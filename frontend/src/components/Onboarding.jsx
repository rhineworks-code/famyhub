import React from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useTranslation } from '../i18n.jsx';

const Onboarding = ({ setUser }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [mode, setMode] = React.useState('create'); // 'create' or 'join'
    const [familyName, setFamilyName] = React.useState('');
    const [inviteCode, setInviteCode] = React.useState('');
    const [loading, setLoading] = React.useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            let response;
            if (mode === 'create') {
                response = await api.post('/auth/family/create', { name: familyName });
                alert(t('create_success'));
            } else {
                response = await api.post('/auth/family/join', { inviteCode });
                alert(t('join_success'));
            }

            // Fetch me again to get the updated family_id and refresh user state
            const userRes = await api.get('/auth/me');
            setUser(userRes.data);
            navigate('/');
        } catch (err) {
            console.error('Onboarding error:', err);
            alert(err.response?.data?.error || t('onboarding_error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-xl overflow-hidden p-8">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-black text-slate-800 dark:text-white mb-2">{t('onboarding_title')}</h1>
                    <p className="text-slate-500 dark:text-slate-400">{t('onboarding_subtitle')}</p>
                </div>

                <div className="flex bg-slate-100 dark:bg-slate-700/50 p-1 rounded-2xl mb-8">
                    <button
                        onClick={() => setMode('create')}
                        className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all ${
                            mode === 'create'
                                ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                    >
                        {t('create_family')}
                    </button>
                    <button
                        onClick={() => setMode('join')}
                        className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all ${
                            mode === 'join'
                                ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                    >
                        {t('join_family')}
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {mode === 'create' ? (
                        <div>
                            <label className="block text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
                                {t('family_name_label')}
                            </label>
                            <input
                                type="text"
                                value={familyName}
                                onChange={(e) => setFamilyName(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-white/10 rounded-2xl px-5 py-4 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-blue/50 transition-all font-medium"
                                placeholder="z.B. Familie Schmidt"
                                required
                            />
                        </div>
                    ) : (
                        <div>
                            <label className="block text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
                                {t('invite_code_label')}
                            </label>
                            <input
                                type="text"
                                value={inviteCode}
                                onChange={(e) => setInviteCode(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-white/10 rounded-2xl px-5 py-4 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-blue/50 transition-all font-medium"
                                placeholder={t('invite_code_placeholder')}
                                required
                            />
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-brand-blue hover:bg-brand-blue-dark text-white rounded-2xl font-black text-lg shadow-lg shadow-brand-blue/20 transition-all transform active:scale-95 disabled:opacity-50"
                    >
                        {loading ? t('processing') : (mode === 'create' ? t('start_btn') : t('join_btn'))}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Onboarding;
