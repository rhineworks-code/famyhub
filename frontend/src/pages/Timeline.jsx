import React from 'react';
import api, { uploadUrl } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useAuth, useMembers } from '../lib/auth';
import { ago } from '../lib/format';
import { Page, Avatar, IconButton, Button, Empty, Loading, ErrorNote, ActionSheet, useFeedback, useAction, cx } from '../ui';

const EMOJIS = ['❤️', '😂', '👏', '😮', '😢'];

const Composer = ({ onPosted }) => {
    const { user } = useAuth();
    const [text, setText] = React.useState('');
    const [file, setFile] = React.useState(null);
    const [preview, setPreview] = React.useState(null);
    const [poll, setPoll] = React.useState(null); // { question, options: [] }
    const [busy, setBusy] = React.useState(false);
    const fileRef = React.useRef(null);
    const act = useAction();

    React.useEffect(() => {
        if (!file) { setPreview(null); return undefined; }
        const url = URL.createObjectURL(file); setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    const valid = poll ? poll.question.trim() && poll.options.filter(o => o.trim()).length >= 2 : text.trim() || file;
    const submit = async () => {
        if (!valid) return;
        const fd = new FormData();
        if (poll) {
            fd.append('type', 'poll');
            fd.append('content', poll.question.trim());
            fd.append('poll_data', JSON.stringify({ question: poll.question.trim(), options: poll.options.filter(o => o.trim()).map(t => ({ text: t.trim() })) }));
        } else {
            fd.append('type', 'post');
            if (text.trim()) fd.append('content', text.trim());
            if (file) fd.append('image', file);
        }
        setBusy(true);
        const ok = await act(() => api.post('/timeline', fd), 'Geteilt');
        setBusy(false);
        if (ok) { setText(''); setFile(null); setPoll(null); onPosted(); }
    };

    return (
        <section className="mb-6 rounded-card bg-card p-4">
            <div className="flex gap-3">
                <Avatar user={user} size={40} />
                <div className="min-w-0 flex-1">
                    {poll ? (
                        <div className="space-y-2">
                            <input value={poll.question} onChange={e => setPoll(p => ({ ...p, question: e.target.value }))} placeholder="Deine Frage …" autoFocus aria-label="Frage" className="w-full bg-transparent py-1.5 text-body font-semibold outline-none" />
                            {poll.options.map((o, i) => (
                                <input key={i} value={o} onChange={e => setPoll(p => ({ ...p, options: p.options.map((x, j) => (j === i ? e.target.value : x)) }))} placeholder={`Antwort ${i + 1}`} aria-label={`Antwort ${i + 1}`}
                                    className="w-full rounded-[10px] bg-fill/12 px-3 py-2 text-sub outline-none" />
                            ))}
                            {poll.options.length < 10 && <button type="button" onClick={() => setPoll(p => ({ ...p, options: [...p.options, ''] }))} className="press text-sub text-accent">+ Antwort</button>}
                        </div>
                    ) : (
                        <textarea value={text} onChange={e => setText(e.target.value)} rows={text ? 3 : 1} placeholder="Was gibt’s Neues?" aria-label="Beitrag"
                            className="w-full resize-none bg-transparent py-2 text-body outline-none placeholder:text-label3" />
                    )}
                    {preview && (
                        <div className="relative mt-2 inline-block">
                            <img src={preview} alt="" className="max-h-48 rounded-cell" />
                            <button onClick={() => setFile(null)} aria-label="Bild entfernen" className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"><i className="ri-close-line"></i></button>
                        </div>
                    )}
                </div>
            </div>
            <div className="mt-3 flex items-center gap-1 border-t hairline pt-3">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { setFile(e.target.files[0] || null); setPoll(null); e.target.value = ''; }} />
                <Button size="sm" variant="plain" icon="ri-image-line" onClick={() => fileRef.current?.click()} disabled={!!poll}>Foto</Button>
                <Button size="sm" variant="plain" icon="ri-bar-chart-horizontal-line" onClick={() => { setPoll(p => (p ? null : { question: text, options: ['', ''] })); setFile(null); }}>{poll ? 'Keine Umfrage' : 'Umfrage'}</Button>
                <span className="flex-1" />
                <Button size="sm" loading={busy} disabled={!valid} onClick={submit}>Teilen</Button>
            </div>
        </section>
    );
};

const Comments = ({ post, onCount }) => {
    const { user, isAdmin } = useAuth();
    const { byId } = useMembers();
    const { data, reload } = useApi(`/timeline/${post.id}/comments`, { initial: [] });
    const [text, setText] = React.useState('');
    const act = useAction();
    const add = async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        if (await act(() => api.post(`/timeline/${post.id}/comments`, { content: text.trim() }))) { setText(''); await reload(); onCount(1); }
    };
    const remove = async (c) => { if (await act(() => api.delete(`/timeline/${post.id}/comments/${c.id}`))) { reload(); onCount(-1); } };
    return (
        <div className="space-y-3 border-t hairline px-4 py-3">
            {data.map(c => (
                <div key={c.id} className="group flex gap-2.5">
                    <Avatar user={byId[c.user_id] || { id: c.user_id, username: c.username, profile_picture: c.profile_picture }} size={30} />
                    <div className="min-w-0 flex-1">
                        <div className="inline-block max-w-full rounded-[16px] bg-fill/12 px-3 py-1.5">
                            <div className="text-footnote font-semibold">{c.username}</div>
                            <div className="whitespace-pre-wrap break-words text-sub">{c.content}</div>
                        </div>
                        <div className="mt-0.5 flex gap-3 px-3 text-caption text-label3">
                            <span>{ago(c.created_at)}</span>
                            {(c.user_id === user.id || isAdmin) && <button onClick={() => remove(c)} className="text-danger">Löschen</button>}
                        </div>
                    </div>
                </div>
            ))}
            <form onSubmit={add} className="flex items-center gap-2">
                <input value={text} onChange={e => setText(e.target.value)} placeholder="Kommentieren …" aria-label="Kommentar" className="min-w-0 flex-1 rounded-full bg-fill/12 px-3.5 py-2 text-sub outline-none" />
                <IconButton type="submit" icon="ri-send-plane-2-fill" label="Senden" variant="plain" disabled={!text.trim()} />
            </form>
        </div>
    );
};

const Post = ({ post, onChanged }) => {
    const { user, isAdmin } = useAuth();
    const { byId } = useMembers();
    const [p, setP] = React.useState(post);
    const [showComments, setShowComments] = React.useState(false);
    const [menu, setMenu] = React.useState(false);
    const [viewer, setViewer] = React.useState(false);
    const { confirm } = useFeedback();
    const act = useAction();
    React.useEffect(() => setP(post), [post]);

    const reactions = EMOJIS.map(e => ({ e, users: p.reactions.filter(r => (r.reaction === 'like' ? '❤️' : r.reaction) === e) })).filter(r => r.users.length);
    const myHeart = p.reactions.some(r => r.user_id === user.id && (r.reaction === '❤️' || r.reaction === 'like'));

    const react = async (emoji) => {
        const matches = (r) => r.user_id === user.id && (r.reaction === emoji || (emoji === '❤️' && r.reaction === 'like'));
        const existing = p.reactions.find(matches);
        const reaction = existing?.reaction || emoji;
        setP(s => ({ ...s, reactions: existing ? s.reactions.filter(r => r !== existing) : [...s.reactions, { user_id: user.id, reaction }] }));
        await act(() => api.post(`/timeline/${p.id}/react`, { reaction }));
    };
    const vote = async (optionId) => {
        const r = await act(() => api.post(`/timeline/${p.id}/vote`, { optionId }));
        if (r?.data) setP(s => ({ ...s, poll_data: r.data.poll_data }));
    };
    const remove = async () => {
        if (!(await confirm({ title: 'Beitrag löschen?', confirmText: 'Löschen', destructive: true }))) return;
        if (await act(() => api.delete(`/timeline/${p.id}`), 'Beitrag gelöscht')) onChanged();
    };

    const author = byId[p.user_id] || { id: p.user_id, username: p.username, profile_picture: p.profile_picture };
    const total = p.poll_data ? p.poll_data.options.reduce((n, o) => n + (o.votes?.length || 0), 0) : 0;

    return (
        <article className="overflow-hidden rounded-card bg-card">
            <header className="flex items-center gap-3 px-4 pt-3.5">
                <Avatar user={author} size={40} />
                <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{p.username}</div>
                    <div className="text-footnote text-label2">{[p.display_role, ago(p.created_at)].filter(Boolean).join(' · ')}</div>
                </div>
                {(p.user_id === user.id || isAdmin) && <IconButton icon="ri-more-fill" label="Optionen" variant="plain" onClick={() => setMenu(true)} />}
            </header>
            {p.content && p.type !== 'poll' && <p className="whitespace-pre-wrap break-words px-4 pt-2.5 text-body">{p.content}</p>}
            {p.media_url && <button onClick={() => setViewer(true)} className="mt-3 block w-full bg-black/5"><img src={uploadUrl(p.media_url)} alt="" loading="lazy" className="mx-auto max-h-[520px] w-full object-cover" /></button>}
            {p.poll_data && (
                <div className="space-y-2 px-4 pt-3">
                    <p className="font-semibold">{p.poll_data.question || p.content}</p>
                    {p.poll_data.options.map(o => {
                        const n = o.votes?.length || 0;
                        const mine = (o.votes || []).includes(user.id);
                        const pct = total ? Math.round((n / total) * 100) : 0;
                        return (
                            <button key={o.id} onClick={() => vote(o.id)} className={cx('press relative block w-full overflow-hidden rounded-cell border px-3 py-2.5 text-left', mine ? 'border-accent' : 'hairline')}>
                                <span className="absolute inset-y-0 left-0 bg-accent/12" style={{ width: `${pct}%` }} />
                                <span className="relative flex items-center gap-2 text-sub">
                                    {mine && <i className="ri-checkbox-circle-fill text-accent"></i>}
                                    <span className="flex-1">{o.text}</span>
                                    <span className="font-semibold text-label2">{pct}%</span>
                                </span>
                            </button>
                        );
                    })}
                    <p className="text-footnote text-label2">{total} {total === 1 ? 'Stimme' : 'Stimmen'}</p>
                </div>
            )}
            <div className="flex items-center gap-1 px-2 py-2">
                <button onClick={() => react('❤️')} aria-label="Gefällt mir" className={cx('press flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sub font-medium', myHeart ? 'text-danger' : 'text-label2')}>
                    <i className={cx(myHeart ? 'ri-heart-fill' : 'ri-heart-line', 'text-lg')}></i>{reactions.find(r => r.e === '❤️')?.users.length || ''}
                </button>
                <button onClick={() => setShowComments(s => !s)} aria-label="Kommentare" className="press flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sub font-medium text-label2">
                    <i className="ri-chat-1-line text-lg"></i>{p.comment_count || ''}<span className="hidden sm:inline">Kommentare</span>
                </button>
                <span className="flex-1" />
                <div className="flex">
                    {EMOJIS.slice(1).map(e => <button key={e} onClick={() => react(e)} className="press rounded-full px-1.5 py-1 text-lg opacity-80 hover:opacity-100" aria-label={`Reaktion ${e}`}>{e}</button>)}
                </div>
            </div>
            {reactions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                    {reactions.map(r => (
                        <span key={r.e} title={r.users.map(u => byId[u.user_id]?.username).filter(Boolean).join(', ')} className="rounded-full bg-fill/12 px-2 py-0.5 text-footnote">{r.e} {r.users.length}</span>
                    ))}
                </div>
            )}
            {showComments && <Comments post={p} onCount={(d) => setP(s => ({ ...s, comment_count: (s.comment_count || 0) + d }))} />}
            <ActionSheet open={menu} onClose={() => setMenu(false)} actions={[{ label: 'Beitrag löschen', icon: 'ri-delete-bin-line', destructive: true, onClick: remove }]} />
            {viewer && (
                <button type="button" onClick={() => setViewer(false)} className="anim-fade fixed inset-0 z-[300] flex items-center justify-center bg-black/90 p-4" aria-label="Schließen">
                    <img src={uploadUrl(p.media_url)} alt="" className="max-h-full max-w-full object-contain" />
                </button>
            )}
        </article>
    );
};

export default function Timeline() {
    const { data, loading, error, reload } = useApi('/timeline', { initial: [], interval: 30000 });
    return (
        <Page title="Timeline">
            <Composer onPosted={reload} />
            {error && <ErrorNote error={error} onRetry={reload} />}
            {loading ? <Loading /> : data.length === 0 ? (
                <Empty icon="ri-quill-pen-line" title="Noch keine Beiträge" text="Teile Fotos, Neuigkeiten oder starte eine Umfrage." />
            ) : (
                <div className="space-y-4">{data.map(p => <Post key={p.id} post={p} onChanged={reload} />)}</div>
            )}
        </Page>
    );
}

