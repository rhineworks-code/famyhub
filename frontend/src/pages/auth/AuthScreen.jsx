import React from 'react';
import api, { errorText } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Button, Field, Segmented, Spinner, Toggle, useFeedback } from '../../ui';

const Shell = ({ title, subtitle, children, footer }) => (
    <div className="safe-top flex min-h-dvh flex-col items-center justify-center bg-bg px-5 py-10">
        <div className="w-full max-w-[400px]">
            <div className="mb-7 flex flex-col items-center text-center">
                <img src="/icon-192x192.png" alt="" className="mb-4 h-[76px] w-[76px] rounded-[20px] shadow-pop" />
                <h1 className="text-title1 font-bold">{title}</h1>
                {subtitle && <p className="mt-1 text-sub text-label2">{subtitle}</p>}
            </div>
            <div className="rounded-sheet bg-card p-5 shadow-soft">{children}</div>
            {footer && <div className="mt-5 space-y-2 text-center text-sub">{footer}</div>}
        </div>
    </div>
);

const Link = ({ onClick, children }) => <button type="button" onClick={onClick} className="press text-accent">{children}</button>;

const ErrorLine = ({ error }) => (error ? <p role="alert" className="rounded-cell bg-danger/10 px-3 py-2.5 text-footnote font-medium text-danger">{error}</p> : null);

export default function AuthScreen() {
    const { signIn } = useAuth();
    const { toast } = useFeedback();
    const [status, setStatus] = React.useState(null);
    const [mode, setMode] = React.useState('login');
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState('');
    const [form, setForm] = React.useState({ identifier: '', password: '', rememberMe: true, code: '', email: '', username: '', invite: '', familyName: '', password2: '' });
    const [tempToken, setTempToken] = React.useState(null);
    const set = (k) => (e) => setForm(f => ({ ...f, [k]: e?.target ? e.target.value : e }));

    React.useEffect(() => {
        api.get('/auth/status').then(r => {
            setStatus(r.data);
            if (!r.data.initialized) setMode('setup');
        }).catch(() => setStatus({ initialized: true, registrationOpen: false }));
        const invite = new URLSearchParams(window.location.search).get('invite');
        if (invite) { setForm(f => ({ ...f, invite })); setMode('register'); }
    }, []);

    const go = (m) => { setError(''); setMode(m); };

    const run = async (fn) => {
        setBusy(true); setError('');
        try { await fn(); } catch (err) { setError(errorText(err)); } finally { setBusy(false); }
    };

    const login = () => run(async () => {
        const { data } = await api.post('/auth/login', { username: form.identifier.trim(), password: form.password, rememberMe: form.rememberMe });
        if (data.twoFactorRequired) { setTempToken(data.tempToken); setForm(f => ({ ...f, code: '' })); go('2fa'); return; }
        signIn(data);
    });

    const verify2fa = () => run(async () => {
        const { data } = await api.post('/auth/login/2fa', { tempToken, code: form.code, rememberMe: form.rememberMe });
        signIn(data);
    });

    const forgot = () => run(async () => {
        const { data } = await api.post('/auth/password/forgot', { email: form.email.trim() });
        toast(data.message);
        go('reset');
    });

    const reset = () => run(async () => {
        if (form.password !== form.password2) throw { message: 'Die Passwörter stimmen nicht überein.' };
        const { data } = await api.post('/auth/password/reset', { email: form.email.trim(), code: form.code.trim(), newPassword: form.password });
        toast(data.message);
        setForm(f => ({ ...f, identifier: f.email, password: '', password2: '', code: '' }));
        go('login');
    });

    const register = () => run(async () => {
        if (form.password !== form.password2) throw { message: 'Die Passwörter stimmen nicht überein.' };
        const { data } = await api.post('/auth/register', { username: form.username.trim(), email: form.email.trim(), password: form.password, invite_code: form.invite.trim() || undefined, family_name: form.familyName.trim() || undefined });
        signIn(data);
    });

    const setup = () => run(async () => {
        if (form.password !== form.password2) throw { message: 'Die Passwörter stimmen nicht überein.' };
        const { data } = await api.post('/system/setup-initial', { username: form.username.trim(), email: form.email.trim(), password: form.password, familyName: form.familyName.trim() });
        signIn(data);
    });

    const importBackup = (file) => run(async () => {
        const fd = new FormData();
        fd.append('backup', file);
        const { data } = await api.post('/system/import-initial', fd, { timeout: 0 });
        toast(data.message);
        setStatus(s => ({ ...s, initialized: true }));
        go('login');
    });

    const submit = (fn) => (e) => { e.preventDefault(); if (!busy) fn(); };

    if (!status) return <div className="flex min-h-dvh items-center justify-center bg-bg text-label3"><Spinner /></div>;

    const pw = (key = 'password', label = 'Passwort', auto = 'current-password') => (
        <Field label={label} type="password" autoComplete={auto} value={form[key]} onChange={set(key)} required minLength={key === 'password' && auto === 'current-password' ? undefined : 6} />
    );

    if (mode === '2fa') {
        return (
            <Shell title="Bestätigung" subtitle="Gib den 6-stelligen Code aus deiner Authenticator-App ein.">
                <form onSubmit={submit(verify2fa)} className="space-y-4">
                    <input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={form.code} onChange={set('code')} aria-label="Code"
                        className="field text-center text-title1 font-semibold tracking-[0.4em]" placeholder="••••••" />
                    <ErrorLine error={error} />
                    <Button type="submit" size="lg" full loading={busy} disabled={form.code.replace(/\s/g, '').length < 6}>Bestätigen</Button>
                </form>
                <div className="mt-4 text-center text-sub"><Link onClick={() => go('login')}>Zurück zur Anmeldung</Link></div>
            </Shell>
        );
    }

    if (mode === 'forgot' || mode === 'reset') {
        return (
            <Shell title="Passwort vergessen" subtitle={mode === 'forgot' ? 'Wir schicken dir einen Code an deine E-Mail-Adresse.' : 'Gib den Code aus der E-Mail und dein neues Passwort ein.'}
                footer={<Link onClick={() => go('login')}>Zurück zur Anmeldung</Link>}>
                {mode === 'forgot' ? (
                    <form onSubmit={submit(forgot)} className="space-y-4">
                        <Field label="E-Mail" type="email" autoComplete="email" value={form.email} onChange={set('email')} required />
                        <ErrorLine error={error} />
                        <Button type="submit" size="lg" full loading={busy}>Code senden</Button>
                        <button type="button" onClick={() => go('reset')} className="press w-full text-sub text-accent">Ich habe schon einen Code</button>
                    </form>
                ) : (
                    <form onSubmit={submit(reset)} className="space-y-4">
                        <Field label="E-Mail" type="email" autoComplete="email" value={form.email} onChange={set('email')} required />
                        <Field label="Code" inputMode="numeric" autoComplete="one-time-code" value={form.code} onChange={set('code')} required />
                        {pw('password', 'Neues Passwort', 'new-password')}
                        {pw('password2', 'Passwort wiederholen', 'new-password')}
                        <ErrorLine error={error} />
                        <Button type="submit" size="lg" full loading={busy}>Passwort ändern</Button>
                    </form>
                )}
            </Shell>
        );
    }

    if (mode === 'setup' || mode === 'import') {
        return (
            <Shell title="Willkommen bei FamyHub" subtitle="Richte deine Familie ein oder stelle ein Backup wieder her.">
                <Segmented className="mb-5" value={mode} onChange={go} options={[{ value: 'setup', label: 'Neu einrichten' }, { value: 'import', label: 'Backup laden' }]} />
                {mode === 'setup' ? (
                    <form onSubmit={submit(setup)} className="space-y-4">
                        <Field label="Familienname" placeholder="z. B. Familie Müller" value={form.familyName} onChange={set('familyName')} required />
                        <Field label="Dein Benutzername" autoComplete="username" value={form.username} onChange={set('username')} required />
                        <Field label="E-Mail" type="email" autoComplete="email" value={form.email} onChange={set('email')} required />
                        {pw('password', 'Passwort', 'new-password')}
                        {pw('password2', 'Passwort wiederholen', 'new-password')}
                        <ErrorLine error={error} />
                        <Button type="submit" size="lg" full loading={busy}>Familie anlegen</Button>
                    </form>
                ) : (
                    <div className="space-y-4">
                        <p className="text-sub text-label2">Wähle eine Backup-Datei (.zip), die du in FamyHub unter Einstellungen → System exportiert hast.</p>
                        <label className="press flex h-[50px] w-full cursor-pointer items-center justify-center gap-2 rounded-cell bg-tint font-semibold text-white">
                            {busy ? <Spinner className="h-4 w-4" /> : <i className="ri-upload-2-line"></i>} Backup auswählen
                            <input type="file" accept=".zip" className="hidden" disabled={busy} onChange={(e) => e.target.files[0] && importBackup(e.target.files[0])} />
                        </label>
                        <ErrorLine error={error} />
                    </div>
                )}
            </Shell>
        );
    }

    if (mode === 'register') {
        return (
            <Shell title="Konto erstellen" subtitle="Mit dem Einladungscode deiner Familie trittst du ihr direkt bei."
                footer={<>Schon ein Konto? <Link onClick={() => go('login')}>Anmelden</Link></>}>
                <form onSubmit={submit(register)} className="space-y-4">
                    <Field label="Einladungscode" value={form.invite} onChange={set('invite')} placeholder="ABC123" className="[&_input]:uppercase" required={!status.registrationOpen} />
                    <Field label="Benutzername" autoComplete="username" value={form.username} onChange={set('username')} required />
                    <Field label="E-Mail" type="email" autoComplete="email" value={form.email} onChange={set('email')} required />
                    {pw('password', 'Passwort', 'new-password')}
                    {pw('password2', 'Passwort wiederholen', 'new-password')}
                    <ErrorLine error={error} />
                    <Button type="submit" size="lg" full loading={busy}>Registrieren</Button>
                </form>
            </Shell>
        );
    }

    return (
        <Shell title="FamyHub" subtitle="Schön, dass du da bist."
            footer={<>
                <div><Link onClick={() => go('forgot')}>Passwort vergessen?</Link></div>
                <div className="text-label2">Neu hier? <Link onClick={() => go('register')}>Mit Einladungscode registrieren</Link></div>
            </>}>
            <form onSubmit={submit(login)} className="space-y-4">
                <Field label="Benutzername oder E-Mail" autoComplete="username" autoCapitalize="none" value={form.identifier} onChange={set('identifier')} required />
                {pw()}
                <div className="flex items-center justify-between px-1">
                    <span className="text-sub">Angemeldet bleiben</span>
                    <Toggle checked={form.rememberMe} onChange={set('rememberMe')} label="Angemeldet bleiben" />
                </div>
                <ErrorLine error={error} />
                <Button type="submit" size="lg" full loading={busy}>Anmelden</Button>
            </form>
        </Shell>
    );
}
