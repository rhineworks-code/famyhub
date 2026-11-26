/** Ingredients are stored as JSON [{name, amount}] – older entries as plain lines. */
export const parseIngredients = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map(i => (typeof i === 'string' ? { name: i, amount: '' } : { name: i.name || '', amount: i.amount || '' }));
    } catch { /* plain text */ }
    return String(raw).split('\n').map(l => l.trim()).filter(Boolean).map(name => ({ name, amount: '' }));
};

export const ingredientLabel = (i) => `${i.amount ? `${i.amount} ` : ''}${i.name}`.trim();
