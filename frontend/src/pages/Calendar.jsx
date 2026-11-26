import React from 'react';
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import { de } from 'date-fns/locale';
import api from '../lib/api';
import { useApi } from '../lib/useApi';
import { useMembers } from '../lib/auth';
import { COLORS, fmt, fmtTime, relDay, toDate, ymd, personColor } from '../lib/format';
import {
    Page, Section, Row, Button, IconButton, Segmented, Sheet, Form, FormGroup, InputRow, ToggleRow, ColorPicker,
    MemberPicker, Empty, Loading, ErrorNote, Avatar, useFeedback, useAction, cx,
} from '../ui';

const RECURRENCE = [
    { value: 'none', label: 'Nie' }, { value: 'weekly', label: 'Jede Woche' },
    { value: 'monthly', label: 'Jeden Monat' }, { value: 'yearly', label: 'Jedes Jahr' },
];

export const eventColor = (e) => e.color || (e.user_id ? personColor(e.user_id) : '#2B3E6A');

const eventsOn = (events, day) => events
    .filter(e => {
        const s = startOfDay(toDate(e.start));
        const end = e.end ? startOfDay(toDate(e.end)) : s;
        const d = startOfDay(day);
        return d >= s && d <= end;
    })
    .sort((a, b) => (b.allDay ? 1 : 0) - (a.allDay ? 1 : 0) || toDate(a.start) - toDate(b.start));

const timeLabel = (e) => {
    if (e.event_type === 'birthday') return 'Geburtstag';
    if (e.allDay) return 'ganztägig';
    return e.end ? `${fmtTime(e.start)} – ${fmtTime(e.end)}` : fmtTime(e.start);
};

export const EventRow = ({ e, onClick, showDay }) => {
    const { byId } = useMembers();
    const person = e.user_id ? byId[e.user_id] : null;
    return (
        <Row onClick={onClick}
            leading={<span className="h-9 w-[5px] shrink-0 rounded-full" style={{ backgroundColor: eventColor(e) }} />}
            title={<>{e.event_type === 'birthday' && '🎂 '}{e.title}</>}
            subtitle={[showDay ? relDay(e.start) : null, timeLabel(e), e.location, e.external_name].filter(Boolean).join(' · ')}
            right={person && <Avatar user={person} size={26} />}
        />
    );
};

const MonthGrid = ({ month, events, selected, onSelect }) => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    const days = [];
    for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
    const today = new Date();
    return (
        <div className="rounded-card bg-card p-2 pb-3">
            <div className="grid grid-cols-7 pb-1 text-center text-caption font-semibold uppercase text-label3">
                {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => <span key={d} className="py-1">{d}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
                {days.map(d => {
                    const list = eventsOn(events, d);
                    const isSel = isSameDay(d, selected);
                    const isToday = isSameDay(d, today);
                    return (
                        <button key={d.toISOString()} type="button" onClick={() => onSelect(d)} aria-label={fmt(d, 'EEEE, d. MMMM')}
                            className={cx('press flex flex-col items-center gap-1 py-1', !isSameMonth(d, month) && 'opacity-35')}>
                            <span className={cx('flex h-9 w-9 items-center justify-center rounded-full text-body',
                                isSel ? (isToday ? 'bg-danger font-semibold text-white' : 'bg-label font-semibold text-bg') : isToday ? 'font-semibold text-danger' : '')}>
                                {format(d, 'd')}
                            </span>
                            <span className="flex h-1.5 gap-[3px]">
                                {list.slice(0, 3).map(e => <span key={e.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: eventColor(e) }} />)}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const emptyForm = (day) => {
    const base = day || new Date();
    const hour = Math.min(new Date().getHours() + 1, 22);
    return {
        title: '', allDay: false, date: ymd(base), time: `${String(hour).padStart(2, '0')}:00`, endDate: ymd(base), endTime: `${String(hour + 1).padStart(2, '0')}:00`,
        location: '', description: '', color: '', user_id: null, event_type: 'normal', recurrence_pattern: 'none',
    };
};

const toForm = (e) => {
    const s = toDate(e.is_instance ? e.series_start : e.start);
    const en = toDate(e.is_instance ? e.series_end : e.end) || s;
    return {
        title: e.title || '', allDay: !!e.allDay, date: ymd(s), time: fmt(s, 'HH:mm'), endDate: ymd(en), endTime: fmt(en, 'HH:mm'),
        location: e.location || '', description: e.description || '', color: e.color || '', user_id: e.user_id || null,
        event_type: e.event_type || 'normal', recurrence_pattern: e.recurrence_pattern || 'none',
    };
};

const EventSheet = ({ open, onClose, event, day, onSaved }) => {
    const { members } = useMembers();
    const { toast, confirm } = useFeedback();
    const [f, setF] = React.useState(emptyForm(day));
    const [saving, setSaving] = React.useState(false);
    const set = (k) => (v) => setF(s => ({ ...s, [k]: v?.target ? (v.target.type === 'checkbox' ? v.target.checked : v.target.value) : v }));

    React.useEffect(() => { if (open) setF(event ? toForm(event) : emptyForm(day)); }, [open, event, day]);

    const save = async () => {
        if (!f.title.trim()) return toast('Bitte einen Titel eingeben', 'error');
        const allDay = f.allDay || f.event_type === 'birthday';
        const start = new Date(`${f.date}T${allDay ? '00:00' : f.time}`);
        let end = new Date(`${f.endDate || f.date}T${allDay ? '23:59' : f.endTime || f.time}`);
        if (end < start) end = allDay ? new Date(`${f.date}T23:59`) : new Date(start.getTime() + 3600e3);
        const body = {
            title: f.title.trim(), start: start.toISOString(), end: end.toISOString(), allDay, location: f.location, description: f.description,
            color: f.color || null, user_id: f.user_id, event_type: f.event_type, recurrence_pattern: f.event_type === 'birthday' ? 'yearly' : f.recurrence_pattern,
            external_uid: event?.external_uid, external_calendar_id: event?.external_calendar_id, is_external: event?.is_external,
        };
        setSaving(true);
        try {
            if (event) await api.put(`/calendar/${event.real_id || event.id}`, body);
            else await api.post('/calendar', body);
            toast(event ? 'Termin gespeichert' : 'Termin erstellt');
            onSaved(); onClose();
        } catch (err) { toast(err.response?.data?.error || 'Speichern fehlgeschlagen', 'error'); } finally { setSaving(false); }
    };

    const remove = async () => {
        const series = event.is_instance;
        if (!(await confirm({ title: 'Termin löschen?', message: series ? 'Alle Termine dieser Serie werden gelöscht.' : undefined, confirmText: 'Löschen', destructive: true }))) return;
        try { await api.delete(`/calendar/${event.real_id || event.id}`); toast('Termin gelöscht'); onSaved(); onClose(); } catch (err) { toast(err.response?.data?.error || 'Löschen fehlgeschlagen', 'error'); }
    };

    const isBirthday = f.event_type === 'birthday';
    const allDay = f.allDay || isBirthday;
    const canDelete = event && !String(event.id).startsWith('ext-');

    return (
        <Sheet open={open} onClose={onClose} title={event ? 'Termin' : 'Neuer Termin'} onSave={save} saving={saving} saveLabel={event ? 'Sichern' : 'Hinzufügen'}>
            <Form onSubmit={save} className="space-y-6">
                <Segmented value={f.event_type} onChange={set('event_type')} options={[{ value: 'normal', label: 'Termin' }, { value: 'birthday', label: 'Geburtstag' }]} />
                <FormGroup>
                    <InputRow placeholder={isBirthday ? 'Wessen Geburtstag?' : 'Titel'} value={f.title} onChange={set('title')} autoFocus={!event} />
                    {!isBirthday && <InputRow placeholder="Ort" value={f.location} onChange={set('location')} />}
                </FormGroup>
                <FormGroup>
                    {!isBirthday && <ToggleRow label="Ganztägig" checked={f.allDay} onChange={set('allDay')} />}
                    <div className="flex min-h-[46px] items-center gap-2 px-4">
                        <span className="mr-auto shrink-0 pr-1 text-body">{isBirthday ? 'Datum' : 'Beginn'}</span>
                        <input type="date" value={f.date} onChange={(e) => setF(s => ({ ...s, date: e.target.value, endDate: s.endDate < e.target.value ? e.target.value : s.endDate }))} className="min-w-0 max-w-[9.5rem] flex-1 rounded-lg bg-fill/15 px-2 py-1.5 text-sub" aria-label="Datum" />
                        {!allDay && <input type="time" value={f.time} onChange={set('time')} className="w-[5.9rem] shrink-0 rounded-lg bg-fill/15 px-2 py-1.5 text-sub" aria-label="Uhrzeit" />}
                    </div>
                    {!isBirthday && (
                        <div className="flex min-h-[46px] items-center gap-2 px-4">
                            <span className="mr-auto shrink-0 pr-1 text-body">Ende</span>
                            <input type="date" value={f.endDate} min={f.date} onChange={set('endDate')} className="min-w-0 max-w-[9.5rem] flex-1 rounded-lg bg-fill/15 px-2 py-1.5 text-sub" aria-label="Enddatum" />
                            {!allDay && <input type="time" value={f.endTime} onChange={set('endTime')} className="w-[5.9rem] shrink-0 rounded-lg bg-fill/15 px-2 py-1.5 text-sub" aria-label="Endzeit" />}
                        </div>
                    )}
                    {!isBirthday && (
                        <InputRow as="select" label="Wiederholen" value={f.recurrence_pattern} onChange={set('recurrence_pattern')}>
                            {RECURRENCE.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </InputRow>
                    )}
                </FormGroup>
                <FormGroup title="Für wen?">
                    <div className="px-3 py-2"><MemberPicker members={members} value={f.user_id} onChange={set('user_id')} allowNone noneLabel="Familie" /></div>
                </FormGroup>
                <FormGroup title="Farbe">
                    <div className="px-4 py-3"><ColorPicker colors={['', ...COLORS].filter(Boolean)} value={f.color} onChange={(c) => set('color')(f.color === c ? '' : c)} /></div>
                </FormGroup>
                <FormGroup>
                    <InputRow as="textarea" placeholder="Notizen" value={f.description} onChange={set('description')} />
                </FormGroup>
                {event?.external_name && <p className="px-4 text-footnote text-label2">Aus dem Kalender „{event.external_name}“. Änderungen werden nur in FamyHub gespeichert.</p>}
                {canDelete && <Button variant="destructive" full onClick={remove}>Termin löschen</Button>}
            </Form>
        </Sheet>
    );
};

const CalendarSettings = ({ open, onClose, onChanged }) => {
    const { data: cals, reload } = useApi(open ? '/calendar/external' : null, { initial: [] });
    const [token, setToken] = React.useState(null);
    const [f, setF] = React.useState({ name: '', url: '', color: COLORS[1] });
    const [busy, setBusy] = React.useState(false);
    const { toast, confirm } = useFeedback();
    const act = useAction();

    React.useEffect(() => { if (open) api.get('/sync/token').then(r => setToken(r.data.token)).catch(() => {}); }, [open]);
    const link = token ? `${window.location.origin}/api/sync/export/${token}.ics` : '';

    const add = async () => {
        if (!f.url.trim()) return;
        setBusy(true);
        const ok = await act(() => api.post('/calendar/external', f), 'Kalender hinzugefügt');
        setBusy(false);
        if (ok) { setF({ name: '', url: '', color: COLORS[1] }); reload(); onChanged(); }
    };
    const remove = async (c) => {
        if (!(await confirm({ title: `„${c.name}“ entfernen?`, confirmText: 'Entfernen', destructive: true }))) return;
        if (await act(() => api.delete(`/calendar/external/${c.id}`), 'Kalender entfernt')) { reload(); onChanged(); }
    };
    const copy = async () => { try { await navigator.clipboard.writeText(link); toast('Link kopiert'); } catch { toast('Kopieren nicht möglich', 'error'); } };
    const regenerate = async () => {
        if (!(await confirm({ title: 'Neuen Link erzeugen?', message: 'Der alte Abo-Link funktioniert danach nicht mehr.', confirmText: 'Erzeugen' }))) return;
        const r = await act(() => api.post('/sync/token/regenerate'), 'Neuer Link erzeugt');
        if (r?.data) setToken(r.data.token);
    };

    return (
        <Sheet open={open} onClose={onClose} title="Kalender">
            <div className="space-y-6">
                <FormGroup title="Abonnierte Kalender" footer="iCal-Links (z. B. von Google, Outlook oder iCloud) werden alle 10 Minuten aktualisiert.">
                    {cals.length === 0 && <p className="px-4 py-3 text-sub text-label2">Noch keine externen Kalender.</p>}
                    {cals.map(c => (
                        <div key={c.id} className="flex min-h-[46px] items-center gap-3 px-4">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
                            <span className="min-w-0 flex-1 truncate">{c.name}</span>
                            <IconButton icon="ri-delete-bin-line" label="Entfernen" variant="plain" className="text-danger" onClick={() => remove(c)} />
                        </div>
                    ))}
                </FormGroup>
                <FormGroup title="Kalender hinzufügen">
                    <InputRow placeholder="Name" value={f.name} onChange={e => setF(s => ({ ...s, name: e.target.value }))} />
                    <InputRow placeholder="https://… oder webcal://…" value={f.url} onChange={e => setF(s => ({ ...s, url: e.target.value }))} inputMode="url" autoCapitalize="none" />
                    <div className="px-4 py-3"><ColorPicker colors={COLORS} value={f.color} onChange={c => setF(s => ({ ...s, color: c }))} /></div>
                </FormGroup>
                <Button full loading={busy} disabled={!f.url.trim()} onClick={add}>Hinzufügen</Button>
                <FormGroup title="FamyHub abonnieren" footer="Mit diesem geheimen Link siehst du alle Familientermine im Kalender deines Handys.">
                    <div className="break-all px-4 py-3 font-mono text-footnote text-label2">{link || '…'}</div>
                    <Row title="Link kopieren" onClick={copy} right={<i className="ri-file-copy-line text-accent"></i>} />
                    <Row title="Neuen Link erzeugen" onClick={regenerate} destructive />
                </FormGroup>
            </div>
        </Sheet>
    );
};

export default function Calendar() {
    const { data: events, loading, error, reload } = useApi('/calendar', { initial: [], interval: 60000 });
    const [view, setView] = React.useState('month');
    const [month, setMonth] = React.useState(startOfMonth(new Date()));
    const [selected, setSelected] = React.useState(startOfDay(new Date()));
    const [editing, setEditing] = React.useState(null); // null | 'new' | event
    const [settings, setSettings] = React.useState(false);

    const dayEvents = React.useMemo(() => eventsOn(events, selected), [events, selected]);
    const upcoming = React.useMemo(() => {
        const from = startOfDay(new Date());
        const to = addDays(from, 90);
        const list = events.filter(e => { const s = toDate(e.start); return s >= from && s <= to; }).sort((a, b) => toDate(a.start) - toDate(b.start));
        const groups = [];
        for (const e of list) {
            const key = ymd(toDate(e.start));
            if (!groups.length || groups[groups.length - 1].key !== key) groups.push({ key, items: [] });
            groups[groups.length - 1].items.push(e);
        }
        return groups;
    }, [events]);

    const select = (d) => { setSelected(d); if (!isSameMonth(d, month)) setMonth(startOfMonth(d)); };
    const goToday = () => { const t = startOfDay(new Date()); setSelected(t); setMonth(startOfMonth(t)); };

    return (
        <Page wide title={view === 'month' ? format(month, 'MMMM', { locale: de }) : 'Termine'} subtitle={view === 'month' ? format(month, 'yyyy') : 'Nächste 90 Tage'}
            actions={<>
                <IconButton icon="ri-settings-4-line" label="Kalender-Einstellungen" variant="gray" onClick={() => setSettings(true)} />
                <IconButton icon="ri-add-line" label="Neuer Termin" variant="filled" onClick={() => setEditing('new')} />
            </>}>
            <div className="mb-4 flex items-center gap-2">
                <Segmented className="flex-1 md:max-w-xs" value={view} onChange={setView} options={[{ value: 'month', label: 'Monat' }, { value: 'list', label: 'Liste' }]} />
                {view === 'month' && <>
                    <IconButton icon="ri-arrow-left-s-line" label="Vorheriger Monat" variant="gray" onClick={() => setMonth(m => addMonths(m, -1))} />
                    <Button size="sm" variant="gray" onClick={goToday}>Heute</Button>
                    <IconButton icon="ri-arrow-right-s-line" label="Nächster Monat" variant="gray" onClick={() => setMonth(m => addMonths(m, 1))} />
                </>}
            </div>
            {error && <ErrorNote error={error} onRetry={reload} />}
            {loading ? <Loading /> : view === 'month' ? (
                <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
                    <MonthGrid month={month} events={events} selected={selected} onSelect={select} />
                    <Section title={relDay(selected) === fmt(selected, 'EEE, d. MMM') ? fmt(selected, 'EEEE, d. MMMM') : `${relDay(selected)} · ${fmt(selected, 'd. MMMM')}`}>
                        {dayEvents.length === 0
                            ? <button onClick={() => setEditing('new')} className="press w-full px-4 py-6 text-center text-sub text-label2">Keine Termine – <span className="text-accent">Termin hinzufügen</span></button>
                            : dayEvents.map(e => <EventRow key={e.id} e={e} onClick={() => setEditing(e)} />)}
                    </Section>
                </div>
            ) : upcoming.length === 0 ? (
                <Empty icon="ri-calendar-line" title="Keine Termine" text="In den nächsten 90 Tagen steht nichts an." action={<Button onClick={() => setEditing('new')} icon="ri-add-line">Termin anlegen</Button>} />
            ) : upcoming.map(g => (
                <Section key={g.key} title={`${relDay(g.key)}${['Heute', 'Morgen'].includes(relDay(g.key)) ? ` · ${fmt(g.key, 'd. MMMM')}` : ''}`}>
                    {g.items.map(e => <EventRow key={e.id} e={e} onClick={() => setEditing(e)} />)}
                </Section>
            ))}
            <EventSheet open={!!editing} onClose={() => setEditing(null)} event={editing === 'new' ? null : editing} day={selected} onSaved={reload} />
            <CalendarSettings open={settings} onClose={() => setSettings(false)} onChanged={reload} />
        </Page>
    );
}
