import React from 'react';
import api from '../lib/api';
import { useApi } from '../lib/useApi';
import { useAuth, useMembers } from '../lib/auth';
import { euro } from '../lib/format';
import { Page, Section, Segmented, IconButton, Button, Sheet, Form, FormGroup, InputRow, Field, Avatar, Empty, Loading, ErrorNote, ActionSheet, useFeedback, useAction, cx } from '../ui';

const ItemSheet = ({ open, onClose, list, item, onSaved }) => {
    const [f, setF] = React.useState({});
    const [saving, setSaving] = React.useState(false);
    const { confirm } = useFeedback();
    const act = useAction();
    React.useEffect(() => { if (open) setF(item ? { title: item.title, url: item.url || '', price: item.price ?? '', notes: item.notes || '' } : { title: '', url: '', price: '', notes: '' }); }, [open, item]);
    const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }));
    const save = async () => {
        if (!f.title?.trim()) return;
        setSaving(true);
        const body = { ...f, price: f.price === '' ? null : Number(String(f.price).replace(',', '.')) };
        const ok = await act(() => (item ? api.put(`/wishlists/${list.id}/items/${item.id}`, body) : api.post(`/wishlists/${list.id}/items`, body)), item ? 'Gespeichert' : 'Wunsch hinzugefügt');
        setSaving(false);
        if (ok) { onSaved(); onClose(); }
    };
    const remove = async () => {
        if (!(await confirm({ title: 'Wunsch löschen?', confirmText: 'Löschen', destructive: true }))) return;
        if (await act(() => api.delete(`/wishlists/${list.id}/items/${item.id}`), 'Gelöscht')) { onSaved(); onClose(); }
    };
    return (
        <Sheet open={open} onClose={onClose} title={item ? 'Wunsch bearbeiten' : 'Neuer Wunsch'} onSave={save} saving={saving} saveDisabled={!f.title?.trim()}>
            <Form onSubmit={save} className="space-y-6">
                <FormGroup footer="Bei einem Link zum Shop wird automatisch ein Vorschaubild geladen.">
                    <InputRow placeholder="Was wünschst du dir?" value={f.title || ''} onChange={set('title')} autoFocus={!item} />
                    <InputRow placeholder="Link (optional)" inputMode="url" autoCapitalize="none" value={f.url || ''} onChange={set('url')} />
                    <InputRow label="Preis (€)" inputMode="decimal" placeholder="0,00" value={f.price ?? ''} onChange={set('price')} />
                    <InputRow as="textarea" placeholder="Notizen, Größe, Farbe …" value={f.notes || ''} onChange={set('notes')} />
                </FormGroup>
                {item && <Button variant="destructive" full onClick={remove}>Wunsch löschen</Button>}
            </Form>
        </Sheet>
    );
};

const WishItem = ({ item, own, list, onEdit, onChanged }) => {
    const { user, isAdmin } = useAuth();
    const act = useAction();
    const reserved = !!item.reserved_by;
    const mine = item.reserved_by === user.id;
    const toggle = async () => {
        const ok = await act(() => api.post(`/wishlists/${list.id}/items/${item.id}/${reserved ? 'unreserve' : 'reserve'}`), reserved ? 'Reservierung aufgehoben' : 'Reserviert – psst, es bleibt geheim 🤫');
        if (ok) onChanged();
    };
    let host = null;
    try { host = item.url ? new URL(/^https?:/.test(item.url) ? item.url : `https://${item.url}`).hostname.replace(/^www\./, '') : null; } catch { /* ignore */ }
    return (
        <div className="group/row flex items-center gap-3 pl-4">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-cell bg-fill/12">
                {item.image_url ? <img src={item.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                    : <div className="flex h-full items-center justify-center text-2xl text-label3"><i className="ri-gift-line"></i></div>}
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-2 border-b hairline py-3 pr-4 group-last/row:border-b-0">
                <button type="button" onClick={own ? onEdit : undefined} className={cx('min-w-0 flex-1 text-left', own && 'press')}>
                    <div className={cx('truncate text-body', !own && reserved && !mine && 'text-label3 line-through')}>{item.title}</div>
                    <div className="truncate text-footnote text-label2">
                        {[item.price != null ? euro(item.price) : null, item.notes, host].filter(Boolean).join(' · ')}
                    </div>
                    {!own && reserved && <div className="text-footnote font-medium text-ok">{mine ? '✓ Von dir reserviert' : `Reserviert von ${item.reserved_by_name}`}</div>}
                </button>
                {item.url && <a href={/^https?:/.test(item.url) ? item.url : `https://${item.url}`} target="_blank" rel="noopener noreferrer" aria-label="Im Shop öffnen" className="press flex h-9 w-9 items-center justify-center rounded-full bg-fill/12 text-accent"><i className="ri-external-link-line"></i></a>}
                {!own && (!reserved || mine || isAdmin) && <Button size="sm" variant={reserved ? 'gray' : 'tinted'} onClick={toggle}>{reserved ? 'Freigeben' : 'Reservieren'}</Button>}
            </div>
        </div>
    );
};

export default function Wishlists() {
    const { user, isAdmin } = useAuth();
    const { byId } = useMembers();
    const { data, loading, error, reload } = useApi('/wishlists', { initial: [] });
    const [tab, setTab] = React.useState('mine');
    const [itemSheet, setItemSheet] = React.useState(null); // { list, item }
    const [listSheet, setListSheet] = React.useState(null); // { list? }
    const [menu, setMenu] = React.useState(null);
    const [title, setTitle] = React.useState('');
    const { confirm } = useFeedback();
    const act = useAction();

    const mine = data.filter(l => l.user_id === user.id);
    const others = data.filter(l => l.user_id !== user.id);
    const shown = tab === 'mine' ? mine : others;

    React.useEffect(() => { if (listSheet) setTitle(listSheet.list?.title || ''); }, [listSheet]);
    const saveList = async () => {
        if (!title.trim()) return;
        const ok = await act(() => (listSheet.list ? api.put(`/wishlists/${listSheet.list.id}`, { title: title.trim() }) : api.post('/wishlists', { title: title.trim() })), 'Gespeichert');
        if (ok) { setListSheet(null); reload(); }
    };
    const deleteList = async (l) => {
        if (!(await confirm({ title: `„${l.title}“ löschen?`, message: 'Alle Wünsche dieser Liste werden gelöscht.', confirmText: 'Löschen', destructive: true }))) return;
        if (await act(() => api.delete(`/wishlists/${l.id}`), 'Liste gelöscht')) reload();
    };

    return (
        <Page title="Wunschlisten" actions={<IconButton icon="ri-add-line" label="Neue Wunschliste" variant="filled" onClick={() => setListSheet({})} />}>
            <Segmented className="mb-5" value={tab} onChange={setTab} options={[{ value: 'mine', label: 'Meine Listen' }, { value: 'family', label: 'Familie' }]} />
            {error && <ErrorNote error={error} onRetry={reload} />}
            {loading ? <Loading /> : shown.length === 0 ? (
                tab === 'mine'
                    ? <Empty icon="ri-gift-2-line" title="Noch keine Wunschliste" text="Zum Geburtstag, zu Weihnachten oder einfach so." action={<Button icon="ri-add-line" onClick={() => setListSheet({})}>Liste anlegen</Button>} />
                    : <Empty icon="ri-gift-2-line" title="Keine Wunschlisten" text="Die anderen haben noch keine Wünsche eingetragen." />
            ) : shown.map(l => {
                const own = l.user_id === user.id;
                return (
                    <Section key={l.id}
                        title={<span className="flex items-center gap-2">{!own && <Avatar user={byId[l.user_id] || { id: l.user_id, username: l.owner_name }} size={20} />}{own ? l.title : `${l.owner_name} · ${l.title}`}</span>}
                        action={(own || isAdmin) && <button onClick={() => setMenu(l)} className="press text-footnote font-medium text-accent" aria-label="Listen-Optionen"><i className="ri-more-fill text-lg"></i></button>}
                        footer={own ? 'Was andere reservieren, siehst du nicht – damit die Überraschung bleibt.' : undefined}>
                        {l.items.length === 0 && <p className="px-4 py-3 text-sub text-label2">Noch keine Wünsche.</p>}
                        {l.items.map(i => <WishItem key={i.id} item={i} own={own} list={l} onEdit={() => setItemSheet({ list: l, item: i })} onChanged={reload} />)}
                        {own && <button onClick={() => setItemSheet({ list: l })} className="press flex w-full items-center gap-3 border-t hairline px-4 py-3 text-body text-accent"><i className="ri-add-circle-fill text-xl"></i>Wunsch hinzufügen</button>}
                    </Section>
                );
            })}
            <ItemSheet open={!!itemSheet} onClose={() => setItemSheet(null)} list={itemSheet?.list} item={itemSheet?.item} onSaved={reload} />
            <Sheet open={!!listSheet} onClose={() => setListSheet(null)} title={listSheet?.list ? 'Liste umbenennen' : 'Neue Wunschliste'} onSave={saveList} saveDisabled={!title.trim()}>
                <form onSubmit={e => { e.preventDefault(); saveList(); }}><Field label="Titel" placeholder="z. B. Geburtstag 2027" value={title} onChange={e => setTitle(e.target.value)} autoFocus /></form>
            </Sheet>
            <ActionSheet open={!!menu} onClose={() => setMenu(null)} title={menu?.title} actions={[
                menu?.user_id === user.id && { label: 'Umbenennen', icon: 'ri-edit-line', onClick: () => setListSheet({ list: menu }) },
                { label: 'Liste löschen', icon: 'ri-delete-bin-line', destructive: true, onClick: () => deleteList(menu) },
            ]} />
        </Page>
    );
}
