import React from 'react';
import api, { uploadUrl } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useAuth, useMembers } from '../lib/auth';
import { fmtTime, relDay, toDate, ymd } from '../lib/format';
import { Avatar, IconButton, Sheet, Field, Button, Loading, useFeedback, useAction, cx } from '../ui';

const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

const parseReactions = (r) => { try { return typeof r === 'string' ? JSON.parse(r || '{}') : (r || {}); } catch { return {}; } };

const Poll = ({ msg, mine, onVote }) => {
    const { user } = useAuth();
    const poll = msg.poll_data;
    const total = poll.options.reduce((n, o) => n + (o.votes?.length || 0), 0);
    return (
        <div className="min-w-[220px] space-y-2">
            <p className="flex items-center gap-1.5 font-semibold"><i className="ri-bar-chart-horizontal-line"></i>{poll.question}</p>
            {poll.options.map((o, i) => {
                const votes = o.votes?.length || 0;
                const voted = (o.votes || []).includes(user.id);
                const pct = total ? Math.round((votes / total) * 100) : 0;
                return (
                    <button key={i} type="button" onClick={() => onVote(i)} className={cx('press relative block w-full overflow-hidden rounded-[10px] px-3 py-2 text-left text-sub', mine ? 'bg-white/15' : 'bg-fill/12')}>
                        <span className={cx('absolute inset-y-0 left-0', mine ? 'bg-white/25' : 'bg-accent/20')} style={{ width: `${pct}%` }} />
                        <span className="relative flex items-center gap-2">
                            {voted && <i className="ri-checkbox-circle-fill"></i>}
                            <span className="flex-1">{o.text}</span>
                            <span className="text-footnote opacity-75">{votes}</span>
                        </span>
                    </button>
                );
            })}
            <p className="text-caption opacity-70">{total} {total === 1 ? 'Stimme' : 'Stimmen'}</p>
        </div>
    );
};

const PollSheet = ({ open, onClose, onCreate }) => {
    const [q, setQ] = React.useState('');
    const [opts, setOpts] = React.useState(['', '']);
    React.useEffect(() => { if (open) { setQ(''); setOpts(['', '']); } }, [open]);
    const valid = q.trim() && opts.filter(o => o.trim()).length >= 2;
    return (
        <Sheet open={open} onClose={onClose} title="Umfrage" saveLabel="Senden" saveDisabled={!valid}
            onSave={() => valid && onCreate({ question: q.trim(), options: opts.filter(o => o.trim()).map(text => ({ text: text.trim(), votes: [] })) })}>
            <div className="space-y-4">
                <Field label="Frage" value={q} onChange={e => setQ(e.target.value)} placeholder="Was essen wir am Sonntag?" autoFocus />
                {opts.map((o, i) => (
                    <div key={i} className="flex items-end gap-2">
                        <Field className="flex-1" label={`Option ${i + 1}`} value={o} onChange={e => setOpts(list => list.map((x, j) => (j === i ? e.target.value : x)))} />
                        {opts.length > 2 && <IconButton icon="ri-subtract-line" label="Option entfernen" variant="destructive" className="mb-1.5" onClick={() => setOpts(list => list.filter((_, j) => j !== i))} />}
                    </div>
                ))}
                {opts.length < 10 && <Button variant="tinted" full icon="ri-add-line" onClick={() => setOpts(list => [...list, ''])}>Option hinzufügen</Button>}
            </div>
        </Sheet>
    );
};

export default function Chat() {
    const { user, isAdmin } = useAuth();
    const { members, byId } = useMembers();
    const { data: messages, setData, loading } = useApi('/chat', { initial: [], interval: 4000 });
    const [text, setText] = React.useState('');
    const [sending, setSending] = React.useState(false);
    const [menuFor, setMenuFor] = React.useState(null);
    const [poll, setPoll] = React.useState(false);
    const [viewer, setViewer] = React.useState(null);
    const listRef = React.useRef(null);
    const fileRef = React.useRef(null);
    const stick = React.useRef(true);
    const { confirm } = useFeedback();
    const act = useAction();

    const scrollToEnd = (smooth) => {
        const el = listRef.current;
        if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    };
    React.useLayoutEffect(() => { if (stick.current) scrollToEnd(false); }, [messages.length]);
    const onScroll = () => {
        const el = listRef.current;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    };

    const send = async (extra = {}) => {
        const content = text.trim();
        if (!content && !extra.file && !extra.poll) return;
        setSending(true);
        const fd = new FormData();
        if (content && !extra.poll) fd.append('content', content);
        if (extra.file) fd.append('image', extra.file);
        if (extra.poll) { fd.append('content', ''); fd.append('poll_data', JSON.stringify(extra.poll)); }
        const r = await act(() => api.post('/chat', fd));
        setSending(false);
        if (r?.data) {
            if (!extra.poll) setText('');
            stick.current = true;
            setData(list => [...list, r.data]);
        }
    };

    const react = async (msg, emoji) => {
        const r = await act(() => api.post(`/chat/${msg.id}/react`, { emoji }));
        if (r?.data) setData(list => list.map(m => (m.id === msg.id ? { ...m, reactions: r.data.reactions } : m)));
    };
    const vote = async (msg, optionIndex) => {
        const r = await act(() => api.post(`/chat/${msg.id}/vote`, { optionIndex }));
        if (r?.data) setData(list => list.map(m => (m.id === msg.id ? { ...m, poll_data: JSON.parse(r.data.poll_data) } : m)));
    };
    const remove = async (msg) => {
        if (!(await confirm({ title: 'Nachricht löschen?', confirmText: 'Löschen', destructive: true }))) return;
        if (await act(() => api.delete(`/chat/${msg.id}`))) setData(list => list.filter(m => m.id !== msg.id));
    };

    let lastDay = null;
    const online = members.filter(m => m.last_active && Date.now() - toDate(m.last_active).getTime() < 5 * 60e3);

    return (
        <div className="flex h-[calc(100dvh-52px-env(safe-area-inset-bottom))] flex-col md:h-dvh">
            <header className="glass safe-top z-10 border-b hairline">
                <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
                    <div className="flex -space-x-2">{members.slice(0, 4).map(m => <Avatar key={m.id} user={m} size={34} className="ring-2 ring-card" />)}</div>
                    <div className="min-w-0 flex-1">
                        <h1 className="truncate text-headline font-semibold">Familien-Chat</h1>
                        <p className="truncate text-caption text-label2">{online.length ? `${online.map(m => m.username).join(', ')} online` : `${members.length} Mitglieder`}</p>
                    </div>
                </div>
            </header>

            <div ref={listRef} onScroll={onScroll} className="flex-1 overflow-y-auto">
                <div className="mx-auto max-w-3xl space-y-1 px-3 py-4">
                    {loading && <Loading />}
                    {!loading && messages.length === 0 && <p className="py-16 text-center text-sub text-label2">Noch keine Nachrichten. Sag Hallo! 👋</p>}
                    {messages.map((m, i) => {
                        const mine = m.user_id === user.id;
                        const day = ymd(toDate(m.created_at));
                        const showDay = day !== lastDay;
                        lastDay = day;
                        const prev = messages[i - 1];
                        const grouped = prev && !showDay && prev.user_id === m.user_id && toDate(m.created_at) - toDate(prev.created_at) < 5 * 60e3;
                        const reactions = Object.entries(parseReactions(m.reactions)).filter(([, ids]) => ids.length);
                        const author = byId[m.user_id];
                        return (
                            <React.Fragment key={m.id}>
                                {showDay && <div className="py-3 text-center text-caption font-semibold text-label2">{relDay(m.created_at)}</div>}
                                <div className={cx('flex items-end gap-2', mine ? 'justify-end' : 'justify-start', !grouped && 'pt-2')}>
                                    {!mine && <span className="w-7 shrink-0">{!messages[i + 1] || messages[i + 1].user_id !== m.user_id ? <Avatar user={author || { id: m.user_id, username: m.user_name }} size={28} /> : null}</span>}
                                    <div className={cx('flex max-w-[78%] flex-col', mine ? 'items-end' : 'items-start')}>
                                        {!mine && !grouped && <span className="mb-0.5 px-3 text-caption font-medium text-label2">{m.user_name}</span>}
                                        <button type="button" onClick={() => setMenuFor(m)} className={cx('text-left', m.image_url && !m.content ? '' : 'rounded-[20px] px-3.5 py-2', mine ? 'bg-tint text-white' : 'bg-card text-label', m.image_url && !m.content && 'overflow-hidden rounded-[18px]')}>
                                            {m.image_url && (
                                                <img src={uploadUrl(m.image_url)} alt="Bild" loading="lazy" onClick={(e) => { e.stopPropagation(); setViewer(m.image_url); }}
                                                    className={cx('max-h-72 w-auto max-w-full object-cover', m.content && '-mx-1.5 mb-1.5 mt-0.5 rounded-[14px]')} />
                                            )}
                                            {m.poll_data ? <Poll msg={m} mine={mine} onVote={(idx) => vote(m, idx)} /> : m.content && <span className="whitespace-pre-wrap break-words text-body">{m.content}</span>}
                                        </button>
                                        {reactions.length > 0 && (
                                            <div className="-mt-1.5 flex gap-1 px-2">
                                                {reactions.map(([emoji, ids]) => (
                                                    <button key={emoji} onClick={() => react(m, emoji)} className={cx('press rounded-full border px-1.5 text-footnote shadow-soft', ids.includes(user.id) ? 'border-accent bg-accent/15' : 'hairline bg-card')}>
                                                        {emoji}{ids.length > 1 && <span className="ml-0.5 text-caption">{ids.length}</span>}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {(!messages[i + 1] || messages[i + 1].user_id !== m.user_id) && <span className="mt-0.5 px-2 text-[11px] text-label3">{fmtTime(m.created_at)}</span>}
                                    </div>
                                </div>
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="glass border-t hairline">
                <div className="mx-auto flex max-w-3xl items-end gap-2 px-3 py-2">
                    <IconButton icon="ri-image-add-line" label="Bild senden" variant="plain" size={38} onClick={() => fileRef.current?.click()} />
                    <IconButton icon="ri-bar-chart-horizontal-line" label="Umfrage" variant="plain" size={38} onClick={() => setPoll(true)} />
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) send({ file: f }); }} />
                    <textarea value={text} rows={1} onChange={e => setText(e.target.value)} placeholder="Nachricht" aria-label="Nachricht"
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(min-width: 768px)').matches) { e.preventDefault(); send(); } }}
                        className="max-h-32 min-h-[38px] flex-1 resize-none rounded-[19px] border hairline bg-card px-3.5 py-[7px] text-body outline-none" />
                    <IconButton type="submit" icon={sending ? 'ri-loader-4-line animate-spin' : 'ri-arrow-up-line'} label="Senden" variant="filled" size={38} disabled={!text.trim() || sending} />
                </div>
            </form>

            {menuFor && (
                <Sheet open onClose={() => setMenuFor(null)} title="Nachricht">
                    <div className="mb-4 flex justify-between rounded-card bg-card p-2">
                        {REACTIONS.map(e => <button key={e} onClick={() => { react(menuFor, e); setMenuFor(null); }} className="press rounded-full p-2 text-[28px]">{e}</button>)}
                    </div>
                    <div className="overflow-hidden rounded-card bg-card">
                        {menuFor.content && <button onClick={() => { navigator.clipboard?.writeText(menuFor.content); setMenuFor(null); }} className="press flex w-full items-center justify-between border-b hairline px-4 py-3 text-body">Kopieren <i className="ri-file-copy-line"></i></button>}
                        {(menuFor.user_id === user.id || isAdmin) && <button onClick={() => { const m = menuFor; setMenuFor(null); remove(m); }} className="press flex w-full items-center justify-between px-4 py-3 text-body text-danger">Löschen <i className="ri-delete-bin-line"></i></button>}
                    </div>
                </Sheet>
            )}
            <PollSheet open={poll} onClose={() => setPoll(false)} onCreate={(p) => { setPoll(false); send({ poll: p }); }} />
            {viewer && (
                <button type="button" onClick={() => setViewer(null)} className="anim-fade fixed inset-0 z-[300] flex items-center justify-center bg-black/90 p-4" aria-label="Schließen">
                    <img src={uploadUrl(viewer)} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
                </button>
            )}
        </div>
    );
}
