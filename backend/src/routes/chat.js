'use strict';

const db = require('../db');
const config = require('../config');
const push = require('../services/push');
const { makeUpload } = require('../services/uploads');
const { featureGuard } = require('../middleware/auth');
const { createRouter, HttpError, parseJSON, trimOrNull } = require('../utils/http');

const router = createRouter();
router.use(featureGuard('chat'));

const upload = makeUpload({ dir: config.uploadsDir, prefix: 'chat-', kind: 'image', maxMb: 15 });

const serialize = (m) => ({ ...m, poll_data: parseJSON(m.poll_data, null), reactions: m.reactions || '{}' });

const ensureChatAlbum = async (req) => {
    const existing = await db.get("SELECT id FROM albums WHERE name = 'Chat-Bilder' AND family_id = ?", [req.user.family_id]);
    if (existing) return existing.id;
    const { lastID } = await db.run("INSERT INTO albums (name, family_id, created_by) VALUES ('Chat-Bilder', ?, ?)", [req.user.family_id, req.user.id]);
    // Every family member may see chat pictures.
    await db.run('INSERT OR IGNORE INTO album_access (album_id, user_id) SELECT ?, id FROM users WHERE family_id = ?', [lastID, req.user.family_id]);
    return lastID;
};

// The most recent 200 messages, oldest first.
// (Bug in the old version: "ORDER BY created_at ASC LIMIT 100" returned the *oldest* 100 messages,
//  so once a family had more than 100 messages new ones were never displayed.)
router.get('/', async (req, res) => {
    const rows = await db.all(
        `SELECT * FROM (SELECT * FROM messages WHERE family_id = ? ORDER BY created_at DESC, id DESC LIMIT 200)
         ORDER BY created_at ASC, id ASC`,
        [req.user.family_id],
    );
    res.json(rows.map(serialize));
});

router.post('/', upload.single('image'), async (req, res) => {
    const content = trimOrNull(req.body.content) || '';
    const imageUrl = req.file ? req.file.filename : null;
    let pollData = null;
    if (req.body.poll_data) {
        const poll = parseJSON(req.body.poll_data, null);
        if (!poll || !Array.isArray(poll.options) || poll.options.length < 2) throw new HttpError(400, 'Ungültige Umfrage');
        pollData = JSON.stringify({ ...poll, options: poll.options.slice(0, 10).map(o => ({ ...o, votes: [] })) });
    }
    if (!content && !imageUrl && !pollData) throw new HttpError(400, 'Nachricht, Bild oder Umfrage erforderlich');

    const createdAt = new Date().toISOString();
    if (imageUrl) {
        const albumId = await ensureChatAlbum(req);
        await db.run('INSERT INTO photos (album_id, filename, original_name, uploaded_by) VALUES (?, ?, ?, ?)', [albumId, imageUrl, req.file.originalname, req.user.id]);
    }
    const { lastID } = await db.run(
        `INSERT INTO messages (family_id, user_id, user_name, content, created_at, image_url, poll_data, reactions)
         VALUES (?, ?, ?, ?, ?, ?, ?, '{}')`,
        [req.user.family_id, req.user.id, req.user.username, content, createdAt, imageUrl, pollData],
    );

    push.sendTemplated(req.user.family_id, 'chat', {
        title: `Neue Nachricht von ${req.user.username}`,
        body: content || (imageUrl ? '📷 Bild' : '📊 Umfrage'),
        sender: req.user.username,
        content,
        data: { url: '/chat' },
    }, { excludeUserId: req.user.id });

    res.json(serialize({
        id: lastID, family_id: req.user.family_id, user_id: req.user.id, user_name: req.user.username,
        content, image_url: imageUrl, created_at: createdAt, poll_data: pollData, reactions: '{}',
    }));
});

router.post('/:id/react', async (req, res) => {
    const emoji = trimOrNull(req.body.emoji);
    if (!emoji || emoji.length > 16) throw new HttpError(400, 'Emoji fehlt');
    const row = await db.get('SELECT reactions FROM messages WHERE id = ? AND family_id = ?', [req.params.id, req.user.family_id]);
    if (!row) throw new HttpError(404, 'Nachricht nicht gefunden');

    const reactions = parseJSON(row.reactions, {}) || {};
    const list = Array.isArray(reactions[emoji]) ? reactions[emoji] : [];
    reactions[emoji] = list.includes(req.user.id) ? list.filter(id => id !== req.user.id) : [...list, req.user.id];
    if (reactions[emoji].length === 0) delete reactions[emoji];

    const json = JSON.stringify(reactions);
    await db.run('UPDATE messages SET reactions = ? WHERE id = ?', [json, req.params.id]);
    res.json({ reactions: json });
});

router.post('/:id/vote', async (req, res) => {
    const index = Number(req.body.optionIndex);
    const row = await db.get('SELECT poll_data FROM messages WHERE id = ? AND family_id = ?', [req.params.id, req.user.family_id]);
    const poll = parseJSON(row?.poll_data, null);
    if (!poll || !Array.isArray(poll.options)) throw new HttpError(404, 'Umfrage nicht gefunden');
    if (!Number.isInteger(index) || !poll.options[index]) throw new HttpError(400, 'Ungültige Option');

    poll.options.forEach((opt) => { opt.votes = (opt.votes || []).filter(id => id !== req.user.id); });
    poll.options[index].votes.push(req.user.id);

    const json = JSON.stringify(poll);
    await db.run('UPDATE messages SET poll_data = ? WHERE id = ?', [json, req.params.id]);
    res.json({ poll_data: json });
});

router.delete('/:id', async (req, res) => {
    const msg = await db.get('SELECT user_id FROM messages WHERE id = ? AND family_id = ?', [req.params.id, req.user.family_id]);
    if (!msg) throw new HttpError(404, 'Nachricht nicht gefunden');
    if (msg.user_id !== req.user.id && req.user.role !== 'admin') throw new HttpError(403, 'Keine Berechtigung');
    await db.run('DELETE FROM messages WHERE id = ?', [req.params.id]);
    res.json({ success: true });
});

module.exports = router;
