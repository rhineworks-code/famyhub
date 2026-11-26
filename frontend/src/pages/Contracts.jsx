import React from 'react';
import { addMonths, differenceInCalendarDays } from 'date-fns';
import api from '../lib/api';
import { useApi } from '../lib/useApi';
import { useAuth, useMembers } from '../lib/auth';
import { euro, fmtDate, toDate } from '../lib/format';
import { Page, Section, Row, Segmented, IconButton, Button, Sheet, Form, FormGroup, InputRow, ToggleRow, Avatar, Empty, Loading, ErrorNote, useFeedback, useAction, cx } from '../ui';

const DEFAULT_TYPES = ['Internet', 'Mobilfunk', 'Versicherung', 'Streaming', 'Strom/Gas', 'Fitnessstudio', 'Sonstiges'];
const DEFAULT_PREDICTED = ['Einkauf', 'Vergnügen', 'Haushalt', 'Auto', 'Kleidung', 'Geschenke', 'Sonstiges'];
const INTERVALS = [{ v: 1, l: 'Monatlich' }, { v: 2, l: 'Alle 2 Monate' }, { v: 3, l: 'Vierteljährlich' }, { v: 6, l: 'Halbjährlich' }, { v: 12, l: 'Jährlich' }];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

const monthly = (c, amount = c.cost) => (Number(amount) || 0) / (Number(c.billing_interval) || 1);

/** Latest date a notice must be given (end date minus notice period). */
const noticeInfo = (c) => {
    if (!c.end_date) return null;
    const deadline = addMonths(toDate(c.end_date), -(Number(c.notice_period_months) || 0));
    const days = differenceInCalendarDays(deadline, new Date());
    if (differenceInCalendarDays(toDate(c.end_date), new Date()) < 0) return { label: `Abgelaufen am ${fmtDate(c.end_date)}`, tone: 'muted' };
    if (days < 0) return { label: `Kündigungsfrist verpasst · läuft bis ${fmtDate(c.end_date)}`, tone: 'muted' };
    return { label: `Kündbar bis ${fmtDate(deadline)}${days <= 60 ? ` (noch ${days} Tage)` : ''}`, tone: days <= 30 ? 'danger' : days <= 60 ? 'warn' : 'normal' };
};

const ContractSheet = ({ open, onClose, contract, categories, onSaved }) => {
    const { members } = useMembers();
    const [f, setF] = React.useState({});
    const [saving, setSaving] = React.useState(false);
    const { confirm } = useFeedback();
    const act = useAction();
    React.useEffect(() => {
        if (!open) return;
        setF(contract
            ? { ...contract, start_date: contract.start_date || '', end_date: contract.end_date || '', notes: contract.notes || '', billing_day: contract.billing_day ?? '', cost: contract.cost ?? '', notice_period_months: contract.notice_period_months ?? 0, is_shared: !!contract.is_shared, is_predicted: !!contract.is_predicted, split_shares: contract.split_shares || [] }
            : { provider: '', type: '', start_date: '', end_date: '', notice_period_months: 0, cost: '', billing_interval: 1, billing_day: '', billing_start_month: null, is_shared: false, is_predicted: false, notes: '', split_shares: [] });
    }, [open, contract]);
    const set = (k) => (v) => setF(s => ({ ...s, [k]: v?.target ? v.target.value : v }));

    const typeOptions = [...new Set([...(f.is_predicted ? DEFAULT_PREDICTED : DEFAULT_TYPES), ...categories.filter(c => !!c.is_predicted === !!f.is_predicted).map(c => c.name), f.type].filter(Boolean))];
    const shareOf = (id) => f.split_shares?.find(s => Number(s.user_id) === id)?.amount ?? '';
    const setShare = (id, amount) => setF(s => ({ ...s, split_shares: [...(s.split_shares || []).filter(x => Number(x.user_id) !== id), ...(amount === '' ? [] : [{ user_id: id, amount }])] }));
    const splitSum = (f.split_shares || []).reduce((n, s) => n + (Number(String(s.amount).replace(',', '.')) || 0), 0);
    const cost = Number(String(f.cost).replace(',', '.')) || 0;

    const save = async () => {
        if (!f.provider?.trim() || !f.type?.trim()) return;
        if (f.is_shared && splitSum > cost + 0.001) return act(() => Promise.reject(new Error('Die Aufteilung ist höher als der Betrag.')));
        setSaving(true);
        const body = {
            ...f, cost, billing_day: f.billing_day === '' ? null : Number(f.billing_day), notice_period_months: Number(f.notice_period_months) || 0,
            split_shares: f.is_shared ? (f.split_shares || []).map(s => ({ user_id: Number(s.user_id), amount: Number(String(s.amount).replace(',', '.')) || 0 })).filter(s => s.amount > 0) : [],
        };
        const ok = await act(() => (contract ? api.put(`/contracts/${contract.id}`, body) : api.post('/contracts', body)), contract ? 'Gespeichert' : 'Angelegt');
        setSaving(false);
        if (ok) { onSaved(); onClose(); }
    };
    const remove = async () => {
        if (!(await confirm({ title: `„${contract.provider}“ löschen?`, confirmText: 'Löschen', destructive: true }))) return;
        if (await act(() => api.delete(`/contracts/${contract.id}`), 'Gelöscht')) { onSaved(); onClose(); }
    };

    return (
        <Sheet open={open} onClose={onClose} title={contract ? 'Bearbeiten' : f.is_predicted ? 'Neue geplante Ausgabe' : 'Neuer Vertrag'} onSave={save} saving={saving} saveDisabled={!f.provider?.trim() || !f.type?.trim()} size="lg">
            <Form onSubmit={save} className="space-y-6">
                <Segmented value={f.is_predicted ? 'p' : 'c'} onChange={v => setF(s => ({ ...s, is_predicted: v === 'p', type: '' }))} options={[{ value: 'c', label: 'Fester Vertrag' }, { value: 'p', label: 'Geplante Ausgabe' }]} />
                <FormGroup>
                    <InputRow placeholder={f.is_predicted ? 'Bezeichnung, z. B. Wocheneinkauf' : 'Anbieter, z. B. Telekom'} value={f.provider || ''} onChange={set('provider')} autoFocus={!contract} />
                    <InputRow as="select" label="Kategorie" value={f.type || ''} onChange={set('type')}>
                        <option value="" disabled>Wählen …</option>
                        {typeOptions.map(t => <option key={t}>{t}</option>)}
                    </InputRow>
                </FormGroup>
                <FormGroup>
                    <InputRow label="Betrag (€)" inputMode="decimal" placeholder="0,00" value={f.cost ?? ''} onChange={set('cost')} />
                    <InputRow as="select" label="Zahlweise" value={f.billing_interval || 1} onChange={e => setF(s => ({ ...s, billing_interval: Number(e.target.value) }))}>
                        {INTERVALS.map(i => <option key={i.v} value={i.v}>{i.l}</option>)}
                    </InputRow>
                    {Number(f.billing_interval) > 1 && (
                        <InputRow as="select" label="Erste Zahlung" value={f.billing_start_month || ''} onChange={e => setF(s => ({ ...s, billing_start_month: e.target.value ? Number(e.target.value) : null }))}>
                            <option value="">—</option>
                            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                        </InputRow>
                    )}
                    <InputRow label="Abbuchung am" type="number" min="1" max="31" placeholder="Tag" value={f.billing_day ?? ''} onChange={set('billing_day')} />
                </FormGroup>
                {!f.is_predicted && (
                    <FormGroup>
                        <InputRow type="date" label="Beginn" value={f.start_date || ''} onChange={set('start_date')} />
                        <InputRow type="date" label="Laufzeit bis" value={f.end_date || ''} onChange={set('end_date')} />
                        <InputRow type="number" min="0" label="Kündigung (Monate)" value={f.notice_period_months ?? 0} onChange={set('notice_period_months')} />
                    </FormGroup>
                )}
                <FormGroup footer={f.is_shared ? `Aufgeteilt: ${euro(splitSum)} von ${euro(cost)}${splitSum < cost ? ` · Rest ${euro(cost - splitSum)} gemeinsam` : ''}` : undefined}>
                    <ToggleRow label="Gemeinsame Kosten" subtitle="Für die ganze Familie" checked={!!f.is_shared} onChange={set('is_shared')} />
                    {f.is_shared && members.map(m => (
                        <div key={m.id} className="flex min-h-[46px] items-center gap-3 px-4">
                            <Avatar user={m} size={28} />
                            <span className="flex-1">{m.username}</span>
                            <input inputMode="decimal" placeholder="0,00 €" value={shareOf(m.id)} onChange={e => setShare(m.id, e.target.value)} aria-label={`Anteil ${m.username}`} className="w-24 bg-transparent text-right text-body outline-none" />
                        </div>
                    ))}
                </FormGroup>
                <FormGroup><InputRow as="textarea" placeholder="Notizen, Kundennummer …" value={f.notes || ''} onChange={set('notes')} /></FormGroup>
                {contract && <Button variant="destructive" full onClick={remove}>Löschen</Button>}
            </Form>
        </Sheet>
    );
};

const CategorySheet = ({ open, onClose, categories, onChanged }) => {
    const [name, setName] = React.useState('');
    const [predicted, setPredicted] = React.useState(false);
    const act = useAction();
    const add = async () => { if (name.trim() && await act(() => api.post('/contracts/categories', { name: name.trim(), is_predicted: predicted }), 'Kategorie angelegt')) { setName(''); onChanged(); } };
    const remove = async (c) => { if (await act(() => api.delete(`/contracts/categories/${c.id}`))) onChanged(); };
    return (
        <Sheet open={open} onClose={onClose} title="Eigene Kategorien">
            <div className="space-y-6">
                <Segmented value={predicted ? 'p' : 'c'} onChange={v => setPredicted(v === 'p')} options={[{ value: 'c', label: 'Verträge' }, { value: 'p', label: 'Geplante Ausgaben' }]} />
                <FormGroup>
                    {categories.filter(c => !!c.is_predicted === predicted).map(c => (
                        <div key={c.id} className="flex min-h-[46px] items-center px-4">
                            <span className="flex-1">{c.name}</span>
                            <IconButton icon="ri-delete-bin-line" label="Löschen" variant="plain" className="text-danger" onClick={() => remove(c)} />
                        </div>
                    ))}
                    <form onSubmit={e => { e.preventDefault(); add(); }} className="flex items-center gap-2 px-4">
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="Neue Kategorie" aria-label="Neue Kategorie" className="min-w-0 flex-1 bg-transparent py-3 text-body outline-none" />
                        <IconButton type="submit" icon="ri-add-line" label="Hinzufügen" variant="tinted" disabled={!name.trim()} />
                    </form>
                </FormGroup>
            </div>
        </Sheet>
    );
};

export default function Contracts() {
    const { user } = useAuth();
    const { members } = useMembers();
    const { data, loading, error, reload } = useApi('/contracts', { initial: [] });
    const { data: categories, reload: reloadCats } = useApi('/contracts/categories', { initial: [] });
    const [filter, setFilter] = React.useState('all');
    const [editing, setEditing] = React.useState(null);
    const [cats, setCats] = React.useState(false);

    const myShare = (c) => c.split_shares?.find(s => Number(s.user_id) === user.id);
    const visible = data.filter(c => {
        if (filter === 'shared') return c.is_shared;
        if (filter === 'mine') return (!c.is_shared && c.user_id === user.id) || (c.is_shared && myShare(c));
        return true;
    });
    const total = visible.reduce((n, c) => n + (filter === 'mine' && c.is_shared ? monthly(c, myShare(c)?.amount) : monthly(c)), 0);

    const burden = React.useMemo(() => {
        const acc = {};
        for (const c of data) {
            if (c.is_shared && c.split_shares?.length) {
                let rest = Number(c.cost) || 0;
                for (const s of c.split_shares) {
                    const name = members.find(m => m.id === Number(s.user_id))?.username || 'Unbekannt';
                    acc[name] = (acc[name] || 0) + monthly(c, s.amount);
                    rest -= Number(s.amount) || 0;
                }
                if (rest > 0.001) acc.Gemeinsam = (acc.Gemeinsam || 0) + monthly(c, rest);
            } else if (c.is_shared) acc.Gemeinsam = (acc.Gemeinsam || 0) + monthly(c);
            else acc[c.user_name || 'Unbekannt'] = (acc[c.user_name || 'Unbekannt'] || 0) + monthly(c);
        }
        return Object.entries(acc).sort((a, b) => b[1] - a[1]);
    }, [data, members]);
    const max = Math.max(1, ...burden.map(b => b[1]));

    const fixed = visible.filter(c => !c.is_predicted);
    const planned = visible.filter(c => c.is_predicted);
    const groups = (list) => [...new Set(list.map(c => c.type))].map(t => ({ t, items: list.filter(c => c.type === t) }));

    const ContractRow = ({ c }) => {
        const n = noticeInfo(c);
        const share = filter === 'mine' && c.is_shared ? myShare(c)?.amount : null;
        return (
            <Row onClick={() => setEditing(c)} chevron
                title={<span className="flex items-center gap-1.5">{c.provider}{c.is_shared ? <i className="ri-group-line text-footnote text-label3" title="Gemeinsam"></i> : null}</span>}
                subtitle={<span className={cx(n?.tone === 'danger' && 'text-danger', n?.tone === 'warn' && 'text-warn')}>
                    {[INTERVALS.find(i => i.v === Number(c.billing_interval))?.l, c.billing_day ? `am ${c.billing_day}.` : null, n?.label, !c.is_shared && c.user_name].filter(Boolean).join(' · ')}
                </span>}
                right={<div className="text-right">
                    <div className="font-semibold tabular-nums">{euro(share ?? c.cost)}</div>
                    {Number(c.billing_interval) > 1 && <div className="text-caption text-label2">{euro(monthly(c, share ?? c.cost))}/Monat</div>}
                </div>} />
        );
    };

    return (
        <Page title="Verträge" actions={<>
            <IconButton icon="ri-price-tag-3-line" label="Kategorien" variant="gray" onClick={() => setCats(true)} />
            <IconButton icon="ri-add-line" label="Neu" variant="filled" onClick={() => setEditing('new')} />
        </>}>
            <section className="mb-5 rounded-card bg-card p-4">
                <div className="flex items-baseline justify-between">
                    <span className="text-footnote font-semibold uppercase tracking-wide text-label2">Pro Monat</span>
                    <span className="text-title1 font-bold tabular-nums">{euro(total)}</span>
                </div>
                {filter === 'all' && burden.length > 0 && (
                    <div className="mt-3 space-y-2">
                        {burden.map(([name, v]) => (
                            <div key={name} className="flex items-center gap-3 text-footnote">
                                <span className="w-20 truncate">{name}</span>
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-fill/15"><div className={cx('h-full rounded-full', name === 'Gemeinsam' ? 'bg-sky' : 'bg-tint')} style={{ width: `${(v / max) * 100}%` }} /></div>
                                <span className="w-20 text-right tabular-nums text-label2">{euro(v)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </section>
            <Segmented className="mb-5" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Alle' }, { value: 'mine', label: 'Meine' }, { value: 'shared', label: 'Gemeinsam' }]} />
            {error && <ErrorNote error={error} onRetry={reload} />}
            {loading ? <Loading /> : visible.length === 0 ? (
                <Empty icon="ri-file-shield-2-line" title="Keine Einträge" text="Behalte Verträge, Kündigungsfristen und laufende Kosten im Blick." />
            ) : (
                <>
                    {groups(fixed).map(g => <Section key={g.t} title={g.t}>{g.items.map(c => <ContractRow key={c.id} c={c} />)}</Section>)}
                    {planned.length > 0 && <h2 className="mb-2 mt-8 px-1 text-title3 font-bold">Geplante Ausgaben</h2>}
                    {groups(planned).map(g => <Section key={`p-${g.t}`} title={g.t}>{g.items.map(c => <ContractRow key={c.id} c={c} />)}</Section>)}
                </>
            )}
            <ContractSheet open={!!editing} onClose={() => setEditing(null)} contract={editing === 'new' ? null : editing} categories={categories} onSaved={reload} />
            <CategorySheet open={cats} onClose={() => setCats(false)} categories={categories} onChanged={reloadCats} />
        </Page>
    );
}
