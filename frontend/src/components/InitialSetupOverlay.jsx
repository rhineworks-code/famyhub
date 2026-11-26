import React from 'react';
import api from '../services/api';
import { useTranslation } from '../i18n.jsx';

const InitialSetupOverlay = ({ onComplete }) => {
    const { t } = useTranslation();
    const [step, setStep] = React.useState(1); // 1: Welcome, 2: Account, 3: Family, 4: Finish/Backup, 5: Restarting
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [error, setError] = React.useState('');
    const [status, setStatus] = React.useState('');
    const [countdown, setCountdown] = React.useState(30);

    // Form states
    const [formData, setFormData] = React.useState({
        username: '',
        email: '',
        password: '',
        familyName: ''
    });
    const [file, setFile] = React.useState(null);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSetup = async (e) => {
        if (e) e.preventDefault();
        setIsProcessing(true);
        setError('');
        setStatus(t('setup_processing') || 'System wird konfiguriert...');

        try {
            const response = await api.post('/system/setup-initial', formData);
            // Setup complete, auto-login
            onComplete(response.data.token, response.data.user);
        } catch (err) {
            setError(err.response?.data?.error || t('setup_failed'));
            setIsProcessing(false);
        }
    };

    const handleImport = async (e) => {
        e.preventDefault();
        if (!file) return;

        setIsProcessing(true);
        setError('');
        setStatus(t('setup_importing') || 'Backup wird hochgeladen...');

        const uploadData = new FormData();
        uploadData.append('backup', file);

        try {
            const response = await api.post('/system/import-initial', uploadData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setStatus(response.data.message);
            setIsProcessing(false);
            setStep(5); // Switch to countdown step

            const timer = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        window.location.reload();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

        } catch (err) {
            setError(err.response?.data?.error || t('import_error'));
            setIsProcessing(false);
        }
    };

    const renderStep = () => {
        switch (step) {
            case 1: // Selection
                return (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="w-20 h-20 bg-brand-light/10 text-brand-light rounded-xl flex items-center justify-center mx-auto mb-8">
                            <i className="ri-rocket-2-line text-4xl"></i>
                        </div>
                        <h2 className="text-3xl font-black text-slate-800 mb-4">{t('setup_welcome_title')}</h2>
                        <p className="text-slate-500 mb-10 leading-relaxed max-w-sm mx-auto">
                            {t('setup_welcome_subtitle')}
                        </p>
                        <div className="space-y-4">
                            <button
                                onClick={() => setStep(2)}
                                className="w-full py-5 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 active:scale-95 transition-all flex items-center justify-center gap-3 shadow-xl"
                            >
                                <i className="ri-add-circle-line text-xl"></i>
                                {t('setup_new_instance')}
                            </button>
                            <button
                                onClick={() => setStep(4)}
                                className="w-full py-5 bg-white text-slate-600 font-bold rounded-lg border border-slate-100 hover:border-brand-light hover:text-brand-light hover:bg-brand-light/5 transition-all flex items-center justify-center gap-3"
                            >
                                <i className="ri-history-line text-xl"></i>
                                {t('setup_restore_backup')}
                            </button>
                        </div>
                    </div>
                );

            case 2: // Admin Account
                return (
                    <form onSubmit={(e) => { e.preventDefault(); setStep(3); }} className="animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="flex items-center gap-4 mb-8">
                            <button type="button" onClick={() => setStep(1)} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:text-slate-600 flex items-center justify-center">
                                <i className="ri-arrow-left-s-line text-2xl"></i>
                            </button>
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="w-1/2 h-full bg-brand-light rounded-full"></div>
                            </div>
                            <span className="text-xs font-black text-slate-400">{t('setup_step_label', { current: 1, total: 2 })}</span>
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2">{t('setup_admin_account')}</h3>
                        <p className="text-slate-500 mb-8 text-sm">{t('setup_admin_subtitle')}</p>

                        <div className="space-y-4 text-left">
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">{t('setup_username_label')}</label>
                                <input
                                    type="text"
                                    name="username"
                                    required
                                    className="w-full px-5 py-4 bg-slate-50 border border-transparent focus:border-brand-light focus:bg-white rounded-lg outline-none transition-all font-medium"
                                    placeholder={t('username_placeholder')}
                                    value={formData.username}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">{t('setup_email_label')}</label>
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    className="w-full px-5 py-4 bg-slate-50 border border-transparent focus:border-brand-light focus:bg-white rounded-lg outline-none transition-all font-medium"
                                    placeholder={t('email_placeholder')}
                                    value={formData.email}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">{t('setup_password_label')}</label>
                                <input
                                    type="password"
                                    name="password"
                                    required
                                    minLength={8}
                                    className="w-full px-5 py-4 bg-slate-50 border border-transparent focus:border-brand-light focus:bg-white rounded-lg outline-none transition-all font-medium"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="w-full py-5 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 transition-all mt-8 flex items-center justify-center gap-3"
                        >
                            {t('setup_next_family')}
                            <i className="ri-arrow-right-s-line text-xl"></i>
                        </button>
                    </form>
                );

            case 3: // Family Details
                return (
                    <form onSubmit={handleSetup} className="animate-in fade-in slide-in-from-right-4 duration-500 text-center">
                        <div className="flex items-center gap-4 mb-8 text-left">
                            <button type="button" onClick={() => setStep(2)} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:text-slate-600 flex items-center justify-center">
                                <i className="ri-arrow-left-s-line text-2xl"></i>
                            </button>
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="w-full h-full bg-brand-light rounded-full"></div>
                            </div>
                            <span className="text-xs font-black text-slate-400">{t('setup_step_label', { current: 2, total: 2 })}</span>
                        </div>
                        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <i className="ri-heart-3-line text-4xl"></i>
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2">{t('setup_family_title')}</h3>
                        <p className="text-slate-500 mb-8 text-sm">{t('setup_family_subtitle')}</p>

                        <div className="text-left mb-8">
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">{t('family_name_label')}</label>
                            <input
                                type="text"
                                name="familyName"
                                required
                                autoFocus
                                className="w-full px-5 py-4 bg-slate-50 border border-transparent focus:border-brand-light focus:bg-white rounded-lg outline-none transition-all font-black text-center text-2xl"
                                placeholder={t('family_name_placeholder')}
                                value={formData.familyName}
                                onChange={handleInputChange}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isProcessing}
                            className="w-full py-5 bg-brand-light text-white font-black rounded-lg hover:bg-brand-dark transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50"
                        >
                            {isProcessing ? (
                                <>
                                    <div className="w-5 h-5 border border-white border-t-transparent rounded-full animate-spin"></div>
                                    {t('setup_processing')}
                                </>
                            ) : (
                                <>
                                    <i className="ri-check-double-line text-xl"></i>
                                    {t('setup_finish_btn')}
                                </>
                            )}
                        </button>
                    </form>
                );

            case 4: // Backup Import Form
                return (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="flex items-center gap-4 mb-8">
                            <button type="button" onClick={() => setStep(1)} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:text-slate-600 flex items-center justify-center">
                                <i className="ri-arrow-left-s-line text-2xl"></i>
                            </button>
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="w-full h-full bg-brand-light rounded-full"></div>
                            </div>
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('setup_restore_backup')}</span>
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2">{t('setup_backup_title')}</h3>
                        <p className="text-slate-500 mb-8 text-sm">{t('setup_backup_subtitle')}</p>

                        <form onSubmit={handleImport} className="space-y-6">
                            <div className="relative group">
                                <input
                                    type="file"
                                    accept=".zip"
                                    onChange={(e) => setFile(e.target.files[0])}
                                    className="hidden"
                                    id="backup-upload"
                                />
                                <label
                                    htmlFor="backup-upload"
                                    className="flex flex-col items-center justify-center w-full h-48 border border-dashed border-slate-200 rounded-[1rem] bg-slate-50 hover:bg-white hover:border-brand-light transition-all cursor-pointer group-hover:shadow-lg"
                                >
                                    <div className="w-16 h-16 bg-white rounded-lg shadow-sm flex items-center justify-center text-3xl text-brand-light mb-4 group-hover:scale-110 transition-transform">
                                        <i className="ri-upload-cloud-2-line"></i>
                                    </div>
                                    <span className="text-sm font-black text-slate-800">
                                        {file ? file.name : t('setup_backup_select')}
                                    </span>
                                    {!file && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">{t('setup_backup_browse')}</span>}
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={!file || isProcessing}
                                className="w-full py-5 bg-slate-800 text-white font-black rounded-lg hover:bg-slate-900 transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50"
                            >
                                {isProcessing ? (
                                    <>
                                        <div className="w-5 h-5 border border-white border-t-transparent rounded-full animate-spin"></div>
                                        {t('setup_importing')}
                                    </>
                                ) : (
                                    <>
                                        <i className="ri-history-line text-xl"></i>
                                        {t('setup_import_start')}
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                );

            case 5: // Restart Countdown
                return (
                    <div className="animate-in fade-in zoom-in duration-500 text-center">
                        <div className="relative w-32 h-32 mx-auto mb-8">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle
                                    cx="64"
                                    cy="64"
                                    r="60"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    fill="transparent"
                                    className="text-slate-100"
                                />
                                <circle
                                    cx="64"
                                    cy="64"
                                    r="60"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    fill="transparent"
                                    strokeDasharray={377}
                                    strokeDashoffset={377 - (377 * countdown) / 30}
                                    className="text-brand-light transition-all duration-1000 ease-linear"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-4xl font-black text-slate-800">{countdown}</span>
                            </div>
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2">{t('setup_restarting_title')}</h3>
                        <p className="text-slate-500 mb-8 text-sm leading-relaxed">
                            {t('setup_restarting_subtitle')}
                        </p>
                        <div className="bg-slate-50 p-4 rounded-lg flex items-center justify-center gap-3 text-slate-400 font-bold">
                            <div className="w-2 h-2 bg-brand-light rounded-full animate-pulse"></div>
                            {t('setup_auto_refresh', { count: countdown })}
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{
            backgroundImage: 'url("/setup-bg.png")',
            backgroundRepeat: 'repeat',
            backgroundSize: '400px',
            backgroundColor: '#ffffff'
        }}>
            <div className="bg-white/95 rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden relative backdrop-blur-md border border-black/[0.06]/20">
                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-light/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-brand-light/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>

                <div className="p-8 md:p-12">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 text-sm font-bold flex items-center gap-3 animate-shake">
                            <i className="ri-error-warning-line text-lg"></i>
                            {error}
                        </div>
                    )}
                    {status && !error && (
                        <div className="bg-brand-light/10 text-brand-light p-4 rounded-lg mb-6 text-sm font-black flex items-center gap-3">
                            <div className="w-4 h-4 border border-brand-light border-t-transparent rounded-full animate-spin"></div>
                            {status}
                        </div>
                    )}

                    {renderStep()}
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }
                .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
            `}} />
        </div>
    );
};

export default InitialSetupOverlay;
