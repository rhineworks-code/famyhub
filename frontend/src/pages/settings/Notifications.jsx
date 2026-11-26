import React from 'react';
import api from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { pushSupported, pushStatus, enablePush, disablePush } from '../../lib/push';
import { Page, Section, Row, ToggleRow, FormGroup, InputRow, Button, Sheet, useFeedback, useAction } from '../../ui';

export const PUSH_TYPES = [
    { type: 'calendar', label: 'Termin-Erinnerungen', icon: 'ri-calendar-2-fill', color: '#FF3B30', vars: ['event_title', 'start_time'] },
    { type: 'chat', label: 'Chat-Nachrichten', icon: 'ri-chat-3-fill', color: '#1AA7EC', vars: ['sender', 'content'] },
    { type: 'gallery', label: 'Neue Fotos', icon: 'ri-image-2-fill', color: '#FF2D55', vars: ['sender', 'album'] },
    { type: 'timeline', label: 'Timeline-Beiträge', icon: 'ri-quill-pen-fill', color: '#AF52DE', vars: ['sender'] },
    { type: 'projects', label: 'Projekt-Fristen', icon: 'ri-folder-chart-fill', color: '#007AFF', vars: ['project_title', 'days_left'] },
];

const TemplateSheet = ({ open, onClose, type, template, onSaved }) => {
    const [f, setF] = React.useState({ title_template: '', body_template: '' });
    const act = useAction();
    React.useEffect(() => { if (open) setF({ title_template: template?.title_template || '', body_template: template?.body_template || '' }); }, [open, template]);
    const save = async () => { if (await act(() => api.post('/push/templates', { type: type.type, ...f }), 'Vorlage gespeichert')) { onSaved(); onClose(); } };
    return (
        <Sheet open={open} onClose={onClose} title={type?.label} onSave={save}>
            <div className="space-y-5">
                <FormGroup footer={`Leer lassen für den Standardtext. Platzhalter: ${(type?.vars || []).map(v => `{${v}}`).join(', ')}`}>
                    <InputRow placeholder="Titel" value={f.title_template} onChange={e => setF(s => ({ ...s, title_template: e.target.value }))} />
                    <InputRow as="textarea" placeholder="Text" value={f.body_template} onChange={e => setF(s => ({ ...s, body_template: e.target.value }))} />
                </FormGroup>
                <div className="flex flex-wrap gap-1.5">
                    {(type?.vars || []).map(v => <button key={v} type="button" onClick={() => setF(s => ({ ...s, body_template: `${s.body_template}{${v}}` }))} className="press rounded-full bg-accent/12 px-2.5 py-1 font-mono text-footnote text-accent">{`{${v}}`}</button>)}
                </div>
            </div>
        </Sheet>
    );
};

export default function Notifications() {
    const { isAdmin } = useAuth();
    const [on, setOn] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [serverReady, setServerReady] = React.useState(true);
    const [templates, setTemplates] = React.useState([]);
    const [editing, setEditing] = React.useState(null);
    const { toast } = useFeedback();
    const act = useAction();

    const loadTemplates = React.useCallback(() => { if (isAdmin) api.get('/push/templates').then(r => setTemplates(r.data)).catch(() => {}); }, [isAdmin]);
    React.useEffect(() => {
        pushStatus().then(setOn).catch(() => {});
        api.get('/push/vapid-public-key').then(r => setServerReady(!!r.data.publicKey)).catch(() => {});
        loadTemplates();
    }, [loadTemplates]);

    const toggle = async (value) => {
        setBusy(true);
        try {
            if (value) { await enablePush(); toast('Mitteilungen aktiviert'); } else { await disablePush(); toast('Mitteilungen deaktiviert'); }
            setOn(value);
        } catch (err) { toast(err?.response?.data?.error || err.message, 'error'); } finally { setBusy(false); }
    };

    return (
        <Page back="/settings" title="Mitteilungen">
            {!pushSupported() && <p className="mb-5 rounded-card bg-warn/12 p-4 text-sub text-label">Dieser Browser unterstützt keine Push-Mitteilungen. Auf dem iPhone: FamyHub über „Teilen → Zum Home-Bildschirm“ installieren und von dort öffnen.</p>}
            {!serverReady && <p className="mb-5 rounded-card bg-warn/12 p-4 text-sub text-label">Auf dem Server sind keine VAPID-Schlüssel hinterlegt. Siehe README → Push-Benachrichtigungen.</p>}
            <Section footer="Gilt für dieses Gerät. Welche Arten von Mitteilungen du bekommst, legt ein Familien-Admin bei deinem Konto fest.">
                <ToggleRow icon="ri-notification-3-fill" color="#FF3B30" label={busy ? 'Einen Moment …' : 'Auf diesem Gerät'} checked={on} onChange={toggle} />
                {on && <Row title="Test-Mitteilung senden" onClick={() => act(() => api.post('/push/test'), 'Test gesendet')} />}
            </Section>
            {isAdmin && (
                <Section title="Texte der Mitteilungen" footer="Gilt für die ganze Familie.">
                    {PUSH_TYPES.map(t => {
                        const tpl = templates.find(x => x.type === t.type);
                        return <Row key={t.type} icon={t.icon} color={t.color} title={t.label} value={tpl?.title_template || tpl?.body_template ? 'Eigener Text' : 'Standard'} onClick={() => setEditing(t)} chevron />;
                    })}
                </Section>
            )}
            {isAdmin && <Button variant="tinted" full icon="ri-send-plane-line" onClick={() => act(() => api.post('/push/test-custom', { title: 'Hallo Familie 👋', body: 'Das ist eine Test-Mitteilung an alle.' }), 'An alle Geräte gesendet')}>Test an alle Geräte</Button>}
            <TemplateSheet open={!!editing} onClose={() => setEditing(null)} type={editing} template={templates.find(x => x.type === editing?.type)} onSaved={loadTemplates} />
        </Page>
    );
}
