import React from 'react';
import api from '../lib/api';
import { useApi } from '../lib/useApi';
import { useAuth, useMembers } from '../lib/auth';
import { ago, relDay, toDate } from '../lib/format';
import { Page, Section, Row, Segmented, IconButton, Button, Sheet, Form, FormGroup, InputRow, ToggleRow, MemberPicker, Avatar, Check, Empty, Loading, ErrorNote, useFeedback, useAction, cx } from '../ui';

const INTERVALS = [
    { value: 'daily', label: 'Täglich' }, { value: '3d', label: 'Alle 3 Tage' }, { value: 'weekly', label: 'Wöchentlich' },
    { value: 'biweekly', label: 'Alle 2 Wochen' }, { value: 'monthly', label: 'Monatlich' }, { value: '3m', label: 'Alle 3 Monate' },
    { value: '6m', label: 'Halbjährlich' }, { value: 'yearly', label: 'Jährlich' },
];
const intervalLabel = (v) => INTERVALS.find(i => i.value === v)?.label || 'Täglich';

const ChoreSheet = ({ open, onClose, chore, onSaved }) => {
    const { members } = useMembers();
    const [f, setF] = React.useState({});
    const [saving, setSaving] = React.useState(false);
    const { confirm } = useFeedback();
    const act = useAction();
    React.useEffect(() => {
        if (open) setF(chore ? { ...chore, is_recurring: !!chore.is_recurring, due_date: chore.due_date || '' } : { title: '', description: '', points: 10, assigned_to: null, due_date: '', is_recurring: false, recurring_interval: 'weekly' });
    }, [open, chore]);
    const set = (k) => (v) => setF(s => ({ ...s, [k]: v?.target ? v.target.value : v }));

    const save = async () => {
        if (!f.title?.trim()) return;
        setSaving(true);
        const body = { ...f, points: Number(f.points) || 0, due_date: f.is_recurring ? null : f.due_date || null };
        const ok = await act(() => (chore ? api.put(`/chores/${chore.id}`, body) : api.post('/chores', body)), chore ? 'Aufgabe gespeichert' : 'Aufgabe erstellt');
        setSaving(false);
        if (ok) { onSaved(); onClose(); }
    };
    const remove = async () => {
        if (!(await confirm({ title: 'Aufgabe löschen?', confirmText: 'Löschen', destructive: true }))) return;
        if (await act(() => api.delete(`/chores/${chore.id}`), 'Gelöscht')) { onSaved(); onClose(); }
    };

    return (
        <Sheet open={open} onClose={onClose} title={chore ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'} onSave={save} saving={saving} saveDisabled={!f.title?.trim()}>
            <Form onSubmit={save} className="space-y-6">
                <FormGroup>
                    <InputRow placeholder="Was ist zu tun?" value={f.title || ''} onChange={set('title')} autoFocus={!chore} />
                    <InputRow as="textarea" placeholder="Beschreibung (optional)" value={f.description || ''} onChange={set('description')} />
                </FormGroup>
                <FormGroup>
                    <InputRow type="number" min="0" inputMode="numeric" label="Punkte" value={f.points ?? ''} onChange={set('points')} />
                    <ToggleRow label="Wiederkehrend" checked={!!f.is_recurring} onChange={set('is_recurring')} />
                    {f.is_recurring
                        ? <InputRow as="select" label="Intervall" value={f.recurring_interval} onChange={set('recurring_interval')}>{INTERVALS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}</InputRow>
                        : <InputRow type="date" label="Fällig am" value={f.due_date || ''} onChange={set('due_date')} />}
                </FormGroup>
                <FormGroup title="Zuständig">
                    <div className="px-3 py-2"><MemberPicker members={members} value={f.assigned_to} onChange={set('assigned_to')} allowNone noneLabel="Jeder" /></div>
                </FormGroup>
                {chore && <Button variant="destructive" full onClick={remove}>Aufgabe löschen</Button>}
            </Form>
        </Sheet>
    );
};

export default function Chores() {
    const { user, isAdmin } = useAuth();
    const { byId } = useMembers();
    const { data, loading, error, reload } = useApi('/chores', { initial: { chores: [], leaderboard: [], history: [] } });
    const [tab, setTab] = React.useState('open');
    const [filter, setFilter] = React.useState(isAdmin ? 'all' : 'mine');
    const [editing, setEditing] = React.useState(null);
    const act = useAction();

    const chores = data.chores.filter(c => filter === 'all' || !c.assigned_to || c.assigned_to === user.id);
    const open = chores.filter(c => !c.completed_today);
    const done = chores.filter(c => c.completed_today);

    const complete = async (c) => { if (await act(() => api.put(`/chores/${c.id}/complete`), c.points ? `Super! +${c.points} Punkte` : 'Erledigt')) reload(); };
    const reopen = async (c) => { if (!c.is_recurring && isAdmin && await act(() => api.put(`/chores/${c.id}/reopen`), 'Wieder offen')) reload(); };

    const ChoreRow = ({ c }) => {
        const person = c.assigned_to ? byId[c.assigned_to] : null;
        const overdue = !c.is_recurring && c.due_date && !c.completed_today && toDate(c.due_date) < new Date(new Date().toDateString());
        const mayComplete = !c.assigned_to || c.assigned_to === user.id || isAdmin;
        return (
            <Row onClick={isAdmin ? () => setEditing(c) : undefined}
                leading={<Check checked={!!c.completed_today} color="#5856D6" label={c.title} onChange={() => (c.completed_today ? reopen(c) : mayComplete && complete(c))} />}
                title={<span className={cx(c.completed_today && 'text-label3 line-through')}>{c.title}</span>}
                subtitle={<span className={cx(overdue && 'text-danger')}>
                    {[c.is_recurring ? `🔁 ${intervalLabel(c.recurring_interval)}` : c.due_date ? `Fällig ${relDay(c.due_date)}` : null, c.description].filter(Boolean).join(' · ') || 'Einmalig'}
                </span>}
                right={<div className="flex items-center gap-2">
                    {c.points > 0 && <span className="rounded-full bg-warn/15 px-2 py-0.5 text-footnote font-semibold text-warn">{c.points}</span>}
                    {person && <Avatar user={person} size={26} />}
                </div>}
            />
        );
    };

    const maxPoints = Math.max(1, ...data.leaderboard.map(l => l.points_balance || 0));

    return (
        <Page title="Aufgaben" actions={isAdmin && <IconButton icon="ri-add-line" label="Neue Aufgabe" variant="filled" onClick={() => setEditing('new')} />}>
            <Segmented className="mb-5" value={tab} onChange={setTab} options={[{ value: 'open', label: `Offen${open.length ? ` (${open.length})` : ''}` }, { value: 'done', label: 'Erledigt' }, { value: 'board', label: 'Rangliste' }]} />
            {error && <ErrorNote error={error} onRetry={reload} />}
            {loading ? <Loading /> : tab === 'board' ? (
                <>
                    <Section title="Punktestand">
                        {data.leaderboard.length === 0 && <p className="px-4 py-3 text-sub text-label2">Noch keine Kinder in der Familie.</p>}
                        {data.leaderboard.map((l, i) => (
                            <div key={l.id} className="flex items-center gap-3 border-b hairline px-4 py-3 last:border-b-0">
                                <span className="w-6 text-center text-title3">{['🥇', '🥈', '🥉'][i] || i + 1}</span>
                                <Avatar user={byId[l.id] || l} size={38} />
                                <div className="min-w-0 flex-1">
                                    <div className="flex justify-between"><span className="font-semibold">{l.username}</span><span className="font-semibold text-warn">{l.points_balance || 0} P</span></div>
                                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-fill/15"><div className="h-full rounded-full bg-warn" style={{ width: `${((l.points_balance || 0) / maxPoints) * 100}%` }} /></div>
                                </div>
                            </div>
                        ))}
                    </Section>
                    <Section title="Zuletzt erledigt">
                        {data.history.length === 0 && <p className="px-4 py-3 text-sub text-label2">Noch nichts erledigt.</p>}
                        {data.history.map(h => (
                            <Row key={h.id} leading={<Avatar user={byId[h.user_id] || { id: h.user_id, username: h.completed_by_name }} size={30} />}
                                title={h.title} subtitle={`${h.completed_by_name} · ${ago(h.completed_at)}`}
                                right={h.points_earned > 0 && <span className="text-footnote font-semibold text-warn">+{h.points_earned}</span>} />
                        ))}
                    </Section>
                </>
            ) : (
                <>
                    {isAdmin && (
                        <div className="mb-4 flex justify-end">
                            <Segmented className="w-56" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Alle' }, { value: 'mine', label: 'Meine' }]} />
                        </div>
                    )}
                    {(tab === 'open' ? open : done).length === 0 ? (
                        tab === 'open'
                            ? <Empty icon="ri-checkbox-circle-line" title="Alles erledigt!" text={isAdmin ? 'Lege neue Aufgaben mit + an.' : 'Gerade gibt es nichts zu tun.'} />
                            : <Empty icon="ri-time-line" title="Noch nichts erledigt" />
                    ) : (
                        <Section footer={tab === 'done' ? 'Wiederkehrende Aufgaben erscheinen im nächsten Intervall wieder unter „Offen“.' : undefined}>
                            {(tab === 'open' ? open : done).map(c => <ChoreRow key={c.id} c={c} />)}
                        </Section>
                    )}
                </>
            )}
            {isAdmin && <ChoreSheet open={!!editing} onClose={() => setEditing(null)} chore={editing === 'new' ? null : editing} onSaved={reload} />}
        </Page>
    );
}
