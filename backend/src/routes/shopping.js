'use strict';

const db = require('../db');
const { featureGuard } = require('../middleware/auth');
const { createRouter, HttpError, trimOrNull, toBoolInt } = require('../utils/http');

const router = createRouter();
router.use(featureGuard('shopping'));

const listOfFamily = async (listId, familyId) => {
    const list = await db.get('SELECT * FROM shopping_lists WHERE id = ? AND family_id = ?', [listId, familyId]);
    if (!list) throw new HttpError(404, 'Liste nicht gefunden');
    return list;
};

// --- Lists ---------------------------------------------------------------------

router.get('/lists', async (req, res) => {
    let rows = await db.all('SELECT * FROM shopping_lists WHERE family_id = ? ORDER BY id', [req.user.family_id]);
    if (rows.length === 0) {
        const { lastID } = await db.run('INSERT INTO shopping_lists (name, family_id) VALUES (?, ?)', ['Allgemein', req.user.family_id]);
        rows = [{ id: lastID, name: 'Allgemein', family_id: req.user.family_id }];
    }
    res.json(rows);
});

router.post('/lists', async (req, res) => {
    const name = trimOrNull(req.body.name);
    if (!name) throw new HttpError(400, 'Name fehlt');
    const { lastID } = await db.run('INSERT INTO shopping_lists (name, family_id) VALUES (?, ?)', [name, req.user.family_id]);
    res.json({ id: lastID, name, family_id: req.user.family_id });
});

router.put('/lists/:id', async (req, res) => {
    const name = trimOrNull(req.body.name);
    if (!name) throw new HttpError(400, 'Name fehlt');
    await listOfFamily(req.params.id, req.user.family_id);
    await db.run('UPDATE shopping_lists SET name = ? WHERE id = ?', [name, req.params.id]);
    res.json({ message: 'Liste umbenannt' });
});

router.delete('/lists/:id', async (req, res) => {
    await listOfFamily(req.params.id, req.user.family_id);
    await db.transaction(async (tx) => {
        await tx.run('DELETE FROM items WHERE list_id = ? AND family_id = ?', [req.params.id, req.user.family_id]);
        await tx.run('DELETE FROM shopping_lists WHERE id = ?', [req.params.id]);
    });
    res.json({ message: 'Liste gelöscht' });
});

// --- Items -----------------------------------------------------------------------

router.get('/', async (req, res) => {
    const params = [req.user.family_id];
    let sql = 'SELECT * FROM items WHERE family_id = ?';
    if (req.query.list_id) { sql += ' AND list_id = ?'; params.push(req.query.list_id); }
    sql += ' ORDER BY completed ASC, id DESC';
    res.json(await db.all(sql, params));
});

router.post('/', async (req, res) => {
    const name = trimOrNull(req.body.name);
    if (!name) throw new HttpError(400, 'Artikel fehlt');
    let listId = req.body.list_id;
    if (listId) {
        await listOfFamily(listId, req.user.family_id);
    } else {
        const first = await db.get('SELECT id FROM shopping_lists WHERE family_id = ? ORDER BY id LIMIT 1', [req.user.family_id]);
        if (!first) throw new HttpError(400, 'Keine Liste vorhanden');
        listId = first.id;
    }
    const category = trimOrNull(req.body.category);
    const { lastID } = await db.run('INSERT INTO items (name, completed, category, family_id, list_id) VALUES (?, 0, ?, ?, ?)', [name, category, req.user.family_id, listId]);
    res.json({ id: lastID, name, completed: 0, category, list_id: Number(listId) });
});

router.post('/bulk', async (req, res) => {
    const { items, list_id: listId } = req.body;
    if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'Artikel fehlen');
    if (!listId) throw new HttpError(400, 'list_id fehlt');
    await listOfFamily(listId, req.user.family_id);

    const clean = items
        .map(item => (typeof item === 'string' ? { name: item, category: 'Rezept' } : { name: item?.name, category: item?.category || 'Rezept' }))
        .map(i => ({ ...i, name: trimOrNull(i.name) }))
        .filter(i => i.name)
        .slice(0, 500);

    await db.transaction(async (tx) => {
        for (const item of clean) {
            await tx.run('INSERT INTO items (name, completed, category, family_id, list_id) VALUES (?, 0, ?, ?, ?)', [item.name, item.category, req.user.family_id, listId]);
        }
    });
    res.json({ message: `${clean.length} Artikel hinzugefügt` });
});

router.put('/:id', async (req, res) => {
    const { name, completed, category, list_id: listId } = req.body;
    if (listId !== undefined && listId !== null) await listOfFamily(listId, req.user.family_id);
    const { changes } = await db.run(
        `UPDATE items SET name = COALESCE(?, name), completed = COALESCE(?, completed), category = COALESCE(?, category), list_id = COALESCE(?, list_id)
         WHERE id = ? AND family_id = ?`,
        [trimOrNull(name), completed === undefined || completed === null ? null : toBoolInt(completed), category ?? null, listId ?? null, req.params.id, req.user.family_id],
    );
    if (!changes) throw new HttpError(404, 'Artikel nicht gefunden');
    res.json({ message: 'Artikel aktualisiert', changes });
});

router.delete('/:id', async (req, res) => {
    const { changes } = await db.run('DELETE FROM items WHERE id = ? AND family_id = ?', [req.params.id, req.user.family_id]);
    res.json({ message: 'Artikel gelöscht', changes });
});

module.exports = router;
