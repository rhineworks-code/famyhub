import React from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import api, { uploadUrl } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useAuth, useMembers } from '../lib/auth';
import { fmtDate } from '../lib/format';
import { Page, IconButton, Button, Sheet, Field, FormGroup, Empty, Loading, ErrorNote, ActionSheet, Avatar, Toggle, Spinner, useFeedback, useAction, cx } from '../ui';

const NameSheet = ({ open, onClose, initial = '', title, onSave }) => {
    const [name, setName] = React.useState('');
    React.useEffect(() => { if (open) setName(initial); }, [open, initial]);
    return (
        <Sheet open={open} onClose={onClose} title={title} onSave={() => name.trim() && onSave(name.trim())} saveDisabled={!name.trim()}>
            <form onSubmit={e => { e.preventDefault(); if (name.trim()) onSave(name.trim()); }}><Field label="Name" value={name} onChange={e => setName(e.target.value)} autoFocus /></form>
        </Sheet>
    );
};

const Albums = () => {
    const { data, loading, error, reload } = useApi('/gallery/albums', { initial: [] });
    const [creating, setCreating] = React.useState(false);
    const navigate = useNavigate();
    const act = useAction();
    const create = async (name) => {
        const r = await act(() => api.post('/gallery/albums', { name }), 'Album erstellt');
        setCreating(false);
        if (r?.data) navigate(`/gallery/${r.data.id}`);
    };
    return (
        <Page wide title="Galerie" actions={<IconButton icon="ri-add-line" label="Neues Album" variant="filled" onClick={() => setCreating(true)} />}>
            {error && <ErrorNote error={error} onRetry={reload} />}
            {loading ? <Loading /> : data.length === 0 ? (
                <Empty icon="ri-image-2-line" title="Noch keine Alben" text="Lege ein Album an und lade die ersten Fotos hoch." action={<Button icon="ri-add-line" onClick={() => setCreating(true)}>Album erstellen</Button>} />
            ) : (
                <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
                    {data.map(a => (
                        <Link key={a.id} to={`/gallery/${a.id}`} className="press block">
                            <div className="aspect-square overflow-hidden rounded-card bg-fill/15">
                                {a.cover_photo
                                    ? <img src={uploadUrl(a.cover_photo)} alt="" loading="lazy" className="h-full w-full object-cover" />
                                    : <div className="flex h-full items-center justify-center text-[40px] text-label3"><i className="ri-image-line"></i></div>}
                            </div>
                            <div className="mt-2 truncate px-0.5 text-sub font-semibold">{a.name}</div>
                            <div className="px-0.5 text-footnote text-label2">{a.photo_count} {a.photo_count === 1 ? 'Foto' : 'Fotos'}</div>
                        </Link>
                    ))}
                </div>
            )}
            <NameSheet open={creating} onClose={() => setCreating(false)} title="Neues Album" onSave={create} />
        </Page>
    );
};

const Viewer = ({ photos, index, onClose, onIndex, onDelete, canDelete }) => {
    const photo = photos[index];
    const touch = React.useRef(null);
    React.useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'ArrowRight') onIndex(Math.min(photos.length - 1, index + 1));
            if (e.key === 'ArrowLeft') onIndex(Math.max(0, index - 1));
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [index, photos.length, onIndex, onClose]);
    if (!photo) return null;
    return (
        <div className="anim-fade fixed inset-0 z-[300] flex flex-col bg-black text-white" role="dialog" aria-modal="true"
            onTouchStart={e => { touch.current = e.touches[0].clientX; }}
            onTouchEnd={e => { const dx = e.changedTouches[0].clientX - (touch.current ?? 0); if (dx < -50) onIndex(Math.min(photos.length - 1, index + 1)); if (dx > 50) onIndex(Math.max(0, index - 1)); }}>
            <div className="safe-top flex items-center gap-2 px-3 py-2">
                <button onClick={onClose} className="press rounded-full px-2 py-1 text-body">Fertig</button>
                <span className="flex-1 text-center text-footnote opacity-75">{index + 1} von {photos.length}</span>
                <a href={uploadUrl(photo.filename)} download={photo.original_name || true} className="press rounded-full p-2 text-xl" aria-label="Herunterladen"><i className="ri-download-2-line"></i></a>
                {canDelete(photo) && <button onClick={() => onDelete(photo)} className="press rounded-full p-2 text-xl" aria-label="Löschen"><i className="ri-delete-bin-line"></i></button>}
            </div>
            <div className="relative flex flex-1 items-center justify-center overflow-hidden">
                <img key={photo.id} src={uploadUrl(photo.filename)} alt={photo.original_name || ''} className="anim-fade max-h-full max-w-full object-contain" />
                {index > 0 && <button onClick={() => onIndex(index - 1)} className="absolute left-3 hidden h-11 w-11 items-center justify-center rounded-full bg-white/15 text-2xl md:flex" aria-label="Vorheriges"><i className="ri-arrow-left-s-line"></i></button>}
                {index < photos.length - 1 && <button onClick={() => onIndex(index + 1)} className="absolute right-3 hidden h-11 w-11 items-center justify-center rounded-full bg-white/15 text-2xl md:flex" aria-label="Nächstes"><i className="ri-arrow-right-s-line"></i></button>}
            </div>
            <div className="safe-bottom px-4 py-3 text-center text-footnote opacity-70">{fmtDate(photo.created_at)}</div>
        </div>
    );
};

const AccessSheet = ({ open, onClose, album, onChanged }) => {
    const { members } = useMembers();
    const act = useAction();
    const has = (id) => (album?.access_user_ids || []).includes(id) || album?.created_by === id;
    const toggle = async (m, on) => {
        if (await act(() => (on ? api.post(`/gallery/albums/${album.id}/access`, { user_id: m.id }) : api.delete(`/gallery/albums/${album.id}/access/${m.id}`)))) onChanged();
    };
    return (
        <Sheet open={open} onClose={onClose} title="Wer darf das Album sehen?">
            <FormGroup footer="Admins sehen alle Alben.">
                {members.map(m => (
                    <div key={m.id} className="flex min-h-[52px] items-center gap-3 px-4">
                        <Avatar user={m} size={32} />
                        <span className="flex-1">{m.username}{m.id === album?.created_by && <span className="text-label2"> · Ersteller</span>}</span>
                        <Toggle checked={has(m.id)} disabled={m.id === album?.created_by} onChange={(on) => toggle(m, on)} label={m.username} />
                    </div>
                ))}
            </FormGroup>
        </Sheet>
    );
};

const Album = () => {
    const { id } = useParams();
    const { user, isAdmin } = useAuth();
    const navigate = useNavigate();
    const { data, loading, error, reload } = useApi(`/gallery/albums/${id}`);
    const [viewer, setViewer] = React.useState(null);
    const [menu, setMenu] = React.useState(false);
    const [rename, setRename] = React.useState(false);
    const [access, setAccess] = React.useState(false);
    const [uploading, setUploading] = React.useState(false);
    const fileRef = React.useRef(null);
    const { confirm } = useFeedback();
    const act = useAction();

    if (loading) return <Loading />;
    if (error) return <Page back="/gallery" title="Album"><ErrorNote error={error} onRetry={reload} /></Page>;
    const { album, photos } = data;
    const owner = album.created_by === user.id || isAdmin;
    const canDelete = (p) => p.uploaded_by === user.id || owner;

    const upload = async (files) => {
        if (!files.length) return;
        setUploading(true);
        // In Paketen zu 30 hochladen (Server-Limit).
        for (let i = 0; i < files.length; i += 30) {
            const fd = new FormData();
            files.slice(i, i + 30).forEach(f => fd.append('photos', f));
            await act(() => api.post(`/gallery/albums/${id}/upload`, fd, { timeout: 0 }));
        }
        setUploading(false);
        reload();
    };
    const removePhoto = async (p) => {
        if (!(await confirm({ title: 'Foto löschen?', confirmText: 'Löschen', destructive: true }))) return;
        if (await act(() => api.delete(`/gallery/photos/${p.id}`), 'Foto gelöscht')) {
            if (photos.length <= 1) setViewer(null); else setViewer(i => Math.min(i, photos.length - 2));
            reload();
        }
    };
    const removeAlbum = async () => {
        if (!(await confirm({ title: `„${album.name}“ löschen?`, message: `${photos.length} Fotos werden ebenfalls gelöscht.`, confirmText: 'Löschen', destructive: true }))) return;
        if (await act(() => api.delete(`/gallery/albums/${id}`), 'Album gelöscht')) navigate('/gallery');
    };

    return (
        <Page wide back="/gallery" title={album.name} subtitle={`${photos.length} ${photos.length === 1 ? 'Foto' : 'Fotos'}`}
            actions={<>
                {owner && <IconButton icon="ri-more-fill" label="Album-Optionen" variant="gray" onClick={() => setMenu(true)} />}
                <IconButton icon={uploading ? 'ri-loader-4-line animate-spin' : 'ri-upload-2-line'} label="Fotos hochladen" variant="filled" disabled={uploading} onClick={() => fileRef.current?.click()} />
            </>}>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { const f = [...e.target.files]; e.target.value = ''; upload(f); }} />
            {uploading && <div className="mb-4 flex items-center gap-2 rounded-cell bg-accent/12 px-4 py-3 text-sub text-accent"><Spinner className="h-4 w-4" /> Fotos werden hochgeladen …</div>}
            {photos.length === 0 ? (
                <Empty icon="ri-image-add-line" title="Album ist leer" action={<Button icon="ri-upload-2-line" onClick={() => fileRef.current?.click()}>Fotos hochladen</Button>} />
            ) : (
                <div className="-mx-4 grid grid-cols-3 gap-0.5 md:mx-0 md:grid-cols-5 md:gap-1.5 lg:grid-cols-6">
                    {photos.map((p, i) => (
                        <button key={p.id} onClick={() => setViewer(i)} className={cx('aspect-square overflow-hidden bg-fill/15 md:rounded-cell')}>
                            <img src={uploadUrl(p.filename)} alt="" loading="lazy" className="h-full w-full object-cover transition-transform hover:scale-105" />
                        </button>
                    ))}
                </div>
            )}
            {viewer !== null && <Viewer photos={photos} index={viewer} onIndex={setViewer} onClose={() => setViewer(null)} onDelete={removePhoto} canDelete={canDelete} />}
            <ActionSheet open={menu} onClose={() => setMenu(false)} title={album.name} actions={[
                { label: 'Umbenennen', icon: 'ri-edit-line', onClick: () => setRename(true) },
                { label: 'Freigaben', icon: 'ri-user-shared-line', onClick: () => setAccess(true) },
                { label: 'Album löschen', icon: 'ri-delete-bin-line', destructive: true, onClick: removeAlbum },
            ]} />
            <NameSheet open={rename} onClose={() => setRename(false)} title="Album umbenennen" initial={album.name}
                onSave={async (name) => { if (await act(() => api.put(`/gallery/albums/${id}`, { name }), 'Umbenannt')) { setRename(false); reload(); } }} />
            <AccessSheet open={access} onClose={() => setAccess(false)} album={album} onChanged={reload} />
        </Page>
    );
};

export default function Gallery() {
    return (
        <Routes>
            <Route index element={<Albums />} />
            <Route path=":id" element={<Album />} />
        </Routes>
    );
}
