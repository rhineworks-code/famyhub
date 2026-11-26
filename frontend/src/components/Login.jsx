import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api, { setToken } from '../services/api';
import { useTranslation } from '../i18n.jsx';
import InitialSetupOverlay from './InitialSetupOverlay';

const Login = ({ setUser }) => {
    const { t } = useTranslation();
    const [identifier, setIdentifier] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [error, setError] = React.useState('');
    const [success, setSuccess] = React.useState('');
    const [isInitialized, setIsInitialized] = React.useState(true);
    const [showOverlay, setShowOverlay] = React.useState(false);
    const [rememberMe, setRememberMe] = React.useState(false);

    // 2FA state
    const [twoFactorRequired, setTwoFactorRequired] = React.useState(false);
    const [twoFactorCode, setTwoFactorCode] = React.useState('');
    const [is2faLoading, setIs2faLoading] = React.useState(false);
    const [tempToken, setTempToken] = React.useState('');

    // Forgot password state
    const [isForgotModalOpen, setIsForgotModalOpen] = React.useState(false);
    const [forgotStep, setForgotStep] = React.useState(1);
    const [resetEmail, setResetEmail] = React.useState('');
    const [resetCode, setResetCode] = React.useState('');
    const [newPassword, setNewPassword] = React.useState('');

    const navigate = useNavigate();

    React.useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        try {
            const res = await api.get('/auth/status');
            setIsInitialized(res.data.initialized);
            if (!res.data.initialized) {
                setShowOverlay(true);
            }
        } catch (err) {
            console.error("Status check failed", err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const response = await api.post('/auth/login', { email: identifier, password, rememberMe });

            if (response.data.twoFactorRequired) {
                setTwoFactorRequired(true);
                setTempToken(response.data.tempToken);
                return;
            }

            const { token, user } = response.data;
            completeLogin(token, user);
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed');
        }
    };

    const handle2faSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIs2faLoading(true);
        try {
            const response = await api.post('/auth/login/2fa', {
                code: twoFactorCode,
                tempToken,
                rememberMe
            });
            const { token, user } = response.data;
            completeLogin(token, user);
        } catch (err) {
            setError(err.response?.data?.error || 'Ungültiger 2FA-Code');
        } finally {
            setIs2faLoading(false);
        }
    };

    const completeLogin = (token, user) => {
        setToken(token);
        setUser(user);

        if (!user.family_id) {
            navigate('/onboarding');
        } else {
            navigate('/');
        }
    };

    const handleForgotRequest = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        try {
            const res = await api.post('/auth/password/forgot', { email: resetEmail });
            setSuccess(res.data.message);
            setForgotStep(2);
        } catch (err) {
            setError(err.response?.data?.error || t('email_send_failed'));
        }
    };

    const handleForgotReset = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        try {
            const res = await api.post('/auth/password/reset', { email: resetEmail, code: resetCode, newPassword });
            setSuccess(res.data.message);
            setTimeout(() => {
                setIsForgotModalOpen(false);
                setForgotStep(1);
                setResetEmail('');
                setResetCode('');
                setNewPassword('');
                setSuccess('');
            }, 3000);
        } catch (err) {
            setError(err.response?.data?.error || t('reset_failed'));
        }
    };

    if (!isInitialized) {
        return (
            <InitialSetupOverlay
                onComplete={(token, user) => {
                    if (token && user) {
                        completeLogin(token, user);
                    }
                }}
            />
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-black/[0.06] p-8">
                <div className="flex flex-col items-center mb-8">
                    <img src="/logo.png" alt="FamyHub" className="w-48 h-48 object-contain mb-2" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">
                    {twoFactorRequired ? 'Zwei-Faktor-Authentifizierung' : t('login_subtitle')}
                </h2>
                {error && !isForgotModalOpen && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}
                {success && !isForgotModalOpen && <div className="bg-emerald-50 text-emerald-600 p-3 rounded-lg mb-4 text-sm">{success}</div>}

                {!twoFactorRequired ? (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('email_or_username')}</label>
                            <input
                                type="text"
                                required
                                className="w-full px-4 py-2 rounded-xl border border-black/[0.06] focus:ring-2 focus:ring-brand-light outline-none"
                                value={identifier}
                                placeholder="Email oder Name (z.B. Alex)"
                                onChange={(e) => setIdentifier(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('password')}</label>
                            <input
                                type="password"
                                required
                                className="w-full px-4 py-2 rounded-xl border border-black/[0.06] focus:ring-2 focus:ring-brand-dark outline-none"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <label className="flex items-center space-x-2 cursor-pointer group">
                                <div className="relative flex items-center">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                    />
                                    <div className="w-5 h-5 border border-gray-200 rounded-md peer-checked:bg-brand-dark peer-checked:border-brand-dark transition-all duration-200 flex items-center justify-center">
                                        <i className={`ri-check-line text-white text-xs transition-opacity duration-200 ${rememberMe ? 'opacity-100' : 'opacity-0'}`}></i>
                                    </div>
                                </div>
                                <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900 transition-colors">Angemeldet bleiben</span>
                            </label>
                            
                            <button type="button" onClick={() => { setIsForgotModalOpen(true); setError(''); setSuccess(''); }} className="text-sm font-bold text-brand-light hover:text-brand-dark transition">
                                {t('forgot_password')}
                            </button>
                        </div>

                        <button
                            type="submit"
                            className="w-full py-3 bg-brand-dark text-white rounded-xl font-medium hover:bg-slate-800 transition"
                        >
                            Anmelden
                        </button>
                        <p className="mt-6 text-center text-sm text-gray-600">
                            Noch kein Konto? <Link to="/register" className="text-brand-light font-medium">Registrieren</Link>
                        </p>
                    </form>
                ) : (
                    <form onSubmit={handle2faSubmit} className="space-y-6">
                        <div className="text-center">
                            <p className="text-sm text-gray-500 mb-6 italic">
                                Bitte gib den 6-stelligen Code aus deiner Authenticator-App ein.
                            </p>
                            <input
                                type="text"
                                required
                                maxLength={6}
                                autoFocus
                                className="w-full h-16 bg-gray-50 border border-transparent focus:border-brand-dark rounded-lg font-black text-center text-3xl tracking-[0.4em] outline-none transition-all"
                                placeholder="123456"
                                value={twoFactorCode}
                                onChange={(e) => setTwoFactorCode(e.target.value)}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={is2faLoading || twoFactorCode.length !== 6}
                            className="w-full py-4 bg-brand-dark text-white rounded-xl font-bold shadow-lg hover:bg-slate-800 transition disabled:opacity-50"
                        >
                            {is2faLoading ? 'Verifiziere...' : 'Bestätigen & Einloggen'}
                        </button>

                        <button
                            type="button"
                            onClick={() => { setTwoFactorRequired(false); setTwoFactorCode(''); }}
                            className="w-full py-2 text-sm text-gray-400 font-bold hover:text-gray-600 transition"
                        >
                            Zurück zum Login
                        </button>
                    </form>
                )}
            </div>

            {/* Forgot Password Modal */}
            {isForgotModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[1.25rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-xl font-black text-slate-800">{t('reset_password')}</h2>
                            <button onClick={() => {
                                setIsForgotModalOpen(false);
                                setForgotStep(1);
                                setError('');
                                setSuccess('');
                            }} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                                <i className="ri-close-line text-2xl"></i>
                            </button>
                        </div>
                        <div className="p-6">
                            {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm font-medium">{error}</div>}
                            {success && <div className="bg-emerald-50 text-emerald-600 p-3 rounded-lg mb-4 text-sm font-medium">{success}</div>}

                            {forgotStep === 1 ? (
                                <form onSubmit={handleForgotRequest} className="space-y-4">
                                    <p className="text-sm text-slate-600 mb-4">{t('email_info')} Wenn sie unserer Familie bekannt ist, senden wir dir einen 6-stelligen Code zu.</p>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">{t('email')}</label>
                                        <input type="email" required className="w-full px-4 py-3 bg-slate-50 border border-black/[0.06] rounded-xl outline-none"
                                            value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="deine@email.de" />
                                    </div>
                                    <button type="submit" className="w-full py-4 bg-slate-800 text-white font-bold rounded-xl shadow-md hover:bg-slate-900 transition mt-4">
                                        Code anfordern
                                    </button>
                                </form>
                            ) : (
                                <form onSubmit={handleForgotReset} className="space-y-4">
                                    <p className="text-sm text-slate-600 mb-4">Wir haben dir einen Code an <b>{resetEmail}</b> geschickt. Bitte gib diesen hier ein.</p>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">6-stelliger Code</label>
                                        <input type="text" required maxLength={6} className="w-full px-4 py-3 bg-slate-50 border border-black/[0.06] rounded-xl outline-none font-mono tracking-widest text-center text-lg"
                                            value={resetCode} onChange={e => setResetCode(e.target.value)} placeholder="123456" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">{t('new_password')}</label>
                                        <input type="password" required className="w-full px-4 py-3 bg-slate-50 border border-black/[0.06] rounded-xl outline-none"
                                            value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="********" />
                                    </div>
                                    <button type="submit" className="w-full py-4 bg-emerald-600 text-white font-bold rounded-xl shadow-md hover:bg-emerald-700 transition mt-4">
                                        Passwort speichern
                                    </button>
                                    <button type="button" onClick={() => setForgotStep(1)} className="w-full py-3 text-slate-500 font-bold hover:text-slate-700 transition mt-2">
                                        Zurück zur Eingabe
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Login;
