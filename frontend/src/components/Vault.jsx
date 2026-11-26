import React from 'react';
import api from '../services/api';
import CryptoJS from 'crypto-js';
import { useTranslation } from '../i18n.jsx';
import { applyOffset } from '../utils/time';

// ─── Password Generator ────────────────────────────────────────────────────
const generatePassword = (length, useUpper, useNumbers, useSymbols) => {
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()-_=+[]{}|;:,.<>?';
    let chars = lower;
    if (useUpper) chars += upper;
    if (useNumbers) chars += numbers;
    if (useSymbols) chars += symbols;
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

// ─── Password Strength ────────────────────────────────────────────────────
const getStrength = (pw, t) => {
    if (!pw) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 14) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    const map = [
        { label: t('vault_strength_0'), color: 'bg-red-500' },
        { label: t('vault_strength_1'), color: 'bg-orange-400' },
        { label: t('vault_strength_2'), color: 'bg-yellow-400' },
        { label: t('vault_strength_3'), color: 'bg-blue-400' },
        { label: t('vault_strength_4'), color: 'bg-emerald-500' },
        { label: t('vault_strength_5'), color: 'bg-emerald-600' },
    ];
    return { score, ...map[Math.min(score, 5)] };
};

const Vault = ({ user }) => {
    const { t } = useTranslation();
    // ─── Auth ────────────────────────────────────────────────────────────
    const [isUnlocked, setIsUnlocked] = React.useState(false);
    const [pin, setPin] = React.useState('');
    const [pinError, setPinError] = React.useState('');

    // ─── Data ────────────────────────────────────────────────────────────
    const [items, setItems] = React.useState([]);
    const [folders, setFolders] = React.useState([]);
    const [activeFolderId, setActiveFolderId] = React.useState(null);
    const [activeTab, setActiveTab] = React.useState('all'); // all | shared | private

    // ─── Modal ───────────────────────────────────────────────────────────
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [editingItem, setEditingItem] = React.useState(null);
    const [formData, setFormData] = React.useState({ title: '', content: '', folder_id: '', is_shared: false });
    const [showContent, setShowContent] = React.useState(false);

    // ─── Password Generator ──────────────────────────────────────────────
    const [isGenOpen, setIsGenOpen] = React.useState(false);
    const [genLength, setGenLength] = React.useState(16);
    const [genUpper, setGenUpper] = React.useState(true);
    const [genNumbers, setGenNumbers] = React.useState(true);
    const [genSymbols, setGenSymbols] = React.useState(true);
    const [genResult, setGenResult] = React.useState('');

    // ─── Folder Management ───────────────────────────────────────────────
    const [isAddingFolder, setIsAddingFolder] = React.useState(false);
    const [newFolderName, setNewFolderName] = React.useState('');
    const [deleteFolderConfirm, setDeleteFolderConfirm] = React.useState(null);
    const newFolderInputRef = React.useRef(null);

    // ─── Search ──────────────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = React.useState('');

    // ─── Import/Export ───────────────────────────────────────────────────
    const [isImporting, setIsImporting] = React.useState(false);
    const [importLog, setImportLog] = React.useState([]);
    const [copiedId, setCopiedId] = React.useState(null);

    // ─── Unlock ──────────────────────────────────────────────────────────
    const handleUnlock = async (e) => {
        e.preventDefault();
        setPinError('');
        if (pin.length < 4) { setPinError(t('vault_pin_short')); return; }
        try {
            const [itemsRes, foldersRes] = await Promise.all([api.get('/vault'), api.get('/vault/folders')]);
            setFolders(foldersRes.data);
            const encryptedItems = itemsRes.data;
            if (encryptedItems.length > 0) {
                try {
                    const bytes = CryptoJS.AES.decrypt(encryptedItems[0].encrypted_data, pin);
                    const dec = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
                    if (!dec || !dec.content) throw new Error('Invalid');
                } catch { setPinError(t('vault_wrong_pin_or_corrupt')); return; }
            }
            setIsUnlocked(true);
            decryptAndSetItems(encryptedItems, pin);
        } catch { setPinError(t('vault_fetch_error')); }
    };

    const decryptAndSetItems = (encryptedItems, currentPin) => {
        const decryptedList = encryptedItems.map(item => {
            try {
                const bytes = CryptoJS.AES.decrypt(item.encrypted_data, currentPin);
                const dec = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
                return { id: item.id, title: item.title, content: dec.content, folder_id: item.folder_id, is_shared: !!item.is_shared, updated_at: item.updated_at };
            } catch {
                return { id: item.id, title: item.title, content: t('vault_decrypt_error'), folder_id: item.folder_id, is_shared: !!item.is_shared, updated_at: item.updated_at, error: true };
            }
        });
        setItems(decryptedList);
    };

    const handleLock = () => { setIsUnlocked(false); setPin(''); setItems([]); setFolders([]); };

    const fetchData = async () => {
        try {
            const [itemsRes, foldersRes] = await Promise.all([api.get('/vault'), api.get('/vault/folders')]);
            setFolders(foldersRes.data);
            decryptAndSetItems(itemsRes.data, pin);
        } catch (err) { console.error(err); }
    };

    // ─── Folder CRUD ─────────────────────────────────────────────────────
    React.useEffect(() => { if (isAddingFolder && newFolderInputRef.current) newFolderInputRef.current.focus(); }, [isAddingFolder]);

    const createFolder = async () => {
        const name = newFolderName.trim();
        if (!name) return;
        try {
            const res = await api.post('/vault/folders', { name });
            setFolders(prev => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
            setActiveFolderId(res.data.id);
            setNewFolderName(''); setIsAddingFolder(false);
        } catch (err) { console.error(err); }
    };

    const deleteFolder = async (id) => {
        try {
            await api.delete(`/vault/folders/${id}`);
            setFolders(prev => prev.filter(f => f.id !== id));
            if (activeFolderId === id) setActiveFolderId(null);
            setDeleteFolderConfirm(null);
            fetchData();
        } catch (err) { console.error(err); }
    };

    // ─── Item CRUD ───────────────────────────────────────────────────────
    const handleOpenModal = (item = null) => {
        if (item && !item.error) {
            setEditingItem(item);
            setFormData({ title: item.title, content: item.content, folder_id: item.folder_id || '', is_shared: item.is_shared });
        } else {
            setEditingItem(null);
            setFormData({ title: '', content: '', folder_id: activeFolderId || '', is_shared: false });
        }
        setShowContent(false);
        setIsGenOpen(false);
        setIsModalOpen(true);
    };

    const handleSaveItem = async (e) => {
        e.preventDefault();
        try {
            const encrypted = CryptoJS.AES.encrypt(JSON.stringify({ content: formData.content }), pin).toString();
            const payload = { title: formData.title, encrypted_data: encrypted, folder_id: formData.folder_id || null, is_shared: formData.is_shared ? 1 : 0 };
            if (editingItem) await api.put(`/vault/${editingItem.id}`, payload);
            else await api.post('/vault', payload);
            setIsModalOpen(false);
            fetchData();
        } catch { alert(t('vault_save_error')); }
    };

    const handleDeleteItem = async (id) => {
        if (!confirm(t('vault_delete_confirm'))) return;
        try { await api.delete(`/vault/${id}`); fetchData(); } catch (err) { console.error(err); }
    };

    // ─── Password Generator ──────────────────────────────────────────────
    const handleGenerate = React.useCallback(() => {
        setGenResult(generatePassword(genLength, genUpper, genNumbers, genSymbols));
    }, [genLength, genUpper, genNumbers, genSymbols]);

    React.useEffect(() => { if (isGenOpen) handleGenerate(); }, [isGenOpen, handleGenerate]);

    const applyGenerated = () => {
        setFormData(f => ({ ...f, content: genResult }));
        setIsGenOpen(false);
    };

    // ─── Copy ────────────────────────────────────────────────────────────
    const copyToClipboard = (text, id) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // ─── Export ──────────────────────────────────────────────────────────
    const exportBitwarden = () => {
        const bw = {
            encrypted: false,
            items: items.filter(i => !i.error).map(i => ({
                id: i.id, type: 1, name: i.title,
                login: { username: '', password: i.content, uris: [] },
                notes: i.is_shared ? `[${t('vault_item_shared')}]` : `[${t('vault_item_private')}]`,
                folderId: i.folder_id || null
            })),
            folders: folders.map(f => ({ id: f.id, name: f.name }))
        };
        const blob = new Blob([JSON.stringify(bw, null, 2)], { type: 'application/json' });
        download(blob, `famyhub_vault_bitwarden_${new Date().toISOString().slice(0, 10)}.json`);
    };

    const exportKeepass = () => {
        const header = 'Title,UserName,Password,URL,Notes';
        const rows = items.filter(i => !i.error).map(i =>
            [csvEscape(i.title), '', csvEscape(i.content), '', csvEscape(i.is_shared ? t('vault_item_shared') : t('vault_item_private'))].join(',')
        );
        const csv = [header, ...rows].join('\n');
        download(new Blob([csv], { type: 'text/csv' }), `famyhub_vault_keepass_${new Date().toISOString().slice(0, 10)}.csv`);
    };

    const csvEscape = (v) => `"${(v || '').replace(/"/g, '""')}"`;
    const download = (blob, name) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
    };

    // ─── Import ──────────────────────────────────────────────────────────
    const handleImportFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = '';
        setIsImporting(true);
        setImportLog([]);
        const text = await file.text();
        const log = [];

        try {
            if (file.name.endsWith('.json')) {
                await importBitwarden(JSON.parse(text), log);
            } else if (file.name.endsWith('.csv')) {
                await importKeepass(text, log);
            } else {
                log.push(t('vault_import_format_error'));
            }
        } catch (err) {
            log.push(`❌ Fehler beim Verarbeiten: ${err.message}`);
        }

        setImportLog(log);
        setIsImporting(false);
        fetchData();
    };

    const findOrCreateFolder = async (name, log) => {
        if (!name) return null;
        try {
            const res = await api.post('/vault/folders/find-or-create', { name });
            if (res.data.existed) {
                log.push(t('vault_import_folder_exists', { name }));
            } else {
                log.push(t('vault_import_folder_created', { name }));
                setFolders(prev => [...prev, { id: res.data.id, name: res.data.name }].sort((a, b) => a.name.localeCompare(b.name)));
            }
            return res.data.id;
        } catch { log.push(t('vault_import_folder_error', { name })); return null; }
    };

    const importBitwarden = async (data, log) => {
        // Build folder map: bw folder id -> our db folder id
        const folderMap = {};
        if (data.folders && Array.isArray(data.folders)) {
            for (const f of data.folders) {
                const dbId = await findOrCreateFolder(f.name, log);
                if (dbId) folderMap[f.id] = dbId;
            }
        }
        const itemList = data.items || data;
        let count = 0;
        for (const item of itemList) {
            const content = item.login?.password || item.notes || '';
            const title = item.name || item.title || t('vault_import_fallback_title');
            const folderId = item.folderId ? folderMap[item.folderId] || null : null;
            const encrypted = CryptoJS.AES.encrypt(JSON.stringify({ content }), pin).toString();
            try {
                await api.post('/vault', { title, encrypted_data: encrypted, folder_id: folderId, is_shared: 0 });
                count++;
                log.push(t('vault_import_save_success', { title }));
            } catch { log.push(t('vault_import_save_error', { title })); }
        }
        log.unshift(t('vault_import_success_bw', { count }));
    };

    const importKeepass = async (csv, log) => {
        const lines = csv.split('\n').filter(l => l.trim());
        const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
        const titleIdx = headers.findIndex(h => h === 'title');
        const passIdx = headers.findIndex(h => h === 'password');
        const groupIdx = headers.findIndex(h => h === 'group');
        let count = 0;
        for (let i = 1; i < lines.length; i++) {
            const cols = parseCSVLine(lines[i]);
            const title = cols[titleIdx] || t('vault_import_fallback_title');
            const content = cols[passIdx] || '';
            const groupName = groupIdx >= 0 ? cols[groupIdx] : null;
            const folderId = groupName ? await findOrCreateFolder(groupName, log) : null;
            const encrypted = CryptoJS.AES.encrypt(JSON.stringify({ content }), pin).toString();
            try {
                await api.post('/vault', { title, encrypted_data: encrypted, folder_id: folderId, is_shared: 0 });
                count++;
                log.push(t('vault_import_save_success', { title }));
            } catch { log.push(t('vault_import_generic_error', { title })); }
        }
        log.unshift(t('vault_import_success_kp', { count }));
    };

    const parseCSVLine = (line) => {
        const result = []; let cur = ''; let inQ = false;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
            else if (line[i] === ',' && !inQ) { result.push(cur); cur = ''; }
            else cur += line[i];
        }
        result.push(cur);
        return result;
    };

    // ─── Filtered Items ───────────────────────────────────────────────────
    const filteredItems = items.filter(i => {
        const folderMatch = activeFolderId === null || i.folder_id === activeFolderId;
        const tabMatch = activeTab === 'all' || (activeTab === 'shared' && i.is_shared) || (activeTab === 'private' && !i.is_shared);
        const q = searchQuery.toLowerCase().trim();
        const searchMatch = !q || i.title.toLowerCase().includes(q) || (i.content && !i.error && i.content.toLowerCase().includes(q));
        return folderMatch && tabMatch && searchMatch;
    });

    // ─── Lock Screen ─────────────────────────────────────────────────────
    if (!isUnlocked) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-700">
                <div className="bg-white dark:bg-slate-900 p-10 rounded-[1.25rem] shadow-2xl border border-black/[0.06] dark:border-slate-800 max-w-sm w-full text-center">
                    <div className="w-24 h-24 bg-brand-light/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <i className="ri-safe-2-line text-5xl text-brand-dark"></i>
                    </div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 mb-2">{t('vault_title')}</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">{t('vault_subtitle_pin')}</p>
                    <form onSubmit={handleUnlock} className="space-y-4">
                        <input type="password" value={pin} onChange={e => setPin(e.target.value)}
                            placeholder={t('vault_pin_placeholder')} autoFocus
                            className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg focus:ring-4 focus:ring-brand-light/10 outline-none font-bold text-center tracking-widest text-xl dark:text-slate-100"
                        />
                        {pinError && <p className="text-red-500 font-bold text-sm bg-red-50 dark:bg-red-900/20 py-2 rounded-xl">{pinError}</p>}
                        <button type="submit" className="w-full py-4 bg-brand-dark text-white rounded-lg font-black shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                            <i className="ri-lock-unlock-line"></i> {t('vault_unlock')}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    const genStrength = getStrength(genResult);

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
                <div>
                    <h1 className="text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
                        <i className="ri-safe-2-line text-brand-dark"></i> {t('vault_title')}
                    </h1>
                </div>
                <div className="flex flex-wrap gap-2">
                    {/* Import */}
                    <label className="bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-black/[0.06] dark:border-slate-800 px-4 py-3 rounded-lg font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center gap-2 cursor-pointer text-sm">
                        <i className="ri-download-line"></i> {t('vault_import')}
                        <input type="file" accept=".json,.csv" className="hidden" onChange={handleImportFile} disabled={isImporting} />
                    </label>
                    {/* Export dropdown */}
                    <div className="relative group">
                        <button className="bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-black/[0.06] dark:border-slate-800 px-4 py-3 rounded-lg font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center gap-2 text-sm">
                            <i className="ri-upload-line"></i> {t('vault_export')} <i className="ri-arrow-down-s-line"></i>
                        </button>
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg shadow-xl z-50 hidden group-hover:block">
                            <button onClick={exportBitwarden} className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 rounded-t-lg">
                                <i className="ri-shield-keyhole-line text-brand-dark"></i> {t('vault_bitwarden')}
                            </button>
                            <button onClick={exportKeepass} className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 rounded-b-lg">
                                <i className="ri-file-list-line text-brand-dark"></i> {t('vault_keepass')}
                            </button>
                        </div>
                    </div>
                    <button onClick={handleLock} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-4 py-3 rounded-lg font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center gap-2 text-sm">
                        <i className="ri-lock-2-line"></i> {t('vault_lock_btn')}
                    </button>
                    <button onClick={() => handleOpenModal()} className="bg-brand-dark text-white px-4 py-3 rounded-lg font-black shadow-lg hover:bg-slate-800 transition flex items-center gap-2 text-sm">
                        <i className="ri-add-line text-lg"></i> {t('vault_new_entry_btn')}
                    </button>
                </div>
            </header>

            {/* Import Log */}
            {(isImporting || importLog.length > 0) && (
                <div className="bg-slate-50 border border-black/[0.06] rounded-[1rem] p-4 flex-shrink-0 animate-in slide-in-from-top-2">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">{t('vault_import_log_title')}</span>
                        {!isImporting && <button onClick={() => setImportLog([])} className="text-xs text-slate-400 hover:text-red-500"><i className="ri-close-line"></i></button>}
                    </div>
                    {isImporting && <p className="text-sm font-bold text-brand-dark animate-pulse">⏳ {t('vault_import_processing')}</p>}
                    <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-0.5 font-mono text-xs text-slate-600">
                        {importLog.map((l, i) => <div key={i}>{l}</div>)}
                    </div>
                </div>
            )}

            {/* Tab Filter + Folder Dropdown + Search */}
            <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
                {/* Tabs */}
                <div className="flex gap-2">
                    {[['all', 'ri-apps-2-line', t('vault_all_tabs')], ['private', 'ri-lock-line', t('vault_private_tabs')], ['shared', 'ri-team-line', t('vault_shared_tabs')]].map(([tab, icon, label]) => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-all ${activeTab === tab ? 'bg-brand-dark text-white shadow-md' : 'bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-black/[0.06] dark:hover:border-slate-700'}`}>
                            <i className={icon}></i> {label}
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${activeTab === tab ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                {tab === 'all' ? items.length : tab === 'private' ? items.filter(i => !i.is_shared).length : items.filter(i => i.is_shared).length}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Folder Dropdown + New Folder */}
                <div className="flex gap-2 sm:ml-auto">
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-slate-800 rounded-lg px-3 pr-1 py-1">
                        <i className="ri-folder-2-line text-slate-400 text-sm"></i>
                        <select
                            value={activeFolderId || ''}
                            onChange={e => setActiveFolderId(e.target.value || null)}
                            className="text-sm font-bold text-slate-700 dark:text-slate-300 bg-transparent outline-none appearance-none cursor-pointer py-1.5 pr-6"
                            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%2394a3b8' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0 center' }}
                        >
                            <option value="">{t('vault_folder_all')}</option>
                            {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                    </div>
                    {/* New Folder */}
                    {isAddingFolder ? (
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-brand-light rounded-lg px-3">
                            <input ref={newFolderInputRef} type="text" className="text-sm font-bold outline-none w-32 py-1.5 dark:bg-slate-900 dark:text-slate-100" placeholder={t('vault_folder_placeholder')} value={newFolderName}
                                onChange={e => setNewFolderName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && createFolder()}
                                onBlur={() => { !newFolderName.trim() && setIsAddingFolder(false); }}
                            />
                            <button onClick={createFolder} className="text-brand-dark hover:scale-110 transition"><i className="ri-check-line"></i></button>
                            <button onClick={() => setIsAddingFolder(false)} className="text-slate-400 hover:text-red-500 transition"><i className="ri-close-line"></i></button>
                        </div>
                    ) : (
                        <button onClick={() => setIsAddingFolder(true)} className="w-10 h-10 bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-slate-800 rounded-lg flex items-center justify-center text-slate-400 hover:text-brand-dark hover:border-brand-light transition" title={t('vault_folder_new')}>
                            <i className="ri-folder-add-line"></i>
                        </button>
                    )}
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative flex-shrink-0">
                <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={t('vault_search_placeholder_full')}
                    className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-slate-800 rounded-lg outline-none font-bold text-sm text-slate-700 dark:text-slate-300 focus:border-brand-light transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                />
                {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <i className="ri-close-circle-line"></i>
                    </button>
                )}
            </div>

            {/* Items Grid */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-8">

                        {filteredItems.length === 0 && (
                            <div className="col-span-full bg-white dark:bg-slate-900 rounded-[1.25rem] border border-black/[0.06] dark:border-slate-800 p-12 text-center shadow-sm">
                                <div className="text-6xl text-slate-200 dark:text-slate-800 mb-4"><i className="ri-key-2-line"></i></div>
                                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">{t('vault_no_entries')}</h3>
                                <p className="text-slate-500 dark:text-slate-400">{t('vault_no_entries_desc')}</p>
                            </div>
                        )}
                        {filteredItems.map(item => (
                            <div key={item.id} className="bg-white dark:bg-slate-900 p-6 rounded-[1rem] border border-black/[0.06] dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-black/[0.06] dark:hover:border-slate-700 transition-all group">
                                <div>
                                    <div className="flex justify-between items-start mb-3">
                                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 break-words pr-2 leading-tight">{item.title}</h3>
                                        <span className={`flex-shrink-0 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full flex items-center gap-1 ${item.is_shared ? 'bg-brand-light/10 text-brand-dark' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                                            <i className={item.is_shared ? 'ri-team-line' : 'ri-lock-line'}></i>
                                            {item.is_shared ? t('vault_shared_tabs') : t('vault_private_tabs')}
                                        </span>
                                    </div>
                                    {item.error ? (
                                        <p className="text-red-500 font-bold bg-red-50 dark:bg-red-900/20 p-3 rounded-lg text-sm">{item.content}</p>
                                    ) : (
                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-black/[0.06] dark:border-slate-800 relative group/code">
                                            <pre className="text-slate-700 dark:text-slate-300 font-mono text-sm whitespace-pre-wrap break-all blur-[4px] hover:blur-none transition-all duration-300 cursor-pointer select-all line-clamp-3">{item.content}</pre>
                                            <button onClick={() => copyToClipboard(item.content, item.id)}
                                                className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-white dark:bg-slate-800 rounded-lg border border-black/[0.06] dark:border-white/10 text-slate-400 hover:text-brand-dark transition-colors shadow-sm opacity-0 group-hover/code:opacity-100">
                                                <i className={copiedId === item.id ? "ri-check-line text-emerald-500" : "ri-clipboard-line text-xs"}></i>
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-4 flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                                            {new Date(applyOffset(item.updated_at, user)).toLocaleDateString('de-DE')}
                                        </span>
                                        {activeFolderId === null && item.folder_id && (
                                            <span className="text-[10px] font-bold text-brand-dark bg-brand-light/10 px-2 py-0.5 rounded-full mt-1 w-fit">
                                                {folders.find(f => f.id === item.folder_id)?.name || ''}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleOpenModal(item)} disabled={item.error} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-brand-dark bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"><i className="ri-edit-2-line"></i></button>
                                        <button onClick={() => handleDeleteItem(item.id)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 bg-slate-50 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><i className="ri-delete-bin-line"></i></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
            </div>

            {/* ─── Item Modal ─────────────────────────────────────────────────── */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-[1.25rem] shadow-2xl w-full max-w-lg overflow-y-auto max-h-[95vh] custom-scrollbar animate-in zoom-in-95 duration-200 border dark:border-slate-800">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-10">
                            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">{editingItem ? t('vault_edit_title') : t('vault_new_title')}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                <i className="ri-close-line text-2xl"></i>
                            </button>
                        </div>
                        <form onSubmit={handleSaveItem} className="p-6 space-y-5">
                            {/* Title */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('title')} *</label>
                                <input type="text" required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg outline-none font-bold focus:border-brand-light dark:text-slate-100"
                                    placeholder={t('vault_gen_placeholder')} />
                            </div>

                            {/* Shared / Private Toggle */}
                            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 border border-black/[0.06] dark:border-slate-800 rounded-lg px-5 py-4">
                                <div>
                                    <p className="font-black text-slate-700 dark:text-slate-200 text-sm">{formData.is_shared ? `👨‍👩‍👧 ${t('vault_gen_shared_label')}` : `🔒 ${t('vault_gen_private_label')}`}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">{formData.is_shared ? t('vault_gen_shared_desc') : t('vault_gen_private_desc')}</p>
                                </div>
                                <button type="button" onClick={() => setFormData(f => ({ ...f, is_shared: !f.is_shared }))}
                                    className={`relative w-12 h-6 rounded-full transition-all duration-300 ${formData.is_shared ? 'bg-brand-dark' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform ${formData.is_shared ? 'translate-x-6' : ''}`}></span>
                                </button>
                            </div>

                            {/* Folder */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('vault_folder_all')}</label>
                                <select value={formData.folder_id} onChange={e => setFormData({ ...formData, folder_id: e.target.value })}
                                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg outline-none font-bold appearance-none cursor-pointer focus:border-brand-light dark:text-slate-100">
                                    <option value="">{t('vault_gen_folder_none')}</option>
                                    {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                            </div>

                            {/* Content */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between ml-1 mr-1">
                                    <label className="text-[10px] font-black text-brand-dark uppercase tracking-widest flex items-center gap-1">
                                        <i className="ri-lock-2-line"></i> {t('vault_gen_content_label')} *
                                    </label>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => setShowContent(v => !v)} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-brand-dark transition">
                                            <i className={showContent ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
                                        </button>
                                        <button type="button" onClick={() => setIsGenOpen(v => !v)} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-brand-dark transition flex items-center gap-1">
                                            <i className="ri-key-2-line"></i> {t('vault_gen_password')}
                                        </button>
                                    </div>
                                </div>
                                <textarea required value={formData.content} onChange={e => setFormData({ ...formData, content: e.target.value })}
                                    rows="4" style={{ filter: showContent ? 'none' : 'blur(4px)' }}
                                    onFocus={() => setShowContent(true)}
                                    className="w-full px-5 py-4 bg-brand-light/5 dark:bg-slate-800/80 border border-brand-light/10 dark:border-white/10 rounded-lg focus:ring-4 focus:ring-brand-light/20 outline-none font-mono text-slate-800 dark:text-slate-100 resize-none focus:border-brand-light transition-all"
                                    placeholder={t('vault_placeholder_content')} />
                                {/* Strength bar */}
                                {formData.content && (() => { const s = getStrength(formData.content, t); return (
                                    <div className="flex items-center gap-2 px-1">
                                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${s.color}`} style={{ width: `${(s.score / 5) * 100}%` }}></div></div>
                                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500">{s.label}</span>
                                    </div>
                                ); })()}

                                {/* Generator Panel */}
                                {isGenOpen && (
                                    <div className="bg-slate-50 dark:bg-slate-800/80 border border-black/[0.06] dark:border-white/10 rounded-lg p-4 space-y-3 animate-in slide-in-from-top-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">{t('vault_gen_password')}</span>
                                        </div>
                                        <div className="bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/10 rounded-lg p-3 font-mono text-sm text-slate-700 dark:text-slate-300 flex items-center justify-between gap-2">
                                            <span className="break-all flex-1">{genResult || '—'}</span>
                                            <button type="button" onClick={handleGenerate} className="text-slate-400 hover:text-brand-dark flex-shrink-0"><i className="ri-refresh-line text-lg"></i></button>
                                        </div>
                                        {genResult && (() => { const s = getStrength(genResult, t); return (
                                            <div className="flex items-center gap-2"><div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"><div className={`h-full rounded-full ${s.color}`} style={{ width: `${(s.score / 5) * 100}%` }}></div></div><span className="text-[10px] font-black text-slate-400 dark:text-slate-500">{s.label}</span></div>
                                        ); })()}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                                                <label>{t('vault_gen_length')}: {genLength}</label>
                                                <input type="range" min="8" max="32" value={genLength} onChange={e => { setGenLength(+e.target.value); }} className="w-32 accent-[#2B3E6A]" />
                                            </div>
                                            <div className="flex flex-wrap gap-3">
                                                {[['genUpper', 'A-Z', genUpper, setGenUpper], ['genNum', '0-9', genNumbers, setGenNumbers], ['genSym', '!@#', genSymbols, setGenSymbols]].map(([key, label, val, setter]) => (
                                                    <label key={key} className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer">
                                                        <input type="checkbox" checked={val} onChange={e => setter(e.target.checked)} className="accent-[#2B3E6A]" /> {label}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                        <button type="button" onClick={applyGenerated} className="w-full py-2.5 bg-brand-dark text-white rounded-lg font-black text-sm hover:bg-slate-800 transition">
                                            {t('vault_gen_apply')}
                                        </button>
                                    </div>
                                )}
                            </div>

                            <button type="submit" className="w-full py-5 bg-brand-dark text-white rounded-[1rem] font-black shadow-xl hover:bg-slate-800 transition-all flex justify-center items-center gap-2">
                                <i className="ri-lock-fill"></i> {t('vault_encrypted_save')}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Vault;
