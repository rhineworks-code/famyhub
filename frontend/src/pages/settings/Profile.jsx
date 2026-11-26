import React from 'react';
import api from '../../lib/api';
import { useAuth, useMembers } from '../../lib/auth';
import { Page, FormGroup, InputRow, Button, Avatar, Spinner, useAction } from '../../ui';

export default function Profile() {
    const { user, refresh } = useAuth();
    const { reload } = useMembers();
    const [f, setF] = React.useState({ email: user.email || '', display_role: user.display_role || '' });
    const [roles, setRoles] = React.useState([]);
    const [busy, setBusy] = React.useState(false);
    const [uploading, setUploading] = React.useState(false);
    const fileRef = React.useRef(null);
    const act = useAction();

    React.useEffect(() => { api.get('/auth/family/roles').then(r => setRoles(r.data)).catch(() => {}); }, []);
    const dirty = f.email !== (user.email || '') || f.display_role !== (user.display_role || '');

    const save = async () => {
        setBusy(true);
        if (await act(() => api.put('/auth/profile', f), 'Profil gespeichert')) { await refresh(); reload(); }
        setBusy(false);
    };
    const upload = async (file) => {
        const fd = new FormData();
        fd.append('avatar', file);
        setUploading(true);
        if (await act(() => api.post('/auth/profile/upload', fd), 'Profilbild aktualisiert')) { await refresh(); reload(); }
        setUploading(false);
    };

    return (
        <Page back="/settings" title="Profil">
            <div className="mb-7 flex flex-col items-center">
                <button onClick={() => fileRef.current?.click()} className="press relative" aria-label="Profilbild ändern">
                    <Avatar user={user} size={104} />
                    <span className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-bg bg-tint text-white">
                        {uploading ? <Spinner className="h-4 w-4" /> : <i className="ri-camera-fill"></i>}
                    </span>
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files[0]; e.target.value = ''; if (file) upload(file); }} />
                <h2 className="mt-3 text-title2 font-bold">{user.username}</h2>
                <p className="text-footnote text-label2">{user.role === 'admin' ? 'Admin' : 'Mitglied'}</p>
            </div>
            <form onSubmit={e => { e.preventDefault(); if (dirty) save(); }} className="space-y-6">
                <FormGroup footer="Den Benutzernamen kann ein Familien-Admin ändern.">
                    <InputRow label="E-Mail" type="email" autoCapitalize="none" value={f.email} onChange={e => setF(s => ({ ...s, email: e.target.value }))} />
                    <InputRow label="Rolle" list="fh-roles" placeholder="z. B. Mama, Papa, Kind" value={f.display_role} onChange={e => setF(s => ({ ...s, display_role: e.target.value }))} />
                    <datalist id="fh-roles">{roles.map(r => <option key={r.id} value={r.name} />)}</datalist>
                </FormGroup>
                <Button type="submit" full disabled={!dirty} loading={busy}>Speichern</Button>
            </form>
        </Page>
    );
}
