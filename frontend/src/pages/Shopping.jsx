import React from 'react';
import api from '../lib/api';
import { useApi } from '../lib/useApi';
import { Page, Section, Check, Chip, IconButton, Empty, Loading, ErrorNote, ActionSheet, Sheet, Field, useFeedback, useAction, cx } from '../ui';

export const CATEGORIES = [
    { id: 'Lebensmittel', icon: 'ri-restaurant-line', color: '#34C759' },
    { id: 'Haushalt', icon: 'ri-home-4-line', color: '#1AA7EC' },
    { id: 'Persönlich', icon: 'ri-user-heart-line', color: '#AF52DE' },
    { id: 'Allgemein', icon: 'ri-shopping-bag-3-line', color: '#8E8E93' },
    { id: 'Rezept', icon: 'ri-book-open-line', color: '#FF9500' },
];

const NameSheet = ({ open, title, initial = '', onClose, onSave }) => {
    const [name, setName] = React.useState(initial);
    React.useEffect(() => { if (open) setName(initial); }, [open, initial]);
    return (
        <Sheet open={open} onClose={onClose} title={title} onSave={() => name.trim() && onSave(name.trim())} saveDisabled={!name.trim()}>
            <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSave(name.trim()); }}>
                <Field label="Name" value={name} onChange={e => setName(e.target.value)} autoFocus />
            </form>
        </Sheet>
    );
};

export default function Shopping() {
    const { data: lists, reload: reloadLists } = useApi('/shopping/lists', { initial: [] });
    const [listId, setListId] = React.useState(() => Number(localStorage.getItem('fh_shop_list')) || null);
    const activeList = lists.find(l => l.id === listId) || lists[0];
    const { data: items, setData: setItems, loading, error, reload } = useApi(activeList ? `/shopping?list_id=${activeList.id}` : null, { initial: [], enabled: !!activeList, interval: 15000 });
    const [text, setText] = React.useState('');
    const [category, setCategory] = React.useState('Lebensmittel');
    const [showDone, setShowDone] = React.useState(false);
    const [menu, setMenu] = React.useState(false);
    const [nameSheet, setNameSheet] = React.useState(null); // 'new' | 'rename'
    const { confirm } = useFeedback();
    const act = useAction();
    const inputRef = React.useRef(null);

    React.useEffect(() => { if (activeList) localStorage.setItem('fh_shop_list', activeList.id); }, [activeList]);

    const open = items.filter(i => !i.completed);
    const done = items.filter(i => i.completed);
    const groups = CATEGORIES.map(c => ({ ...c, items: open.filter(i => (i.category || 'Allgemein') === c.id) }))
        .concat([{ id: 'Sonstiges', icon: 'ri-price-tag-3-line', color: '#8E8E93', items: open.filter(i => i.category && !CATEGORIES.some(c => c.id === i.category)) }])
        .filter(g => g.items.length);

    const add = async (e) => {
        e.preventDefault();
        const names = text.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
        if (!names.length || !activeList) return;
        setText('');
        inputRef.current?.focus();
        if (names.length === 1) {
            const r = await act(() => api.post('/shopping', { name: names[0], category, list_id: activeList.id }));
            if (r?.data) setItems(list => [r.data, ...list]);
        } else {
            await act(() => api.post('/shopping/bulk', { list_id: activeList.id, items: names.map(name => ({ name, category })) }), `${names.length} Artikel hinzugefügt`);
            reload();
        }
    };

    const toggle = async (item) => {
        setItems(list => list.map(i => (i.id === item.id ? { ...i, completed: i.completed ? 0 : 1 } : i)));
        const ok = await act(() => api.put(`/shopping/${item.id}`, { completed: !item.completed }));
        if (!ok) reload();
    };
    const remove = async (item) => {
        setItems(list => list.filter(i => i.id !== item.id));
        await act(() => api.delete(`/shopping/${item.id}`));
    };
    const clearDone = async () => {
        if (!(await confirm({ title: `${done.length} erledigte Artikel löschen?`, confirmText: 'Löschen', destructive: true }))) return;
        await Promise.all(done.map(i => api.delete(`/shopping/${i.id}`).catch(() => {})));
        reload();
    };

    const saveList = async (name) => {
        if (nameSheet === 'new') {
            const r = await act(() => api.post('/shopping/lists', { name }), 'Liste angelegt');
            if (r?.data) { await reloadLists(); setListId(r.data.id); }
        } else {
            await act(() => api.put(`/shopping/lists/${activeList.id}`, { name }), 'Liste umbenannt');
            reloadLists();
        }
        setNameSheet(null);
    };
    const deleteList = async () => {
        if (!(await confirm({ title: `„${activeList.name}“ löschen?`, message: 'Alle Artikel dieser Liste werden gelöscht.', confirmText: 'Löschen', destructive: true }))) return;
        if (await act(() => api.delete(`/shopping/lists/${activeList.id}`), 'Liste gelöscht')) { setListId(null); reloadLists(); }
    };

    const ItemRow = ({ item }) => (
        <div className="group/row flex items-center gap-3 pl-4">
            <Check checked={!!item.completed} onChange={() => toggle(item)} color="#34C759" />
            <div className="flex min-h-[48px] min-w-0 flex-1 items-center gap-2 border-b hairline pr-2 group-last/row:border-b-0">
                <button type="button" onClick={() => toggle(item)} className={cx('min-w-0 flex-1 truncate py-3 text-left text-body', item.completed && 'text-label3 line-through')}>{item.name}</button>
                <IconButton icon="ri-close-line" label={`${item.name} löschen`} variant="plain" className="text-label3" size={32} onClick={() => remove(item)} />
            </div>
        </div>
    );

    return (
        <Page title="Einkauf" subtitle={open.length ? `${open.length} offen` : undefined}
            actions={<IconButton icon="ri-more-fill" label="Listen-Optionen" variant="gray" onClick={() => setMenu(true)} />}>
            <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
                {lists.map(l => <Chip key={l.id} active={activeList?.id === l.id} onClick={() => setListId(l.id)}>{l.name}</Chip>)}
                <Chip onClick={() => setNameSheet('new')}><i className="ri-add-line"></i> Liste</Chip>
            </div>

            <form onSubmit={add} className="mb-6 rounded-card bg-card p-2">
                <div className="flex items-center gap-2">
                    <input ref={inputRef} value={text} onChange={e => setText(e.target.value)} placeholder="Was wird gebraucht?" aria-label="Neuer Artikel"
                        className="min-w-0 flex-1 bg-transparent px-2 py-2 text-body outline-none placeholder:text-label3" enterKeyHint="done" />
                    <IconButton type="submit" icon="ri-arrow-up-line" label="Hinzufügen" variant="filled" disabled={!text.trim()} />
                </div>
                <div className="no-scrollbar mt-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                    {CATEGORIES.filter(c => c.id !== 'Rezept').map(c => (
                        <button key={c.id} type="button" onClick={() => setCategory(c.id)}
                            className={cx('press flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-footnote font-medium', category === c.id ? 'text-white' : 'bg-fill/12 text-label2')}
                            style={category === c.id ? { backgroundColor: c.color } : undefined}>
                            <i className={c.icon}></i>{c.id}
                        </button>
                    ))}
                </div>
            </form>

            {error && <ErrorNote error={error} onRetry={reload} />}
            {loading ? <Loading /> : open.length === 0 && done.length === 0 ? (
                <Empty icon="ri-shopping-basket-2-line" title="Alles da!" text="Die Liste ist leer. Tipp: Mehrere Artikel mit Komma trennen." />
            ) : (
                <>
                    {open.length === 0 && <Empty icon="ri-checkbox-circle-line" title="Alles erledigt" />}
                    {groups.map(g => (
                        <Section key={g.id} title={<span className="flex items-center gap-1.5"><i className={g.icon} style={{ color: g.color }}></i>{g.id}</span>}>
                            {g.items.map(i => <ItemRow key={i.id} item={i} />)}
                        </Section>
                    ))}
                    {done.length > 0 && (
                        <Section title={`Erledigt (${done.length})`}
                            action={<div className="flex gap-3 text-footnote font-medium text-accent">
                                <button onClick={() => setShowDone(s => !s)}>{showDone ? 'Ausblenden' : 'Anzeigen'}</button>
                                <button onClick={clearDone} className="text-danger">Löschen</button>
                            </div>}>
                            {showDone ? done.map(i => <ItemRow key={i.id} item={i} />) : <button onClick={() => setShowDone(true)} className="w-full px-4 py-3 text-left text-sub text-label2">{done.map(i => i.name).join(', ')}</button>}
                        </Section>
                    )}
                </>
            )}

            <ActionSheet open={menu} onClose={() => setMenu(false)} title={activeList?.name} actions={[
                { label: 'Neue Liste', icon: 'ri-add-line', onClick: () => setNameSheet('new') },
                activeList && { label: 'Liste umbenennen', icon: 'ri-edit-line', onClick: () => setNameSheet('rename') },
                done.length > 0 && { label: 'Erledigte löschen', icon: 'ri-delete-bin-line', onClick: clearDone, destructive: true },
                activeList && lists.length > 1 && { label: 'Liste löschen', icon: 'ri-delete-bin-2-line', onClick: deleteList, destructive: true },
            ]} />
            <NameSheet open={!!nameSheet} title={nameSheet === 'new' ? 'Neue Liste' : 'Liste umbenennen'} initial={nameSheet === 'rename' ? activeList?.name : ''} onClose={() => setNameSheet(null)} onSave={saveList} />
        </Page>
    );
}

