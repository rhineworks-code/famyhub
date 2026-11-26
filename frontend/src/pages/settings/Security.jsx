import React from 'react';
import api from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Page, Section, Row, FormGroup, InputRow, Button, Sheet, Field, useFeedback, useAction } from '../../ui';

export default function Security() {
    const { user, signIn, refresh } = useAuth();
    const [pw, setPw] = React.useState({ currentPassword: '', newPassword: '', repeat: '' });
    const [busy, setBusy] = React.useState(false);
    const [setup, setSetup] = React.useState(null);
    const [code, setCode] = React.useState('');
    const { confirm, toast } = useFeedback();
    const act = useAction();

    const changePassword = async (e) => {
        e.preventDefault();
        if (pw.newPassword !== pw.repeat) return toast('Die neuen Passwörter stimmen nicht überein.', 'error');
        setBusy(true);
        const r = await act(() => api.post('/auth/profile/password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword }), 'Passwort geändert – andere Geräte wurden abgemeldet');
        setBusy(false);
        if (r?.data?.token) { signIn(r.data); setPw({ currentPassword: '', newPassword: '', repeat: '' }); }
    };
    const start2fa = async () => {
        const r = await act(() => api.post('/auth/profile/2fa/setup'));
        if (r?.data) { setSetup(r.data); setCode(''); }
    };
    const verify2fa = async () => {
        if (await act(() => api.post('/auth/profile/2fa/verify', { code }), 'Zwei-Faktor-Anmeldung ist aktiv')) { setSetup(null); refresh(); }
    };
    const disable2fa = async () => {
        if (!(await confirm({ title: '2FA deaktivieren?', message: 'Die Anmeldung ist danach nur noch mit Passwort geschützt.', confirmText: 'Deaktivieren', destructive: true }))) return;
        if (await act(() => api.post('/auth/profile/2fa/disable'), '2FA deaktiviert')) refresh();
    };

    return (
        <Page back="/settings" title="Sicherheit">
            <Section title="Zwei-Faktor-Anmeldung" footer="Zusätzlich zum Passwort wird beim Anmelden ein Code aus einer Authenticator-App (z. B. Google Authenticator, 1Password) abgefragt.">
                <Row icon="ri-shield-check-fill" color={user.two_factor_enabled ? '#34C759' : '#8E8E93'} title="Zwei-Faktor-Anmeldung" value={user.two_factor_enabled ? 'An' : 'Aus'} />
                {user.two_factor_enabled ? <Row title="Deaktivieren" destructive onClick={disable2fa} /> : <Row title="Einrichten" onClick={start2fa} chevron />}
            </Section>
            <form onSubmit={changePassword} className="space-y-3">
                <FormGroup title="Passwort ändern" footer="Mindestens 6 Zeichen. Alle anderen Geräte werden danach abgemeldet.">
                    <InputRow type="password" autoComplete="current-password" placeholder="Aktuelles Passwort" value={pw.currentPassword} onChange={e => setPw(s => ({ ...s, currentPassword: e.target.value }))} />
                    <InputRow type="password" autoComplete="new-password" placeholder="Neues Passwort" value={pw.newPassword} onChange={e => setPw(s => ({ ...s, newPassword: e.target.value }))} />
                    <InputRow type="password" autoComplete="new-password" placeholder="Neues Passwort wiederholen" value={pw.repeat} onChange={e => setPw(s => ({ ...s, repeat: e.target.value }))} />
                </FormGroup>
                <Button type="submit" full loading={busy} disabled={!pw.currentPassword || pw.newPassword.length < 6}>Passwort ändern</Button>
            </form>
            <Sheet open={!!setup} onClose={() => setSetup(null)} title="2FA einrichten" onSave={verify2fa} saveLabel="Aktivieren" saveDisabled={code.replace(/\s/g, '').length < 6}>
                {setup && (
                    <div className="space-y-5 text-center">
                        <p className="text-sub text-label2">1. Scanne den QR-Code mit deiner Authenticator-App.</p>
                        <img src={setup.qrCodeUrl} alt="QR-Code" className="mx-auto h-52 w-52 rounded-card bg-white p-3" />
                        <p className="break-all font-mono text-footnote text-label2">{setup.secret}</p>
                        <p className="text-sub text-label2">2. Gib den angezeigten 6-stelligen Code ein.</p>
                        <Field inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value)} placeholder="123456" className="[&_input]:text-center [&_input]:text-title2 [&_input]:tracking-[0.3em]" />
                    </div>
                )}
            </Sheet>
        </Page>
    );
}
