import React from 'react';
import api, { errorText } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Button, Field, Segmented } from '../../ui';

export default function Onboarding() {
    const { user, refresh, signOut } = useAuth();
    const [mode, setMode] = React.useState('join');
    const [value, setValue] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState('');

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true); setError('');
        try {
            if (mode === 'join') await api.post('/auth/family/join', { inviteCode: value.trim() });
            else await api.post('/auth/family/create', { name: value.trim() });
            await refresh();
        } catch (err) { setError(errorText(err)); } finally { setBusy(false); }
    };

    return (
        <div className="safe-top flex min-h-dvh items-center justify-center bg-bg px-5">
            <div className="w-full max-w-[400px]">
                <div className="mb-6 text-center">
                    <span className="mx-auto mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-tint text-[36px] text-white shadow-pop"><i className="ri-home-heart-fill"></i></span>
                    <h1 className="text-title1 font-bold">Hallo {user.username}!</h1>
                    <p className="mt-1 text-sub text-label2">Du gehörst noch zu keiner Familie.</p>
                </div>
                <form onSubmit={submit} className="space-y-4 rounded-sheet bg-card p-5">
                    <Segmented value={mode} onChange={(m) => { setMode(m); setValue(''); setError(''); }} options={[{ value: 'join', label: 'Beitreten' }, { value: 'create', label: 'Neu anlegen' }]} />
                    {mode === 'join'
                        ? <Field label="Einladungscode" value={value} onChange={e => setValue(e.target.value.toUpperCase())} placeholder="ABC123" required autoFocus />
                        : <Field label="Familienname" value={value} onChange={e => setValue(e.target.value)} placeholder="Familie Müller" required autoFocus />}
                    {error && <p role="alert" className="rounded-cell bg-danger/10 px-3 py-2.5 text-footnote font-medium text-danger">{error}</p>}
                    <Button type="submit" size="lg" full loading={busy}>{mode === 'join' ? 'Familie beitreten' : 'Familie anlegen'}</Button>
                </form>
                <button onClick={signOut} className="press mt-5 w-full text-center text-sub text-accent">Abmelden</button>
            </div>
        </div>
    );
}
