import React from 'react';
import api, { setToken } from '../services/api';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../utils/cropImage';
import PushEditor from './PushEditor';
import { useTranslation } from '../i18n.jsx';

const Settings = ({ user, onUpdateUser, handlePushToggle, pushEnabled }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = React.useState('profile');
    const [members, setMembers] = React.useState([]);
    const [smtpConfig, setSmtpConfig] = React.useState({ host: '', port: '', user: '', pass: '', from: '' });
    const [isAddMemberModalOpen, setIsAddMemberModalOpen] = React.useState(false);
    const [isPermissionsModalOpen, setIsPermissionsModalOpen] = React.useState(false);
    const [selectedUserForPerms, setSelectedUserForPerms] = React.useState(null);
    const [permissions, setPermissions] = React.useState({});
    const [passwords, setPasswords] = React.useState({ current: '', next: '', confirm: '' });
    const [familyName, setFamilyName] = React.useState(user.family_name || '');
    const [roles, setRoles] = React.useState([]);
    const [newRoleName, setNewRoleName] = React.useState('');
    const [preferences, setPreferences] = React.useState({ 
        language: user.language || 'de', 
        theme: user.theme || 'system',
        timezone: user.timezone || 'Europe/Berlin',
        time_offset: user.time_offset || 0 
    });

    React.useEffect(() => {
        if (user) {
            setPreferences({ 
                language: user.language || 'de', 
                theme: user.theme || 'system',
                timezone: user.timezone || 'Europe/Berlin',
                time_offset: user.time_offset || 0
            });
        }
    }, [user]);
    const [pinCode, setPinCode] = React.useState('');
    const [is2faEnabled, setIs2faEnabled] = React.useState(user.two_factor_enabled || false);
    const [profileData, setProfileData] = React.useState({ email: user.email || '', display_role: user.display_role || '' });
    const [stats, setStats] = React.useState(null);
    const [storageConfig, setStorageConfig] = React.useState({ 
        type: 'local', 
        path: '', 
        current: '', 
        isDefault: true, 
        writable: false,
        smb_host: '',
        smb_share: '',
        smb_user: '',
        smb_pass: '',
        smb_port: '445'
    });
    const [storageTestResult, setStorageTestResult] = React.useState(null);
    const [isSavingStorage, setIsSavingStorage] = React.useState(false);

    const [newMember, setNewMember] = React.useState({ username: '', email: '', password: '', role: 'member', display_role: '' });
    const [isEditMemberModalOpen, setIsEditMemberModalOpen] = React.useState(false);
    const [editingMember, setEditingMember] = React.useState(null);
    const [is2faModalOpen, setIs2faModalOpen] = React.useState(false);
    const [twoFactorSetup, setTwoFactorSetup] = React.useState({ qrCodeUrl: '', secret: '', code: '' });
    const [is2faLoading, setIs2faLoading] = React.useState(false);
    const [isBackingUp, setIsBackingUp] = React.useState(false);
    const [isRestoring, setIsRestoring] = React.useState(false);
    const [isResetModalOpen, setIsResetModalOpen] = React.useState(false);
    const [resetPassword, setResetPassword] = React.useState('');
    const [isResetting, setIsResetting] = React.useState(false);
    const [countdown, setCountdown] = React.useState(30);
    const [showCountdownOverlay, setShowCountdownOverlay] = React.useState(false);
    const [countdownType, setCountdownType] = React.useState(''); // 'reset', 'restore', or 'update'

    // Profile Picture State
    const [imageSrc, setImageSrc] = React.useState(null);
    const [crop, setCrop] = React.useState({ x: 0, y: 0 });
    const [zoom, setZoom] = React.useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = React.useState(null);
    const [isCropping, setIsCropping] = React.useState(false);

    React.useEffect(() => {
        if (activeTab === 'admin') {
            fetchMembers();
            fetchSmtp();
            fetchStats();
            fetchStorageConfig();
        }
        if (activeTab === 'family') {
            fetchMembers();
        }
        if (activeTab === 'profile' || activeTab === 'family') {
            fetchRoles();
        }
    }, [activeTab]);

    const fetchStats = async () => {
        try {
            const res = await api.get('/auth/admin/stats');
            setStats(res.data);
        } catch (err) { console.error("Failed to fetch stats:", err); }
    };

    const fetchStorageConfig = async () => {
        try {
            const res = await api.get('/documents/storage-info');
            setStorageConfig({ 
                ...res.data,
                current: res.data.type === 'smb' ? `smb://${res.data.smb_host}/${res.data.smb_share}` : res.data.path,
                smb_pass: '' // Don't fetch password
            });
        } catch (err) { console.error('Failed to fetch storage info:', err); }
    };

    const handleTestStorage = async () => {
        setStorageTestResult(null);
        try {
            const res = await api.post('/documents/storage-path', { ...storageConfig, test: true });
            setStorageTestResult({ ok: res.data.ok, message: res.data.message });
        } catch (err) {
            setStorageTestResult({ ok: false, message: err.response?.data?.message || t('settings_connection_test_failed') });
        }
    };

    const handleSaveStorage = async () => {
        setIsSavingStorage(true);
        try {
            await api.post('/documents/storage-path', { ...storageConfig });
            await fetchStorageConfig();
            setStorageTestResult({ ok: true, message: t('settings_storage_saved_next_access') });
        } catch (err) {
            setStorageTestResult({ ok: false, message: err.response?.data?.error || t('save_error') });
        } finally {
            setIsSavingStorage(false);
        }
    };

    const handleSaveProfile = async () => {
        try {
            await api.put('/auth/profile', profileData);
            alert(t('save_success') || 'Erfolgreich gespeichert');
            onUpdateUser();
        } catch (err) {
            alert(t('save_error') || 'Fehler beim Speichern');
        }
    };

    const handleCleanup = async () => {
        if (!confirm(t('settings_cleanup_confirm'))) return;
        try {
            const res = await api.post('/auth/admin/cleanup');
            alert(res.data.message);
            fetchStats();
        } catch (err) { alert(t('settings_cleanup_failed')); }
    };

    const formatBytes = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const fetchRoles = async () => {
        try {
            const res = await api.get('/auth/family/roles');
            setRoles(res.data);
        } catch (err) { console.error("Failed to fetch roles:", err); }
    };

    const fetchMembers = async () => {
        try {
            const res = await api.get('/auth/family/members');
            setMembers(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchSmtp = async () => {
        try {
            const res = await api.get('/auth/admin/smtp');
            const d = res.data || {};
            setSmtpConfig({ host: d.host || '', port: d.port || '', user: d.user || '', pass: '', from: d.from || '', hasPassword: !!d.hasPassword });
        } catch (err) { console.error(err); }
    };

    const handleSavePreferences = async () => {
        try {
            console.log('Saving Preferences:', preferences);
            await api.put('/auth/profile/preferences', preferences);
            alert(t('save_success') || "Einstellungen gespeichert");
            if (onUpdateUser) onUpdateUser();
        } catch (err) { console.error(err); }
    };

    const handleSyncTime = async () => {
        try {
            let serverMillis;
            try {
                // Primary source: Local Application Server
                const res = await api.get('/system/time');
                serverMillis = res.data.serverTime;
            } catch (localErr) {
                console.warn("Local time sync failed, falling back to worldtimeapi:", localErr);
                // Fallback: Public Time API
                const response = await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC');
                const data = await response.json();
                serverMillis = new Date(data.datetime).getTime();
            }

            const localMillis = Date.now();
            // Calculate offset in seconds
            const offset = Math.round((serverMillis - localMillis) / 1000);
            
            setPreferences(prev => ({ ...prev, time_offset: offset }));
            alert(t('sync_success') || 'Zeit erfolgreich synchronisiert');
        } catch (err) {
            console.error("Time sync failed:", err);
            alert(t('sync_error') || 'Fehler bei der Synchronisation');
        }
    };

    const getAppTime = () => {
        const now = new Date();
        const offsetMs = (preferences.time_offset || 0) * 1000;
        return new Date(now.getTime() + offsetMs);
    };

    const [currentTime, setCurrentTime] = React.useState(getAppTime());

    React.useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(getAppTime());
        }, 1000);
        return () => clearInterval(timer);
    }, [preferences.time_offset]);

    const handleSavePin = async () => {
        try {
            await api.post('/auth/profile/pin', { pin: pinCode });
            alert(t('settings_pin_set_success'));
            setPinCode('');
        } catch (err) { alert(err.response?.data?.error || t('settings_pin_set_error')); }
    };

    const handleToggle2fa = async () => {
        if (is2faEnabled) {
            if (!confirm(t('settings_2fa_disable_confirm'))) return;
            try {
                await api.post('/auth/profile/2fa/disable');
                setIs2faEnabled(false);
                alert(t('settings_2fa_disabled'));
            } catch (err) { alert(t('settings_2fa_disable_error')); }
        } else {
            setIs2faModalOpen(true);
            start2faSetup();
        }
    };

    const start2faSetup = async () => {
        setIs2faLoading(true);
        try {
            const res = await api.post('/auth/profile/2fa/setup');
            setTwoFactorSetup({ ...twoFactorSetup, qrCodeUrl: res.data.qrCodeUrl, secret: res.data.secret });
        } catch (err) { alert(t('settings_setup_start_error')); }
        finally { setIs2faLoading(false); }
    };

    const verifyAndEnable2fa = async () => {
        if (!twoFactorSetup.code || twoFactorSetup.code.length !== 6) return alert(t('settings_enter_6_digit_code'));
        setIs2faLoading(true);
        try {
            await api.post('/auth/profile/2fa/verify', { code: twoFactorSetup.code });
            setIs2faEnabled(true);
            setIs2faModalOpen(false);
            alert(t('settings_2fa_active_success'));
        } catch (err) { alert(err.response?.data?.error || t('settings_verification_failed')); }
        finally { setIs2faLoading(false); }
    };

    const handleDownloadBackup = async () => {
        setIsBackingUp(true);
        try {
            const response = await api.get('/system/export', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `famyhub_backup_${new Date().toISOString().split('T')[0]}.zip`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            alert(t('settings_backup_download_error'));
        } finally {
            setIsBackingUp(false);
        }
    };

    const handleRestoreBackup = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!confirm(t('settings_restore_warning'))) {
            event.target.value = null;
            return;
        }

        setIsRestoring(true);
        const formData = new FormData();
        formData.append('backup', file);

        try {
            const res = await api.post('/system/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setToken(null); // Session is invalid after a restore
            setCountdownType('restore');
            setShowCountdownOverlay(true);
            const timer = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        window.location.href = '/login'; // Redirect to login
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } catch (err) {
            alert(err.response?.data?.error || t('settings_restore_error'));
        } finally {
            setIsRestoring(false);
            event.target.value = null;
        }
    };

    const handleReset = async (e) => {
        e.preventDefault();
        if (!confirm(t('settings_reset_warning'))) return;

        setIsResetting(true);
        try {
            const res = await api.post('/system/reset', { password: resetPassword });
            setToken(null);
            setIsResetModalOpen(false);
            setCountdownType('reset');
            setShowCountdownOverlay(true);
            const timer = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        window.location.href = '/login';
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } catch (err) {
            alert(err.response?.data?.error || t('settings_reset_failed'));
            setIsResetting(false);
        }
    };

    const handleSaveSmtp = async (e) => {
        e.preventDefault();
        try {
            await api.post('/auth/admin/smtp', smtpConfig);
            alert(t('settings_smtp_saved'));
        } catch (err) { console.error(err); }
    };

    const handleSaveFamilyName = async () => {
        try {
            await api.put('/auth/family/name', { name: familyName });
            alert(t('family_name_updated'));
            if (onUpdateUser) onUpdateUser();
        } catch (err) { alert(t('error_saving')); }
    };

    const handleAddMember = async (e) => {
        e.preventDefault();
        try {
            await api.post('/auth/family/members', newMember);
            setIsAddMemberModalOpen(false);
            setNewMember({ username: '', email: '', password: '', role: 'member' });
            fetchMembers();
        } catch (err) { alert(t(err.response?.data?.error) || t('error_creating')); }
    };

    const handleSaveMemberEdit = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/auth/family/members/${editingMember.id}`, editingMember);
            setIsEditMemberModalOpen(false);
            fetchMembers();
            alert(t('member_updated'));
        } catch (err) { alert(t('error_saving')); }
    };

    const handleAddRole = async () => {
        if (!newRoleName.trim()) return;
        try {
            await api.post('/auth/family/roles', { name: newRoleName });
            setNewRoleName('');
            fetchRoles();
        } catch (err) { alert(t('error_add_role')); }
    };

    const handleDeleteRole = async (id) => {
        if (!confirm("Rolle wirklich löschen?")) return;
        try {
            await api.delete(`/auth/family/roles/${id}`);
            fetchRoles();
        } catch (err) { alert(t('error_delete_role')); }
    };

    const onCropComplete = (croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    };

    const onFileChange = async (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                setImageSrc(reader.result);
                setIsCropping(true);
            });
            reader.readAsDataURL(file);
        }
    };

    const handleUploadAvatar = async () => {
        try {
            const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
            const formData = new FormData();
            formData.append('avatar', croppedImage);

            const res = await api.post('/auth/profile/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setIsCropping(false);
            setImageSrc(null);
            alert(t('Profilbild_aktualisiert'));
            if (onUpdateUser) onUpdateUser();
        } catch (e) {
            console.error(e);
            alert("Fehler beim Upload");
        }
    };

    const handleOpenPermissions = (u) => {
        setSelectedUserForPerms(u);
        let perms = {};
        try {
            perms = typeof u.permissions === 'string' ? JSON.parse(u.permissions) : (u.permissions || {});
        } catch (e) { perms = {}; }

        // All available features
        const allFeatures = ['calendar', 'shopping', 'meals', 'documents', 'wishlist', 'contracts', 'gallery', 'vacations', 'chat', 'contacts', 'projects', 'vault', 'recipes', 'pocket_money', 'chores', 'timeline'];
        const currentPerms = {};
        allFeatures.forEach(f => {
            currentPerms[f] = perms[f] === undefined ? true : perms[f];
        });

        setPermissions(currentPerms);
        setIsPermissionsModalOpen(true);
    };

    const handleSavePermissions = async () => {
        try {
            await api.put(`/auth/user/${selectedUserForPerms.id}/permissions`, { permissions });
            setIsPermissionsModalOpen(false);
            fetchMembers();
        } catch (err) { console.error(err); }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (passwords.next !== passwords.confirm) return alert("Passwörter stimmen nicht überein");
        try {
            const res = await api.post('/auth/profile/password', {
                currentPassword: passwords.current,
                newPassword: passwords.next
            });
            // All other sessions were signed out – this device gets a fresh token.
            if (res.data?.token) setToken(res.data.token);
            alert("Passwort erfolgreich geändert. Andere Geräte wurden abgemeldet.");
            setPasswords({ current: '', next: '', confirm: '' });
        } catch (err) { alert(err.response?.data?.error || "Fehler beim Ändern"); }
    };

    const navItems = [
        { id: 'profile', icon: 'ri-user-smile-line', label: t('profile_mgmt'), category: 'Profil' },
        { id: 'family', icon: 'ri-home-heart-line', label: t('family_mgmt'), category: 'Profil' },
        { id: 'app', icon: 'ri-settings-4-line', label: t('system_time_mgmt'), category: 'Profil' },
        { id: 'security', icon: 'ri-shield-keyhole-line', label: t('security_settings'), category: 'Profil' },
        { id: 'push', icon: 'ri-notification-3-line', label: t('push_notifications'), category: 'Admin', adminOnly: true },
        { id: 'admin', icon: 'ri-admin-line', label: t('admin_settings'), category: 'Admin', adminOnly: true },
    ];

    const currentCategory = navItems.find(i => i.id === activeTab)?.category;

    return (
        <div className="max-w-7xl mx-auto min-h-[80vh] flex flex-col md:flex-row gap-8">
            {/* Sidebar Navigation */}
            <aside className="w-full md:w-72 space-y-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight px-4 mb-2">{t('settings')}</h1>
                    <p className="text-slate-400 dark:text-slate-500 font-bold px-4 text-xs uppercase tracking-widest">{t('config_protection')}</p>
                </div>

                <nav className="space-y-8 mt-10">
                    {['Profil', 'Admin'].map(cat => (
                        <div key={cat} className={(cat === 'Admin' && user.role !== 'admin') ? 'hidden' : ''}>
                            <h3 className="px-6 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4">{cat === 'Profil' ? t('profile_tab') : t('admin_tab')}</h3>
                            <div className="space-y-1">
                                {navItems
                                    .filter(item => item.category === cat)
                                    .filter(item => !item.adminOnly || user.role === 'admin')
                                    .map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => setActiveTab(item.id)}
                                            className={`w-full flex items-center gap-4 px-6 py-4 rounded-lg font-black transition-all ${activeTab === item.id ? 'bg-brand-dark text-white shadow-xl' : 'text-slate-500 dark:text-slate-400 hover:text-brand-dark dark:hover:text-brand-light hover:bg-white dark:hover:bg-slate-800/50'}`}
                                        >
                                            <i className={`${item.icon} text-xl`}></i>
                                            <span className="text-sm">{item.label}</span>
                                        </button>
                                    ))}
                            </div>
                        </div>
                    ))}
                </nav>
            </aside>

            {/* Content Area */}
            <main className="flex-1 bg-white dark:bg-slate-900 rounded-[3rem] shadow-sm border border-black/[0.06] dark:border-slate-800 p-8 md:p-12 relative overflow-hidden transition-colors duration-500">
                {/* Header Decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 dark:bg-slate-800/20 rounded-full -mr-32 -mt-32 opacity-50 transition-colors"></div>

                <div className="relative z-10 h-full flex flex-col">
                    {/* 1. Profilverwaltung */}
                    {activeTab === 'profile' && (
                        <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
                            <div>
                                <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight mb-2">{t('profile_mgmt')}</h2>
                                <p className="text-slate-400 dark:text-slate-500 font-bold">{t('profile_info')}</p>
                            </div>

                            <div className="space-y-8">
                                <section className="bg-slate-50/50 dark:bg-slate-800/50 p-8 rounded-[1.25rem] border border-black/[0.06] dark:border-slate-800">
                                    <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-3">
                                        <i className="ri-user-settings-line text-brand-dark dark:text-brand-light"></i>
                                        {t('profile_pic')}
                                    </h3>
                                    <div className="flex flex-col sm:flex-row items-center gap-8 bg-white dark:bg-slate-900 p-6 rounded-[1rem] border border-black/[0.06] dark:border-slate-800 shadow-sm transition-colors">
                                        <div className="relative">
                                            {user.profile_picture ? (
                                                <img src={`${window.location.origin}${user.profile_picture}`} className="w-24 h-24 rounded-full object-cover border-2 border-slate-50 shadow-md" alt="Profil" />
                                            ) : (
                                                <div className="w-24 h-24 rounded-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-white/10 flex items-center justify-center text-slate-200 dark:text-slate-600 text-3xl shadow-inner transition-colors">
                                                    <i className="ri-user-smile-line"></i>
                                                </div>
                                            )}
                                            <label className="absolute bottom-0 right-0 w-8 h-8 bg-brand-dark text-white rounded-full flex items-center justify-center border border-white cursor-pointer hover:scale-110 transition-transform shadow-lg">
                                                <i className="ri-camera-lens-line text-sm"></i>
                                                <input id="avatar-input" type="file" className="hidden" accept="image/*" onChange={onFileChange} />
                                            </label>
                                        </div>
                                        <div className="flex-1 text-center sm:text-left">
                                            <h4 className="font-black text-slate-800 mb-1">Dein Foto</h4>
                                            <button
                                                onClick={() => document.getElementById('avatar-input').click()}
                                                className="mt-2 px-6 py-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs hover:bg-white dark:hover:bg-slate-700 border border-transparent hover:border-slate-100 dark:hover:border-slate-600 transition-all"
                                            >
                                                Bild ändern
                                            </button>
                                        </div>
                                    </div>
                                </section>

      {isCropping && (
                                    <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
                                        <div className="bg-white dark:bg-slate-900 rounded-[1.25rem] w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] transition-colors border border-transparent dark:border-slate-800">
                                            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                                <h3 className="text-xl font-black text-slate-800">Foto anpassen</h3>
                                                <button onClick={() => setIsCropping(false)} className="text-slate-400 hover:text-slate-600">
                                                    <i className="ri-close-line text-2xl"></i>
                                                </button>
                                            </div>
                                            <div className="flex-1 relative min-h-[400px] bg-slate-50 dark:bg-slate-950 transition-colors">
                                                <Cropper
                                                    image={imageSrc}
                                                    crop={crop}
                                                    zoom={zoom}
                                                    aspect={1}
                                                    cropShape="round"
                                                    showGrid={false}
                                                    onCropChange={setCrop}
                                                    onCropComplete={onCropComplete}
                                                    onZoomChange={setZoom}
                                                />
                                            </div>
                                            <div className="p-8 space-y-6">
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                        <span>Zoom</span>
                                                        <span>{Math.round(zoom * 100)}%</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        value={zoom}
                                                        min={1}
                                                        max={3}
                                                        step={0.1}
                                                        aria-labelledby="Zoom"
                                                        onChange={(e) => setZoom(e.target.value)}
                                                        className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-brand-dark"
                                                    />
                                                </div>
                                                <div className="flex gap-4">
                                                    <button
                                                        onClick={() => setIsCropping(false)}
                                                        className="flex-1 py-4 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-300 rounded-lg font-black hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                                                    >
                                                        Abbrechen
                                                    </button>
                                                    <button
                                                        onClick={handleUploadAvatar}
                                                        className="flex-2 py-4 bg-brand-dark text-white rounded-lg font-black shadow-xl transition-all px-12"
                                                    >
                                                        Hochladen
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                    <section className="bg-slate-50/50 dark:bg-slate-800/50 p-8 rounded-[1.25rem] border border-black/[0.06] dark:border-slate-800">
                                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-3">
                                            <i className="ri-lock-2-line text-brand-dark dark:text-brand-light"></i>
                                            {t('account_details')}
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">{t('username')}</label>
                                                <input
                                                    type="text"
                                                    disabled
                                                    className="w-full h-14 px-6 bg-slate-200/50 dark:bg-slate-800/50 border border-transparent rounded-lg font-bold outline-none text-slate-400 dark:text-slate-600 cursor-not-allowed"
                                                    value={user.username}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">{t('email')}</label>
                                                <input
                                                    type="email"
                                                    className="w-full h-14 px-6 bg-white dark:bg-slate-900 border border-transparent dark:border-slate-800 rounded-lg font-bold outline-none focus:border-brand-dark dark:focus:border-brand-light shadow-sm text-slate-800 dark:text-slate-100"
                                                    value={profileData.email}
                                                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className="mt-6">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">{t('role_label')}</label>
                                            <select
                                                className="w-full h-14 px-6 bg-white dark:bg-slate-900 border border-transparent dark:border-slate-800 rounded-lg font-bold outline-none focus:border-brand-dark dark:focus:border-brand-light shadow-sm appearance-none text-slate-800 dark:text-slate-100"
                                                value={profileData.display_role}
                                                onChange={(e) => setProfileData({ ...profileData, display_role: e.target.value })}
                                            >
                                                <option value="">{t('no_role')}</option>
                                                {roles.map(role => (
                                                    <option key={role.id} value={role.name}>{role.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <button
                                            onClick={handleSaveProfile}
                                            className="w-full mt-8 py-4 bg-brand-dark text-white rounded-lg font-black shadow-xl transition-all"
                                        >
                                            {t('save_profile_btn')}
                                        </button>
                                    </section>
                                </div>
                            </div>
                    )}

                    {/* 5. Push-Benachrichtigungen */}
                    {activeTab === 'push' && <PushEditor />}

                    {/* 2. Familienverwaltung */}
                    {activeTab === 'family' && (
                        <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
                            <div>
                                <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight mb-2">{t('family_mgmt')}</h2>
                                <p className="text-slate-400 dark:text-slate-500 font-bold">{t('family_info')}</p>
                            </div>

                            <div className="bg-slate-50/50 dark:bg-slate-800/50 p-10 rounded-[1.25rem] border border-black/[0.06] dark:border-slate-800 space-y-10">
                                <section className="space-y-4">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">{t('family_name_label')}</label>
                                    <div className="flex gap-4">
                                        <input
                                            type="text"
                                            className="flex-1 h-14 px-6 bg-white dark:bg-slate-900 border border-transparent dark:border-slate-800 focus:border-brand-dark dark:focus:border-brand-light rounded-lg font-bold outline-none shadow-sm text-slate-800 dark:text-slate-100"
                                            value={familyName}
                                            onChange={(e) => setFamilyName(e.target.value)}
                                            placeholder={t('family_name_placeholder')}
                                        />
                                        <button
                                            onClick={handleSaveFamilyName}
                                            className="px-8 bg-brand-dark text-white rounded-lg font-black shadow-lg transition-all"
                                        >
                                            {t('save')}
                                        </button>
                                    </div>
                                </section>

                                <hr className="border-slate-100 dark:border-white/10" />

                                <section className="space-y-6">
                                    <div>
                                        <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">{t('family_members')}</h3>
                                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500">{t('family_members_info')}</p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {members.map(m => (
                                            <div key={m.id} className="flex items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-lg border border-black/[0.06] dark:border-slate-800 shadow-sm">
                                                <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center font-black text-slate-300 dark:text-slate-600">
                                                    {m.username.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-black text-slate-800 dark:text-slate-100">{m.username}</div>
                                                    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{m.display_role || t('member')}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </div>
                        </div>
                    )}

                    {/* 3. Appverwaltung */}
                    {activeTab === 'app' && (
                        <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
                            <div>
                                <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight mb-2">{t('system_time_mgmt')}</h2>
                                <p className="text-slate-400 dark:text-slate-500 font-bold">{t('app_info')}</p>
                            </div>

                            <div className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <section className="space-y-4">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">{t('display_language')}</label>
                                        <div className="flex gap-3">
                                            {['de', 'en'].map(lang => (
                                                <button
                                                    key={lang}
                                                    onClick={() => setPreferences({ ...preferences, language: lang })}
                                                    className={`flex-1 py-4 rounded-lg font-black transition-all border ${preferences.language === lang ? 'bg-brand-dark text-white border-brand-dark' : 'bg-slate-50 dark:bg-slate-800 border-transparent text-slate-400 dark:text-slate-500 hover:bg-white dark:hover:bg-slate-700 hover:border-slate-100 dark:hover:border-slate-600'}`}
                                                >
                                                    {lang === 'de' ? 'Deutsch' : 'English'}
                                                </button>
                                            ))}
                                        </div>
                                    </section>

                                    <section className="space-y-4">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">{t('design')}</label>
                                        <div className="flex gap-3">
                                            {['system', 'light', 'dark'].map(theme => (
                                                <button
                                                    key={theme}
                                                    onClick={() => setPreferences({ ...preferences, theme: theme })}
                                                    className={`flex-1 py-4 rounded-lg font-black transition-all border ${preferences.theme === theme ? 'bg-brand-dark text-white border-brand-dark' : 'bg-slate-50 dark:bg-slate-800 border-transparent text-slate-400 dark:text-slate-500 hover:bg-white dark:hover:bg-slate-700 hover:border-slate-100 dark:hover:border-slate-600'}`}
                                                >
                                                    <i className={theme === 'light' ? 'ri-sun-line mr-2' : theme === 'dark' ? 'ri-moon-line mr-2' : 'ri-contrast-2-line mr-2'}></i>
                                                    {theme === 'light' ? t('light') : theme === 'dark' ? t('dark') : 'Automatisch'}
                                                </button>
                                            ))}
                                        </div>
                                    </section>
                                </div>

                                <section className="bg-slate-50/50 dark:bg-slate-800/50 p-8 rounded-[1.25rem] border border-black/[0.06] dark:border-slate-800 space-y-8">
                                    <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                                        <i className="ri-time-line text-brand-dark dark:text-brand-light"></i>
                                        {t('timezone_settings')}
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">{t('timezone_label')}</label>
                                            <select
                                                className="w-full h-14 px-6 bg-white dark:bg-slate-900 border border-transparent dark:border-slate-800 rounded-lg font-bold outline-none focus:border-brand-dark dark:focus:border-brand-light shadow-sm text-slate-800 dark:text-slate-100 appearance-none"
                                                value={preferences.timezone}
                                                onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
                                            >
                                                {Intl.supportedValuesOf('timeZone').map(tz => (
                                                    <option key={tz} value={tz}>{tz}</option>
                                                ))}
                                            </select>
                                            <div className="mt-2 flex items-center gap-2">
                                                <span className="px-2 py-1 bg-brand-light/10 text-brand-dark dark:text-brand-light text-[8px] font-black uppercase tracking-widest rounded border border-brand-light/20 flex items-center gap-1">
                                                    <i className="ri-checkbox-circle-line"></i>
                                                    {t('auto_dst')}
                                                </span>
                                                {(() => {
                                                    try {
                                                        const formatter = new Intl.DateTimeFormat('de-DE', { timeZone: preferences.timezone, timeZoneName: 'shortOffset' });
                                                        const offset = formatter.formatToParts(new Date()).find(p => p.type === 'timeZoneName').value;
                                                        return (
                                                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">
                                                                {t('current_offset')}: {offset}
                                                            </span>
                                                        );
                                                    } catch (e) { return null; }
                                                })()}
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">{t('manual_time_label')}</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    className="w-full h-14 px-6 bg-white dark:bg-slate-900 border border-transparent dark:border-slate-800 rounded-lg font-bold outline-none focus:border-brand-dark dark:focus:border-brand-light shadow-sm text-slate-800 dark:text-slate-100"
                                                    value={preferences.time_offset}
                                                    onChange={(e) => setPreferences({ ...preferences, time_offset: parseInt(e.target.value) || 0 })}
                                                />
                                                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">SEC</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-center justify-between p-6 bg-white dark:bg-slate-900 rounded-[1rem] border border-black/[0.06] dark:border-slate-800 gap-4 transition-colors">
                                        <div className="space-y-1">
                                            <h4 className="font-black text-slate-800 dark:text-slate-100">{t('current_app_time')}</h4>
                                            <p className="text-2xl font-mono font-black text-brand-dark dark:text-brand-light">
                                                {currentTime.toLocaleTimeString(preferences.language === 'de' ? 'de-DE' : 'en-US', { timeZone: preferences.timezone })}
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleSyncTime}
                                            className="px-8 py-4 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-black hover:bg-brand-dark hover:text-white transition-all flex items-center gap-2 border border-transparent hover:border-brand-light"
                                        >
                                            <i className="ri-refresh-line"></i>
                                            {t('sync_with_server')}
                                        </button>
                                    </div>
                                </section>

                                <section className="space-y-4">
                                    <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">{t('push_notifications')}</h3>
                                    <div className="flex flex-col sm:flex-row items-center justify-between p-6 bg-slate-50 dark:bg-slate-800/80 rounded-[1rem] border border-black/[0.06] dark:border-slate-800 gap-4 transition-colors">
                                        <div>
                                            <h4 className="font-black text-slate-800 dark:text-slate-100">{t('push_notifications')}</h4>
                                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-1">
                                                {pushEnabled
                                                    ? t('push_active')
                                                    : t('push_inactive')}
                                            </p>
                                        </div>
                                        <button
                                            onClick={(e) => { e.preventDefault(); handlePushToggle(); }}
                                            className={`px-8 py-4 rounded-xl font-black transition-all whitespace-nowrap ${pushEnabled
                                                ? 'bg-red-500 text-white shadow-lg hover:bg-red-600'
                                                : 'bg-brand-dark text-white shadow-xl'}`}
                                        >
                                            {pushEnabled ? (
                                                <><i className="ri-notification-off-line mr-2"></i>{t('deactivate')}</>
                                            ) : (
                                                t('activate_on_device')
                                            )}
                                        </button>
                                    </div>
                                </section>

                                <button onClick={handleSavePreferences} className="w-full py-5 bg-brand-dark text-white rounded-[1rem] font-black shadow-xl transition-all">
                                    {t('save_preferences_btn')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 4. Sicherheitseinstellungen */}
                    {activeTab === 'security' && (
                        <div className="space-y-12 animate-in slide-in-from-right-4 duration-500">
                            <div>
                                <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight mb-2">{t('security_settings')}</h2>
                                <p className="text-slate-400 dark:text-slate-500 font-bold">{t('security_info')}</p>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                <section className="space-y-6">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="w-12 h-12 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center text-xl shadow-sm"><i className="ri-lock-password-line"></i></div>
                                        <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">{t('manage_password')}</h3>
                                    </div>
                                    <form onSubmit={handleChangePassword} className="space-y-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">{t('current_password')}</label>
                                            <input type="password" required className="w-full h-14 px-6 bg-slate-50 dark:bg-slate-800 border border-brand-dark/25 focus:border-brand-light rounded-lg font-bold outline-none transition-all text-slate-800 dark:text-slate-100" value={passwords.current} onChange={e => setPasswords({ ...passwords, current: e.target.value })} />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">{t('new_password')}</label>
                                            <input type="password" required className="w-full h-14 px-6 bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-brand-light rounded-lg font-bold outline-none transition-all text-slate-800 dark:text-slate-100" value={passwords.next} onChange={e => setPasswords({ ...passwords, next: e.target.value })} />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">{t('confirm_password')}</label>
                                            <input type="password" required className="w-full h-14 px-6 bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-brand-light rounded-lg font-bold outline-none transition-all text-slate-800 dark:text-slate-100" value={passwords.confirm} onChange={e => setPasswords({ ...passwords, confirm: e.target.value })} />
                                        </div>
                                        <button type="submit" className="w-full py-5 bg-brand-dark text-white rounded-[1rem] font-black shadow-lg hover:bg-slate-800 dark:hover:bg-slate-700 transition-all">{t('update_password_btn')}</button>
                                    </form>
                                </section>

                                <section className="space-y-10">
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-12 h-12 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center text-xl shadow-sm"><i className="ri-keypad-line"></i></div>
                                            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">{t('manage_pin')}</h3>
                                        </div>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 font-bold leading-relaxed italic">{t('pin_info')}</p>
                                        <div className="flex gap-3">
                                            <input type="password" placeholder={t('new_pin_placeholder')} className="flex-1 h-14 px-6 bg-slate-50 dark:bg-slate-800 border border-brand-dark/25 focus:border-brand-light rounded-lg font-black tracking-[0.5em] outline-none text-center text-slate-800 dark:text-slate-100" value={pinCode} onChange={e => setPinCode(e.target.value)} maxLength={6} />
                                            <button onClick={handleSavePin} className="px-8 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg font-black hover:bg-brand-dark hover:text-white transition-all">{t('save')}</button>
                                        </div>
                                    </div>

                                    <div className="pt-6 border-t border-slate-50 dark:border-slate-800">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center text-xl shadow-sm"><i className="ri-shield-check-line"></i></div>
                                                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">{t('manage_2fa')}</h3>
                                            </div>
                                            <button
                                                onClick={handleToggle2fa}
                                                className={`w-16 h-8 rounded-full p-1 transition-all ${is2faEnabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                                            >
                                                <div className={`w-6 h-6 bg-white dark:bg-slate-200 rounded-full shadow-sm transition-all ${is2faEnabled ? 'ml-8' : 'ml-0'}`}></div>
                                            </button>
                                        </div>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 font-bold leading-relaxed">
                                            {is2faEnabled
                                                ? t('2fa_active')
                                                : t('2fa_inactive')}
                                        </p>
                                    </div>
                                </section>
                            </div>
                        </div>
                    )}

                    {/* 5. Administratoreinstellungen */}
                    {activeTab === 'admin' && (
                        <div className="space-y-12 animate-in slide-in-from-right-4 duration-500 overflow-y-auto custom-scrollbar pr-2">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight mb-2">{t('admin_settings')}</h2>
                                    <p className="text-slate-400 dark:text-slate-500 font-bold">{t('admin_info')}</p>
                                </div>
                            </div>

                            {/* Section: System Info & Storage */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <section className="bg-slate-800 dark:bg-slate-900 text-white p-8 rounded-[1.25rem] shadow-xl md:col-span-2 relative overflow-hidden">
                                    <i className="ri-cpu-line absolute -bottom-10 -right-10 text-[12rem] opacity-5"></i>
                                    <h3 className="text-lg font-black mb-6 flex items-center gap-3">
                                        <i className="ri-information-line text-brand-light"></i>
                                        {t('system_info')}
                                    </h3>
                                    {stats ? (
                                        <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{t('platform')}</p>
                                                <p className="font-bold">{stats.system.platform} ({stats.system.arch})</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{t('node_version')}</p>
                                                <p className="font-bold">{stats.system.nodeVersion}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{t('uptime')}</p>
                                                <p className="font-bold">{Math.floor(stats.system.uptime / 3600)} {t('hours')}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{t('cpus')}</p>
                                                <p className="font-bold">{stats.system.cpus} {t('cores')}</p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{t('ram_usage')}</p>
                                                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-1">
                                                    <div className="h-full bg-brand-light" style={{ width: `${Math.round(((stats.system.memory.total - stats.system.memory.free) / stats.system.memory.total) * 100)}%` }}></div>
                                                </div>
                                                <p className="text-[10px] font-bold opacity-60">{formatBytes(stats.system.memory.total - stats.system.memory.free)} / {formatBytes(stats.system.memory.total)}</p>
                                            </div>
                                        </div>
                                    ) : <p className="text-slate-400 animate-pulse">...</p>}
                                </section>

                                <section className="bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-slate-800 p-8 rounded-[1.25rem] shadow-sm flex flex-col justify-between transition-colors">
                                    <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-3">
                                        <i className="ri-hard-drive-2-line text-brand-dark"></i>
                                        {t('storage_usage')}
                                    </h3>
                                    {stats ? (
                                        <div className="space-y-6">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('database')}</p>
                                                <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{formatBytes(stats.storage.database)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('uploads')}</p>
                                                <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{formatBytes(stats.storage.uploads)}</p>
                                            </div>
                                            <button onClick={handleCleanup} className="w-full py-3 bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-600 transition-all flex items-center justify-center gap-2">
                                                <i className="ri-broom-line"></i>
                                                {t('cleanup_db_btn')}
                                            </button>
                                        </div>
                                    ) : <div className="space-y-4"><div className="h-12 bg-slate-50 dark:bg-slate-700 animate-pulse rounded-xl"></div><div className="h-12 bg-slate-50 dark:bg-slate-700 animate-pulse rounded-xl"></div></div>}
                                </section>
                            </div>

                            {/* Section: SMTP Mailserver */}
                            <section className="bg-slate-50/50 dark:bg-slate-800/30 p-10 rounded-[1.25rem] border border-black/[0.06] dark:border-slate-800">
                                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-3">
                                    <i className="ri-mail-send-line text-brand-dark"></i>
                                    {t('mailserver_smtp')}
                                </h3>
                                <form onSubmit={handleSaveSmtp} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <input type="text" className="w-full h-14 px-6 bg-white dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg font-bold outline-none text-slate-800 dark:text-slate-100" placeholder={t('smtp_host')} value={smtpConfig.host} onChange={e => setSmtpConfig({ ...smtpConfig, host: e.target.value })} />
                                    <input type="text" className="w-full h-14 px-6 bg-white dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg font-bold outline-none text-slate-800 dark:text-slate-100" placeholder={t('smtp_port')} value={smtpConfig.port} onChange={e => setSmtpConfig({ ...smtpConfig, port: e.target.value })} />
                                    <input type="text" className="w-full h-14 px-6 bg-white dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg font-bold outline-none text-slate-800 dark:text-slate-100" placeholder={t('smtp_user')} value={smtpConfig.user} onChange={e => setSmtpConfig({ ...smtpConfig, user: e.target.value })} />
                                    <input type="password" className="w-full h-14 px-6 bg-white dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg font-bold outline-none text-slate-800 dark:text-slate-100" placeholder={smtpConfig.hasPassword ? '•••••••• (unverändert)' : t('smtp_pass')} value={smtpConfig.pass} onChange={e => setSmtpConfig({ ...smtpConfig, pass: e.target.value })} />
                                    <input type="email" className="md:col-span-2 w-full h-14 px-6 bg-white dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg font-bold outline-none text-slate-800 dark:text-slate-100" placeholder={t('smtp_from')} value={smtpConfig.from} onChange={e => setSmtpConfig({ ...smtpConfig, from: e.target.value })} />
                                    <button type="submit" className="md:col-span-2 py-4 bg-brand-dark text-white rounded-lg font-black shadow-lg transition-all">{t('save_smtp_btn')}</button>
                                </form>
                            </section>

                            {/* Section: Dokumentenspeicher */}
                            <section className="bg-slate-50/50 dark:bg-slate-800/30 p-10 rounded-[1.25rem] border border-black/[0.06] dark:border-slate-800">
                                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-3">
                                    <i className="ri-folder-cloud-line text-brand-dark"></i>
                                    {t('doc_storage')}
                                </h3>
                                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-6">{t('doc_storage_info')}</p>

                                <div className="space-y-6">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">{t('storage_mode')}</label>
                                        <div className="flex bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-black/[0.06] dark:border-white/10 shadow-sm">
                                            {['local', 'smb'].map((type) => (
                                                <button
                                                    key={type}
                                                    onClick={() => setStorageConfig({ ...storageConfig, type })}
                                                    className={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${storageConfig.type === type ? 'bg-brand-dark text-white shadow-md' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
                                                >
                                                    {type === 'local' ? t('local_path') : t('nas_smb')}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 p-4 rounded-lg border border-black/[0.06] dark:border-white/10 bg-white dark:bg-slate-800/50">
                                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${storageConfig.writable ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
                                        <div>
                                            <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('current_status')}</p>
                                            <p className="font-bold text-slate-700 dark:text-slate-200 text-sm truncate">{storageConfig.current || '...'}</p>
                                            <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                                {storageConfig.type === 'smb' ? 'SMB' : storageConfig.isDefault ? t('internal') : t('custom')} 
                                                · {storageConfig.writable ? '✓' : '✗'}
                                            </p>
                                        </div>
                                    </div>

                                    {storageConfig.type === 'local' ? (
                                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1 mb-2 block">{t('local_absolute_path')}</label>
                                            <input
                                                type="text"
                                                className="w-full h-14 px-6 bg-white dark:bg-slate-800 border border-transparent focus:border-brand-dark rounded-lg font-bold outline-none shadow-sm font-mono text-sm text-slate-800 dark:text-slate-100"
                                                placeholder={t('path_placeholder')}
                                                value={storageConfig.path}
                                                onChange={e => { setStorageConfig({ ...storageConfig, path: e.target.value }); setStorageTestResult(null); }}
                                            />
                                        </div>
                                    ) : (
                                        <form onSubmit={e => e.preventDefault()} className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div className="md:col-span-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1 mb-2 block" htmlFor="smb_host">{t('smb_host')}</label>
                                                <input
                                                    id="smb_host"
                                                    name="smb_host"
                                                    type="text"
                                                    className="w-full h-14 px-6 bg-white dark:bg-slate-800 border border-transparent focus:border-brand-dark rounded-lg font-bold outline-none shadow-sm font-mono text-sm text-slate-800 dark:text-slate-100"
                                                    placeholder="10.0.5.17"
                                                    value={storageConfig.smb_host}
                                                    onChange={e => { setStorageConfig({ ...storageConfig, smb_host: e.target.value }); setStorageTestResult(null); }}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1 mb-2 block" htmlFor="smb_share">{t('smb_share')}</label>
                                                <input
                                                    id="smb_share"
                                                    name="smb_share"
                                                    type="text"
                                                    className="w-full h-14 px-6 bg-white dark:bg-slate-800 border border-transparent focus:border-brand-dark rounded-lg font-bold outline-none shadow-sm font-mono text-sm text-slate-800 dark:text-slate-100"
                                                    placeholder="Dokumente"
                                                    value={storageConfig.smb_share}
                                                    onChange={e => { setStorageConfig({ ...storageConfig, smb_share: e.target.value }); setStorageTestResult(null); }}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1 mb-2 block" htmlFor="smb_port">{t('smb_port_label')}</label>
                                                <input
                                                    id="smb_port"
                                                    name="smb_port"
                                                    type="text"
                                                    className="w-full h-14 px-6 bg-white dark:bg-slate-800 border border-transparent focus:border-brand-dark rounded-lg font-bold outline-none shadow-sm font-mono text-sm text-slate-800 dark:text-slate-100"
                                                    placeholder="445"
                                                    value={storageConfig.smb_port}
                                                    onChange={e => { setStorageConfig({ ...storageConfig, smb_port: e.target.value }); setStorageTestResult(null); }}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1 mb-2 block" htmlFor="smb_user">{t('username')}</label>
                                                <input
                                                    id="smb_user"
                                                    name="smb_user"
                                                    type="text"
                                                    autoComplete="username"
                                                    className="w-full h-14 px-6 bg-white dark:bg-slate-800 border border-transparent focus:border-brand-dark rounded-lg font-bold outline-none shadow-sm font-mono text-sm text-slate-800 dark:text-slate-100"
                                                    value={storageConfig.smb_user}
                                                    onChange={e => { setStorageConfig({ ...storageConfig, smb_user: e.target.value }); setStorageTestResult(null); }}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1 mb-2 block" htmlFor="smb_pass">{t('smtp_pass')}</label>
                                                <input
                                                    id="smb_pass"
                                                    name="smb_pass"
                                                    type="password"
                                                    autoComplete="new-password"
                                                    className="w-full h-14 px-6 bg-white dark:bg-slate-800 border border-transparent focus:border-brand-dark rounded-lg font-bold outline-none shadow-sm font-mono text-sm text-slate-800 dark:text-slate-100"
                                                    value={storageConfig.smb_pass}
                                                    onChange={e => { setStorageConfig({ ...storageConfig, smb_pass: e.target.value }); setStorageTestResult(null); }}
                                                />
                                            </div>
                                        </form>
                                    )}

                                    {storageTestResult && (
                                        <div className={`p-4 rounded-lg flex items-center gap-3 ${storageTestResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                                            <i className={`text-xl ${storageTestResult.ok ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'}`}></i>
                                            <p className="font-bold text-sm">{storageTestResult.message}</p>
                                        </div>
                                    )}

                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={handleTestStorage}
                                            className="flex-1 py-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-white/10 text-slate-600 dark:text-slate-300 rounded-lg font-black hover:border-brand-dark transition-all flex items-center justify-center gap-2"
                                        >
                                            <i className="ri-wifi-line"></i>
                                            {t('test_connection_btn')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSaveStorage}
                                            disabled={isSavingStorage}
                                            className="flex-1 py-3 bg-brand-dark text-white rounded-lg font-black shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {isSavingStorage ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-save-line"></i>}
                                            {t('save_storage_btn')}
                                        </button>
                                    </div>
                                </div>
                            </section>

                            {/* Section: Roles Management */}
                            <section className="space-y-6">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">{t('manage_roles')}</h3>
                                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500">{t('roles_info')}</p>
                                </div>
                                <div className="flex gap-4">
                                    <input type="text" className="flex-1 h-12 px-6 bg-white dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-xl font-bold outline-none shadow-sm text-slate-800 dark:text-slate-100" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder={t('add_role_placeholder')} />
                                    <button onClick={handleAddRole} className="px-6 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-black shadow-md hover:bg-slate-700 dark:hover:bg-slate-600 transition-all">{t('save')}</button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {roles.map(role => (
                                        <div key={role.id} className="flex items-center gap-2 bg-white dark:bg-slate-800 px-4 py-2 rounded-xl border border-black/[0.06] dark:border-white/10 shadow-sm transition-all hover:border-brand-dark">
                                            <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">{role.name}</span>
                                            <button onClick={() => handleDeleteRole(role.id)} className="text-slate-300 hover:text-red-500 transition-colors ml-2"><i className="ri-close-circle-fill"></i></button>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* Section: Members Management */}
                            <section className="space-y-6 pb-12">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-1">{t('manage_members')}</h3>
                                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500">{t('members_admin_info')}</p>
                                    </div>
                                    <button onClick={() => setIsAddMemberModalOpen(true)} className="p-3 bg-brand-dark text-white rounded-xl shadow-lg hover:scale-105 transition-all"><i className="ri-user-add-line text-lg"></i></button>
                                </div>
                                <div className="space-y-3">
                                    {members.map(m => (
                                        <div key={m.id} className="flex items-center justify-between bg-white dark:bg-slate-800 p-5 rounded-xl border border-black/[0.06] dark:border-white/10 shadow-sm group hover:shadow-md transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 flex items-center justify-center font-black text-lg uppercase group-hover:bg-brand-light group-hover:text-white transition-colors">{m.username.charAt(0)}</div>
                                                <div>
                                                    <div className="font-black text-slate-800 dark:text-slate-100">{m.username}</div>
                                                    <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{m.email}</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => { setEditingMember(m); setIsEditMemberModalOpen(true); }} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-brand-dark flex items-center justify-center transition-colors"><i className="ri-edit-line"></i></button>
                                                <button onClick={() => handleOpenPermissions(m)} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-brand-dark flex items-center justify-center transition-colors"><i className="ri-shield-keyhole-line"></i></button>
                                                {m.id !== user.id && (
                                                    <button
                                                        onClick={async () => {
                                                            if (confirm(t('settings_delete_member_confirm', { name: m.username }))) {
                                                                try { await api.delete(`/auth/family/members/${m.id}`); fetchMembers(); } catch (e) { alert(t('error')); }
                                                            }
                                                        }}
                                                        className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors"
                                                    ><i className="ri-delete-bin-line"></i></button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="space-y-6 pb-12">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">{t('system_maintenance')}</h3>
                                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500">{t('maintenance_info')}</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <button
                                        type="button"
                                        onClick={handleDownloadBackup}
                                        disabled={isBackingUp}
                                        className="flex items-center justify-center gap-3 p-6 bg-white dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-[1rem] shadow-sm hover:shadow-md transition-all group"
                                    >
                                        <div className="w-12 h-12 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                                            {isBackingUp ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-download-cloud-2-line"></i>}
                                        </div>
                                        <div className="text-left">
                                            <div className="font-black text-slate-800 dark:text-slate-100">{t('create_backup')}</div>
                                            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('backup_all_data')}</div>
                                        </div>
                                    </button>

                                    <label className="flex items-center justify-center gap-3 p-6 bg-white dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-[1rem] shadow-sm hover:shadow-md transition-all group cursor-pointer">
                                        <div className="w-12 h-12 rounded-lg bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                                            {isRestoring ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-upload-cloud-2-line"></i>}
                                        </div>
                                        <div className="text-left">
                                            <div className="font-black text-slate-800 dark:text-slate-100">{t('restore_backup')}</div>
                                            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('restore_data')}</div>
                                        </div>
                                        <input
                                            type="file"
                                            accept=".zip"
                                            className="hidden"
                                            onChange={handleRestoreBackup}
                                            disabled={isRestoring}
                                        />
                                    </label>

                                    <div className="flex items-center gap-3 p-6 bg-brand-light/5 dark:bg-brand-light/10 border border-brand-light/20 rounded-[1rem] lg:col-span-2">
                                        <div className="w-12 h-12 rounded-lg bg-brand-light/10 dark:bg-brand-light/20 text-brand-dark dark:text-brand-light flex items-center justify-center text-xl shrink-0">
                                            <i className="ri-ship-line"></i>
                                        </div>
                                        <div className="text-left">
                                            <div className="font-black text-slate-800 dark:text-slate-100">{t('apply_update')}</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                Updates werden über ein neues Docker-Image eingespielt: vorher ein Backup erstellen, dann <code className="font-mono">docker compose build &amp;&amp; docker compose up -d</code>. Deine Daten in <code className="font-mono">data/</code> und <code className="font-mono">uploads/</code> bleiben erhalten.
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setIsResetModalOpen(true)}
                                        className="flex items-center justify-center gap-3 p-6 bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-[1rem] shadow-sm hover:shadow-md transition-all group lg:col-span-2"
                                    >
                                        <div className="w-12 h-12 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                                            <i className="ri-error-warning-line"></i>
                                        </div>
                                        <div className="text-left">
                                            <div className="font-black text-red-600 dark:text-red-400">{t('factory_reset')}</div>
                                            <div className="text-[10px] font-bold text-red-400 dark:text-red-500 uppercase tracking-widest">{t('reset_system')}</div>
                                        </div>
                                    </button>
                                </div>
                            </section>
                        </div>
                    )}
                </div>
            </main>

             {/* MODALS */}
            {isAddMemberModalOpen && (
                <div className="fixed inset-0 bg-brand-dark/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-[3rem] shadow-2xl w-full max-w-md p-10 animate-in zoom-in-95 duration-300">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 flex items-center justify-center text-xl shadow-sm"><i className="ri-user-add-line"></i></div>
                            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{t('invite_member')}</h2>
                        </div>
                        <form onSubmit={handleAddMember} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">{t('username')}</label>
                                <input type="text" required className="w-full h-14 px-6 bg-slate-50 dark:bg-slate-900 border border-transparent dark:border-white/10 rounded-lg font-bold outline-none focus:border-brand-dark dark:text-slate-100" value={newMember.username} onChange={e => setNewMember({ ...newMember, username: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">{t('email')}</label>
                                <input type="email" required className="w-full h-14 px-6 bg-slate-50 dark:bg-slate-900 border border-transparent dark:border-white/10 rounded-lg font-bold outline-none focus:border-brand-dark dark:text-slate-100" value={newMember.email} onChange={e => setNewMember({ ...newMember, email: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">{t('initial_pass')}</label>
                                <input type="password" required className="w-full h-14 px-6 bg-slate-50 dark:bg-slate-900 border border-transparent dark:border-white/10 rounded-lg font-bold outline-none focus:border-brand-dark dark:text-slate-100" value={newMember.password} onChange={e => setNewMember({ ...newMember, password: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">{t('family_role_label')}</label>
                                <input type="text" className="w-full h-14 px-6 bg-slate-50 dark:bg-slate-900 border border-transparent dark:border-white/10 rounded-lg font-bold outline-none focus:border-brand-dark dark:text-slate-100" value={newMember.display_role} onChange={e => setNewMember({ ...newMember, display_role: e.target.value })} placeholder="Vater" />
                            </div>
                            <div className="flex gap-4 pt-6">
                                <button type="button" onClick={() => setIsAddMemberModalOpen(false)} className="flex-1 py-4 font-black text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">{t('cancel')}</button>
                                <button type="submit" className="flex-1 py-4 bg-brand-dark text-white rounded-lg font-black shadow-xl hover:scale-105 transition-all">{t('create')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isEditMemberModalOpen && editingMember && (
                <div className="fixed inset-0 bg-brand-dark/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-[3rem] shadow-2xl w-full max-w-md p-10 animate-in zoom-in-95 duration-300">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 flex items-center justify-center text-xl shadow-sm"><i className="ri-edit-line"></i></div>
                            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{t('edit_profile')}</h2>
                        </div>
                        <form onSubmit={handleSaveMemberEdit} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">{t('username')}</label>
                                <input type="text" required className="w-full h-14 px-6 bg-slate-50 dark:bg-slate-900 border border-transparent dark:border-white/10 rounded-lg font-bold outline-none focus:border-brand-dark dark:text-slate-100" value={editingMember.username} onChange={e => setEditingMember({ ...editingMember, username: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">{t('email')}</label>
                                <input type="email" required className="w-full h-14 px-6 bg-slate-50 dark:bg-slate-900 border border-transparent dark:border-white/10 rounded-lg font-bold outline-none focus:border-brand-dark dark:text-slate-100" value={editingMember.email} onChange={e => setEditingMember({ ...editingMember, email: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">{t('role_label_system')}</label>
                                <select className="w-full h-14 px-6 bg-slate-50 dark:bg-slate-900 border border-transparent dark:border-white/10 rounded-lg font-bold outline-none focus:border-brand-dark dark:text-slate-100 appearance-none" value={editingMember.role} onChange={e => setEditingMember({ ...editingMember, role: e.target.value })}>
                                    <option value="member">{t('member')}</option>
                                    <option value="admin">Administrator</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">{t('family_role_label')}</label>
                                <select
                                    className="w-full h-14 px-6 bg-slate-50 dark:bg-slate-900 border border-transparent dark:border-white/10 rounded-lg font-bold outline-none focus:border-brand-dark dark:text-slate-100 appearance-none"
                                    value={editingMember.display_role || ''}
                                    onChange={e => setEditingMember({ ...editingMember, display_role: e.target.value })}
                                >
                                    <option value="">{t('no_role')}</option>
                                    {roles.map(role => (
                                        <option key={role.id} value={role.name}>{role.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-4 pt-6">
                                <button type="button" onClick={() => setIsEditMemberModalOpen(false)} className="flex-1 py-4 font-black text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">{t('cancel')}</button>
                                <button type="submit" className="flex-1 py-4 bg-brand-dark text-white rounded-lg font-black shadow-xl hover:scale-105 transition-all">{t('save')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isPermissionsModalOpen && selectedUserForPerms && (
                <div className="fixed inset-0 bg-brand-dark/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-[3rem] shadow-2xl w-full max-w-xl p-10 animate-in zoom-in-95 duration-300">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-14 h-14 rounded-lg bg-brand-light/10 text-brand-dark flex items-center justify-center text-2xl shadow-sm">
                                <i className="ri-shield-user-fill"></i>
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight leading-none">{t('permissions')}</h1>
                                <p className="text-slate-400 dark:text-slate-500 font-bold mt-1 text-sm uppercase tracking-widest">{selectedUserForPerms.username}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-10 max-h-[50vh] overflow-y-auto px-1 custom-scrollbar">
                            {Object.keys(permissions).map(feature => (
                                <label key={feature} className={`group flex items-center justify-between p-4 rounded-lg cursor-pointer transition-all border ${permissions[feature] ? 'bg-brand-dark text-white border-brand-dark shadow-lg' : 'bg-slate-50 dark:bg-slate-900 border-transparent dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:border-slate-200 dark:hover:border-slate-700'}`}>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black uppercase tracking-widest opacity-60 leading-none">{t('feature')}</span>
                                        <span className="font-black mt-1 text-sm capitalize">{feature}</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="w-6 h-6 rounded-lg border border-white/20 bg-transparent text-brand-light focus:ring-0 checked:bg-brand-light transition-all"
                                        checked={permissions[feature]}
                                        onChange={(e) => setPermissions({ ...permissions, [feature]: e.target.checked })}
                                    />
                                </label>
                            ))}
                        </div>

                        <div className="flex gap-4 pt-4 border-t border-slate-50 dark:border-white/10">
                            <button onClick={() => setIsPermissionsModalOpen(false)} className="flex-1 py-4 font-black text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">{t('cancel')}</button>
                            <button onClick={handleSavePermissions} className="flex-1 py-4 bg-brand-dark text-white rounded-[1rem] font-black shadow-xl hover:scale-105 transition-all">{t('apply_perms')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 2FA Setup Modal */}
            {is2faModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{t('setup_2fa')}</h3>
                                <p className="text-brand-dark dark:text-brand-light font-bold uppercase tracking-widest text-[10px] mt-1">{t('increase_security')}</p>
                            </div>
                            <button onClick={() => setIs2faModalOpen(false)} className="w-12 h-12 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-all shadow-sm">
                                <i className="ri-close-line text-2xl"></i>
                            </button>
                        </div>

                        <div className="p-10 space-y-8">
                            <div className="space-y-4 text-center">
                                <p className="text-sm font-bold text-slate-600 dark:text-slate-300 leading-relaxed italic">
                                    {t('2fa_scan_info')}
                                </p>

                                <div className="flex flex-col items-center justify-center gap-6 py-4">
                                    {is2faLoading ? (
                                        <div className="w-48 h-48 bg-slate-50 dark:bg-slate-900 rounded-xl flex items-center justify-center border border-dashed border-slate-200 dark:border-white/10">
                                            <i className="ri-loader-4-line text-3xl text-brand-dark animate-spin"></i>
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-white dark:bg-slate-100 rounded-xl shadow-xl border border-black/[0.06] dark:border-white/10">
                                            <img src={twoFactorSetup.qrCodeUrl} alt="2FA QR Code" className="w-48 h-48" />
                                        </div>
                                    )}

                                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-black/[0.06] dark:border-white/10 w-full text-center">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">{t('manual_code')}</p>
                                        <div className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 tracking-widest break-all">
                                            {twoFactorSetup.secret}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-white/10">
                                <div className="space-y-2 text-center">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{t('confirmation_code')}</label>
                                    <input
                                        type="text"
                                        maxLength={6}
                                        className="w-full h-16 bg-slate-50 dark:bg-slate-900 border border-transparent focus:border-brand-dark rounded-lg font-black text-center text-3xl tracking-[0.4em] outline-none transition-all shadow-inner dark:text-slate-100"
                                        placeholder="123456"
                                        value={twoFactorSetup.code}
                                        onChange={(e) => setTwoFactorSetup({ ...twoFactorSetup, code: e.target.value })}
                                    />
                                </div>
                                <button
                                    onClick={verifyAndEnable2fa}
                                    disabled={is2faLoading || twoFactorSetup.code.length !== 6}
                                    className="w-full py-5 bg-brand-dark text-white rounded-[1rem] font-black shadow-xl transition-all disabled:opacity-50 disabled:scale-100"
                                >
                                    {is2faLoading ? t('verifying') : t('enable_2fa_btn')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Reset Modal */}
            {isResetModalOpen && (
                <div className="fixed inset-0 bg-red-900/40 backdrop-blur-md z-[300] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-[3rem] shadow-2xl w-full max-w-md p-10 animate-in zoom-in-95 duration-300">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-14 h-14 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center text-2xl shadow-sm">
                                <i className="ri-alarm-warning-fill"></i>
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{t('factory_reset')}</h2>
                                <p className="text-red-500 font-bold uppercase tracking-widest text-[10px] mt-1">{t('danger_zone')}</p>
                            </div>
                        </div>

                        <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-xl mb-8 border border-red-100 dark:border-red-900/30">
                            <p className="text-sm text-red-800 dark:text-red-400 leading-relaxed font-bold">
                                {t('reset_warning')}
                            </p>
                        </div>

                        <form onSubmit={handleReset} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">{t('confirm_admin_pass')}</label>
                                <input
                                    type="password"
                                    required
                                    className="w-full h-14 px-6 bg-slate-50 dark:bg-slate-900 border border-transparent focus:border-red-500 rounded-lg font-bold outline-none transition-all dark:text-slate-100"
                                    value={resetPassword}
                                    onChange={e => setResetPassword(e.target.value)}
                                    placeholder={t('your_password')}
                                />
                            </div>

                            <div className="flex flex-col gap-3">
                                <button
                                    type="submit"
                                    disabled={isResetting || !resetPassword}
                                    className="w-full py-5 bg-red-600 text-white rounded-lg font-black shadow-xl hover:bg-red-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    {isResetting ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-delete-bin-2-line"></i>}
                                    {t('reset_now_btn')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setIsResetModalOpen(false); setResetPassword(''); }}
                                    className="w-full py-4 text-slate-400 dark:text-slate-500 font-bold hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                >
                                    {t('cancel')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Countdown Overlay */}
            {showCountdownOverlay && (
                <div className="fixed inset-0 z-[500] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-[3rem] shadow-2xl w-full max-w-lg p-12 text-center animate-in zoom-in duration-500">
                        <div className="relative w-40 h-40 mx-auto mb-10">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle
                                    cx="80"
                                    cy="80"
                                    r="76"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    fill="transparent"
                                    className="text-slate-100 dark:text-slate-700"
                                />
                                <circle
                                    cx="80"
                                    cy="80"
                                    r="76"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    fill="transparent"
                                    strokeDasharray={477}
                                    strokeDashoffset={477 - (477 * countdown) / 30}
                                    className="text-brand-dark dark:text-brand-light transition-all duration-1000 ease-linear"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-5xl font-black text-slate-800 dark:text-slate-100">{countdown}</span>
                            </div>
                        </div>

                        <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 mb-4">
                            {countdownType === 'reset' ? t('resetting_system') : countdownType === 'update' ? t('completing_update') : t('applying_backup')}
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-10 leading-relaxed font-bold">
                            {countdownType === 'reset'
                                ? t('reset_wait_info')
                                : countdownType === 'update'
                                    ? t('update_restart_info')
                                    : t('backup_logout_info')}
                        </p>

                        <div className="bg-slate-50 dark:bg-slate-900 p-5 rounded-[1rem] flex items-center justify-center gap-4 text-brand-dark dark:text-brand-light font-black shadow-inner">
                            <div className="w-3 h-3 bg-brand-dark dark:bg-brand-light rounded-full animate-pulse"></div>
                            {countdownType === 'reset' ? `${t('auto_refresh')} ${countdown}s` : countdownType === 'update' ? `${t('system_restart')} ${countdown}s` : `${t('auto_logout')} ${countdown}s`}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
