import React from 'react';
import { addDays, addWeeks, format, isToday, startOfWeek } from 'date-fns';
import { de } from 'date-fns/locale';
import api from '../lib/api';
import { useApi } from '../lib/useApi';
import { useAuth } from '../lib/auth';
import { ymd, fmt } from '../lib/format';
import { Page, IconButton, Button, Sheet, Form, FormGroup, InputRow, Loading, ErrorNote, useFeedback, useAction, cx } from '../ui';
import AddToShopping from '../components/AddToShopping';

export const MEAL_TYPES = [
    { id: 'Frühstück', icon: 'ri-cup-line', color: '#FF9500' },
    { id: 'Mittagessen', icon: 'ri-sun-line', color: '#34C759' },
    { id: 'Abendessen', icon: 'ri-moon-line', color: '#5856D6' },
];

const MealSheet = ({ open, onClose, slot, meal, recipes, onSaved }) => {
    const [f, setF] = React.useState({ name: '', notes: '', date: '', type: '', suggestion: false });
    const [saving, setSaving] = React.useState(false);
    const [shopping, setShopping] = React.useState(false);
    const { confirm } = useFeedback();
    const act = useAction();

    React.useEffect(() => {
        if (!open) return;
        setF(meal
            ? { name: meal.recipe_name, notes: meal.notes || '', date: meal.date, type: meal.meal_type, suggestion: false }
            : { name: '', notes: '', date: slot?.date, type: slot?.type, suggestion: !!slot?.hasMeal });
    }, [open, meal, slot]);

    const recipe = recipes.find(r => r.title.toLowerCase() === f.name.trim().toLowerCase());
    const matches = f.name.trim().length > 0 ? recipes.filter(r => r.title.toLowerCase().includes(f.name.trim().toLowerCase()) && r.title !== f.name).slice(0, 5) : [];

    const save = async () => {
        if (!f.name.trim()) return;
        setSaving(true);
        let ok;
        if (meal) {
            ok = await act(async () => {
                await api.put(`/meals/${meal.id}`, { recipe_name: f.name.trim(), notes: f.notes });
                if (f.date !== meal.date || f.type !== meal.meal_type) await api.patch(`/meals/${meal.id}/move`, { date: f.date, meal_type: f.type });
            }, 'Gespeichert');
        } else {
            ok = await act(() => api.post('/meals', { date: f.date, meal_type: f.type, recipe_name: f.name.trim(), notes: f.notes, forceAdd: f.suggestion }), f.suggestion ? 'Vorschlag hinzugefügt' : 'Eingeplant');
        }
        setSaving(false);
        if (ok) { onSaved(); onClose(); }
    };
    const remove = async () => {
        if (!(await confirm({ title: `„${meal.recipe_name}“ entfernen?`, confirmText: 'Entfernen', destructive: true }))) return;
        if (await act(() => api.delete(`/meals/${meal.id}`), 'Entfernt')) { onSaved(); onClose(); }
    };

    return (
        <>
            <Sheet open={open && !shopping} onClose={onClose} title={meal ? 'Mahlzeit' : f.type || 'Mahlzeit'} onSave={save} saving={saving} saveDisabled={!f.name.trim()} saveLabel={meal ? 'Sichern' : 'Hinzufügen'}>
                <Form onSubmit={save} className="space-y-6">
                    <p className="text-center text-sub text-label2">{fmt(f.date, 'EEEE, d. MMMM')}</p>
                    <div>
                        <FormGroup>
                            <InputRow placeholder="Was gibt es?" value={f.name} onChange={e => setF(s => ({ ...s, name: e.target.value }))} autoFocus={!meal} />
                            <InputRow as="textarea" placeholder="Notizen" value={f.notes} onChange={e => setF(s => ({ ...s, notes: e.target.value }))} />
                        </FormGroup>
                        {matches.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2 px-1">
                                {matches.map(r => <button key={r.id} type="button" onClick={() => setF(s => ({ ...s, name: r.title }))} className="press rounded-full bg-accent/12 px-3 py-1 text-footnote font-medium text-accent"><i className="ri-book-open-line"></i> {r.title}</button>)}
                            </div>
                        )}
                    </div>
                    <FormGroup>
                        <InputRow type="date" label="Tag" value={f.date || ''} onChange={e => setF(s => ({ ...s, date: e.target.value }))} />
                        <InputRow as="select" label="Mahlzeit" value={f.type || ''} onChange={e => setF(s => ({ ...s, type: e.target.value }))}>
                            {MEAL_TYPES.map(t => <option key={t.id}>{t.id}</option>)}
                        </InputRow>
                    </FormGroup>
                    {!meal && slot?.hasMeal && (
                        <p className="px-4 text-footnote text-label2">Für diese Mahlzeit gibt es schon einen Eintrag – dein Eintrag wird als weiterer Vorschlag zur Abstimmung hinzugefügt.</p>
                    )}
                    {recipe && <Button variant="tinted" full icon="ri-shopping-cart-2-line" onClick={() => setShopping(true)}>Zutaten auf die Einkaufsliste</Button>}
                    {meal && <Button variant="destructive" full onClick={remove}>Entfernen</Button>}
                </Form>
            </Sheet>
            <AddToShopping open={shopping} onClose={() => setShopping(false)} recipe={recipe} />
        </>
    );
};

export default function Meals() {
    const { user } = useAuth();
    const [week, setWeek] = React.useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
    const end = addDays(week, 6);
    const { data: meals, setData, loading, error, reload } = useApi(`/meals?startDate=${ymd(week)}&endDate=${ymd(end)}`, { initial: [] });
    const canRecipes = user.role === 'admin' || user.permissions?.recipes !== false;
    const { data: recipes } = useApi(canRecipes ? '/recipes' : null, { initial: [], enabled: canRecipes });
    const [sheet, setSheet] = React.useState(null); // { slot } | { meal }
    const act = useAction();


    const vote = async (meal) => {
        setData(list => list.map(m => (m.id === meal.id ? { ...m, has_voted: !m.has_voted, vote_count: m.vote_count + (m.has_voted ? -1 : 1) } : m)));
        if (!(await act(() => api.post(`/meals/${meal.id}/vote`)))) reload();
    };

    const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
    const thisWeek = ymd(week) === ymd(startOfWeek(new Date(), { weekStartsOn: 1 }));

    return (
        <Page wide title="Essensplan" subtitle={`KW ${format(week, 'I')} · ${format(week, 'd. MMM', { locale: de })} – ${format(end, 'd. MMM', { locale: de })}`}
            actions={<>
                <IconButton icon="ri-arrow-left-s-line" label="Vorherige Woche" variant="gray" onClick={() => setWeek(w => addWeeks(w, -1))} />
                {!thisWeek && <Button size="sm" variant="gray" onClick={() => setWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))}>Heute</Button>}
                <IconButton icon="ri-arrow-right-s-line" label="Nächste Woche" variant="gray" onClick={() => setWeek(w => addWeeks(w, 1))} />
            </>}>
            {error && <ErrorNote error={error} onRetry={reload} />}
            {loading ? <Loading /> : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {days.map(d => {
                        const date = ymd(d);
                        const today = isToday(d);
                        return (
                            <section key={date} className={cx('overflow-hidden rounded-card bg-card', today && 'ring-2 ring-accent')}>
                                <header className="flex items-baseline justify-between px-4 pb-1 pt-3">
                                    <h2 className="text-headline font-semibold">{format(d, 'EEEE', { locale: de })}</h2>
                                    <span className={cx('text-footnote', today ? 'font-semibold text-accent' : 'text-label2')}>{today ? 'Heute' : format(d, 'd. MMM', { locale: de })}</span>
                                </header>
                                {MEAL_TYPES.map(t => {
                                    const slot = meals.filter(m => m.date === date && m.meal_type === t.id).sort((a, b) => b.vote_count - a.vote_count);
                                    return (
                                        <div key={t.id} className="flex gap-3 border-t hairline px-4 py-2.5 first-of-type:border-t-0">
                                            <i className={cx(t.icon, 'mt-0.5 text-[19px]')} style={{ color: t.color }} title={t.id}></i>
                                            <div className="min-w-0 flex-1 space-y-1.5">
                                                {slot.length === 0 && (
                                                    <button onClick={() => setSheet({ slot: { date, type: t.id } })} className="press w-full text-left text-sub text-label3">{t.id} planen</button>
                                                )}
                                                {slot.map((m, i) => (
                                                    <div key={m.id} className="flex items-center gap-2">
                                                        <button onClick={() => setSheet({ meal: m })} className="press min-w-0 flex-1 text-left">
                                                            <span className={cx('block truncate text-body', slot.length > 1 && i > 0 && 'text-label2')}>{m.recipe_name}</span>
                                                            {m.notes && <span className="block truncate text-footnote text-label2">{m.notes}</span>}
                                                        </button>
                                                        {slot.length > 1 && (
                                                            <button onClick={() => vote(m)} aria-label="Abstimmen" className={cx('press flex items-center gap-1 rounded-full px-2 py-0.5 text-footnote font-semibold', m.has_voted ? 'bg-danger/15 text-danger' : 'bg-fill/12 text-label2')}>
                                                                <i className={m.has_voted ? 'ri-heart-fill' : 'ri-heart-line'}></i>{m.vote_count}
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                            {slot.length > 0 && <IconButton icon="ri-add-line" label="Vorschlag hinzufügen" variant="plain" size={28} onClick={() => setSheet({ slot: { date, type: t.id, hasMeal: true } })} />}
                                        </div>
                                    );
                                })}
                            </section>
                        );
                    })}
                </div>
            )}
            <MealSheet open={!!sheet} onClose={() => setSheet(null)} slot={sheet?.slot} meal={sheet?.meal} recipes={recipes || []} onSaved={reload} />
        </Page>
    );
}
