'use strict';

const db = require('../db');
const { featureGuard } = require('../middleware/auth');
const { createRouter, HttpError, trimOrNull, uuid } = require('../utils/http');

const router = createRouter();
router.use(featureGuard('vacations'));

const vacationOfFamily = async (id, familyId) => {
    const v = await db.get('SELECT * FROM vacations WHERE id = ? AND family_id = ?', [id, familyId]);
    if (!v) throw new HttpError(404, 'Urlaub nicht gefunden');
    return v;
};

// --- Dream destinations (defined first so "/destinations" never collides with "/:id") ---
router.get('/destinations', async (req, res) => {
    res.json(await db.all(
        `SELECT d.*, COALESCE(u.username, 'Unbekannt') AS user_name FROM dream_destinations d
         LEFT JOIN users u ON d.user_id = u.id WHERE d.family_id = ? ORDER BY d.created_at DESC`,
        [req.user.family_id],
    ));
});

router.post('/destinations', async (req, res) => {
    const title = trimOrNull(req.body.title);
    if (!title) throw new HttpError(400, 'Titel fehlt');
    const id = uuid();
    const notes = trimOrNull(req.body.notes) || '';
    await db.run('INSERT INTO dream_destinations (id, family_id, user_id, title, notes) VALUES (?, ?, ?, ?, ?)', [id, req.user.family_id, req.user.id, title, notes]);
    res.json({ id, family_id: req.user.family_id, user_id: req.user.id, user_name: req.user.username, title, notes });
});

router.put('/destinations/:id', async (req, res) => {
    const title = trimOrNull(req.body.title);
    if (!title) throw new HttpError(400, 'Titel fehlt');
    const { changes } = await db.run('UPDATE dream_destinations SET title = ?, notes = ? WHERE id = ? AND family_id = ?', [title, trimOrNull(req.body.notes) || '', req.params.id, req.user.family_id]);
    if (!changes) throw new HttpError(404, 'Traumziel nicht gefunden');
    res.json({ message: 'Traumziel aktualisiert' });
});

router.delete('/destinations/:id', async (req, res) => {
    const { changes } = await db.run('DELETE FROM dream_destinations WHERE id = ? AND family_id = ?', [req.params.id, req.user.family_id]);
    if (!changes) throw new HttpError(404, 'Traumziel nicht gefunden');
    res.json({ message: 'Traumziel gelöscht' });
});

// --- Vacations ---
router.get('/', async (req, res) => {
    res.json(await db.all('SELECT * FROM vacations WHERE family_id = ? ORDER BY start_date ASC', [req.user.family_id]));
});

router.post('/', async (req, res) => {
    const title = trimOrNull(req.body.title);
    if (!title) throw new HttpError(400, 'Titel fehlt');
    const id = uuid();
    const v = { destination: trimOrNull(req.body.destination), start_date: trimOrNull(req.body.start_date), end_date: trimOrNull(req.body.end_date) };
    if (v.start_date && v.end_date && v.end_date < v.start_date) throw new HttpError(400, 'Das Ende liegt vor dem Beginn');
    await db.run('INSERT INTO vacations (id, family_id, title, destination, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)', [id, req.user.family_id, title, v.destination, v.start_date, v.end_date]);
    res.json({ id, family_id: req.user.family_id, title, ...v });
});

router.put('/:id', async (req, res) => {
    const vacation = await vacationOfFamily(req.params.id, req.user.family_id);
    const title = trimOrNull(req.body.title) || vacation.title;
    const start = req.body.start_date !== undefined ? trimOrNull(req.body.start_date) : vacation.start_date;
    const end = req.body.end_date !== undefined ? trimOrNull(req.body.end_date) : vacation.end_date;
    if (start && end && end < start) throw new HttpError(400, 'Das Ende liegt vor dem Beginn');
    const destination = req.body.destination !== undefined ? trimOrNull(req.body.destination) : vacation.destination;
    await db.run('UPDATE vacations SET title = ?, destination = ?, start_date = ?, end_date = ? WHERE id = ?', [title, destination, start, end, vacation.id]);
    res.json({ message: 'Urlaub aktualisiert' });
});

router.delete('/:id', async (req, res) => {
    const vacation = await vacationOfFamily(req.params.id, req.user.family_id);
    await db.run('DELETE FROM vacations WHERE id = ?', [vacation.id]);
    res.json({ message: 'Urlaub gelöscht' });
});

// --- Packing list ---
router.get('/:id/items', async (req, res) => {
    const vacation = await vacationOfFamily(req.params.id, req.user.family_id);
    res.json(await db.all('SELECT * FROM vacation_items WHERE vacation_id = ? ORDER BY category, created_at DESC', [vacation.id]));
});

router.post('/:id/items', async (req, res) => {
    const vacation = await vacationOfFamily(req.params.id, req.user.family_id);
    const title = trimOrNull(req.body.title);
    if (!title) throw new HttpError(400, 'Titel fehlt');
    const id = uuid();
    const category = trimOrNull(req.body.category) || 'Allgemein';
    await db.run('INSERT INTO vacation_items (id, vacation_id, title, category, is_packed) VALUES (?, ?, ?, ?, 0)', [id, vacation.id, title, category]);
    res.json({ id, vacation_id: vacation.id, title, category, is_packed: 0 });
});

router.put('/:id/items/:itemId/toggle', async (req, res) => {
    const vacation = await vacationOfFamily(req.params.id, req.user.family_id);
    const { changes } = await db.run('UPDATE vacation_items SET is_packed = CASE WHEN is_packed = 1 THEN 0 ELSE 1 END WHERE id = ? AND vacation_id = ?', [req.params.itemId, vacation.id]);
    if (!changes) throw new HttpError(404, 'Eintrag nicht gefunden');
    res.json({ message: 'Umgeschaltet' });
});

router.delete('/:id/items/:itemId', async (req, res) => {
    const vacation = await vacationOfFamily(req.params.id, req.user.family_id);
    await db.run('DELETE FROM vacation_items WHERE id = ? AND vacation_id = ?', [req.params.itemId, vacation.id]);
    res.json({ message: 'Eintrag gelöscht' });
});

module.exports = router;
