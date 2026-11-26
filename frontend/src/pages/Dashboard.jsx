import React from 'react';
import { Link } from 'react-router-dom';
import { addDays, startOfDay } from 'date-fns';
import api from '../lib/api';
import { useApi } from '../lib/useApi';
import { useAuth, useMembers } from '../lib/auth';
import { featureById } from '../lib/features';
import { fmt, fmtTime, greeting, relDay, toDate, ymd, ago } from '../lib/format';
import { Avatar, IconTile, Sheet, FormGroup, ToggleRow, Field, Button, Check, useAction, cx } from '../ui';
import { eventColor } from './Calendar';

const WIDGETS = [
    { id: 'weather', label: 'Wetter', icon: 'ri-sun-cloudy-fill', color: '#1AA7EC' },
    { id: 'family', label: 'Familie', icon: 'ri-group-fill', color: '#2B3E6A' },
    { id: 'events', label: 'Termine', feature: 'calendar' },
    { id: 'meals', label: 'Essen heute', feature: 'meals' },
    { id: 'chores', label: 'Aufgaben', feature: 'chores' },
    { id: 'shopping', label: 'Einkauf', feature: 'shopping' },
    { id: 'chat', label: 'Chat', feature: 'chat' },
].map(w => (w.feature ? { ...featureById[w.feature], ...w } : w));

const can = (user, feature) => !feature || user.role === 'admin' || user.permissions?.[feature] !== false;

const Widget = ({ w, to, children, action, className }) => (
    <section className={cx('flex flex-col overflow-hidden rounded-card bg-card', className)}>
        <header className="flex items-center gap-2 px-4 pb-2 pt-3.5">
            <IconTile icon={w.icon} color={w.color} size={24} />
            {to ? <Link to={to} className="press flex flex-1 items-center gap-0.5 text-sub font-semibold">{w.label}<i className="ri-arrow-right-s-line text-label3"></i></Link>
                : <span className="flex-1 text-sub font-semibold">{w.label}</span>}
            {action}
        </header>
        <div className="flex-1">{children}</div>
    </section>
);

const Muted = ({ children }) => <p className="px-4 pb-4 pt-1 text-sub text-label2">{children}</p>;

/* WMO weather codes → icon + label */
const weatherInfo = (code, day = true) => {
    if (code === 0) return [day ? 'ri-sun-fill' : 'ri-moon-clear-fill', 'Klar', '#FF9500'];
    if (code <= 2) return [day ? 'ri-sun-cloudy-fill' : 'ri-moon-cloudy-fill', 'Leicht bewölkt', '#FF9500'];
    if (code === 3) return ['ri-cloudy-fill', 'Bewölkt', '#8E8E93'];
    if (code <= 48) return ['ri-mist-fill', 'Nebel', '#8E8E93'];
    if (code <= 57) return ['ri-drizzle-fill', 'Nieselregen', '#1AA7EC'];
    if (code <= 67) return ['ri-rainy-fill', 'Regen', '#1AA7EC'];
    if (code <= 77) return ['ri-snowy-fill', 'Schnee', '#5AC8FA'];
    if (code <= 82) return ['ri-showers-fill', 'Schauer', '#1AA7EC'];
    if (code <= 86) return ['ri-snowy-fill', 'Schneeschauer', '#5AC8FA'];
    return ['ri-thunderstorms-fill', 'Gewitter', '#5856D6'];
};

const WeatherWidget = () => {
    const [coords, setCoords] = React.useState(() => { try { return JSON.parse(localStorage.getItem('fh_coords')); } catch { return null; } });
    const { data, error } = useApi(`/weather${coords ? `?lat=${coords.lat}&lon=${coords.lon}` : ''}`);
    const locate = () => navigator.geolocation?.getCurrentPosition((p) => {
        const c = { lat: p.coords.latitude.toFixed(2), lon: p.coords.longitude.toFixed(2) };
        localStorage.setItem('fh_coords', JSON.stringify(c)); setCoords(c);
    });
    if (error) return null;
    if (!data?.current) return <div className="h-[132px] animate-pulse rounded-card bg-card" />;
    const [icon, label] = weatherInfo(data.current.weather_code, data.current.is_day);
    return (
        <section className="relative overflow-hidden rounded-card bg-gradient-to-br from-[#1AA7EC] to-[#2B3E6A] p-4 text-white">
            <button onClick={locate} className="press absolute right-3 top-3 rounded-full bg-white/15 p-1.5 text-sm" aria-label="Meinen Standort verwenden" title="Meinen Standort verwenden"><i className="ri-map-pin-line"></i></button>
            <div className="flex items-center gap-3">
                <i className={cx(icon, 'text-[44px] leading-none')}></i>
                <div>
                    <div className="text-[40px] font-light leading-none">{Math.round(data.current.temperature_2m)}°</div>
                    <div className="text-footnote opacity-85">{label} · gefühlt {Math.round(data.current.apparent_temperature)}°</div>
                </div>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-1 text-center text-caption">
                {data.daily.time.slice(0, 4).map((d, i) => (
                    <div key={d} className="rounded-cell bg-white/12 py-1.5">
                        <div className="opacity-85">{i === 0 ? 'Heute' : fmt(d, 'EEE')}</div>
                        <i className={cx(weatherInfo(data.daily.weather_code[i])[0], 'text-lg')}></i>
                        <div className="font-semibold">{Math.round(data.daily.temperature_2m_max[i])}° <span className="opacity-70">{Math.round(data.daily.temperature_2m_min[i])}°</span></div>
                    </div>
                ))}
            </div>
        </section>
    );
};

const MOODS = ['😊', '😎', '🥳', '😴', '🤒', '😤', '🤯', '🏃', '💼', '🏠', '🎮', '❤️'];

const MoodSheet = ({ open, onClose }) => {
    const { user, refresh } = useAuth();
    const { reload } = useMembers();
    const [emoji, setEmoji] = React.useState('');
    const [text, setText] = React.useState('');
    const act = useAction();
    React.useEffect(() => { if (open) { setEmoji(user.mood_emoji || ''); setText(user.mood_text || ''); } }, [open, user]);
    const save = async (e = emoji, t = text) => {
        if (await act(() => api.post('/auth/profile/mood', { mood_emoji: e, mood_text: t }), 'Status aktualisiert')) { refresh(); reload(); onClose(); }
    };
    return (
        <Sheet open={open} onClose={onClose} title="Mein Status" onSave={() => save()}>
            <div className="space-y-5">
                <div className="grid grid-cols-6 gap-2">
                    {MOODS.map(m => <button key={m} onClick={() => setEmoji(emoji === m ? '' : m)} className={cx('press aspect-square rounded-cell text-[28px]', emoji === m ? 'bg-accent/20 ring-2 ring-accent' : 'bg-card')}>{m}</button>)}
                </div>
                <Field label="Was machst du gerade?" value={text} onChange={e => setText(e.target.value)} maxLength={140} placeholder="z. B. Beim Training bis 18 Uhr" />
                {(user.mood_emoji || user.mood_text) && <Button variant="gray" full onClick={() => save('', '')}>Status löschen</Button>}
            </div>
        </Sheet>
    );
};

const FamilyWidget = ({ w }) => {
    const { user } = useAuth();
    const { members } = useMembers();
    const [mood, setMood] = React.useState(false);
    const isOnline = (m) => m.last_active && Date.now() - toDate(m.last_active).getTime() < 5 * 60e3;
    return (
        <Widget w={w}>
            <div className="no-scrollbar flex gap-4 overflow-x-auto px-4 pb-4">
                {members.map(m => (
                    <button key={m.id} onClick={() => m.id === user.id && setMood(true)} className={cx('flex w-[68px] shrink-0 flex-col items-center gap-1 text-center', m.id === user.id && 'press')}>
                        <span className="relative">
                            <Avatar user={m} size={56} />
                            {m.mood_emoji && <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-card text-base shadow-soft">{m.mood_emoji}</span>}
                            {isOnline(m) && <span className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full border-2 border-card bg-ok" />}
                        </span>
                        <span className="w-full truncate text-footnote font-medium">{m.id === user.id ? 'Ich' : m.username}</span>
                        <span className="line-clamp-2 w-full text-caption text-label2">{m.mood_text || (m.id === user.id ? 'Status setzen' : m.display_role || '')}</span>
                    </button>
                ))}
            </div>
            <MoodSheet open={mood} onClose={() => setMood(false)} />
        </Widget>
    );
};

const EventsWidget = ({ w }) => {
    const { data } = useApi('/calendar', { initial: [] });
    const from = startOfDay(new Date());
    const to = addDays(from, 7);
    const list = data.filter(e => { const s = toDate(e.start); const en = toDate(e.end) || s; return en >= new Date() && s < to; })
        .sort((a, b) => toDate(a.start) - toDate(b.start)).slice(0, 5);
    return (
        <Widget w={w} to="/calendar">
            {list.length === 0 ? <Muted>Keine Termine in den nächsten 7 Tagen.</Muted> : (
                <ul className="pb-2">
                    {list.map(e => (
                        <li key={e.id} className="flex items-center gap-3 px-4 py-2">
                            <span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: eventColor(e) }} />
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-body">{e.event_type === 'birthday' && '🎂 '}{e.title}</div>
                                <div className="text-footnote text-label2">{relDay(e.start)} · {e.allDay || e.event_type === 'birthday' ? 'ganztägig' : fmtTime(e.start)}</div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </Widget>
    );
};

const MealsWidget = ({ w }) => {
    const today = ymd(new Date());
    const { data } = useApi(`/meals?startDate=${today}&endDate=${today}`, { initial: [] });
    const types = ['Frühstück', 'Mittagessen', 'Abendessen'];
    const pick = (t) => data.filter(m => m.meal_type === t).sort((a, b) => b.vote_count - a.vote_count)[0];
    return (
        <Widget w={w} to="/meals">
            <ul className="pb-3">
                {types.map(t => {
                    const m = pick(t);
                    return (
                        <li key={t} className="flex items-baseline gap-3 px-4 py-1.5">
                            <span className="w-24 shrink-0 text-footnote text-label2">{t}</span>
                            <span className={cx('truncate text-body', !m && 'text-label3')}>{m ? m.recipe_name : '—'}</span>
                        </li>
                    );
                })}
            </ul>
        </Widget>
    );
};

const ChoresWidget = ({ w }) => {
    const { user } = useAuth();
    const { data, reload } = useApi('/chores', { initial: { chores: [] } });
    const act = useAction();
    const mine = (data.chores || []).filter(c => !c.completed_today && (!c.assigned_to || c.assigned_to === user.id || user.role === 'admin')).slice(0, 5);
    const done = async (c) => { if (await act(() => api.put(`/chores/${c.id}/complete`), c.points ? `+${c.points} Punkte` : 'Erledigt')) reload(); };
    const me = (data.leaderboard || []).find(l => l.id === user.id);
    return (
        <Widget w={w} to="/chores" action={me ? <span className="rounded-full bg-warn/15 px-2 py-0.5 text-footnote font-semibold text-warn">⭐ {me.points_balance}</span> : null}>
            {mine.length === 0 ? <Muted>Alles erledigt. 🎉</Muted> : (
                <ul className="pb-2">
                    {mine.map(c => (
                        <li key={c.id} className="flex items-center gap-3 px-4 py-2">
                            <Check checked={false} onChange={() => done(c)} color="#5856D6" />
                            <span className="min-w-0 flex-1 truncate text-body">{c.title}</span>
                            {c.points > 0 && <span className="text-footnote text-label2">{c.points} P</span>}
                        </li>
                    ))}
                </ul>
            )}
        </Widget>
    );
};

const ShoppingWidget = ({ w }) => {
    const { data } = useApi('/shopping', { initial: [] });
    const open = data.filter(i => !i.completed);
    return (
        <Widget w={w} to="/shopping" action={open.length ? <span className="text-footnote font-semibold text-label2">{open.length}</span> : null}>
            {open.length === 0 ? <Muted>Nichts zu besorgen.</Muted> : (
                <div className="flex flex-wrap gap-1.5 px-4 pb-4">
                    {open.slice(0, 12).map(i => <span key={i.id} className="rounded-full bg-fill/12 px-2.5 py-1 text-footnote">{i.name}</span>)}
                    {open.length > 12 && <span className="px-1 py-1 text-footnote text-label2">+{open.length - 12}</span>}
                </div>
            )}
        </Widget>
    );
};

const ChatWidget = ({ w }) => {
    const { byId } = useMembers();
    const { data } = useApi('/chat', { initial: [], interval: 30000 });
    const last = data.slice(-3);
    return (
        <Widget w={w} to="/chat">
            {last.length === 0 ? <Muted>Noch keine Nachrichten.</Muted> : (
                <ul className="pb-2">
                    {last.map(m => (
                        <li key={m.id} className="flex items-center gap-3 px-4 py-2">
                            <Avatar user={byId[m.user_id] || { id: m.user_id, username: m.user_name }} size={30} />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2"><span className="text-footnote font-semibold">{m.user_name}</span><span className="text-caption text-label3">{ago(m.created_at)}</span></div>
                                <div className="truncate text-sub text-label2">{m.poll_data ? `📊 ${m.poll_data.question}` : m.content || '📷 Bild'}</div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </Widget>
    );
};

const Hero = ({ onEdit }) => {
    const { user } = useAuth();
    const [mood, setMood] = React.useState(false);
    const today = ymd(new Date());
    const coords = (() => { try { return JSON.parse(localStorage.getItem('fh_coords')); } catch { return null; } })();
    const { data: weather } = useApi(`/weather${coords ? `?lat=${coords.lat}&lon=${coords.lon}` : ''}`);
    const { data: events } = useApi(can(user, 'calendar') ? '/calendar' : null, { initial: [], enabled: can(user, 'calendar') });
    const { data: chores } = useApi(can(user, 'chores') ? '/chores' : null, { initial: { chores: [] }, enabled: can(user, 'chores') });
    const { data: items } = useApi(can(user, 'shopping') ? '/shopping' : null, { initial: [], enabled: can(user, 'shopping') });
    const { data: meals } = useApi(can(user, 'meals') ? `/meals?startDate=${today}&endDate=${today}` : null, { initial: [], enabled: can(user, 'meals') });

    const now = new Date();
    const todayEvents = events.filter(e => { const s = toDate(e.start); const en = toDate(e.end) || s; return ymd(s) <= today && ymd(en) >= today; });
    const nextEvent = todayEvents.filter(e => !e.allDay && toDate(e.start) > now).sort((a, b) => toDate(a.start) - toDate(b.start))[0];
    const openChores = (chores.chores || []).filter(c => !c.completed_today && (!c.assigned_to || c.assigned_to === user.id)).length;
    const openItems = items.filter(i => !i.completed).length;
    const dinner = meals.filter(m => m.meal_type === (now.getHours() < 14 ? 'Mittagessen' : 'Abendessen')).sort((a, b) => b.vote_count - a.vote_count)[0];

    const pills = [
        can(user, 'calendar') && { to: '/calendar', icon: 'ri-calendar-2-line', text: nextEvent ? `${fmtTime(nextEvent.start)} ${nextEvent.title}` : todayEvents.length ? `${todayEvents.length} ${todayEvents.length === 1 ? 'Termin' : 'Termine'} heute` : 'Keine Termine heute' },
        can(user, 'meals') && dinner && { to: '/meals', icon: 'ri-restaurant-line', text: dinner.recipe_name },
        can(user, 'chores') && { to: '/chores', icon: 'ri-task-line', text: openChores ? `${openChores} ${openChores === 1 ? 'Aufgabe' : 'Aufgaben'} offen` : 'Alles erledigt' },
        can(user, 'shopping') && openItems > 0 && { to: '/shopping', icon: 'ri-shopping-cart-2-line', text: `${openItems} auf der Liste` },
    ].filter(Boolean);
    const w = weather?.current ? weatherInfo(weather.current.weather_code, weather.current.is_day) : null;

    return (
        <section className="relative mb-4 overflow-hidden rounded-sheet bg-[#2B3E6A] p-5 text-white shadow-pop md:p-7">
            <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[#1AA7EC] opacity-35 blur-3xl" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 left-10 h-56 w-56 rounded-full bg-[#5B7BD5] opacity-25 blur-3xl" />
            <div className="relative flex items-start gap-4">
                <button onClick={() => setMood(true)} className="press relative shrink-0" aria-label="Status setzen">
                    <Avatar user={user} size={56} className="ring-2 ring-white/40" />
                    <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm text-[#2B3E6A] shadow-soft">{user.mood_emoji || <i className="ri-emotion-line"></i>}</span>
                </button>
                <div className="min-w-0 flex-1">
                    <p className="text-footnote font-medium text-white/70">{fmt(now, 'EEEE, d. MMMM')}</p>
                    <h1 className="text-title2 font-bold leading-tight sm:text-title1 md:text-large">{greeting()}, {user.username}</h1>
                    {user.mood_text && <p className="mt-0.5 truncate text-sub text-white/80">{user.mood_text}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                    <button onClick={onEdit} className="press flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-lg" aria-label="Übersicht anpassen" title="Übersicht anpassen"><i className="ri-equalizer-line"></i></button>
                    {w && <div className="flex items-center gap-1 text-title3 font-semibold"><i className={w[0]}></i>{Math.round(weather.current.temperature_2m)}°</div>}
                </div>
            </div>
            {pills.length > 0 && (
                <div className="relative mt-5 flex flex-wrap gap-2">
                    {pills.map(p => (
                        <Link key={p.to} to={p.to} className="press flex max-w-full items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-footnote font-medium backdrop-blur">
                            <i className={p.icon}></i><span className="truncate">{p.text}</span>
                        </Link>
                    ))}
                </div>
            )}
            <MoodSheet open={mood} onClose={() => setMood(false)} />
        </section>
    );
};

const COMPONENTS = { family: FamilyWidget, events: EventsWidget, meals: MealsWidget, chores: ChoresWidget, shopping: ShoppingWidget, chat: ChatWidget };

const enabledWidgets = (user) => {
    const saved = user.dashboard_widgets;
    const list = saved && Array.isArray(saved.v3) ? saved.v3 : WIDGETS.map(w => w.id);
    return list.filter(id => { const w = WIDGETS.find(x => x.id === id); return w && can(user, w.feature); });
};

export default function Dashboard() {
    const { user, patchUser } = useAuth();
    const [edit, setEdit] = React.useState(false);
    const enabled = enabledWidgets(user);
    const act = useAction();

    const toggle = async (id, on) => {
        const next = on ? WIDGETS.map(w => w.id).filter(x => x === id || enabled.includes(x)) : enabled.filter(x => x !== id);
        patchUser({ dashboard_widgets: { v3: next } });
        await act(() => api.put('/auth/profile/dashboard', { widgets: { v3: next } }));
    };

    const cards = enabled.filter(id => id !== 'weather' && id !== 'family');

    return (
        <div className="mx-auto w-full max-w-6xl pb-10">
            <Hero onEdit={() => setEdit(true)} />

            <div className="grid gap-4 lg:grid-cols-2 lg:[&>*:only-child]:col-span-2">
                {enabled.includes('weather') && <WeatherWidget />}
                {enabled.includes('family') && <FamilyWidget w={WIDGETS.find(w => w.id === 'family')} />}
            </div>
            <div className="mt-4 gap-4 sm:columns-2 xl:columns-3">
                {cards.map(id => { const C = COMPONENTS[id]; return <div key={id} className="mb-4 break-inside-avoid"><C w={WIDGETS.find(w => w.id === id)} /></div>; })}
            </div>

            <Sheet open={edit} onClose={() => setEdit(false)} title="Übersicht anpassen">
                <FormGroup footer="Wähle aus, was auf deiner Übersicht erscheinen soll.">
                    {WIDGETS.filter(w => can(user, w.feature)).map(w => (
                        <ToggleRow key={w.id} label={w.label} icon={w.icon} color={w.color} checked={enabled.includes(w.id)} onChange={(on) => toggle(w.id, on)} />
                    ))}
                </FormGroup>
            </Sheet>
        </div>
    );
}
