'use strict';

const db = require('../db');
const { featureGuard } = require('../middleware/auth');
const { createRouter, HttpError, trimOrNull, uuid } = require('../utils/http');

const router = createRouter();
router.use(featureGuard('recipes'));

const asText = (v) => (v === undefined || v === null ? null : (typeof v === 'string' ? v : JSON.stringify(v)));

const folderOfFamily = async (folderId, familyId) => {
    if (!folderId) return null;
    const folder = await db.get('SELECT id FROM recipe_folders WHERE id = ? AND family_id = ?', [folderId, familyId]);
    if (!folder) throw new HttpError(400, 'Ordner nicht gefunden');
    return folder.id;
};

// --- Folders ---
router.get('/folders', async (req, res) => {
    res.json(await db.all('SELECT id, name, created_at FROM recipe_folders WHERE family_id = ? ORDER BY name COLLATE NOCASE', [req.user.family_id]));
});

router.post('/folders', async (req, res) => {
    const name = trimOrNull(req.body.name);
    if (!name) throw new HttpError(400, 'Ordnername fehlt');
    const id = uuid();
    await db.run('INSERT INTO recipe_folders (id, family_id, name) VALUES (?, ?, ?)', [id, req.user.family_id, name]);
    res.json({ id, name });
});

router.put('/folders/:id', async (req, res) => {
    const name = trimOrNull(req.body.name);
    if (!name) throw new HttpError(400, 'Ordnername fehlt');
    const { changes } = await db.run('UPDATE recipe_folders SET name = ? WHERE id = ? AND family_id = ?', [name, req.params.id, req.user.family_id]);
    if (!changes) throw new HttpError(404, 'Ordner nicht gefunden');
    res.json({ message: 'Ordner aktualisiert' });
});

router.delete('/folders/:id', async (req, res) => {
    await db.run('UPDATE recipes SET folder_id = NULL WHERE folder_id = ? AND family_id = ?', [req.params.id, req.user.family_id]);
    const { changes } = await db.run('DELETE FROM recipe_folders WHERE id = ? AND family_id = ?', [req.params.id, req.user.family_id]);
    if (!changes) throw new HttpError(404, 'Ordner nicht gefunden');
    res.json({ message: 'Ordner gelöscht' });
});

// --- Recipes ---
router.get('/', async (req, res) => {
    // LEFT JOIN: recipes of deleted users used to disappear completely.
    res.json(await db.all(
        `SELECT r.*, COALESCE(u.username, 'Unbekannt') AS creator_name
         FROM recipes r LEFT JOIN users u ON r.created_by = u.id
         WHERE r.family_id = ? ORDER BY r.created_at DESC`,
        [req.user.family_id],
    ));
});

router.post('/', async (req, res) => {
    const title = trimOrNull(req.body.title);
    if (!title) throw new HttpError(400, 'Titel fehlt');
    const folderId = await folderOfFamily(req.body.folder_id, req.user.family_id);
    const ingredients = asText(req.body.ingredients);
    const instructions = asText(req.body.instructions);
    const { lastID } = await db.run(
        'INSERT INTO recipes (family_id, folder_id, title, ingredients, instructions, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user.family_id, folderId, title, ingredients, instructions, req.user.id],
    );
    res.json({ id: lastID, family_id: req.user.family_id, folder_id: folderId, title, ingredients, instructions, created_by: req.user.id, creator_name: req.user.username, created_at: new Date().toISOString() });
});

router.put('/:id', async (req, res) => {
    const title = trimOrNull(req.body.title);
    if (!title) throw new HttpError(400, 'Titel fehlt');
    const folderId = await folderOfFamily(req.body.folder_id, req.user.family_id);
    const ingredients = asText(req.body.ingredients);
    const instructions = asText(req.body.instructions);
    const { changes } = await db.run(
        'UPDATE recipes SET title = ?, ingredients = ?, instructions = ?, folder_id = ? WHERE id = ? AND family_id = ?',
        [title, ingredients, instructions, folderId, req.params.id, req.user.family_id],
    );
    if (!changes) throw new HttpError(404, 'Rezept nicht gefunden');
    res.json({ id: req.params.id, title, ingredients, instructions, folder_id: folderId });
});

router.delete('/:id', async (req, res) => {
    const { changes } = await db.run('DELETE FROM recipes WHERE id = ? AND family_id = ?', [req.params.id, req.user.family_id]);
    if (!changes) throw new HttpError(404, 'Rezept nicht gefunden');
    res.json({ success: true });
});

module.exports = router;
