import React from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { differenceInCalendarDays } from 'date-fns';
import api from '../lib/api';
import { useApi } from '../lib/useApi';
import { useMembers } from '../lib/auth';
import { fmtDate, relDay, toDate, personColor } from '../lib/format';
import { Page, Section, IconButton, Button, Sheet, Form, FormGroup, InputRow, Field, Avatar, Check, Empty, Loading, ErrorNote, ActionSheet, useFeedback, useAction, cx } from '../ui';

const INTERVALS = [
    { value: '', label: 'Einmalig' }, { value: '7_days', label: 'Wöchentlich' }, { value: '14_days', label: 'Alle 2 Wochen' },
    { value: '1_month', label: 'Monatlich' }, { value: '2_months', label: 'Alle 2 Monate' }, { value: '3_months', label: 'Vierteljährlich' },
    { value: '6_months', label: 'Halbjährlich' }, { value: '9_months', label: 'Alle 9 Monate' }, { value: '12_months', label: 'Jährlich' },
];

const progress = (p) => {
    const total = p.todos.length + p.milestones.length;
    const done = p.todos.filter(t => t.completed).length + p.milestones.filter(m => m.completed).length;
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
};

const deadlineInfo = (p) => {
    if (!p.deadline) return null;
    const d = differenceInCalendarDays(toDate(p.deadline), new Date());
    return { label: d < 0 ? `${-d} ${d === -1 ? 'Tag' : 'Tage'} überfällig` : d <= 1 ? relDay(p.deadline) : `noch ${d} Tage`, late: d < 0, soon: d >= 0 && d <= 7 };
};

const People = ({ assigned, size = 26 }) => {
    const { byId } = useMembers();
    return (
        <div className="flex -space-x-1.5">
            {assigned.slice(0, 5).map(a => {
                const s = String(a);
                const m = s.startsWith('user:') ? byId[Number(s.slice(5))] : null;
                const name = m ? m.username : s.replace(/^ext:/, '');
                return <Avatar key={s} user={m} name={name} color={m ? undefined : personColor(name)} size={size} className="ring-2 ring-card" />;
            })}
        </div>
    );
};

const ProjectSheet = ({ open, onClose, project, onSaved }) => {
    const { members } = useMembers();
    const [f, setF] = React.useState({});
    const [ext, setExt] = React.useState('');
    const [saving, setSaving] = React.useState(false);
    const act = useAction();
    React.useEffect(() => {
        if (open) setF(project ? { title: project.title, description: project.description || '', deadline: project.deadline || '', recurring_interval: project.recurring_interval || '', assigned_to: project.assigned_to.map(String) } : { title: '', description: '', deadline: '', recurring_interval: '', assigned_to: [] });
        setExt('');
    }, [open, project]);
    const toggle = (key) => setF(s => ({ ...s, assigned_to: s.assigned_to.includes(key) ? s.assigned_to.filter(x => x !== key) : [...s.assigned_to, key] }));
    const save = async () => {
        if (!f.title?.trim()) return;
        setSaving(true);
        const body = { ...f, recurring_interval: f.recurring_interval || null, deadline: f.deadline || null };
        const r = await act(() => (project ? api.put(`/projects/${project.id}`, body) : api.post('/projects', body)), project ? 'Gespeichert' : 'Projekt angelegt');
        setSaving(false);
        if (r) { onSaved(r.data); onClose(); }
    };
    const externals = (f.assigned_to || []).filter(a => a.startsWith('ext:'));
    return (
        <Sheet open={open} onClose={onClose} title={project ? 'Projekt bearbeiten' : 'Neues Projekt'} onSave={save} saving={saving} saveDisabled={!f.title?.trim()}>
            <Form onSubmit={save} className="space-y-6">
                <FormGroup>
                    <InputRow placeholder="Projektname, z. B. Garage aufräumen" value={f.title || ''} onChange={e => setF(s => ({ ...s, title: e.target.value }))} autoFocus={!project} />
                    <InputRow as="textarea" placeholder="Beschreibung" value={f.description || ''} onChange={e => setF(s => ({ ...s, description: e.target.value }))} />
                </FormGroup>
                <FormGroup footer="Bei wiederkehrenden Projekten wird die Frist beim Abschließen automatisch verschoben.">
                    <InputRow type="date" label="Frist" value={f.deadline || ''} onChange={e => setF(s => ({ ...s, deadline: e.target.value }))} />
                    <InputRow as="select" label="Wiederholen" value={f.recurring_interval || ''} onChange={e => setF(s => ({ ...s, recurring_interval: e.target.value }))}>
                        {INTERVALS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                    </InputRow>
                </FormGroup>
                <FormGroup title="Beteiligt">
                    <div className="no-scrollbar flex gap-3 overflow-x-auto px-3 py-2">
                        {members.map(m => {
                            const key = `user:${m.id}`;
                            const on = (f.assigned_to || []).includes(key);
                            return (
                                <button key={m.id} type="button" onClick={() => toggle(key)} className="press flex w-14 shrink-0 flex-col items-center gap-1">
                                    <span className={cx('rounded-full', on && 'ring-[3px] ring-accent ring-offset-2 ring-offset-bg')}><Avatar user={m} size={46} /></span>
                                    <span className="w-full truncate text-center text-caption">{m.username}</span>
                                </button>
                            );
                        })}
                    </div>
                    {externals.map(e => (
                        <div key={e} className="flex min-h-[44px] items-center gap-3 px-4">
                            <Avatar name={e.slice(4)} color={personColor(e.slice(4))} size={28} />
                            <span className="flex-1">{e.slice(4)}</span>
                            <IconButton icon="ri-close-line" label="Entfernen" variant="plain" onClick={() => toggle(e)} />
                        </div>
                    ))}
                    <div className="flex items-center gap-2 px-4">
                        <input value={ext} onChange={e => setExt(e.target.value)} placeholder="Weitere Person (z. B. Handwerker)" aria-label="Weitere Person" className="min-w-0 flex-1 bg-transparent py-3 text-body outline-none"
                            onKeyDown={e => { if (e.key === 'Enter' && ext.trim()) { e.preventDefault(); toggle(`ext:${ext.trim()}`); setExt(''); } }} />
                        <IconButton icon="ri-add-line" label="Hinzufügen" variant="tinted" disabled={!ext.trim()} onClick={() => { toggle(`ext:${ext.trim()}`); setExt(''); }} />
                    </div>
                </FormGroup>
            </Form>
        </Sheet>
    );
};

const List = () => {
    const { data, loading, error, reload } = useApi('/projects', { initial: [] });
    const [creating, setCreating] = React.useState(false);
    const navigate = useNavigate();
    return (
        <Page title="Projekte" actions={<IconButton icon="ri-add-line" label="Neues Projekt" variant="filled" onClick={() => setCreating(true)} />}>
            {error && <ErrorNote error={error} onRetry={reload} />}
            {loading ? <Loading /> : data.length === 0 ? (
                <Empty icon="ri-folder-chart-line" title="Keine Projekte" text="Renovierung, Umzug, Steuer – plane größere Vorhaben mit Aufgaben und Meilensteinen." action={<Button icon="ri-add-line" onClick={() => setCreating(true)}>Projekt anlegen</Button>} />
            ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                    {data.map(p => {
                        const pr = progress(p);
                        const dl = deadlineInfo(p);
                        return (
                            <Link key={p.id} to={`/projects/${p.id}`} className="press block rounded-card bg-card p-4">
                                <div className="flex items-start gap-3">
                                    <div className="min-w-0 flex-1">
                                        <h2 className="truncate text-headline font-semibold">{p.title}</h2>
                                        <p className={cx('text-footnote', dl?.late ? 'font-medium text-danger' : dl?.soon ? 'font-medium text-warn' : 'text-label2')}>
                                            {[dl ? `${fmtDate(p.deadline)} · ${dl.label}` : 'Keine Frist', p.recurring_interval && '🔁'].filter(Boolean).join(' ')}
                                        </p>
                                    </div>
                                    <People assigned={p.assigned_to} />
                                </div>
                                <div className="mt-4 flex items-center gap-3">
                                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-fill/15"><div className="h-full rounded-full bg-[#007AFF] transition-all" style={{ width: `${pr.pct}%` }} /></div>
                                    <span className="w-16 text-right text-footnote text-label2">{pr.done}/{pr.total}</span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
            <ProjectSheet open={creating} onClose={() => setCreating(false)} onSaved={(p) => { reload(); if (p?.id) navigate(`/projects/${p.id}`); }} />
        </Page>
    );
};

const Detail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { data, setData, loading, error, reload } = useApi('/projects', { initial: [] });
    const p = data.find(x => x.id === id);
    const [todo, setTodo] = React.useState('');
    const [urgent, setUrgent] = React.useState(false);
    const [ms, setMs] = React.useState(null);
    const [edit, setEdit] = React.useState(false);
    const [menu, setMenu] = React.useState(false);
    const { confirm } = useFeedback();
    const act = useAction();

    if (loading) return <Loading />;
    if (error) return <ErrorNote error={error} onRetry={reload} />;
    if (!p) return <Page back="/projects" title="Projekt"><Empty title="Projekt nicht gefunden" /></Page>;

    const patch = (fn) => setData(list => list.map(x => (x.id === p.id ? fn(x) : x)));
    const addTodo = async (e) => {
        e.preventDefault();
        if (!todo.trim()) return;
        const r = await act(() => api.post(`/projects/${p.id}/todos`, { task: todo.trim(), urgency: urgent ? 'urgent' : 'normal' }));
        if (r?.data) { patch(x => ({ ...x, todos: [...x.todos, r.data] })); setTodo(''); setUrgent(false); }
    };
    const toggleTodo = async (t) => {
        patch(x => ({ ...x, todos: x.todos.map(y => (y.id === t.id ? { ...y, completed: y.completed ? 0 : 1 } : y)) }));
        if (!(await act(() => api.put(`/projects/${p.id}/todos/${t.id}`, { completed: !t.completed })))) reload();
    };
    const delTodo = async (t) => { patch(x => ({ ...x, todos: x.todos.filter(y => y.id !== t.id) })); await act(() => api.delete(`/projects/${p.id}/todos/${t.id}`)); };
    const toggleMs = async (m) => {
        patch(x => ({ ...x, milestones: x.milestones.map(y => (y.id === m.id ? { ...y, completed: y.completed ? 0 : 1 } : y)) }));
        if (!(await act(() => api.put(`/projects/${p.id}/milestones/${m.id}`, { completed: !m.completed })))) reload();
    };
    const saveMs = async () => {
        if (!ms.title.trim()) return;
        const ok = await act(() => (ms.id ? api.put(`/projects/${p.id}/milestones/${ms.id}`, { title: ms.title, due_date: ms.due_date || null }) : api.post(`/projects/${p.id}/milestones`, { title: ms.title, due_date: ms.due_date || null })), 'Meilenstein gespeichert');
        if (ok) { setMs(null); reload(); }
    };
    const delMs = async () => {
        if (await act(() => api.delete(`/projects/${p.id}/milestones/${ms.id}`), 'Meilenstein gelöscht')) { setMs(null); reload(); }
    };
    const complete = async () => {
        if (!(await confirm({ title: 'Projekt abschließen?', message: p.recurring_interval ? 'Alle Aufgaben werden zurückgesetzt und die Frist wird verschoben.' : 'Alle Aufgaben werden zurückgesetzt.', confirmText: 'Abschließen' }))) return;
        if (await act(() => api.post(`/projects/${p.id}/complete`), 'Projekt abgeschlossen')) reload();
    };
    const remove = async () => {
        if (!(await confirm({ title: `„${p.title}“ löschen?`, confirmText: 'Löschen', destructive: true }))) return;
        if (await act(() => api.delete(`/projects/${p.id}`), 'Projekt gelöscht')) navigate('/projects');
    };

    const pr = progress(p);
    const dl = deadlineInfo(p);
    const todos = [...p.todos].sort((a, b) => a.completed - b.completed || (b.urgency === 'urgent') - (a.urgency === 'urgent'));

    return (
        <Page back="/projects" title={p.title} actions={<IconButton icon="ri-more-fill" label="Optionen" variant="gray" onClick={() => setMenu(true)} />}>
            <section className="mb-6 rounded-card bg-card p-4">
                {p.description && <p className="mb-3 whitespace-pre-wrap text-body text-label2">{p.description}</p>}
                <div className="flex items-center gap-3">
                    <div className="relative h-14 w-14 shrink-0">
                        <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90"><circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="4" className="stroke-fill/20" /><circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="4" stroke="#007AFF" strokeLinecap="round" strokeDasharray={`${pr.pct * 0.974} 100`} /></svg>
                        <span className="absolute inset-0 flex items-center justify-center text-footnote font-semibold">{pr.pct}%</span>
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className={cx('text-sub font-medium', dl?.late && 'text-danger')}>{dl ? `${fmtDate(p.deadline)} · ${dl.label}` : 'Keine Frist'}</div>
                        <div className="text-footnote text-label2">{INTERVALS.find(i => i.value === (p.recurring_interval || ''))?.label} · {pr.done} von {pr.total} erledigt</div>
                    </div>
                    <People assigned={p.assigned_to} size={30} />
                </div>
                {pr.total > 0 && pr.done === pr.total && <Button className="mt-4" full icon="ri-check-double-line" onClick={complete}>Projekt abschließen</Button>}
            </section>

            <Section title="Aufgaben">
                <form onSubmit={addTodo} className="flex items-center gap-2 border-b hairline px-4">
                    <i className="ri-add-circle-fill text-xl text-accent"></i>
                    <input value={todo} onChange={e => setTodo(e.target.value)} placeholder="Neue Aufgabe" aria-label="Neue Aufgabe" className="min-w-0 flex-1 bg-transparent py-3 text-body outline-none" />
                    <button type="button" onClick={() => setUrgent(u => !u)} className={cx('press rounded-full px-2.5 py-1 text-caption font-semibold', urgent ? 'bg-danger text-white' : 'bg-fill/12 text-label2')}>Dringend</button>
                </form>
                {todos.map(t => (
                    <div key={t.id} className="group/row flex items-center gap-3 pl-4">
                        <Check checked={!!t.completed} onChange={() => toggleTodo(t)} color="#007AFF" label={t.task} />
                        <div className="flex min-h-[48px] flex-1 items-center gap-2 border-b hairline pr-2 group-last/row:border-b-0">
                            <span className={cx('flex-1 py-3 text-body', t.completed && 'text-label3 line-through')}>{t.task}</span>
                            {t.urgency === 'urgent' && !t.completed && <span className="rounded-full bg-danger/12 px-2 py-0.5 text-caption font-semibold text-danger">Dringend</span>}
                            <IconButton icon="ri-close-line" label="Löschen" variant="plain" className="text-label3" size={32} onClick={() => delTodo(t)} />
                        </div>
                    </div>
                ))}
            </Section>

            <Section title="Meilensteine" action={<button onClick={() => setMs({ title: '', due_date: '' })} className="press text-footnote font-medium text-accent">Hinzufügen</button>}>
                {p.milestones.length === 0 && <p className="px-4 py-3 text-sub text-label2">Noch keine Meilensteine.</p>}
                {p.milestones.map(m => (
                    <div key={m.id} className="group/row flex items-center gap-3 pl-4">
                        <Check checked={!!m.completed} onChange={() => toggleMs(m)} color="#FF9500" label={m.title} />
                        <button onClick={() => setMs({ ...m, due_date: m.due_date || '' })} className="flex min-h-[52px] flex-1 items-center gap-2 border-b hairline pr-4 text-left group-last/row:border-b-0">
                            <span className="min-w-0 flex-1 py-2.5">
                                <span className={cx('block text-body', m.completed && 'text-label3 line-through')}>{m.title}</span>
                                {m.due_date && <span className="block text-footnote text-label2">{fmtDate(m.due_date)}</span>}
                            </span>
                            <i className="ri-arrow-right-s-line text-[22px] text-label3"></i>
                        </button>
                    </div>
                ))}
            </Section>

            <ActionSheet open={menu} onClose={() => setMenu(false)} title={p.title} actions={[
                { label: 'Bearbeiten', icon: 'ri-edit-line', onClick: () => setEdit(true) },
                { label: 'Abschließen & zurücksetzen', icon: 'ri-restart-line', onClick: complete },
                { label: 'Projekt löschen', icon: 'ri-delete-bin-line', destructive: true, onClick: remove },
            ]} />
            <ProjectSheet open={edit} onClose={() => setEdit(false)} project={p} onSaved={reload} />
            <Sheet open={!!ms} onClose={() => setMs(null)} title={ms?.id ? 'Meilenstein' : 'Neuer Meilenstein'} onSave={saveMs} saveDisabled={!ms?.title?.trim()}>
                {ms && (
                    <Form onSubmit={saveMs} className="space-y-4">
                        <Field label="Titel" value={ms.title} onChange={e => setMs(s => ({ ...s, title: e.target.value }))} autoFocus />
                        <Field label="Fällig am" type="date" value={ms.due_date} onChange={e => setMs(s => ({ ...s, due_date: e.target.value }))} />
                        {ms.id && <Button variant="destructive" full onClick={delMs}>Meilenstein löschen</Button>}
                    </Form>
                )}
            </Sheet>
        </Page>
    );
};

export default function Projects() {
    return (
        <Routes>
            <Route index element={<List />} />
            <Route path=":id" element={<Detail />} />
        </Routes>
    );
}
