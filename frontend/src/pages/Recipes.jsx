import React from 'react';
import api from '../lib/api';
import { useApi } from '../lib/useApi';
import { parseIngredients } from '../lib/recipes';
import { Page, Section, Row, Chip, IconButton, Button, Sheet, Form, FormGroup, InputRow, Field, SearchField, Empty, Loading, ErrorNote, ActionSheet, useFeedback, useAction } from '../ui';
import AddToShopping from '../components/AddToShopping';

const RecipeEditor = ({ open, onClose, recipe, folders, folderId, onSaved }) => {
    const [f, setF] = React.useState({ title: '', ingredients: [], instructions: '', folder_id: '' });
    const [saving, setSaving] = React.useState(false);
    const act = useAction();
    React.useEffect(() => {
        if (!open) return;
        setF(recipe
            ? { title: recipe.title, ingredients: parseIngredients(recipe.ingredients), instructions: recipe.instructions || '', folder_id: recipe.folder_id || '' }
            : { title: '', ingredients: [{ amount: '', name: '' }], instructions: '', folder_id: folderId || '' });
    }, [open, recipe, folderId]);
    const setIng = (i, k, v) => setF(s => ({ ...s, ingredients: s.ingredients.map((x, j) => (j === i ? { ...x, [k]: v } : x)) }));
    const save = async () => {
        if (!f.title.trim()) return;
        setSaving(true);
        const body = { ...f, title: f.title.trim(), folder_id: f.folder_id || null, ingredients: JSON.stringify(f.ingredients.filter(i => i.name.trim())) };
        const r = await act(() => (recipe ? api.put(`/recipes/${recipe.id}`, body) : api.post('/recipes', body)), recipe ? 'Rezept gespeichert' : 'Rezept angelegt');
        setSaving(false);
        if (r) { onSaved(r.data); onClose(); }
    };
    return (
        <Sheet open={open} onClose={onClose} title={recipe ? 'Rezept bearbeiten' : 'Neues Rezept'} onSave={save} saving={saving} saveDisabled={!f.title.trim()} size="lg">
            <Form onSubmit={save} className="space-y-6">
                <FormGroup>
                    <InputRow placeholder="Name des Rezepts" value={f.title} onChange={e => setF(s => ({ ...s, title: e.target.value }))} autoFocus={!recipe} />
                    <InputRow as="select" label="Ordner" value={f.folder_id} onChange={e => setF(s => ({ ...s, folder_id: e.target.value }))}>
                        <option value="">Kein Ordner</option>
                        {folders.map(fo => <option key={fo.id} value={fo.id}>{fo.name}</option>)}
                    </InputRow>
                </FormGroup>
                <FormGroup title="Zutaten">
                    {f.ingredients.map((ing, i) => (
                        <div key={i} className="flex items-center gap-2 px-4">
                            <input value={ing.amount} onChange={e => setIng(i, 'amount', e.target.value)} placeholder="Menge" aria-label="Menge" className="w-24 bg-transparent py-3 text-body text-label2 outline-none" />
                            <input value={ing.name} onChange={e => setIng(i, 'name', e.target.value)} placeholder="Zutat" aria-label="Zutat" className="min-w-0 flex-1 bg-transparent py-3 text-body outline-none"
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setF(s => ({ ...s, ingredients: [...s.ingredients, { amount: '', name: '' }] })); } }} />
                            <IconButton icon="ri-indeterminate-circle-fill" label="Zutat entfernen" variant="plain" className="text-danger" size={30} onClick={() => setF(s => ({ ...s, ingredients: s.ingredients.filter((_, j) => j !== i) }))} />
                        </div>
                    ))}
                    <button type="button" onClick={() => setF(s => ({ ...s, ingredients: [...s.ingredients, { amount: '', name: '' }] }))} className="press flex w-full items-center gap-2 px-4 py-3 text-body text-accent"><i className="ri-add-circle-fill text-xl"></i>Zutat hinzufügen</button>
                </FormGroup>
                <FormGroup title="Zubereitung">
                    <InputRow as="textarea" placeholder="Schritt für Schritt …" value={f.instructions} onChange={e => setF(s => ({ ...s, instructions: e.target.value }))} className="[&_textarea]:min-h-[180px]" />
                </FormGroup>
            </Form>
        </Sheet>
    );
};

const RecipeView = ({ recipe, open, onClose, onEdit, onDelete }) => {
    const [shopping, setShopping] = React.useState(false);
    const [servings, setServings] = React.useState(1);
    React.useEffect(() => { if (open) setServings(1); }, [open]);
    if (!recipe) return null;
    const ings = parseIngredients(recipe.ingredients);
    const scale = (amount) => {
        if (servings === 1 || !amount) return amount;
        return amount.replace(/(\d+(?:[.,]\d+)?)/, (m) => { const n = Number(m.replace(',', '.')) * servings; return String(Math.round(n * 100) / 100).replace('.', ','); });
    };
    const steps = (recipe.instructions || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
    return (
        <>
            <Sheet open={open && !shopping} onClose={onClose} title={recipe.title} size="lg">
                <div className="space-y-6">
                    <div className="flex gap-2">
                        <Button variant="tinted" className="flex-1" icon="ri-shopping-cart-2-line" onClick={() => setShopping(true)} disabled={!ings.length}>Einkaufen</Button>
                        <IconButton icon="ri-edit-line" label="Bearbeiten" variant="gray" size={44} onClick={onEdit} />
                        <IconButton icon="ri-delete-bin-line" label="Löschen" variant="destructive" size={44} onClick={onDelete} />
                    </div>
                    <Section title="Zutaten" className="mb-0" action={ings.length > 0 && (
                        <div className="flex items-center gap-2 text-footnote">
                            <button onClick={() => setServings(s => Math.max(0.5, s - 0.5))} className="press flex h-6 w-6 items-center justify-center rounded-full bg-fill/15" aria-label="Weniger">−</button>
                            <span className="w-10 text-center font-semibold">{String(servings).replace('.', ',')}×</span>
                            <button onClick={() => setServings(s => s + 0.5)} className="press flex h-6 w-6 items-center justify-center rounded-full bg-fill/15" aria-label="Mehr">+</button>
                        </div>
                    )}>
                        {ings.length === 0 && <p className="px-4 py-3 text-sub text-label2">Keine Zutaten eingetragen.</p>}
                        {ings.map((i, idx) => (
                            <div key={idx} className="flex items-baseline gap-3 border-b hairline px-4 py-2.5 last:border-b-0">
                                <span className="w-20 shrink-0 text-sub font-semibold text-accent">{scale(i.amount)}</span>
                                <span className="text-body">{i.name}</span>
                            </div>
                        ))}
                    </Section>
                    <Section title="Zubereitung" className="mb-0">
                        {steps.length === 0 && <p className="px-4 py-3 text-sub text-label2">Keine Anleitung eingetragen.</p>}
                        {steps.map((s, i) => (
                            <div key={i} className="flex gap-3 border-b hairline px-4 py-3 last:border-b-0">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-tint text-caption font-bold text-white">{i + 1}</span>
                                <p className="whitespace-pre-wrap text-body">{s}</p>
                            </div>
                        ))}
                    </Section>
                    <p className="text-center text-footnote text-label3">Von {recipe.creator_name}</p>
                </div>
            </Sheet>
            <AddToShopping open={shopping} onClose={() => setShopping(false)} recipe={recipe} />
        </>
    );
};

export default function Recipes() {
    const { data, loading, error, reload } = useApi('/recipes', { initial: [] });
    const { data: folders, reload: reloadFolders } = useApi('/recipes/folders', { initial: [] });
    const [folder, setFolder] = React.useState('all');
    const [q, setQ] = React.useState('');
    const [viewing, setViewing] = React.useState(null);
    const [editing, setEditing] = React.useState(null);
    const [folderSheet, setFolderSheet] = React.useState(null);
    const [folderName, setFolderName] = React.useState('');
    const [menu, setMenu] = React.useState(false);
    const { confirm } = useFeedback();
    const act = useAction();

    const shown = data.filter(r => (folder === 'all' || r.folder_id === folder) && (!q || r.title.toLowerCase().includes(q.toLowerCase()) || (r.ingredients || '').toLowerCase().includes(q.toLowerCase())));
    const activeFolder = folders.find(f => f.id === folder);

    const remove = async (r) => {
        if (!(await confirm({ title: `„${r.title}“ löschen?`, confirmText: 'Löschen', destructive: true }))) return;
        if (await act(() => api.delete(`/recipes/${r.id}`), 'Rezept gelöscht')) { setViewing(null); reload(); }
    };
    React.useEffect(() => { if (folderSheet) setFolderName(folderSheet.folder?.name || ''); }, [folderSheet]);
    const saveFolder = async () => {
        if (!folderName.trim()) return;
        const r = await act(() => (folderSheet.folder ? api.put(`/recipes/folders/${folderSheet.folder.id}`, { name: folderName.trim() }) : api.post('/recipes/folders', { name: folderName.trim() })), 'Ordner gespeichert');
        if (r) { setFolderSheet(null); reloadFolders(); if (r.data?.id) setFolder(r.data.id); }
    };
    const deleteFolder = async () => {
        if (!(await confirm({ title: `Ordner „${activeFolder.name}“ löschen?`, message: 'Die Rezepte bleiben erhalten.', confirmText: 'Löschen', destructive: true }))) return;
        if (await act(() => api.delete(`/recipes/folders/${activeFolder.id}`), 'Ordner gelöscht')) { setFolder('all'); reloadFolders(); reload(); }
    };

    return (
        <Page title="Rezepte" actions={<>
            {activeFolder && <IconButton icon="ri-more-fill" label="Ordner-Optionen" variant="gray" onClick={() => setMenu(true)} />}
            <IconButton icon="ri-add-line" label="Neues Rezept" variant="filled" onClick={() => setEditing('new')} />
        </>}>
            <div className="mb-3"><SearchField value={q} onChange={setQ} placeholder="Rezepte oder Zutaten suchen" /></div>
            <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4">
                <Chip active={folder === 'all'} onClick={() => setFolder('all')}>Alle</Chip>
                {folders.map(f => <Chip key={f.id} active={folder === f.id} onClick={() => setFolder(f.id)}>{f.name}</Chip>)}
                <Chip onClick={() => setFolderSheet({})}><i className="ri-folder-add-line"></i> Ordner</Chip>
            </div>
            {error && <ErrorNote error={error} onRetry={reload} />}
            {loading ? <Loading /> : shown.length === 0 ? (
                <Empty icon="ri-book-open-line" title={q ? 'Nichts gefunden' : 'Noch keine Rezepte'} text={q ? undefined : 'Sammelt eure Lieblingsrezepte an einem Ort.'} action={!q && <Button icon="ri-add-line" onClick={() => setEditing('new')}>Rezept anlegen</Button>} />
            ) : (
                <Section>
                    {shown.map(r => {
                        const n = parseIngredients(r.ingredients).length;
                        return <Row key={r.id} icon="ri-restaurant-2-fill" color="#A2845E" title={r.title} subtitle={[n ? `${n} Zutaten` : null, folders.find(f => f.id === r.folder_id)?.name, r.creator_name].filter(Boolean).join(' · ')} onClick={() => setViewing(r)} chevron />;
                    })}
                </Section>
            )}
            <RecipeView recipe={viewing} open={!!viewing} onClose={() => setViewing(null)} onEdit={() => { setEditing(viewing); setViewing(null); }} onDelete={() => remove(viewing)} />
            <RecipeEditor open={!!editing} onClose={() => setEditing(null)} recipe={editing === 'new' ? null : editing} folders={folders} folderId={activeFolder?.id} onSaved={() => reload()} />
            <Sheet open={!!folderSheet} onClose={() => setFolderSheet(null)} title={folderSheet?.folder ? 'Ordner umbenennen' : 'Neuer Ordner'} onSave={saveFolder} saveDisabled={!folderName.trim()}>
                <form onSubmit={e => { e.preventDefault(); saveFolder(); }}><Field label="Name" placeholder="z. B. Kuchen" value={folderName} onChange={e => setFolderName(e.target.value)} autoFocus /></form>
            </Sheet>
            <ActionSheet open={menu} onClose={() => setMenu(false)} title={activeFolder?.name} actions={[
                { label: 'Ordner umbenennen', icon: 'ri-edit-line', onClick: () => setFolderSheet({ folder: activeFolder }) },
                { label: 'Ordner löschen', icon: 'ri-delete-bin-line', destructive: true, onClick: deleteFolder },
            ]} />
        </Page>
    );
}
