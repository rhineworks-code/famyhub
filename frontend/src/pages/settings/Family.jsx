import React from 'react';
import api from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useAuth, useMembers } from '../../lib/auth';
import { FEATURES } from '../../lib/features';
import { ago, toDate } from '../../lib/format';
import { Page, Section, Row, Avatar, Button, Sheet, Form, FormGroup, InputRow, ToggleRow, IconTile, IconButton, Segmented, useFeedback, useAction } from '../../ui';
import { PUSH_TYPES } from './Notifications';

const MemberSheet = ({ open, onClose, member, onSaved }) => {
    const { user } = useAuth();
    const [tab, setTab] = React.useState('profile');
    const [f, setF] = React.useState({});
    const [perms, setPerms] = React.useState({});
    const [pw, setPw] = React.useState('');
    const [saving, setSaving] = React.useState(false);
    const { confirm } = useFeedback();
    const act = useAction();
    const isNew = !member;

    React.useEffect(() => {
        if (!open) return;
        setTab('profile'); setPw('');
        setF(member ? { username: member.username, email: member.email?.endsWith('@famyhub.local') ? '' : member.email, display_role: member.display_role || '', role: member.role } : { username: '', email: '', display_role: '', role: 'member', password: '' });
        setPerms(member?.permissions || {});
    }, [open, member]);

    const save = async () => {
        setSaving(true);
        let ok;
        if (isNew) {
            ok = await act(() => api.post('/auth/family/members', { ...f, email: f.email || undefined }), `${f.username} wurde angelegt`);
        } else {
            ok = await act(async () => {
                const body = { username: f.username, display_role: f.display_role, role: f.role };
                if (f.email) body.email = f.email;
                await api.put(`/auth/family/members/${member.id}`, body);
                await api.put(`/auth/user/${member.id}/permissions`, { permissions: perms });
            }, 'Gespeichert');
        }
        setSaving(false);
        if (ok) { onSaved(); onClose(); }
    };
    const resetPw = async () => {
        if (pw.length < 6) return;
        if (await act(() => api.post(`/auth/admin/reset-password/${member.id}`, { newPassword: pw }), 'Passwort zurückgesetzt')) setPw('');
    };
    const remove = async () => {
        if (!(await confirm({ title: `${member.username} entfernen?`, message: 'Das Konto und private Daten (Wunschlisten, private Tresor-Einträge) werden gelöscht. Gemeinsame Daten bleiben erhalten.', confirmText: 'Entfernen', destructive: true }))) return;
        if (await act(() => api.delete(`/auth/family/members/${member.id}`), 'Mitglied entfernt')) { onSaved(); onClose(); }
    };
    const set = (k) => (v) => setF(s => ({ ...s, [k]: v?.target ? v.target.value : v }));
    const valid = f.username?.trim() && (!isNew || (f.password || '').length >= 6);

    return (
        <Sheet open={open} onClose={onClose} title={isNew ? 'Neues Mitglied' : member.username} onSave={save} saving={saving} saveDisabled={!valid} saveLabel={isNew ? 'Anlegen' : 'Sichern'}>
            <div className="space-y-6">
                {!isNew && f.role !== 'admin' && <Segmented value={tab} onChange={setTab} options={[{ value: 'profile', label: 'Profil' }, { value: 'perms', label: 'Module' }, { value: 'notify', label: 'Mitteilungen' }]} />}
                {tab === 'profile' && (
                    <Form onSubmit={save} className="space-y-6">
                        <FormGroup footer={isNew ? 'Kinder brauchen keine E-Mail-Adresse.' : undefined}>
                            <InputRow label="Name" value={f.username || ''} onChange={set('username')} autoFocus={isNew} autoCapitalize="none" />
                            <InputRow label="E-Mail" type="email" placeholder="optional" autoCapitalize="none" value={f.email || ''} onChange={set('email')} />
                            <InputRow label="Rolle" placeholder="z. B. Kind, Oma" value={f.display_role || ''} onChange={set('display_role')} />
                            {isNew && <InputRow label="Passwort" type="password" autoComplete="new-password" placeholder="min. 6 Zeichen" value={f.password || ''} onChange={set('password')} />}
                        </FormGroup>
                        <FormGroup footer="Admins (Eltern) dürfen alles: Aufgaben vergeben, Taschengeld buchen, Mitglieder verwalten.">
                            <ToggleRow label="Admin" icon="ri-vip-crown-fill" color="#FF9500" checked={f.role === 'admin'} onChange={(v) => setF(s => ({ ...s, role: v ? 'admin' : 'member' }))} />
                        </FormGroup>
                        {!isNew && (
                            <FormGroup title="Passwort zurücksetzen">
                                <div className="flex items-center gap-2 pr-3">
                                    <InputRow className="flex-1" type="password" autoComplete="new-password" placeholder="Neues Passwort" value={pw} onChange={e => setPw(e.target.value)} />
                                    <Button size="sm" variant="tinted" disabled={pw.length < 6} onClick={resetPw}>Setzen</Button>
                                </div>
                            </FormGroup>
                        )}
                        {!isNew && member.id !== user.id && <Button variant="destructive" full onClick={remove}>Aus der Familie entfernen</Button>}
                    </Form>
                )}
                {tab === 'perms' && (
                    <FormGroup footer="Ausgeschaltete Module sind für dieses Mitglied nicht sichtbar.">
                        {FEATURES.map(feat => (
                            <ToggleRow key={feat.id} label={feat.label} icon={feat.icon} color={feat.color} checked={perms[feat.perm] !== false} onChange={(v) => setPerms(p => ({ ...p, [feat.perm]: v }))} />
                        ))}
                    </FormGroup>
                )}
                {tab === 'notify' && (
                    <FormGroup footer="Welche Push-Mitteilungen dieses Mitglied bekommt.">
                        {PUSH_TYPES.map(t => (
                            <ToggleRow key={t.type} label={t.label} icon={t.icon} color={t.color} checked={perms[`notify_${t.type}`] !== false} onChange={(v) => setPerms(p => ({ ...p, [`notify_${t.type}`]: v }))} />
                        ))}
                    </FormGroup>
                )}
            </div>
        </Sheet>
    );
};

export default function Family() {
    const { user, isAdmin } = useAuth();
    const { members, reload } = useMembers();
    const { data: family, setData: setFamily, reload: reloadFamily } = useApi('/auth/family');
    const { data: roles, reload: reloadRoles } = useApi('/auth/family/roles', { initial: [] });
    const [editing, setEditing] = React.useState(null);
    const [name, setName] = React.useState(null);
    const [role, setRole] = React.useState('');
    const { toast, confirm } = useFeedback();
    const act = useAction();

    const invite = family ? `${window.location.origin}/?invite=${family.invite_code}` : '';
    const share = async () => {
        const text = `Komm in unsere Familie bei FamyHub! Einladungscode: ${family.invite_code}`;
        if (navigator.share) { try { await navigator.share({ title: 'FamyHub', text, url: invite }); return; } catch { /* cancelled */ } }
        try { await navigator.clipboard.writeText(`${text}\n${invite}`); toast('Einladung kopiert'); } catch { toast('Kopieren nicht möglich', 'error'); }
    };
    const regenerate = async () => {
        if (!(await confirm({ title: 'Neuen Code erzeugen?', message: 'Der alte Einladungscode funktioniert danach nicht mehr.', confirmText: 'Erzeugen' }))) return;
        const r = await act(() => api.post('/auth/family/invite-code/regenerate'), 'Neuer Code erzeugt');
        if (r?.data) setFamily(f => ({ ...f, invite_code: r.data.invite_code }));
    };
    const saveName = async () => {
        if (name?.trim() && await act(() => api.put('/auth/family/name', { name: name.trim() }), 'Gespeichert')) { setName(null); reloadFamily(); }
    };
    const addRole = async (e) => {
        e.preventDefault();
        if (role.trim() && await act(() => api.post('/auth/family/roles', { name: role.trim() }))) { setRole(''); reloadRoles(); }
    };
    const online = (m) => m.last_active && Date.now() - toDate(m.last_active).getTime() < 5 * 60e3;

    return (
        <Page back="/settings" title={family?.name || 'Familie'}>
            <Section title="Einladen" footer="Mit dem Code können sich neue Mitglieder selbst registrieren und landen direkt in eurer Familie.">
                <div className="flex items-center gap-3 px-4 py-4">
                    <IconTile icon="ri-key-2-fill" color="#2B3E6A" size={40} />
                    <div className="min-w-0 flex-1">
                        <div className="text-footnote text-label2">Einladungscode</div>
                        <div className="font-mono text-title2 font-bold tracking-widest">{family?.invite_code || '…'}</div>
                    </div>
                    <Button size="sm" icon="ri-share-forward-line" onClick={share} disabled={!family}>Teilen</Button>
                </div>
                {isAdmin && <Row title="Neuen Code erzeugen" onClick={regenerate} />}
                {isAdmin && <Row title="Familie umbenennen" onClick={() => setName(family?.name || '')} chevron />}
            </Section>

            <Section title={`Mitglieder (${members.length})`} action={isAdmin && <button onClick={() => setEditing('new')} className="press text-footnote font-medium text-accent">Hinzufügen</button>}>
                {members.map(m => (
                    <Row key={m.id} onClick={isAdmin ? () => setEditing(m) : undefined} chevron={isAdmin}
                        leading={<span className="relative"><Avatar user={m} size={40} />{online(m) && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-ok" />}</span>}
                        title={<>{m.username}{m.id === user.id && <span className="text-label2"> (du)</span>}</>}
                        subtitle={[m.role === 'admin' ? 'Admin' : 'Mitglied', m.display_role, m.last_active && !online(m) ? `aktiv ${ago(m.last_active)}` : online(m) ? 'online' : null].filter(Boolean).join(' · ')}
                        right={m.two_factor_enabled && <i className="ri-shield-check-fill text-ok" title="2FA aktiv"></i>} />
                ))}
            </Section>

            {isAdmin && (
                <Section title="Rollen-Vorschläge" footer="Erscheinen als Auswahl im Profil, z. B. Mama, Papa, Oma.">
                    {roles.map(r => (
                        <div key={r.id} className="flex min-h-[46px] items-center border-b hairline px-4 last:border-b-0">
                            <span className="flex-1">{r.name}</span>
                            <IconButton icon="ri-delete-bin-line" label="Löschen" variant="plain" className="text-danger" onClick={async () => { if (await act(() => api.delete(`/auth/family/roles/${r.id}`))) reloadRoles(); }} />
                        </div>
                    ))}
                    <form onSubmit={addRole} className="flex items-center gap-2 px-4">
                        <input value={role} onChange={e => setRole(e.target.value)} placeholder="Neue Rolle" aria-label="Neue Rolle" className="min-w-0 flex-1 bg-transparent py-3 text-body outline-none" />
                        <IconButton type="submit" icon="ri-add-line" label="Hinzufügen" variant="tinted" disabled={!role.trim()} />
                    </form>
                </Section>
            )}

            {isAdmin && <MemberSheet open={!!editing} onClose={() => setEditing(null)} member={editing === 'new' ? null : editing} onSaved={reload} />}
            <Sheet open={name !== null} onClose={() => setName(null)} title="Familienname" onSave={saveName} saveDisabled={!name?.trim()}>
                <Form onSubmit={saveName}><FormGroup><InputRow value={name || ''} onChange={e => setName(e.target.value)} autoFocus /></FormGroup></Form>
            </Sheet>
        </Page>
    );
}
