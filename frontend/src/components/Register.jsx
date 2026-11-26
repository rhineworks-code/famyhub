import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api, { setToken } from '../services/api';
import { useTranslation } from '../i18n.jsx';

const Register = ({ setUser }) => {
    const { t } = useTranslation();
    const [name, setName] = React.useState('');
    const [familyName, setFamilyName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [error, setError] = React.useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await api.post('/auth/register', {
                name,
                email,
                password,
                family_name: familyName
            });
            const { token, user } = response.data;
            setToken(token);
            setUser(user);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.error || t('registration_failed'));
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-black/[0.06] p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">{t('register_title')}</h2>
                {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('name')}</label>
                        <input
                            type="text"
                            required
                            className="w-full px-4 py-2 rounded-xl border border-black/[0.06] focus:ring-2 focus:ring-brand-dark outline-none"
                            value={name}
                            placeholder="z.B. Alex"
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('family_name_label')}</label>
                        <input
                            type="text"
                            required
                            className="w-full px-4 py-2 rounded-xl border border-black/[0.06] focus:ring-2 focus:ring-brand-dark outline-none"
                            value={familyName}
                            placeholder={t('family_name_placeholder')}
                            onChange={(e) => setFamilyName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('email')}</label>
                        <input
                            type="email"
                            required
                            className="w-full px-4 py-2 rounded-xl border border-black/[0.06] focus:ring-2 focus:ring-brand-dark outline-none"
                            value={email}
                            placeholder="familie@beispiel.de"
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('password')}</label>
                        <input
                            type="password"
                            required
                            className="w-full px-4 py-2 rounded-xl border border-black/[0.06] focus:ring-2 focus:ring-brand-dark outline-none"
                            value={password}
                            placeholder="••••••••"
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full py-3 bg-brand-dark text-white rounded-xl font-medium hover:bg-slate-800 transition"
                    >
                        {t('register_btn')}
                    </button>
                </form>
                <p className="mt-6 text-center text-sm text-gray-600">
                    {t('login_link').split(' ')[0]} {t('login_link').split(' ').slice(1).join(' ')} <Link to="/login" className="text-brand-dark font-medium">{t('login_title')}</Link>
                </p>
            </div>
        </div>
    );
};

export default Register;
