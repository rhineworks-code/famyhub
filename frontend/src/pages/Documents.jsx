import React from 'react';
import api, { documentUrl } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useAuth } from '../lib/auth';
import { COLORS, fmtDate } from '../lib/format';
import { Page, Section, Row, Segmented, Chip, IconButton, Button, Sheet, FormGroup, InputRow, ToggleRow, SearchField, ColorPicker, Check, Toggle, Empty, Loading, ErrorNote, Spinner, useFeedback, useAction, cx } from '../ui';

const fileIcon = (name = '') => {
    const ext = name.split('.').pop().toLowerCase();
    if (ext === 'pdf') return ['ri-file-pdf-2-fill', '#FF3B30'];
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'tif', 'tiff'].includes(ext)) return ['ri-image-fill', '#34C759'];
    return ['ri-file-text-fill', '#5AC8FA'];
};
const isImage = (name) => fileIcon(name)[0] === 'ri-image-fill' && !/\.(heic|tiff?)$/i.test(name);

const DocSheet = ({ doc, open, onClose, categories, tags, onChanged }) => {
    const { user, isAdmin } = useAuth();
    const [f, setF] = React.useState(null);
    const [showText, setShowText] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const { confirm, toast } = useFeedback();
    const act = useAction();
    React.useEffect(() => { if (open && doc) { setF({ title: doc.title, category_id: doc.category_id || '', is_shared: !!doc.is_shared, tagIds: doc.tags.map(t => t.id) }); setShowText(false); } }, [open, doc]);
    if (!doc || !f) return null;
    const owner = doc.user_id === user.id || isAdmin;

    const save = async () => {
        setSaving(true);
        const body = { title: f.title, category_id: f.category_id || null, tagIds: f.tagIds };
        if (owner) body.is_shared = f.is_shared;
        const ok = await act(() => api.put(`/documents/${doc.id}`, body), 'Gespeichert');
        setSaving(false);
        if (ok) { onChanged(); onClose(); }
    };
    const archive = async () => { if (await act(() => api.put(`/documents/${doc.id}`, { is_archived: !doc.is_archived }), doc.is_archived ? 'Wiederhergestellt' : 'Archiviert')) { onChanged(); onClose(); } };
    const remove = async () => {
        if (!(await confirm({ title: `„${doc.title}“ löschen?`, message: 'Die Datei wird endgültig gelöscht.', confirmText: 'Löschen', destructive: true }))) return;
        if (await act(() => api.delete(`/documents/${doc.id}`), 'Gelöscht')) { onChanged(); onClose(); }
    };
    const reextract = async () => { if (await act(() => api.post(`/documents/${doc.id}/reextract`))) toast('Texterkennung läuft im Hintergrund …'); };

    return (
        <Sheet open={open} onClose={onClose} title="Dokument" onSave={save} saving={saving} size="xl">
            <div className="grid gap-6 md:grid-cols-[1fr_320px]">
                <div className="overflow-hidden rounded-card bg-card">
                    {isImage(doc.filename)
                        ? <img src={documentUrl(doc.filename)} alt="" className="max-h-[60vh] w-full object-contain" />
                        : /\.pdf$/i.test(doc.filename)
                            ? <iframe src={documentUrl(doc.filename)} title={doc.title} className="h-[60vh] w-full" />
                            : <div className="flex h-48 items-center justify-center text-label3"><i className="ri-file-text-line text-5xl"></i></div>}
                </div>
                <div className="space-y-5">
                    <FormGroup>
                        <InputRow placeholder="Titel" value={f.title} onChange={e => setF(s => ({ ...s, title: e.target.value }))} />
                        <InputRow as="select" label="Kategorie" value={f.category_id} onChange={e => setF(s => ({ ...s, category_id: e.target.value }))}>
                            <option value="">Keine</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </InputRow>
                        {owner && <ToggleRow label="Mit Familie teilen" checked={f.is_shared} onChange={v => setF(s => ({ ...s, is_shared: v }))} />}
                    </FormGroup>
                    {tags.length > 0 && (
                        <div>
                            <p className="mb-1.5 px-4 text-footnote font-semibold uppercase tracking-wide text-label2">Tags</p>
                            <div className="flex flex-wrap gap-1.5 px-1">
                                {tags.map(t => {
                                    const on = f.tagIds.includes(t.id);
                                    return <button key={t.id} type="button" onClick={() => setF(s => ({ ...s, tagIds: on ? s.tagIds.filter(x => x !== t.id) : [...s.tagIds, t.id] }))}
                                        className={cx('press rounded-full px-2.5 py-1 text-footnote font-medium', on ? 'text-white' : 'bg-card text-label2')} style={on ? { backgroundColor: t.color } : undefined}>#{t.name}</button>;
                                })}
                            </div>
                        </div>
                    )}
                    <p className="px-1 text-footnote text-label2">Hochgeladen am {fmtDate(doc.created_at)}{doc.owner_name ? ` von ${doc.owner_name}` : ''}</p>
                    <div className="grid grid-cols-2 gap-2">
                        <a href={documentUrl(doc.filename, true)} className="press flex h-11 items-center justify-center gap-1.5 rounded-cell bg-accent/12 font-semibold text-accent"><i className="ri-download-2-line"></i>Laden</a>
                        <Button variant="gray" icon={doc.is_archived ? 'ri-inbox-unarchive-line' : 'ri-archive-line'} onClick={archive}>{doc.is_archived ? 'Zurück' : 'Archiv'}</Button>
                        <Button variant="gray" icon="ri-text" onClick={() => setShowText(s => !s)}>Text</Button>
                        <Button variant="destructive" icon="ri-delete-bin-line" onClick={remove}>Löschen</Button>
                    </div>
                    {showText && (
                        <div className="rounded-card bg-card p-3">
                            <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-sans text-footnote text-label2">{doc.content_text || 'Kein Text erkannt.'}</pre>
                            <button onClick={reextract} className="press mt-2 text-footnote font-medium text-accent">Text neu erkennen</button>
                        </div>
                    )}
                </div>
            </div>
        </Sheet>
    );
};

const LabelsSheet = ({ open, onClose, categories, tags, onChanged }) => {
    const [kind, setKind] = React.useState('categories');
    const [name, setName] = React.useState('');
    const [color, setColor] = React.useState(COLORS[1]);
    const act = useAction();
    const list = kind === 'categories' ? categories : tags;
    const add = async () => { if (name.trim() && await act(() => api.post(`/documents/${kind}`, { name: name.trim(), color }))) { setName(''); onChanged(); } };
    const remove = async (x) => { if (await act(() => api.delete(`/documents/${kind}/${x.id}`))) onChanged(); };
    return (
        <Sheet open={open} onClose={onClose} title="Kategorien & Tags">
            <div className="space-y-5">
                <Segmented value={kind} onChange={setKind} options={[{ value: 'categories', label: 'Kategorien' }, { value: 'tags', label: 'Tags' }]} />
                <FormGroup footer="Neue Dokumente werden automatisch zugeordnet, wenn der Name im Text vorkommt.">
                    {list.map(x => (
                        <div key={x.id} className="flex min-h-[46px] items-center gap-3 px-4">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: x.color }} />
                            <span className="flex-1">{kind === 'tags' ? '#' : ''}{x.name}</span>
                            <IconButton icon="ri-delete-bin-line" label="Löschen" variant="plain" className="text-danger" onClick={() => remove(x)} />
                        </div>
                    ))}
                    <form onSubmit={e => { e.preventDefault(); add(); }} className="flex items-center gap-2 px-4">
                        <input value={name} onChange={e => setName(e.target.value)} placeholder={kind === 'tags' ? 'Neuer Tag' : 'Neue Kategorie'} aria-label="Name" className="min-w-0 flex-1 bg-transparent py-3 text-body outline-none" />
                        <IconButton type="submit" icon="ri-add-line" label="Hinzufügen" variant="tinted" disabled={!name.trim()} />
                    </form>
                </FormGroup>
                <div className="px-1"><ColorPicker colors={COLORS} value={color} onChange={setColor} /></div>
            </div>
        </Sheet>
    );
};

export default function Documents() {
    const [archived, setArchived] = React.useState(false);
    const { data, loading, error, reload } = useApi(`/documents?archived=${archived}`, { initial: [] });
    const { data: categories, reload: reloadCats } = useApi('/documents/categories', { initial: [] });
    const { data: tags, reload: reloadTags } = useApi('/documents/tags', { initial: [] });
    const [q, setQ] = React.useState('');
    const [cat, setCat] = React.useState(null);
    const [tag, setTag] = React.useState(null);
    const [open, setOpen] = React.useState(null);
    const [labels, setLabels] = React.useState(false);
    const [uploading, setUploading] = React.useState(0);
    const [shareNew, setShareNew] = React.useState(() => localStorage.getItem('fh_doc_share') !== '0');
    const [selecting, setSelecting] = React.useState(false);
    const [selected, setSelected] = React.useState([]);
    const fileRef = React.useRef(null);
    const { confirm, toast } = useFeedback();
    const act = useAction();

    const needle = q.trim().toLowerCase();
    const shown = data.filter(d => (!cat || d.category_id === cat) && (!tag || d.tags.some(t => t.id === tag))
        && (!needle || d.title.toLowerCase().includes(needle) || (d.content_text || '').toLowerCase().includes(needle)));

    const upload = async (files) => {
        setUploading(files.length);
        let n = 0;
        for (const file of files) {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('is_shared', shareNew ? '1' : '0');
            if (cat) fd.append('category_id', cat);
            if (await act(() => api.post('/documents', fd, { timeout: 0 }))) n += 1;
            setUploading(u => u - 1);
        }
        setUploading(0);
        if (n) toast(`${n} ${n === 1 ? 'Dokument' : 'Dokumente'} hochgeladen`);
        reload();
    };
    const bulk = async (kind) => {
        if (kind === 'delete' && !(await confirm({ title: `${selected.length} Dokumente löschen?`, confirmText: 'Löschen', destructive: true }))) return;
        const ok = await act(() => (kind === 'delete' ? api.post('/documents/bulk-delete', { ids: selected }) : api.post('/documents/bulk-update', { ids: selected, updates: { is_archived: !archived } })), 'Erledigt');
        if (ok) { setSelected([]); setSelecting(false); reload(); }
    };
    const snippet = (d) => {
        if (!needle || !d.content_text) return null;
        const i = d.content_text.toLowerCase().indexOf(needle);
        if (i < 0) return null;
        return `…${d.content_text.slice(Math.max(0, i - 30), i + 60).replace(/\s+/g, ' ')}…`;
    };

    return (
        <Page wide title="Dokumente" actions={<>
            <IconButton icon="ri-price-tag-3-line" label="Kategorien & Tags" variant="gray" onClick={() => setLabels(true)} />
            <IconButton icon={uploading ? 'ri-loader-4-line animate-spin' : 'ri-upload-2-line'} label="Hochladen" variant="filled" disabled={!!uploading} onClick={() => fileRef.current?.click()} />
        </>}>
            <input ref={fileRef} type="file" multiple accept=".pdf,image/*,.txt" className="hidden" onChange={e => { const f = [...e.target.files]; e.target.value = ''; if (f.length) upload(f); }} />
            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center">
                <div className="flex-1"><SearchField value={q} onChange={setQ} placeholder="Titel und Inhalt durchsuchen" /></div>
                <Segmented className="md:w-64" value={archived ? 'a' : 'd'} onChange={v => { setArchived(v === 'a'); setSelected([]); }} options={[{ value: 'd', label: 'Dokumente' }, { value: 'a', label: 'Archiv' }]} />
            </div>
            {(categories.length > 0 || tags.length > 0) && (
                <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
                    <Chip active={!cat && !tag} onClick={() => { setCat(null); setTag(null); }}>Alle</Chip>
                    {categories.map(c => <Chip key={`c${c.id}`} active={cat === c.id} color={c.color} onClick={() => { setCat(cat === c.id ? null : c.id); setTag(null); }}>{c.name}</Chip>)}
                    {tags.map(t => <Chip key={`t${t.id}`} active={tag === t.id} color={t.color} onClick={() => { setTag(tag === t.id ? null : t.id); setCat(null); }}>#{t.name}</Chip>)}
                </div>
            )}
            {uploading > 0 && <div className="mb-4 flex items-center gap-2 rounded-cell bg-accent/12 px-4 py-3 text-sub text-accent"><Spinner className="h-4 w-4" /> Lade hoch und erkenne Text … (noch {uploading})</div>}
            {error && <ErrorNote error={error} onRetry={reload} />}
            {loading ? <Loading /> : shown.length === 0 ? (
                <Empty icon="ri-file-text-line" title={needle ? 'Nichts gefunden' : archived ? 'Archiv ist leer' : 'Noch keine Dokumente'} text={!needle && !archived ? 'PDFs und Fotos von Briefen werden automatisch durchsuchbar gemacht.' : undefined}
                    action={!archived && !needle && <Button icon="ri-upload-2-line" onClick={() => fileRef.current?.click()}>Dokument hochladen</Button>} />
            ) : (
                <Section title={`${shown.length} ${shown.length === 1 ? 'Dokument' : 'Dokumente'}`}
                    action={<button onClick={() => { setSelecting(s => !s); setSelected([]); }} className="press text-footnote font-medium text-accent">{selecting ? 'Fertig' : 'Auswählen'}</button>}>
                    {shown.map(d => {
                        const [icon, color] = fileIcon(d.filename);
                        const sel = selected.includes(d.id);
                        return (
                            <Row key={d.id} icon={selecting ? undefined : icon} color={color}
                                leading={selecting && <Check checked={sel} onChange={() => setSelected(s => (sel ? s.filter(x => x !== d.id) : [...s, d.id]))} />}
                                onClick={() => (selecting ? setSelected(s => (sel ? s.filter(x => x !== d.id) : [...s, d.id])) : setOpen(d))}
                                title={d.title}
                                subtitle={snippet(d) || [fmtDate(d.created_at), d.category_name, !d.is_shared && 'privat', ...d.tags.map(t => `#${t.name}`)].filter(Boolean).join(' · ')}
                                right={d.category_color && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.category_color }} />} chevron={!selecting} />
                        );
                    })}
                </Section>
            )}
            {!archived && <div className="flex items-center justify-between rounded-card bg-card px-4 py-1.5"><span className="text-sub">Neue Dokumente mit Familie teilen</span><Toggle label="Neue Dokumente teilen" checked={shareNew} onChange={(v) => { setShareNew(v); localStorage.setItem('fh_doc_share', v ? '1' : '0'); }} /></div>}
            {selecting && selected.length > 0 && (
                <div className="glass fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+64px)] z-40 mx-auto flex max-w-md items-center gap-2 rounded-card p-2 shadow-pop md:bottom-6">
                    <span className="flex-1 px-2 text-sub font-medium">{selected.length} ausgewählt</span>
                    <Button size="sm" variant="tinted" icon={archived ? 'ri-inbox-unarchive-line' : 'ri-archive-line'} onClick={() => bulk('archive')}>{archived ? 'Zurück' : 'Archiv'}</Button>
                    <Button size="sm" variant="destructive" icon="ri-delete-bin-line" onClick={() => bulk('delete')}>Löschen</Button>
                </div>
            )}
            <DocSheet doc={open} open={!!open} onClose={() => setOpen(null)} categories={categories} tags={tags} onChanged={reload} />
            <LabelsSheet open={labels} onClose={() => setLabels(false)} categories={categories} tags={tags} onChanged={() => { reloadCats(); reloadTags(); reload(); }} />
        </Page>
    );
}

