import React from 'react';
import api from '../lib/api';
import { useApi } from '../lib/useApi';
import { personColor } from '../lib/format';
import { Page, Section, Row, IconButton, Button, Sheet, Form, FormGroup, InputRow, ToggleRow, SearchField, Avatar, Empty, Loading, ErrorNote, useFeedback, useAction } from '../ui';

const ContactSheet = ({ open, onClose, contact, onSaved }) => {
    const [f, setF] = React.useState({});
    const [saving, setSaving] = React.useState(false);
    const act = useAction();
    React.useEffect(() => {
        if (open) setF(contact ? { ...contact, is_emergency: !!contact.is_emergency, is_favorite: !!contact.is_favorite } : { name: '', relationship: '', phone: '', email: '', address: '', notes: '', is_emergency: false, is_favorite: false });
    }, [open, contact]);
    const set = (k) => (v) => setF(s => ({ ...s, [k]: v?.target ? v.target.value : v }));
    const save = async () => {
        if (!f.name?.trim()) return;
        setSaving(true);
        const ok = await act(() => (contact ? api.put(`/contacts/${contact.id}`, f) : api.post('/contacts', f)), contact ? 'Kontakt gespeichert' : 'Kontakt angelegt');
        setSaving(false);
        if (ok) { onSaved(); onClose(); }
    };
    return (
        <Sheet open={open} onClose={onClose} title={contact ? 'Kontakt bearbeiten' : 'Neuer Kontakt'} onSave={save} saving={saving} saveDisabled={!f.name?.trim()}>
            <Form onSubmit={save} className="space-y-6">
                <FormGroup>
                    <InputRow placeholder="Name" value={f.name || ''} onChange={set('name')} autoFocus={!contact} />
                    <InputRow placeholder="Beziehung, z. B. Kinderärztin, Oma" value={f.relationship || ''} onChange={set('relationship')} />
                </FormGroup>
                <FormGroup>
                    <InputRow label="Telefon" type="tel" placeholder="+49 …" value={f.phone || ''} onChange={set('phone')} />
                    <InputRow label="E-Mail" type="email" autoCapitalize="none" value={f.email || ''} onChange={set('email')} />
                    <InputRow label="Adresse" value={f.address || ''} onChange={set('address')} />
                </FormGroup>
                <FormGroup>
                    <ToggleRow label="Notfallkontakt" icon="ri-alarm-warning-fill" color="#FF3B30" checked={!!f.is_emergency} onChange={set('is_emergency')} />
                    <ToggleRow label="Favorit" icon="ri-star-fill" color="#FF9500" checked={!!f.is_favorite} onChange={set('is_favorite')} />
                </FormGroup>
                <FormGroup><InputRow as="textarea" placeholder="Notizen" value={f.notes || ''} onChange={set('notes')} /></FormGroup>
            </Form>
        </Sheet>
    );
};

const ContactView = ({ contact, open, onClose, onEdit, onDelete }) => {
    if (!contact) return null;
    const action = (href, icon, label, disabled) => (
        <a href={disabled ? undefined : href} aria-disabled={disabled} className={`press flex flex-1 flex-col items-center gap-1 rounded-cell bg-card py-2.5 text-caption font-medium ${disabled ? 'pointer-events-none text-label3' : 'text-accent'}`}>
            <i className={`${icon} text-xl`}></i>{label}
        </a>
    );
    const maps = contact.address ? `https://maps.google.com/?q=${encodeURIComponent(contact.address)}` : null;
    return (
        <Sheet open={open} onClose={onClose} title="">
            <div className="space-y-5">
                <div className="flex flex-col items-center text-center">
                    <Avatar name={contact.name} color={personColor(contact.id)} size={84} />
                    <h2 className="mt-3 text-title2 font-bold">{contact.name}</h2>
                    {contact.relationship && <p className="text-sub text-label2">{contact.relationship}</p>}
                    {contact.is_emergency ? <span className="mt-2 rounded-full bg-danger/12 px-3 py-0.5 text-footnote font-semibold text-danger">Notfallkontakt</span> : null}
                </div>
                <div className="flex gap-2">
                    {action(contact.phone ? `tel:${contact.phone.replace(/\s/g, '')}` : null, 'ri-phone-fill', 'Anrufen', !contact.phone)}
                    {action(contact.phone ? `sms:${contact.phone.replace(/\s/g, '')}` : null, 'ri-message-3-fill', 'Nachricht', !contact.phone)}
                    {action(contact.email ? `mailto:${contact.email}` : null, 'ri-mail-fill', 'E-Mail', !contact.email)}
                    {action(maps, 'ri-map-pin-2-fill', 'Karte', !maps)}
                </div>
                <div className="overflow-hidden rounded-cell bg-card">
                    {contact.phone && <Row title={contact.phone} subtitle="Telefon" />}
                    {contact.email && <Row title={contact.email} subtitle="E-Mail" />}
                    {contact.address && <Row title={contact.address} subtitle="Adresse" multiline />}
                    {contact.notes && <Row title={contact.notes} subtitle="Notizen" multiline />}
                </div>
                <div className="flex gap-2">
                    <Button variant="gray" className="flex-1" icon="ri-edit-line" onClick={onEdit}>Bearbeiten</Button>
                    <Button variant="destructive" className="flex-1" icon="ri-delete-bin-line" onClick={onDelete}>Löschen</Button>
                </div>
            </div>
        </Sheet>
    );
};

export default function Contacts() {
    const { data, loading, error, reload } = useApi('/contacts', { initial: [] });
    const [q, setQ] = React.useState('');
    const [viewing, setViewing] = React.useState(null);
    const [editing, setEditing] = React.useState(null);
    const { confirm } = useFeedback();
    const act = useAction();

    const match = (c) => !q || [c.name, c.relationship, c.phone, c.email].some(v => (v || '').toLowerCase().includes(q.toLowerCase()));
    const list = data.filter(match);
    const emergency = list.filter(c => c.is_emergency);
    const favorites = list.filter(c => !c.is_emergency && c.is_favorite);
    const rest = list.filter(c => !c.is_emergency && !c.is_favorite);
    const letters = [...new Set(rest.map(c => c.name[0]?.toUpperCase() || '#'))].sort((a, b) => a.localeCompare(b, 'de'));

    const remove = async (c) => {
        if (!(await confirm({ title: `${c.name} löschen?`, confirmText: 'Löschen', destructive: true }))) return;
        if (await act(() => api.delete(`/contacts/${c.id}`), 'Kontakt gelöscht')) { setViewing(null); reload(); }
    };

    const ContactRow = ({ c }) => (
        <Row leading={<Avatar name={c.name} color={personColor(c.id)} size={36} />} title={c.name} subtitle={[c.relationship, c.phone].filter(Boolean).join(' · ')} onClick={() => setViewing(c)}
            right={c.phone && <a href={`tel:${c.phone.replace(/\s/g, '')}`} onClick={e => e.stopPropagation()} aria-label={`${c.name} anrufen`} className="press flex h-9 w-9 items-center justify-center rounded-full bg-ok/15 text-ok"><i className="ri-phone-fill"></i></a>} />
    );

    return (
        <Page title="Kontakte" actions={<IconButton icon="ri-add-line" label="Neuer Kontakt" variant="filled" onClick={() => setEditing('new')} />}>
            <div className="mb-5"><SearchField value={q} onChange={setQ} /></div>
            {error && <ErrorNote error={error} onRetry={reload} />}
            {loading ? <Loading /> : list.length === 0 ? (
                <Empty icon="ri-contacts-book-2-line" title={q ? 'Nichts gefunden' : 'Noch keine Kontakte'} text={q ? undefined : 'Ärzte, Schule, Babysitter, Notfallnummern – alles an einem Ort.'} />
            ) : (
                <>
                    {emergency.length > 0 && <Section title="🚨 Notfall">{emergency.map(c => <ContactRow key={c.id} c={c} />)}</Section>}
                    {favorites.length > 0 && <Section title="⭐ Favoriten">{favorites.map(c => <ContactRow key={c.id} c={c} />)}</Section>}
                    {letters.map(l => <Section key={l} title={l}>{rest.filter(c => (c.name[0]?.toUpperCase() || '#') === l).map(c => <ContactRow key={c.id} c={c} />)}</Section>)}
                </>
            )}
            <ContactView contact={viewing} open={!!viewing} onClose={() => setViewing(null)} onEdit={() => { setEditing(viewing); setViewing(null); }} onDelete={() => remove(viewing)} />
            <ContactSheet open={!!editing} onClose={() => setEditing(null)} contact={editing === 'new' ? null : editing} onSaved={reload} />
        </Page>
    );
}
