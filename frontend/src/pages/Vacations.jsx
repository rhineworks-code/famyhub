import React from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { differenceInCalendarDays } from 'date-fns';
import api from '../lib/api';
import { useApi } from '../lib/useApi';
import { fmt, toDate } from '../lib/format';
import { Page, Section, Row, Segmented, IconButton, Button, Sheet, Form, FormGroup, InputRow, Check, Empty, Loading, ErrorNote, ActionSheet, useFeedback, useAction, cx } from '../ui';

const PACK_CATEGORIES = ['Kleidung', 'Hygiene', 'Dokumente', 'Technik', 'Kinder', 'Apotheke', 'Allgemein'];

const range = (v) => {
    if (!v.start_date) return 'Kein Datum';
    const s = fmt(v.start_date, 'd. MMM');
    const e = v.end_date ? fmt(v.end_date, 'd. MMM yyyy') : fmt(v.start_date, 'yyyy');
    return v.end_date ? `${s} – ${e}` : `${fmt(v.start_date, 'd. MMM yyyy')}`;
};

const countdown = (v) => {
    if (!v.start_date) return null;
    const today = new Date(new Date().toDateString());
    const d = differenceInCalendarDays(toDate(v.start_date), today);
    const end = v.end_date ? differenceInCalendarDays(toDate(v.end_date), today) : d;
    if (d > 0) return { label: d === 1 ? 'Morgen' : `in ${d} Tagen`, active: false, big: d };
    if (end >= 0) return { label: 'Jetzt im Urlaub 🌴', active: true };
    return null;
};

const VacationSheet = ({ open, onClose, vacation, onSaved }) => {
    const [f, setF] = React.useState({});
    const [saving, setSaving] = React.useState(false);
    const act = useAction();
    React.useEffect(() => { if (open) setF(vacation ? { ...vacation, start_date: vacation.start_date || '', end_date: vacation.end_date || '' } : { title: '', destination: '', start_date: '', end_date: '' }); }, [open, vacation]);
    const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }));
    const save = async () => {
        if (!f.title?.trim()) return;
        setSaving(true);
        const r = await act(() => (vacation ? api.put(`/vacations/${vacation.id}`, f) : api.post('/vacations', f)), vacation ? 'Gespeichert' : 'Urlaub angelegt');
        setSaving(false);
        if (r) { onSaved(r.data); onClose(); }
    };
    return (
        <Sheet open={open} onClose={onClose} title={vacation ? 'Urlaub bearbeiten' : 'Neuer Urlaub'} onSave={save} saving={saving} saveDisabled={!f.title?.trim()}>
            <Form onSubmit={save} className="space-y-6">
                <FormGroup>
                    <InputRow placeholder="Titel, z. B. Sommerferien" value={f.title || ''} onChange={set('title')} autoFocus={!vacation} />
                    <InputRow placeholder="Reiseziel" value={f.destination || ''} onChange={set('destination')} />
                </FormGroup>
                <FormGroup>
                    <InputRow type="date" label="Von" value={f.start_date || ''} onChange={set('start_date')} />
                    <InputRow type="date" label="Bis" min={f.start_date || undefined} value={f.end_date || ''} onChange={set('end_date')} />
                </FormGroup>
            </Form>
        </Sheet>
    );
};

const DestinationSheet = ({ open, onClose, dest, onSaved }) => {
    const [f, setF] = React.useState({ title: '', notes: '' });
    const { confirm } = useFeedback();
    const act = useAction();
    React.useEffect(() => { if (open) setF(dest ? { title: dest.title, notes: dest.notes || '' } : { title: '', notes: '' }); }, [open, dest]);
    const save = async () => {
        if (!f.title.trim()) return;
        if (await act(() => (dest ? api.put(`/vacations/destinations/${dest.id}`, f) : api.post('/vacations/destinations', f)), 'Gespeichert')) { onSaved(); onClose(); }
    };
    const remove = async () => {
        if (!(await confirm({ title: 'Traumziel löschen?', confirmText: 'Löschen', destructive: true }))) return;
        if (await act(() => api.delete(`/vacations/destinations/${dest.id}`))) { onSaved(); onClose(); }
    };
    return (
        <Sheet open={open} onClose={onClose} title={dest ? 'Traumziel' : 'Neues Traumziel'} onSave={save} saveDisabled={!f.title.trim()}>
            <Form onSubmit={save} className="space-y-6">
                <FormGroup>
                    <InputRow placeholder="Wohin würdest du gern?" value={f.title} onChange={e => setF(s => ({ ...s, title: e.target.value }))} autoFocus={!dest} />
                    <InputRow as="textarea" placeholder="Warum? Ideen, Links …" value={f.notes} onChange={e => setF(s => ({ ...s, notes: e.target.value }))} />
                </FormGroup>
                {dest && <Button variant="destructive" full onClick={remove}>Löschen</Button>}
            </Form>
        </Sheet>
    );
};

const Overview = () => {
    const { data, loading, error, reload } = useApi('/vacations', { initial: [] });
    const { data: dreams, reload: reloadDreams } = useApi('/vacations/destinations', { initial: [] });
    const [tab, setTab] = React.useState('trips');
    const [sheet, setSheet] = React.useState(false);
    const [dream, setDream] = React.useState(null);
    const navigate = useNavigate();

    const today = new Date(new Date().toDateString());
    const upcoming = data.filter(v => !v.start_date || toDate(v.end_date || v.start_date) >= today);
    const past = data.filter(v => !upcoming.includes(v)).reverse();
    const next = upcoming.find(v => v.start_date);
    const cd = next && countdown(next);

    return (
        <Page title="Urlaub" actions={<IconButton icon="ri-add-line" label={tab === 'trips' ? 'Neuer Urlaub' : 'Neues Traumziel'} variant="filled" onClick={() => (tab === 'trips' ? setSheet(true) : setDream({}))} />}>
            <Segmented className="mb-5" value={tab} onChange={setTab} options={[{ value: 'trips', label: 'Reisen' }, { value: 'dreams', label: 'Traumziele' }]} />
            {error && <ErrorNote error={error} onRetry={reload} />}
            {tab === 'dreams' ? (
                dreams.length === 0 ? <Empty icon="ri-earth-line" title="Noch keine Traumziele" text="Sammelt Orte, an die ihr irgendwann mal wollt." /> : (
                    <Section>
                        {dreams.map(d => <Row key={d.id} icon="ri-map-pin-2-fill" color="#30B0C7" title={d.title} subtitle={[d.user_name, d.notes].filter(Boolean).join(' · ')} onClick={() => setDream({ dest: d })} chevron />)}
                    </Section>
                )
            ) : loading ? <Loading /> : data.length === 0 ? (
                <Empty icon="ri-suitcase-3-line" title="Noch kein Urlaub geplant" action={<Button icon="ri-add-line" onClick={() => setSheet(true)}>Urlaub anlegen</Button>} />
            ) : (
                <>
                    {next && cd && (
                        <Link to={`/vacations/${next.id}`} className="press mb-6 block overflow-hidden rounded-sheet bg-gradient-to-br from-[#30B0C7] to-[#2B3E6A] p-5 text-white shadow-pop">
                            <p className="text-footnote font-semibold uppercase tracking-wide opacity-80">{cd.active ? 'Gerade unterwegs' : 'Nächster Urlaub'}</p>
                            <h2 className="mt-1 text-title1 font-bold">{next.title}</h2>
                            <p className="opacity-90">{[next.destination, range(next)].filter(Boolean).join(' · ')}</p>
                            {cd.big ? <p className="mt-4"><span className="text-[44px] font-bold leading-none">{cd.big}</span> <span className="text-sub opacity-85">{cd.big === 1 ? 'Tag' : 'Tage'} noch</span></p> : <p className="mt-4 text-title3 font-semibold">{cd.label}</p>}
                        </Link>
                    )}
                    {upcoming.length > 0 && (
                        <Section title="Geplant">
                            {upcoming.map(v => <Row key={v.id} icon="ri-suitcase-3-fill" color="#30B0C7" title={v.title} subtitle={[v.destination, range(v)].filter(Boolean).join(' · ')} value={countdown(v)?.label} to={`/vacations/${v.id}`} />)}
                        </Section>
                    )}
                    {past.length > 0 && (
                        <Section title="Vergangen">
                            {past.map(v => <Row key={v.id} icon="ri-history-line" color="#8E8E93" title={v.title} subtitle={[v.destination, range(v)].filter(Boolean).join(' · ')} to={`/vacations/${v.id}`} />)}
                        </Section>
                    )}
                </>
            )}
            <VacationSheet open={sheet} onClose={() => setSheet(false)} onSaved={(v) => { reload(); if (v?.id) navigate(`/vacations/${v.id}`); }} />
            <DestinationSheet open={!!dream} onClose={() => setDream(null)} dest={dream?.dest} onSaved={reloadDreams} />
        </Page>
    );
};

const Trip = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { data: all, reload: reloadAll } = useApi('/vacations', { initial: [] });
    const vacation = all.find(v => v.id === id);
    const { data: items, setData, loading, reload } = useApi(`/vacations/${id}/items`, { initial: [] });
    const [text, setText] = React.useState('');
    const [cat, setCat] = React.useState('Kleidung');
    const [edit, setEdit] = React.useState(false);
    const [menu, setMenu] = React.useState(false);
    const [hidePacked, setHidePacked] = React.useState(false);
    const { confirm } = useFeedback();
    const act = useAction();

    const add = async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        const r = await act(() => api.post(`/vacations/${id}/items`, { title: text.trim(), category: cat }));
        if (r?.data) { setData(list => [r.data, ...list]); setText(''); }
    };
    const toggle = async (i) => {
        setData(list => list.map(x => (x.id === i.id ? { ...x, is_packed: x.is_packed ? 0 : 1 } : x)));
        if (!(await act(() => api.put(`/vacations/${id}/items/${i.id}/toggle`)))) reload();
    };
    const remove = async (i) => { setData(list => list.filter(x => x.id !== i.id)); await act(() => api.delete(`/vacations/${id}/items/${i.id}`)); };
    const removeTrip = async () => {
        if (!(await confirm({ title: 'Urlaub löschen?', message: 'Die Packliste wird ebenfalls gelöscht.', confirmText: 'Löschen', destructive: true }))) return;
        if (await act(() => api.delete(`/vacations/${id}`), 'Gelöscht')) navigate('/vacations');
    };

    const packed = items.filter(i => i.is_packed).length;
    const cats = [...new Set([...PACK_CATEGORIES, ...items.map(i => i.category)])].filter(c => items.some(i => i.category === c && (!hidePacked || !i.is_packed)));
    const cd = vacation && countdown(vacation);

    return (
        <Page back="/vacations" title={vacation?.title || 'Urlaub'} subtitle={vacation ? [vacation.destination, range(vacation)].filter(Boolean).join(' · ') : ''}
            actions={<IconButton icon="ri-more-fill" label="Optionen" variant="gray" onClick={() => setMenu(true)} />}>
            {cd && <p className="-mt-3 mb-5 px-1 text-sub font-medium text-accent">{cd.label}</p>}
            <section className="mb-5 rounded-card bg-card p-4">
                <div className="flex items-baseline justify-between">
                    <span className="text-headline font-semibold">Packliste</span>
                    <span className="text-sub text-label2">{packed} von {items.length} gepackt</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-fill/15"><div className="h-full rounded-full bg-ok transition-all" style={{ width: `${items.length ? (packed / items.length) * 100 : 0}%` }} /></div>
            </section>
            <form onSubmit={add} className="mb-6 rounded-card bg-card p-2">
                <div className="flex items-center gap-2">
                    <input value={text} onChange={e => setText(e.target.value)} placeholder="Was muss mit?" aria-label="Neuer Eintrag" className="min-w-0 flex-1 bg-transparent px-2 py-2 text-body outline-none" />
                    <IconButton type="submit" icon="ri-arrow-up-line" label="Hinzufügen" variant="filled" disabled={!text.trim()} />
                </div>
                <div className="no-scrollbar mt-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                    {PACK_CATEGORIES.map(c => <button key={c} type="button" onClick={() => setCat(c)} className={cx('press shrink-0 rounded-full px-2.5 py-1 text-footnote font-medium', cat === c ? 'bg-tint text-white' : 'bg-fill/12 text-label2')}>{c}</button>)}
                </div>
            </form>
            {loading ? <Loading /> : items.length === 0 ? <Empty icon="ri-luggage-cart-line" title="Packliste ist leer" /> : (
                <>
                    <div className="mb-3 flex justify-end"><button onClick={() => setHidePacked(h => !h)} className="press text-footnote font-medium text-accent">{hidePacked ? 'Gepacktes anzeigen' : 'Gepacktes ausblenden'}</button></div>
                    {cats.map(c => (
                        <Section key={c} title={c}>
                            {items.filter(i => i.category === c && (!hidePacked || !i.is_packed)).map(i => (
                                <div key={i.id} className="group/row flex items-center gap-3 pl-4">
                                    <Check checked={!!i.is_packed} onChange={() => toggle(i)} color="#34C759" label={i.title} />
                                    <div className="flex min-h-[48px] flex-1 items-center border-b hairline pr-2 group-last/row:border-b-0">
                                        <button onClick={() => toggle(i)} className={cx('flex-1 py-3 text-left text-body', i.is_packed && 'text-label3 line-through')}>{i.title}</button>
                                        <IconButton icon="ri-close-line" label="Entfernen" variant="plain" className="text-label3" size={32} onClick={() => remove(i)} />
                                    </div>
                                </div>
                            ))}
                        </Section>
                    ))}
                </>
            )}
            <ActionSheet open={menu} onClose={() => setMenu(false)} actions={[
                { label: 'Bearbeiten', icon: 'ri-edit-line', onClick: () => setEdit(true) },
                { label: 'Urlaub löschen', icon: 'ri-delete-bin-line', destructive: true, onClick: removeTrip },
            ]} />
            <VacationSheet open={edit} onClose={() => setEdit(false)} vacation={vacation} onSaved={reloadAll} />
        </Page>
    );
};

export default function Vacations() {
    return (
        <Routes>
            <Route index element={<Overview />} />
            <Route path=":id" element={<Trip />} />
        </Routes>
    );
}
