import React from 'react';
import CryptoJS from 'crypto-js';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import { ago } from '../lib/format';
import { Page, Section, Row, Chip, IconButton, Button, Sheet, Form, FormGroup, InputRow, ToggleRow, Field, SearchField, Empty, Loading, ActionSheet, useFeedback, useAction, cx } from '../ui';

// Format kept compatible with all earlier versions: AES(JSON.stringify({ content }), PIN)
const encrypt = (content, pin) => CryptoJS.AES.encrypt(JSON.stringify({ content }), pin).toString();
const decrypt = (data, pin) => {
    const text = CryptoJS.AES.decrypt(data, pin).toString(CryptoJS.enc.Utf8);
    const parsed = JSON.parse(text);
    if (typeof parsed?.content !== 'string') throw new Error('invalid');
    return parsed.content;
};

const generate = (len = 20) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!$%&*+-_?';
    const arr = new Uint32Array(len);
    crypto.getRandomValues(arr);
    return [...arr].map(n => chars[n % chars.length]).join('');
};

const strength = (s = '') => {
    let n = 0;
    if (s.length >= 8) n++;
    if (s.length >= 14) n++;
    if (/[A-Z]/.test(s) && /[a-z]/.test(s)) n++;
    if (/\d/.test(s)) n++;
    if (/[^A-Za-z0-9]/.test(s)) n++;
    return [['Sehr schwach', '#FF3B30'], ['Schwach', '#FF3B30'], ['Mittel', '#FF9500'], ['Gut', '#FFCC00'], ['Stark', '#34C759'], ['Sehr stark', '#34C759']][n];
};

const LockScreen = ({ hasItems, onUnlock }) => {
    const [pin, setPin] = React.useState('');
    const [pin2, setPin2] = React.useState('');
    const [error, setError] = React.useState('');
    const submit = (e) => {
        e.preventDefault();
        if (pin.length < 4) return setError('Die PIN muss mindestens 4 Zeichen haben.');
        if (!hasItems && pin !== pin2) return setError('Die PINs stimmen nicht überein.');
        if (!onUnlock(pin)) { setError('Falsche PIN'); setPin(''); }
    };
    return (
        <div className="mx-auto flex max-w-sm flex-col items-center pt-10 text-center">
            <span className="mb-5 flex h-20 w-20 items-center justify-center rounded-[22px] bg-[#1C1C1E] text-[40px] text-white shadow-pop dark:bg-[#3A3A3C]"><i className="ri-safe-2-fill"></i></span>
            <h1 className="text-title1 font-bold">Tresor</h1>
            <p className="mb-6 mt-1 text-sub text-label2">{hasItems ? 'Gib die Familien-PIN ein, um den Tresor zu öffnen.' : 'Lege eine Familien-PIN fest. Alle Einträge werden damit auf deinem Gerät verschlüsselt.'}</p>
            <form onSubmit={submit} className="w-full space-y-3">
                <input type="password" autoFocus value={pin} onChange={e => { setPin(e.target.value); setError(''); }} placeholder="PIN" aria-label="PIN" autoComplete="off"
                    className="field text-center text-title2 tracking-[0.3em] placeholder:text-body placeholder:tracking-normal" />
                {!hasItems && <input type="password" value={pin2} onChange={e => setPin2(e.target.value)} placeholder="PIN wiederholen" aria-label="PIN wiederholen" autoComplete="off" className="field text-center text-title2 tracking-[0.3em] placeholder:text-body placeholder:tracking-normal" />}
                {error && <p role="alert" className="text-footnote font-medium text-danger">{error}</p>}
                <Button type="submit" size="lg" full icon="ri-lock-unlock-line">{hasItems ? 'Entsperren' : 'PIN festlegen'}</Button>
            </form>
            {!hasItems && <p className="mt-5 text-footnote text-label3">Wichtig: Die PIN wird nirgends gespeichert. Ohne sie lassen sich die Einträge nicht wiederherstellen.</p>}
        </div>
    );
};

const EntrySheet = ({ open, onClose, entry, folders, folderId, pin, onSaved }) => {
    const [f, setF] = React.useState({});
    const [show, setShow] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const { confirm } = useFeedback();
    const act = useAction();
    React.useEffect(() => {
        if (open) { setF(entry ? { title: entry.title, content: entry.error ? '' : entry.content, folder_id: entry.folder_id || '', is_shared: !!entry.is_shared } : { title: '', content: '', folder_id: folderId || '', is_shared: false }); setShow(!entry); }
    }, [open, entry, folderId]);
    const save = async () => {
        if (!f.title?.trim() || !f.content) return;
        setSaving(true);
        const body = { title: f.title.trim(), encrypted_data: encrypt(f.content, pin), folder_id: f.folder_id || null, is_shared: f.is_shared ? 1 : 0 };
        const ok = await act(() => (entry ? api.put(`/vault/${entry.id}`, body) : api.post('/vault', body)), 'Sicher gespeichert');
        setSaving(false);
        if (ok) { onSaved(); onClose(); }
    };
    const remove = async () => {
        if (!(await confirm({ title: `„${entry.title}“ löschen?`, confirmText: 'Löschen', destructive: true }))) return;
        if (await act(() => api.delete(`/vault/${entry.id}`), 'Gelöscht')) { onSaved(); onClose(); }
    };
    const [label, color] = strength(f.content);
    return (
        <Sheet open={open} onClose={onClose} title={entry ? 'Eintrag' : 'Neuer Eintrag'} onSave={save} saving={saving} saveDisabled={!f.title?.trim() || !f.content}>
            <Form onSubmit={save} className="space-y-6">
                <FormGroup>
                    <InputRow placeholder="Titel, z. B. WLAN Zuhause" value={f.title || ''} onChange={e => setF(s => ({ ...s, title: e.target.value }))} autoFocus={!entry} />
                    <InputRow as="select" label="Ordner" value={f.folder_id || ''} onChange={e => setF(s => ({ ...s, folder_id: e.target.value }))}>
                        <option value="">Kein Ordner</option>
                        {folders.map(fo => <option key={fo.id} value={fo.id}>{fo.name}</option>)}
                    </InputRow>
                </FormGroup>
                <div>
                    <div className="relative">
                        <textarea value={f.content || ''} onChange={e => setF(s => ({ ...s, content: e.target.value }))} placeholder="Passwort, PIN oder geheime Notiz" aria-label="Geheimer Inhalt" rows={3} spellCheck={false} autoComplete="off"
                            className={cx('field resize-none pr-12 font-mono', !show && f.content && '[-webkit-text-security:disc]')} />
                        <button type="button" onClick={() => setShow(s => !s)} className="press absolute right-3 top-3 text-xl text-label3" aria-label={show ? 'Verbergen' : 'Anzeigen'}><i className={show ? 'ri-eye-off-line' : 'ri-eye-line'}></i></button>
                    </div>
                    <div className="mt-2 flex items-center justify-between px-1">
                        {f.content ? <span className="text-footnote font-medium" style={{ color }}>{label}</span> : <span />}
                        <button type="button" onClick={() => { setF(s => ({ ...s, content: generate() })); setShow(true); }} className="press text-footnote font-medium text-accent"><i className="ri-magic-line"></i> Sicheres Passwort erzeugen</button>
                    </div>
                </div>
                <FormGroup footer={f.is_shared ? 'Alle Familienmitglieder mit der PIN sehen diesen Eintrag.' : 'Nur du siehst diesen Eintrag.'}>
                    <ToggleRow label="Mit Familie teilen" checked={!!f.is_shared} onChange={v => setF(s => ({ ...s, is_shared: v }))} />
                </FormGroup>
                {entry && <Button variant="destructive" full onClick={remove}>Eintrag löschen</Button>}
            </Form>
        </Sheet>
    );
};

export default function Vault() {
    const { user } = useAuth();
    const [raw, setRaw] = React.useState(null);
    const [folders, setFolders] = React.useState([]);
    const [pin, setPin] = React.useState(null);
    const [items, setItems] = React.useState([]);
    const [q, setQ] = React.useState('');
    const [folder, setFolder] = React.useState('all');
    const [revealed, setRevealed] = React.useState({});
    const [editing, setEditing] = React.useState(null);
    const [menu, setMenu] = React.useState(false);
    const [folderSheet, setFolderSheet] = React.useState(null);
    const [folderName, setFolderName] = React.useState('');
    const fileRef = React.useRef(null);
    const { toast, confirm } = useFeedback();
    const act = useAction();

    const load = React.useCallback(async (currentPin = pin) => {
        const [e, f] = await Promise.all([api.get('/vault'), api.get('/vault/folders')]);
        setRaw(e.data); setFolders(f.data);
        if (currentPin) setItems(e.data.map(i => { try { return { ...i, content: decrypt(i.encrypted_data, currentPin) }; } catch { return { ...i, content: '', error: true }; } }));
        return e.data;
    }, [pin]);
    React.useEffect(() => { load(null).catch(() => setRaw([])); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Lock automatically after 5 minutes without interaction.
    React.useEffect(() => {
        if (!pin) return undefined;
        let timer;
        const reset = () => { clearTimeout(timer); timer = setTimeout(() => { setPin(null); setItems([]); setRevealed({}); }, 5 * 60e3); };
        reset();
        ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, reset));
        return () => { clearTimeout(timer); ['pointerdown', 'keydown'].forEach(ev => window.removeEventListener(ev, reset)); };
    }, [pin]);

    const unlock = (candidate) => {
        if (raw.length) {
            try { decrypt(raw[0].encrypted_data, candidate); } catch { return false; }
        }
        setPin(candidate);
        setItems(raw.map(i => { try { return { ...i, content: decrypt(i.encrypted_data, candidate) }; } catch { return { ...i, content: '', error: true }; } }));
        return true;
    };
    const lock = () => { setPin(null); setItems([]); setRevealed({}); };

    const copy = async (i) => {
        try { await navigator.clipboard.writeText(i.content); toast('In die Zwischenablage kopiert'); } catch { toast('Kopieren nicht möglich', 'error'); }
    };

    const download = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
    const exportJson = async () => {
        if (!(await confirm({ title: 'Unverschlüsselt exportieren?', message: 'Die Datei enthält alle Passwörter im Klartext (Bitwarden-Format). Bewahre sie sicher auf.', confirmText: 'Exportieren' }))) return;
        const bw = {
            encrypted: false,
            folders: folders.map(f => ({ id: f.id, name: f.name })),
            items: items.filter(i => !i.error).map(i => ({ id: i.id, type: 1, name: i.title, folderId: i.folder_id || null, login: { username: '', password: i.content, uris: [] }, notes: null })),
        };
        download(new Blob([JSON.stringify(bw, null, 2)], { type: 'application/json' }), `famyhub_tresor_${new Date().toISOString().slice(0, 10)}.json`);
    };
    const parseCsvLine = (line) => {
        const out = []; let cur = ''; let quoted = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"') { if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted; } else if (c === ',' && !quoted) { out.push(cur); cur = ''; } else cur += c;
        }
        out.push(cur);
        return out;
    };
    const importFile = async (file) => {
        const text = await file.text();
        const entries = [];
        const folderIds = {};
        const folderFor = async (name) => {
            if (!name) return null;
            if (!folderIds[name]) folderIds[name] = (await api.post('/vault/folders/find-or-create', { name })).data.id;
            return folderIds[name];
        };
        try {
            if (/\.json$/i.test(file.name)) {
                const data = JSON.parse(text);
                const names = Object.fromEntries((data.folders || []).map(f => [f.id, f.name]));
                for (const it of data.items || []) {
                    const content = [it.login?.username && `Benutzer: ${it.login.username}`, it.login?.password, it.notes].filter(Boolean).join('\n');
                    if (content) entries.push({ title: it.name || 'Import', content, folder: names[it.folderId] });
                }
            } else {
                const lines = text.split(/\r?\n/).filter(l => l.trim());
                const head = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
                const idx = (...names) => head.findIndex(h => names.includes(h));
                const [ti, ui, pi, gi, ni] = [idx('title', 'name'), idx('username', 'login_username'), idx('password', 'login_password'), idx('group', 'folder'), idx('notes')];
                for (const line of lines.slice(1)) {
                    const c = parseCsvLine(line);
                    const content = [ui >= 0 && c[ui] && `Benutzer: ${c[ui]}`, pi >= 0 && c[pi], ni >= 0 && c[ni]].filter(Boolean).join('\n');
                    if (content) entries.push({ title: c[ti] || 'Import', content, folder: gi >= 0 ? c[gi] : null });
                }
            }
        } catch { return toast('Die Datei konnte nicht gelesen werden.', 'error'); }
        if (!entries.length) return toast('Keine Einträge gefunden.', 'error');
        let n = 0;
        for (const e of entries) {
            const ok = await act(async () => api.post('/vault', { title: e.title, encrypted_data: encrypt(e.content, pin), folder_id: await folderFor(e.folder), is_shared: 0 }));
            if (ok) n++;
        }
        toast(`${n} Einträge importiert`);
        load();
    };

    React.useEffect(() => { if (folderSheet) setFolderName(folderSheet.folder?.name || ''); }, [folderSheet]);
    const saveFolder = async () => {
        if (!folderName.trim()) return;
        const r = await act(() => (folderSheet.folder ? api.put(`/vault/folders/${folderSheet.folder.id}`, { name: folderName.trim() }) : api.post('/vault/folders', { name: folderName.trim() })), 'Ordner gespeichert');
        if (r) { setFolderSheet(null); load(); }
    };
    const activeFolder = folders.find(f => f.id === folder);
    const deleteFolder = async () => {
        if (!(await confirm({ title: `Ordner „${activeFolder.name}“ löschen?`, message: 'Die Einträge bleiben erhalten.', confirmText: 'Löschen', destructive: true }))) return;
        if (await act(() => api.delete(`/vault/folders/${activeFolder.id}`), 'Ordner gelöscht')) { setFolder('all'); load(); }
    };

    if (raw === null) return <Loading />;
    if (!pin) return <LockScreen hasItems={raw.length > 0} onUnlock={unlock} />;

    const needle = q.toLowerCase();
    const shown = items.filter(i => (folder === 'all' || i.folder_id === folder) && (!needle || i.title.toLowerCase().includes(needle)));

    return (
        <Page title="Tresor" actions={<>
            <IconButton icon="ri-more-fill" label="Optionen" variant="gray" onClick={() => setMenu(true)} />
            <IconButton icon="ri-add-line" label="Neuer Eintrag" variant="filled" onClick={() => setEditing('new')} />
        </>}>
            <input ref={fileRef} type="file" accept=".json,.csv" className="hidden" onChange={e => { const f = e.target.files[0]; e.target.value = ''; if (f) importFile(f); }} />
            <div className="mb-3"><SearchField value={q} onChange={setQ} /></div>
            <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4">
                <Chip active={folder === 'all'} onClick={() => setFolder('all')}>Alle</Chip>
                {folders.map(f => <Chip key={f.id} active={folder === f.id} onClick={() => setFolder(f.id)}>{f.name}</Chip>)}
                <Chip onClick={() => setFolderSheet({})}><i className="ri-folder-add-line"></i> Ordner</Chip>
            </div>
            {shown.length === 0 ? <Empty icon="ri-key-2-line" title={q ? 'Nichts gefunden' : 'Tresor ist leer'} text={q ? undefined : 'WLAN-Passwort, Router-PIN, Kundennummern – sicher verschlüsselt.'} /> : (
                <Section footer="Inhalte werden auf deinem Gerät mit der Familien-PIN verschlüsselt. Der Server sieht nur Zeichensalat.">
                    {shown.map(i => (
                        <Row key={i.id} icon={i.is_shared ? 'ri-group-fill' : 'ri-lock-fill'} color={i.is_shared ? '#1AA7EC' : '#1C1C1E'} onClick={() => setEditing(i)}
                            title={i.title}
                            subtitle={i.error ? <span className="text-danger">Mit anderer PIN verschlüsselt</span>
                                : <span className="font-mono">{revealed[i.id] ? i.content.split('\n')[0] : '••••••••••'}{' · '}<span className="font-sans">{i.user_id === user.id || !i.user_id ? ago(i.updated_at) : 'geteilt'}</span></span>}
                            right={!i.error && <div className="flex gap-1">
                                <IconButton icon={revealed[i.id] ? 'ri-eye-off-line' : 'ri-eye-line'} label="Anzeigen" variant="plain" size={34} onClick={(e) => { e.stopPropagation(); setRevealed(r => ({ ...r, [i.id]: !r[i.id] })); }} />
                                <IconButton icon="ri-file-copy-line" label="Kopieren" variant="plain" size={34} onClick={(e) => { e.stopPropagation(); copy(i); }} />
                            </div>} />
                    ))}
                </Section>
            )}
            <EntrySheet open={!!editing} onClose={() => setEditing(null)} entry={editing === 'new' ? null : editing} folders={folders} folderId={activeFolder?.id} pin={pin} onSaved={load} />
            <ActionSheet open={menu} onClose={() => setMenu(false)} actions={[
                { label: 'Jetzt sperren', icon: 'ri-lock-line', onClick: lock },
                { label: 'Importieren (Bitwarden JSON / CSV)', icon: 'ri-upload-2-line', onClick: () => fileRef.current?.click() },
                { label: 'Exportieren (Bitwarden JSON)', icon: 'ri-download-2-line', onClick: exportJson },
                activeFolder && { label: 'Ordner umbenennen', icon: 'ri-edit-line', onClick: () => setFolderSheet({ folder: activeFolder }) },
                activeFolder && { label: 'Ordner löschen', icon: 'ri-delete-bin-line', destructive: true, onClick: deleteFolder },
            ]} />
            <Sheet open={!!folderSheet} onClose={() => setFolderSheet(null)} title={folderSheet?.folder ? 'Ordner umbenennen' : 'Neuer Ordner'} onSave={saveFolder} saveDisabled={!folderName.trim()}>
                <form onSubmit={e => { e.preventDefault(); saveFolder(); }}><Field label="Name" value={folderName} onChange={e => setFolderName(e.target.value)} autoFocus /></form>
            </Sheet>
        </Page>
    );
}
