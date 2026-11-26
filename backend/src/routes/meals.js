'use strict';

const db = require('../db');
const { featureGuard } = require('../middleware/auth');
const { createRouter, HttpError, trimOrNull } = require('../utils/http');

const router = createRouter();
router.use(featureGuard('meals'));

const day = (value) => {
    const s = String(value || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new HttpError(400, 'Ungültiges Datum');
    return s;
};

router.get('/', async (req, res) => {
    const start = day(req.query.startDate || req.query.start);
    const end = day(req.query.endDate || req.query.end);
    const rows = await db.all(
        `SELECT m.*,
                (SELECT COUNT(*) FROM meal_votes v WHERE v.meal_id = m.id) AS vote_count,
                (SELECT 1 FROM meal_votes v WHERE v.meal_id = m.id AND v.user_id = ?) AS has_voted
         FROM meals m
         WHERE m.family_id = ? AND m.date BETWEEN ? AND ?
         ORDER BY m.date ASC, m.meal_type ASC, vote_count DESC`,
        [req.user.id, req.user.family_id, start, end],
    );
    res.json(rows.map(r => ({ ...r, has_voted: !!r.has_voted, meal_date: r.date, meal_name: r.recipe_name })));
});

router.post('/', async (req, res) => {
    const date = day(req.body.date || req.body.meal_date);
    const mealType = trimOrNull(req.body.meal_type);
    const name = trimOrNull(req.body.recipe_name || req.body.meal_name);
    const notes = trimOrNull(req.body.notes) || '';
    if (!mealType || !name) throw new HttpError(400, 'Pflichtfelder fehlen');

    if (!req.body.forceAdd) {
        const existing = await db.get('SELECT id FROM meals WHERE family_id = ? AND date = ? AND meal_type = ?', [req.user.family_id, date, mealType]);
        if (existing) {
            await db.run('UPDATE meals SET recipe_name = ?, notes = ? WHERE id = ?', [name, notes, existing.id]);
            return res.json({ id: existing.id, date, meal_type: mealType, recipe_name: name, notes });
        }
    }
    const { lastID } = await db.run(
        'INSERT INTO meals (family_id, date, meal_type, recipe_name, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user.family_id, date, mealType, name, notes, req.user.id],
    );
    res.json({ id: lastID, date, meal_type: mealType, recipe_name: name, notes });
});

router.patch('/:id/move', async (req, res) => {
    const date = day(req.body.date);
    const mealType = trimOrNull(req.body.meal_type);
    if (!mealType) throw new HttpError(400, 'Ziel-Datum und Typ erforderlich');
    const { changes } = await db.run('UPDATE meals SET date = ?, meal_type = ? WHERE id = ? AND family_id = ?', [date, mealType, req.params.id, req.user.family_id]);
    if (!changes) throw new HttpError(404, 'Mahlzeit nicht gefunden');
    res.json({ success: true });
});

router.post('/:id/vote', async (req, res) => {
    const meal = await db.get('SELECT id FROM meals WHERE id = ? AND family_id = ?', [req.params.id, req.user.family_id]);
    if (!meal) throw new HttpError(404, 'Mahlzeit nicht gefunden');
    const existing = await db.get('SELECT id FROM meal_votes WHERE meal_id = ? AND user_id = ?', [meal.id, req.user.id]);
    if (existing) {
        await db.run('DELETE FROM meal_votes WHERE id = ?', [existing.id]);
        return res.json({ voted: false });
    }
    await db.run('INSERT OR IGNORE INTO meal_votes (meal_id, user_id, family_id) VALUES (?, ?, ?)', [meal.id, req.user.id, req.user.family_id]);
    res.json({ voted: true });
});

router.put('/:id', async (req, res) => {
    const name = trimOrNull(req.body.recipe_name ?? req.body.meal_name);
    if (!name) throw new HttpError(400, 'Name der Mahlzeit fehlt');
    const notes = trimOrNull(req.body.notes) || '';
    const { changes } = await db.run('UPDATE meals SET recipe_name = ?, notes = ? WHERE id = ? AND family_id = ?', [name, notes, req.params.id, req.user.family_id]);
    if (!changes) throw new HttpError(404, 'Mahlzeit nicht gefunden');
    res.json({ success: true, id: req.params.id, recipe_name: name, notes });
});

router.delete('/:id', async (req, res) => {
    await db.run('DELETE FROM meals WHERE id = ? AND family_id = ?', [req.params.id, req.user.family_id]);
    res.json({ success: true });
});

module.exports = router;
