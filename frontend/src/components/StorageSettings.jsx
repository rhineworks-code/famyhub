import React from 'react';
import api from '../lib/api';
import { FormGroup, InputRow, Segmented, Button, Spinner, useFeedback, useAction, cx } from '../ui';

/** Where uploaded documents are stored: inside the container volume or on a network share (SMB). */
export default function StorageSettings({ onSaved }) {
    const [info, setInfo] = React.useState(null);
    const [f, setF] = React.useState(null);
    const [busy, setBusy] = React.useState('');
    const [result, setResult] = React.useState(null);
    const { toast, confirm } = useFeedback();
    const act = useAction();

    const load = React.useCallback(() => api.get('/documents/storage-info').then(r => {
        setInfo(r.data);
        setF({ type: r.data.type, path: r.data.path, smb_host: r.data.smb_host, smb_share: r.data.smb_share, smb_user: r.data.smb_user, smb_port: r.data.smb_port || '445', smb_domain: r.data.smb_domain || '', smb_pass: '' });
    }).catch(() => setInfo(false)), []);
    React.useEffect(() => { load(); }, [load]);

    if (info === null || !f) return <div className="flex justify-center py-8 text-label3"><Spinner /></div>;
    if (info === false) return <p className="text-sub text-label2">Speicher-Einstellungen konnten nicht geladen werden.</p>;

    const set = (k) => (e) => { setF(s => ({ ...s, [k]: e.target.value })); setResult(null); };
    const test = async () => {
        setBusy('test');
        const r = await act(() => api.post('/documents/storage-path', { ...f, test: true }));
        setBusy('');
        if (r?.data) setResult(r.data);
    };
    const save = async () => {
        if (f.type === 'smb' && (!f.smb_host || !f.smb_share)) return toast('Bitte Server und Freigabe angeben.', 'error');
        setBusy('save');
        if (f.type === 'smb') {
            const t = await act(() => api.post('/documents/storage-path', { ...f, test: true }));
            if (!t?.data?.ok) { setBusy(''); setResult(t?.data || null); return; }
        }
        const ok = await act(() => api.post('/documents/storage-path', f), f.type === 'smb' ? 'Neue Dokumente werden jetzt auf dem NAS gespeichert' : 'Speicherort gespeichert');
        setBusy('');
        if (ok) { await load(); onSaved?.(); }
    };
    const other = info.type === 'smb' ? (info.counts?.local || 0) : (info.counts?.smb || 0);
    const migrate = async () => {
        if (!(await confirm({ title: `${other} Dokumente verschieben?`, message: info.type === 'smb' ? 'Die Dateien werden auf das NAS kopiert und danach lokal gelöscht.' : 'Die Dateien werden vom NAS in den lokalen Speicher kopiert und danach auf dem NAS gelöscht.', confirmText: 'Verschieben' }))) return;
        setBusy('migrate');
        const r = await act(() => api.post('/documents/storage/migrate', {}, { timeout: 0 }));
        setBusy('');
        if (r?.data) { toast(r.data.message, r.data.failed ? 'error' : 'ok'); load(); }
    };

    return (
        <div className="space-y-4">
            <div className={cx('flex items-center gap-3 rounded-card p-4', info.writable ? 'bg-ok/12' : 'bg-danger/10')}>
                <i className={cx('text-2xl', info.type === 'smb' ? 'ri-server-line' : 'ri-hard-drive-2-line', info.writable ? 'text-ok' : 'text-danger')}></i>
                <div className="min-w-0 flex-1 text-sub">
                    <div className="font-semibold">{info.type === 'smb' ? `NAS: \\\\${info.smb_host}\\${info.smb_share.replace(/\//g, '\\')}` : 'Lokal im Container'}</div>
                    <div className="text-footnote text-label2">{info.writable ? 'Verbunden und beschreibbar' : 'Nicht erreichbar oder nicht beschreibbar'}{info.counts ? ` · ${info.counts.smb || 0} auf dem NAS, ${info.counts.local || 0} lokal` : ''}</div>
                </div>
            </div>

            <Segmented value={f.type} onChange={(v) => { setF(s => ({ ...s, type: v })); setResult(null); }} options={[{ value: 'local', label: 'Lokal' }, { value: 'smb', label: 'Netzwerkfreigabe (SMB)' }]} />

            {f.type === 'local' ? (
                <FormGroup footer="Standard ist der Ordner uploads/documents im Docker-Volume.">
                    <InputRow label="Pfad" autoCapitalize="none" value={f.path || ''} onChange={set('path')} />
                </FormGroup>
            ) : (
                <FormGroup footer="Freigabe mit Unterordnern angeben, z. B. „dokumente/famyhub“. Fehlende Ordner werden angelegt. Für Synology, QNAP, TrueNAS, Windows und Fritz!Box (SMB 2/3).">
                    <InputRow label="Server" placeholder="192.168.1.10" autoCapitalize="none" inputMode="url" value={f.smb_host || ''} onChange={set('smb_host')} />
                    <InputRow label="Freigabe" placeholder="dokumente/famyhub" autoCapitalize="none" value={f.smb_share || ''} onChange={set('smb_share')} />
                    <InputRow label="Benutzer" autoCapitalize="none" autoComplete="off" value={f.smb_user || ''} onChange={set('smb_user')} />
                    <InputRow label="Passwort" type="password" autoComplete="new-password" placeholder={info.smb_has_password ? '•••••• (gespeichert)' : ''} value={f.smb_pass || ''} onChange={set('smb_pass')} />
                    <InputRow label="Domäne" placeholder="optional" autoCapitalize="none" value={f.smb_domain || ''} onChange={set('smb_domain')} />
                    <InputRow label="Port" inputMode="numeric" value={f.smb_port || ''} onChange={set('smb_port')} />
                </FormGroup>
            )}

            {result && <p role="status" className={cx('rounded-cell px-4 py-3 text-footnote font-medium', result.ok ? 'bg-ok/12 text-ok' : 'bg-danger/10 text-danger')}>{result.message}</p>}

            <div className="grid grid-cols-2 gap-3">
                <Button variant="gray" loading={busy === 'test'} onClick={test}>Testen</Button>
                <Button loading={busy === 'save'} onClick={save}>Speichern</Button>
            </div>

            {other > 0 && (
                <div className="rounded-card bg-card p-4">
                    <p className="text-sub">{other === 1 ? '1 Dokument liegt' : `${other} Dokumente liegen`} noch {info.type === 'smb' ? 'lokal' : 'auf dem NAS'} und {other === 1 ? 'wird' : 'werden'} weiterhin angezeigt.</p>
                    <Button className="mt-3" variant="tinted" full loading={busy === 'migrate'} icon="ri-folder-transfer-line" onClick={migrate}>
                        {info.type === 'smb' ? 'Alle auf das NAS verschieben' : 'Alle in den lokalen Speicher holen'}
                    </Button>
                </div>
            )}
        </div>
    );
}
