'use strict';

const db = require('../db');
const config = require('../config');
const push = require('../services/push');
const { makeUpload, safeUnlink, resolveUploadUrl } = require('../services/uploads');
const { featureGuard } = require('../middleware/auth');
const { createRouter, HttpError, parseJSON, trimOrNull, uuid, parseDbDate } = require('../utils/http');

const iso = (v) => { const d = parseDbDate(v); return d && !Number.isNaN(d.getTime()) ? d.toISOString() : v; };

const router = createRouter();
router.use(featureGuard('timeline'));

const upload = makeUpload({ dir: config.timelineDir, kind: 'image', maxMb: 15, nameFn: (req) => `post-${req.user.id}-${Date.now()}` });

const postOfFamily = async (id, familyId) => {
    const post = await db.get('SELECT * FROM timeline_posts WHERE id = ? AND family_id = ?', [id, familyId]);
    if (!post) throw new HttpError(404, 'Beitrag nicht gefunden');
    return post;
};

router.get('/', async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const posts = await db.all(
        `SELECT p.*, u.username, u.display_role, u.profile_picture,
                (SELECT COUNT(*) FROM timeline_comments c WHERE c.post_id = p.id) AS comment_count
         FROM timeline_posts p LEFT JOIN users u ON p.user_id = u.id
         WHERE p.family_id = ? ORDER BY p.created_at DESC, p.id DESC LIMIT ?`,
        [req.user.family_id, limit],
    );
    if (posts.length === 0) return res.json([]);
    const ids = posts.map(p => p.id);
    const reactions = await db.all(`SELECT * FROM timeline_reactions WHERE post_id IN (${db.placeholders(ids)})`, ids);
    res.json(posts.map(p => ({
        ...p,
        username: p.username || 'Unbekannt',
        created_at: iso(p.created_at),
        poll_data: parseJSON(p.poll_data, null),
        reactions: reactions.filter(r => r.post_id === p.id),
    })));
});

router.post('/', upload.single('image'), async (req, res) => {
    const type = req.body.type === 'poll' ? 'poll' : 'post';
    const content = trimOrNull(req.body.content);
    const mediaUrl = req.file ? `/uploads/timeline/${req.file.filename}` : null;

    let pollData = null;
    if (type === 'poll') {
        const poll = parseJSON(req.body.poll_data, null);
        if (!poll || !Array.isArray(poll.options) || poll.options.length < 2) throw new HttpError(400, 'Eine Umfrage braucht mindestens zwei Antworten');
        pollData = JSON.stringify({ ...poll, options: poll.options.slice(0, 10).map(o => ({ id: o.id || uuid(), text: String(o.text || '').slice(0, 200), votes: [] })) });
    }
    if (!content && !mediaUrl && !pollData) throw new HttpError(400, 'Der Beitrag ist leer');

    const { lastID } = await db.run(
        'INSERT INTO timeline_posts (family_id, user_id, type, content, media_url, poll_data) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user.family_id, req.user.id, type, content, mediaUrl, pollData],
    );
    push.sendTemplated(req.user.family_id, 'timeline', {
        title: `${req.user.username} hat etwas geteilt`,
        body: content ? content.slice(0, 120) : (type === 'poll' ? '📊 Neue Umfrage' : '📷 Neues Bild'),
        sender: req.user.username,
        data: { url: '/timeline' },
    }, { excludeUserId: req.user.id });
    res.json({ id: lastID, message: 'Beitrag erstellt' });
});

router.get('/:id/comments', async (req, res) => {
    const post = await postOfFamily(req.params.id, req.user.family_id);
    const rows = await db.all(
        `SELECT c.*, COALESCE(u.username, 'Unbekannt') AS username, u.profile_picture
         FROM timeline_comments c LEFT JOIN users u ON c.user_id = u.id
         WHERE c.post_id = ? ORDER BY c.created_at ASC, c.id ASC`,
        [post.id],
    );
    res.json(rows.map(c => ({ ...c, created_at: iso(c.created_at) })));
});

router.post('/:id/comments', async (req, res) => {
    const post = await postOfFamily(req.params.id, req.user.family_id);
    const content = trimOrNull(req.body.content);
    if (!content) throw new HttpError(400, 'Kommentar ist leer');
    const { lastID } = await db.run('INSERT INTO timeline_comments (post_id, user_id, content) VALUES (?, ?, ?)', [post.id, req.user.id, content.slice(0, 2000)]);
    res.json({ id: lastID, message: 'Kommentar hinzugefügt' });
});

router.delete('/:id/comments/:commentId', async (req, res) => {
    const post = await postOfFamily(req.params.id, req.user.family_id);
    const comment = await db.get('SELECT * FROM timeline_comments WHERE id = ? AND post_id = ?', [req.params.commentId, post.id]);
    if (!comment) throw new HttpError(404, 'Kommentar nicht gefunden');
    if (comment.user_id !== req.user.id && req.user.role !== 'admin') throw new HttpError(403, 'Keine Berechtigung');
    await db.run('DELETE FROM timeline_comments WHERE id = ?', [comment.id]);
    res.json({ success: true });
});

router.post('/:id/react', async (req, res) => {
    const post = await postOfFamily(req.params.id, req.user.family_id);
    const reaction = trimOrNull(req.body.reaction) || 'like';
    if (reaction.length > 16) throw new HttpError(400, 'Ungültige Reaktion');
    const existing = await db.get('SELECT id FROM timeline_reactions WHERE post_id = ? AND user_id = ? AND reaction = ?', [post.id, req.user.id, reaction]);
    if (existing) {
        await db.run('DELETE FROM timeline_reactions WHERE id = ?', [existing.id]);
        return res.json({ message: 'Reaktion entfernt', active: false });
    }
    await db.run('INSERT OR IGNORE INTO timeline_reactions (post_id, user_id, reaction) VALUES (?, ?, ?)', [post.id, req.user.id, reaction]);
    res.json({ message: 'Reaktion hinzugefügt', active: true });
});

router.post('/:id/vote', async (req, res) => {
    const post = await postOfFamily(req.params.id, req.user.family_id);
    const poll = parseJSON(post.poll_data, null);
    if (!poll || !Array.isArray(poll.options)) throw new HttpError(400, 'Keine Umfrage');
    const option = poll.options.find(o => String(o.id) === String(req.body.optionId));
    if (!option) throw new HttpError(400, 'Ungültige Option');
    poll.options.forEach((o) => { o.votes = (o.votes || []).filter(uid => uid !== req.user.id); });
    option.votes.push(req.user.id);
    await db.run('UPDATE timeline_posts SET poll_data = ? WHERE id = ?', [JSON.stringify(poll), post.id]);
    res.json({ message: 'Stimme gezählt', poll_data: poll });
});

router.delete('/:id', async (req, res) => {
    const post = await postOfFamily(req.params.id, req.user.family_id);
    if (post.user_id !== req.user.id && req.user.role !== 'admin') throw new HttpError(403, 'Keine Berechtigung');
    await db.run('DELETE FROM timeline_posts WHERE id = ?', [post.id]);
    if (post.media_url) safeUnlink(resolveUploadUrl(post.media_url));
    res.json({ message: 'Beitrag gelöscht' });
});

module.exports = router;
