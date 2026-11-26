'use strict';

const db = require('../db');
const { featureGuard } = require('../middleware/auth');
const { createRouter, HttpError, trimOrNull, toBoolInt, uuid } = require('../utils/http');

const router = createRouter();
router.use(featureGuard('vault'));

/**
 * Entries are encrypted in the browser – the server only stores ciphertext.
 * Visibility: shared entries are visible to the whole family, private entries
 * only to their creator. (The old version showed "private" entries to everyone.)
 * Legacy entries without an owner stay visible to the family.
 */
const VISIBLE = '(COALESCE(is_shared, 0) = 1 OR user_id IS NULL OR user_id = ?)';

const folderOfFamily = async (folderId, familyId) => {
    if (!folderId) return null;
    const f = await db.get('SELECT id FROM vault_folders WHERE id = ? AND family_id = ?', [folderId, familyId]);
    if (!f) throw new HttpError(400, 'Ordner nicht gefunden');
    return f.id;
};

// --- Folders ---
router.get('/folders', async (req, res) => {
    res.json(await db.all('SELECT id, name, created_at FROM vault_folders WHERE family_id = ? ORDER BY name COLLATE NOCASE', [req.user.family_id]));
});

router.post('/folders', async (req, res) => {
    const name = trimOrNull(req.body.name);
    if (!name) throw new HttpError(400, 'Ordnername fehlt');
    const id = uuid();
    await db.run('INSERT INTO vault_folders (id, family_id, name) VALUES (?, ?, ?)', [id, req.user.family_id, name]);
    res.json({ id, name });
});

router.post('/folders/find-or-create', async (req, res) => {
    const name = trimOrNull(req.body.name);
    if (!name) throw new HttpError(400, 'Ordnername fehlt');
    const existing = await db.get('SELECT id, name FROM vault_folders WHERE family_id = ? AND name = ? COLLATE NOCASE', [req.user.family_id, name]);
    if (existing) return res.json({ ...existing, existed: true });
    const id = uuid();
    await db.run('INSERT INTO vault_folders (id, family_id, name) VALUES (?, ?, ?)', [id, req.user.family_id, name]);
    res.json({ id, name, existed: false });
});

router.put('/folders/:id', async (req, res) => {
    const name = trimOrNull(req.body.name);
    if (!name) throw new HttpError(400, 'Ordnername fehlt');
    const { changes } = await db.run('UPDATE vault_folders SET name = ? WHERE id = ? AND family_id = ?', [name, req.params.id, req.user.family_id]);
    if (!changes) throw new HttpError(404, 'Ordner nicht gefunden');
    res.json({ message: 'Ordner aktualisiert' });
});

router.delete('/folders/:id', async (req, res) => {
    await db.run('UPDATE vault SET folder_id = NULL WHERE folder_id = ? AND family_id = ?', [req.params.id, req.user.family_id]);
    const { changes } = await db.run('DELETE FROM vault_folders WHERE id = ? AND family_id = ?', [req.params.id, req.user.family_id]);
    if (!changes) throw new HttpError(404, 'Ordner nicht gefunden');
    res.json({ message: 'Ordner gelöscht' });
});

// --- Entries ---
router.get('/', async (req, res) => {
    res.json(await db.all(
        `SELECT id, title, encrypted_data, folder_id, is_shared, user_id, updated_at FROM vault
         WHERE family_id = ? AND ${VISIBLE} ORDER BY title COLLATE NOCASE`,
        [req.user.family_id, req.user.id],
    ));
});

router.post('/', async (req, res) => {
    const title = trimOrNull(req.body.title);
    const data = req.body.encrypted_data;
    if (!title || !data || typeof data !== 'string') throw new HttpError(400, 'Titel und verschlüsselte Daten sind erforderlich');
    const folderId = await folderOfFamily(req.body.folder_id, req.user.family_id);
    const id = uuid();
    const shared = toBoolInt(req.body.is_shared);
    await db.run('INSERT INTO vault (id, family_id, user_id, folder_id, title, encrypted_data, is_shared) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, req.user.family_id, req.user.id, folderId, title, data, shared]);
    res.json({ id, title, folder_id: folderId, encrypted_data: data, is_shared: shared, user_id: req.user.id, updated_at: new Date().toISOString() });
});

router.put('/:id', async (req, res) => {
    const title = trimOrNull(req.body.title);
    const data = req.body.encrypted_data;
    if (!title || !data || typeof data !== 'string') throw new HttpError(400, 'Titel und verschlüsselte Daten sind erforderlich');
    const folderId = await folderOfFamily(req.body.folder_id, req.user.family_id);
    const { changes } = await db.run(
        `UPDATE vault SET title = ?, encrypted_data = ?, folder_id = ?, is_shared = ?, user_id = COALESCE(user_id, ?), updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND family_id = ? AND ${VISIBLE}`,
        [title, data, folderId, toBoolInt(req.body.is_shared), req.user.id, req.params.id, req.user.family_id, req.user.id],
    );
    if (!changes) throw new HttpError(404, 'Eintrag nicht gefunden');
    res.json({ message: 'Eintrag aktualisiert' });
});

router.delete('/:id', async (req, res) => {
    const { changes } = await db.run(`DELETE FROM vault WHERE id = ? AND family_id = ? AND ${VISIBLE}`, [req.params.id, req.user.family_id, req.user.id]);
    if (!changes) throw new HttpError(404, 'Eintrag nicht gefunden');
    res.json({ message: 'Eintrag gelöscht' });
});

module.exports = router;
