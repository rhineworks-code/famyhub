'use strict';

const path = require('path');
const db = require('../db');
const config = require('../config');
const push = require('../services/push');
const { makeUpload, safeUnlink } = require('../services/uploads');
const { featureGuard } = require('../middleware/auth');
const { createRouter, HttpError, trimOrNull } = require('../utils/http');

const router = createRouter();
router.use(featureGuard('gallery'));

const upload = makeUpload({ dir: config.uploadsDir, kind: 'image', maxMb: 25 });

/** Album the current user may see (creator, explicit access, or admin of the family). */
const accessibleAlbum = async (req, albumId) => {
    const album = await db.get(
        `SELECT a.* FROM albums a
         WHERE a.id = ? AND a.family_id = ?
           AND (a.created_by = ? OR ? = 'admin' OR EXISTS (SELECT 1 FROM album_access aa WHERE aa.album_id = a.id AND aa.user_id = ?))`,
        [albumId, req.user.family_id, req.user.id, req.user.role, req.user.id],
    );
    if (!album) throw new HttpError(403, 'Kein Zugriff oder Album nicht gefunden');
    return album;
};

router.get('/albums', async (req, res) => {
    const rows = await db.all(
        `SELECT a.*, COALESCE(u.username, 'Unbekannt') AS creator_name,
                (SELECT COUNT(*) FROM photos WHERE album_id = a.id) AS photo_count,
                (SELECT filename FROM photos WHERE album_id = a.id ORDER BY created_at DESC, id DESC LIMIT 1) AS cover_photo
         FROM albums a
         LEFT JOIN users u ON a.created_by = u.id
         WHERE a.family_id = ?
           AND (a.created_by = ? OR ? = 'admin' OR EXISTS (SELECT 1 FROM album_access aa WHERE aa.album_id = a.id AND aa.user_id = ?))
         ORDER BY a.created_at DESC`,
        [req.user.family_id, req.user.id, req.user.role, req.user.id],
    );
    res.json(rows);
});

router.post('/albums', async (req, res) => {
    const name = trimOrNull(req.body.name);
    if (!name) throw new HttpError(400, 'Name fehlt');
    const { lastID } = await db.run('INSERT INTO albums (name, family_id, created_by) VALUES (?, ?, ?)', [name, req.user.family_id, req.user.id]);
    await db.run('INSERT OR IGNORE INTO album_access (album_id, user_id) VALUES (?, ?)', [lastID, req.user.id]);
    res.json({ id: lastID, name, family_id: req.user.family_id, created_by: req.user.id });
});

router.get('/albums/:id', async (req, res) => {
    const album = await accessibleAlbum(req, req.params.id);
    const photos = await db.all('SELECT * FROM photos WHERE album_id = ? ORDER BY created_at DESC, id DESC', [album.id]);
    const access = await db.all('SELECT user_id FROM album_access WHERE album_id = ?', [album.id]);
    res.json({ album: { ...album, access_user_ids: access.map(a => a.user_id) }, photos });
});

router.put('/albums/:id', async (req, res) => {
    const album = await accessibleAlbum(req, req.params.id);
    if (album.created_by !== req.user.id && req.user.role !== 'admin') throw new HttpError(403, 'Nur der Ersteller kann das Album umbenennen');
    const name = trimOrNull(req.body.name);
    if (!name) throw new HttpError(400, 'Name fehlt');
    await db.run('UPDATE albums SET name = ? WHERE id = ?', [name, album.id]);
    res.json({ success: true });
});

router.delete('/albums/:id', async (req, res) => {
    const album = await accessibleAlbum(req, req.params.id);
    if (album.created_by !== req.user.id && req.user.role !== 'admin') throw new HttpError(403, 'Nur der Ersteller kann das Album löschen');
    const photos = await db.all('SELECT filename FROM photos WHERE album_id = ?', [album.id]);
    await db.run('DELETE FROM albums WHERE id = ?', [album.id]);
    for (const p of photos) {
        const stillUsed = await db.get('SELECT 1 FROM messages WHERE image_url = ? LIMIT 1', [p.filename]);
        if (!stillUsed) safeUnlink(path.join(config.uploadsDir, path.basename(p.filename)));
    }
    res.json({ success: true });
});

router.post('/albums/:id/upload', upload.array('photos', 30), async (req, res) => {
    const files = req.files || [];
    try {
        if (files.length === 0) throw new HttpError(400, 'Keine Dateien hochgeladen');
        const album = await accessibleAlbum(req, req.params.id);
        const results = [];
        await db.transaction(async (tx) => {
            for (const file of files) {
                const { lastID } = await tx.run('INSERT INTO photos (album_id, filename, original_name, uploaded_by) VALUES (?, ?, ?, ?)', [album.id, file.filename, file.originalname, req.user.id]);
                results.push({ id: lastID, filename: file.filename, original_name: file.originalname, created_at: new Date().toISOString() });
            }
        });
        push.sendTemplated(req.user.family_id, 'gallery', {
            title: 'Neue Fotos in der Galerie',
            body: `${req.user.username} hat ${files.length === 1 ? 'ein Foto' : `${files.length} Fotos`} zu „${album.name}“ hinzugefügt.`,
            sender: req.user.username,
            album: album.name,
            data: { url: '/gallery' },
        }, { excludeUserId: req.user.id });
        res.json(results);
    } catch (err) {
        files.forEach(f => safeUnlink(f.path));
        throw err;
    }
});

router.post('/albums/:id/access', async (req, res) => {
    const album = await accessibleAlbum(req, req.params.id);
    if (album.created_by !== req.user.id && req.user.role !== 'admin') throw new HttpError(403, 'Nur der Ersteller kann Zugriff vergeben');
    const member = await db.get('SELECT id FROM users WHERE id = ? AND family_id = ?', [req.body.user_id, req.user.family_id]);
    if (!member) throw new HttpError(404, 'Mitglied nicht gefunden');
    await db.run('INSERT OR IGNORE INTO album_access (album_id, user_id) VALUES (?, ?)', [album.id, member.id]);
    res.json({ success: true });
});

router.delete('/albums/:id/access/:userId', async (req, res) => {
    const album = await accessibleAlbum(req, req.params.id);
    if (album.created_by !== req.user.id && req.user.role !== 'admin') throw new HttpError(403, 'Nur der Ersteller kann Zugriff entziehen');
    await db.run('DELETE FROM album_access WHERE album_id = ? AND user_id = ?', [album.id, req.params.userId]);
    res.json({ success: true });
});

router.delete('/photos/:id', async (req, res) => {
    const photo = await db.get(
        `SELECT p.*, a.created_by AS album_owner FROM photos p JOIN albums a ON a.id = p.album_id
         WHERE p.id = ? AND a.family_id = ?`,
        [req.params.id, req.user.family_id],
    );
    if (!photo) throw new HttpError(404, 'Foto nicht gefunden');
    if (photo.uploaded_by !== req.user.id && photo.album_owner !== req.user.id && req.user.role !== 'admin') throw new HttpError(403, 'Keine Berechtigung');

    await db.run('DELETE FROM photos WHERE id = ?', [photo.id]);
    const stillUsed = await db.get('SELECT 1 FROM messages WHERE image_url = ? UNION SELECT 1 FROM photos WHERE filename = ? LIMIT 1', [photo.filename, photo.filename]);
    if (!stillUsed) safeUnlink(path.join(config.uploadsDir, path.basename(photo.filename)));
    res.json({ success: true });
});

module.exports = router;
