import React from 'react';
import api from '../lib/api';
import { ingredientLabel, parseIngredients } from '../lib/recipes';
import { Sheet, FormGroup, Check, InputRow, useAction } from '../ui';

/** Sheet: pick ingredients of a recipe and put them on a shopping list. */
export default function AddToShopping({ open, onClose, recipe }) {
    const [lists, setLists] = React.useState([]);
    const [listId, setListId] = React.useState('');
    const [items, setItems] = React.useState([]);
    const [busy, setBusy] = React.useState(false);
    const act = useAction();

    React.useEffect(() => {
        if (!open) return;
        setItems(parseIngredients(recipe?.ingredients).map(i => ({ ...i, on: true })));
        api.get('/shopping/lists').then(r => { setLists(r.data); setListId(String(r.data[0]?.id || '')); }).catch(() => {});
    }, [open, recipe]);

    const selected = items.filter(i => i.on && i.name.trim());
    const save = async () => {
        setBusy(true);
        const ok = await act(() => api.post('/shopping/bulk', { list_id: listId, items: selected.map(ingredientLabel) }), `${selected.length} Zutaten auf die Einkaufsliste gesetzt`);
        setBusy(false);
        if (ok) onClose();
    };

    return (
        <Sheet open={open} onClose={onClose} title="Auf die Einkaufsliste" onSave={save} saving={busy} saveLabel="Hinzufügen" saveDisabled={!selected.length || !listId}>
            <div className="space-y-6">
                <FormGroup>
                    <InputRow as="select" label="Liste" value={listId} onChange={e => setListId(e.target.value)}>
                        {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </InputRow>
                </FormGroup>
                <FormGroup title={recipe?.title}>
                    {items.length === 0 && <p className="px-4 py-3 text-sub text-label2">Dieses Rezept hat keine Zutatenliste.</p>}
                    {items.map((i, idx) => (
                        <button key={idx} type="button" onClick={() => setItems(list => list.map((x, j) => (j === idx ? { ...x, on: !x.on } : x)))} className="flex min-h-[46px] w-full items-center gap-3 px-4 text-left">
                            <Check checked={i.on} onChange={() => setItems(list => list.map((x, j) => (j === idx ? { ...x, on: !x.on } : x)))} />
                            <span className="flex-1 text-body">{i.name}</span>
                            {i.amount && <span className="text-sub text-label2">{i.amount}</span>}
                        </button>
                    ))}
                </FormGroup>
            </div>
        </Sheet>
    );
}
