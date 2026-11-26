import React from 'react';
import api from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Page, Section, Row, FormGroup, InputRow, Segmented, Button, Sheet, Field, Spinner, useFeedback, useAction } from '../../ui';

const bytes = (n) => {
    if (!n) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
    return `${(n / 1024 ** i).toFixed(i ? 1 : 0).replace('.', ',')} ${u[i]}`;
};
const uptime = (s) => { const d = Math.floor(s / 86400); const h = Math.floor((s % 86400) / 3600); return d ? `${d} T ${h} Std` : `${h} Std ${Math.floor((s % 3600) / 60)} Min`; };

const Smtp = () => {
    const [f, setF] = React.useState(null);
    const [busy, setBusy] = React.useState(false);
    const act = useAction();
    React.useEffect(() => { api.get('/auth/admin/smtp').then(r => setF({ host: '', port: '', user: '', from: '', pass: '', ...r.data })).catch(() => setF({})); }, []);
    if (!f) return null;
    const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }));
    const save = async () => { setBusy(true); await act(() => api.post('/auth/admin/smtp', f), 'E-Mail-Einstellungen gespeichert'); setBusy(false); };
    return (
        <div className="mb-7 space-y-3">
            <FormGroup title="E-Mail-Versand (SMTP)" footer="Wird für „Passwort vergessen“ benötigt.">
                <InputRow label="Server" placeholder="smtp.example.de" autoCapitalize="none" value={f.host || ''} onChange={set('host')} />
                <InputRow label="Port" inputMode="numeric" placeholder="587" value={f.port || ''} onChange={set('port')} />
                <InputRow label="Benutzer" autoCapitalize="none" value={f.user || ''} onChange={set('user')} />
                <InputRow label="Passwort" type="password" autoComplete="new-password" placeholder={f.hasPassword ? '•••••• (gespeichert)' : ''} value={f.pass || ''} onChange={set('pass')} />
                <InputRow label="Absender" placeholder="FamyHub <noreply@…>" value={f.from || ''} onChange={set('from')} />
            </FormGroup>
            <Button variant="tinted" full loading={busy} onClick={save}>Speichern</Button>
        </div>
    );
};

const Storage = () => {
    const [info, setInfo] = React.useState(null);
    const [f, setF] = React.useState(null);
    const [busy, setBusy] = React.useState('');
    const { toast } = useFeedback();
    const act = useAction();
    const load = () => api.get('/documents/storage-info').then(r => { setInfo(r.data); setF({ type: r.data.type, path: r.data.path, smb_host: r.data.smb_host, smb_share: r.data.smb_share, smb_user: r.data.smb_user, smb_port: r.data.smb_port, smb_pass: '' }); }).catch(() => {});
    React.useEffect(() => { load(); }, []);
    if (!f) return null;
    const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }));
    const test = async () => {
        setBusy('test');
        const r = await act(() => api.post('/documents/storage-path', { ...f, test: true }));
        setBusy('');
        if (r?.data) toast(r.data.message || (r.data.ok ? 'Verbindung erfolgreich' : 'Verbindung fehlgeschlagen'), r.data.ok ? 'ok' : 'error');
    };
    const save = async () => { setBusy('save'); if (await act(() => api.post('/documents/storage-path', f), 'Speicherort gespeichert')) load(); setBusy(''); };
    return (
        <div className="mb-7 space-y-3">
            <FormGroup title="Speicherort für Dokumente" footer={info ? `Aktuell: ${info.type === 'smb' ? `NAS //${info.smb_host}/${info.smb_share}` : info.path} · ${info.writable ? 'beschreibbar ✓' : 'nicht beschreibbar ✗'}` : undefined}>
                <div className="px-4 py-3"><Segmented value={f.type} onChange={(v) => setF(s => ({ ...s, type: v }))} options={[{ value: 'local', label: 'Lokal' }, { value: 'smb', label: 'NAS (SMB)' }]} /></div>
                {f.type === 'local' ? (
                    <InputRow label="Pfad" autoCapitalize="none" value={f.path || ''} onChange={set('path')} />
                ) : (
                    <>
                        <InputRow label="Server" placeholder="192.168.1.10" autoCapitalize="none" value={f.smb_host || ''} onChange={set('smb_host')} />
                        <InputRow label="Freigabe" placeholder="dokumente" autoCapitalize="none" value={f.smb_share || ''} onChange={set('smb_share')} />
                        <InputRow label="Benutzer" autoCapitalize="none" value={f.smb_user || ''} onChange={set('smb_user')} />
                        <InputRow label="Passwort" type="password" autoComplete="new-password" placeholder="unverändert" value={f.smb_pass || ''} onChange={set('smb_pass')} />
                        <InputRow label="Port" inputMode="numeric" value={f.smb_port || ''} onChange={set('smb_port')} />
                    </>
                )}
            </FormGroup>
            <div className="grid grid-cols-2 gap-3">
                <Button variant="gray" loading={busy === 'test'} onClick={test}>Testen</Button>
                <Button variant="tinted" loading={busy === 'save'} onClick={save}>Speichern</Button>
            </div>
            <p className="px-4 text-footnote text-label2">Bestehende Dokumente bleiben an ihrem bisherigen Ort und werden weiter gefunden.</p>
        </div>
    );
};

export default function System() {
    const { signOut, user } = useAuth();
    const [stats, setStats] = React.useState(undefined);
    const [importing, setImporting] = React.useState(false);
    const [reset, setReset] = React.useState(false);
    const [password, setPassword] = React.useState('');
    const fileRef = React.useRef(null);
    const { confirm, toast } = useFeedback();
    const act = useAction();

    React.useEffect(() => { api.get('/auth/admin/stats').then(r => setStats(r.data)).catch(() => setStats(null)); }, []);
    const systemAdmin = stats !== null;

    const importBackup = async (file) => {
        if (!(await confirm({ title: 'Backup einspielen?', message: `„${file.name}“ ersetzt ALLE aktuellen Daten. Eine Sicherheitskopie der jetzigen Datenbank wird angelegt.`, confirmText: 'Einspielen', destructive: true }))) return;
        const fd = new FormData();
        fd.append('backup', file);
        setImporting(true);
        const r = await act(() => api.post('/system/import', fd, { timeout: 0 }));
        setImporting(false);
        if (r) { toast(r.data.message); setTimeout(signOut, 1500); }
    };
    const factoryReset = async () => {
        const r = await act(() => api.post('/system/reset', { password }));
        if (r) { toast(r.data.message); setTimeout(signOut, 2000); }
    };

    return (
        <Page back="/settings" title="System">
            <Smtp />
            {systemAdmin && <Storage />}
            {stats === undefined && <div className="flex justify-center py-6 text-label3"><Spinner /></div>}
            {systemAdmin && stats && (
                <Section title="Server">
                    <Row title="Datenbank" value={bytes(stats.storage.database)} />
                    <Row title="Dateien" value={bytes(stats.storage.uploads)} />
                    <Row title="Arbeitsspeicher frei" value={`${bytes(stats.system.memory.free)} von ${bytes(stats.system.memory.total)}`} />
                    <Row title="Laufzeit" value={uptime(stats.system.uptime)} />
                    <Row title="Node.js" value={stats.system.nodeVersion} />
                    <Row title="Datenbank optimieren" onClick={() => act(() => api.post('/auth/admin/cleanup'), 'Datenbank optimiert')} />
                </Section>
            )}
            {systemAdmin && (
                <Section title="Datensicherung" footer="Das Backup enthält die Datenbank und alle hochgeladenen Dateien (ZIP).">
                    <a href="/api/system/export" className="press group/row flex items-center gap-3 pl-4"><span className="flex flex-1 items-center border-b hairline py-[11px] pr-4 text-body text-accent">Backup herunterladen<i className="ri-download-2-line ml-auto"></i></span></a>
                    <Row title={importing ? 'Wird eingespielt …' : 'Backup einspielen'} onClick={importing ? undefined : () => fileRef.current?.click()} right={importing ? <Spinner className="h-4 w-4" /> : <i className="ri-upload-2-line text-accent"></i>} />
                    <input ref={fileRef} type="file" accept=".zip" className="hidden" onChange={e => { const f = e.target.files[0]; e.target.value = ''; if (f) importBackup(f); }} />
                </Section>
            )}
            {systemAdmin && (
                <Section title="Gefahrenzone">
                    <Row title="Auf Werkseinstellungen zurücksetzen" destructive onClick={() => { setPassword(''); setReset(true); }} />
                </Section>
            )}
            {stats === null && <p className="px-4 text-footnote text-label2">Backup, Speicherort und Werksreset kann nur der System-Administrator (Admin der zuerst angelegten Familie) verwalten.</p>}
            <Sheet open={reset} onClose={() => setReset(false)} title="Werksreset">
                <div className="space-y-4">
                    <p className="rounded-card bg-danger/10 p-4 text-sub text-danger">Alle Familien, Konten und Dateien werden gelöscht. Vorher wird automatisch eine Kopie der Datenbank im Datenordner abgelegt.</p>
                    <Field label={`Passwort von ${user.username}`} type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
                    <Button variant="danger" full disabled={!password} onClick={factoryReset}>Alles löschen</Button>
                </div>
            </Sheet>
        </Page>
    );
}
