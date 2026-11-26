'use strict';

const db = require('../db');
const push = require('../services/push');
const { requireAuth, requireFamily, requireAdmin } = require('../middleware/auth');
const { createRouter, HttpError, trimOrNull } = require('../utils/http');

const router = createRouter();

// Public key for the browser – read at runtime, so the frontend no longer has to be
// rebuilt when the keys change (the old build baked in a demo key that never matched).
router.get('/vapid-public-key', (req, res) => res.json({ publicKey: push.publicKey || null, enabled: push.enabled }));

router.use(requireAuth);

router.post('/subscribe', async (req, res) => {
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) throw new HttpError(400, 'Ungültiges Abonnement');
    if (!/^https:\/\//.test(endpoint)) throw new HttpError(400, 'Ungültiger Endpunkt');
    await db.run(
        `INSERT INTO subscriptions (endpoint, p256dh, auth, user_id, family_id) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, user_id = excluded.user_id, family_id = excluded.family_id`,
        [endpoint, keys.p256dh, keys.auth, req.user.id, req.user.family_id],
    );
    res.status(201).json({ message: 'Abonniert' });
});

router.delete('/subscribe', async (req, res) => {
    const endpoint = req.body?.endpoint;
    if (!endpoint) throw new HttpError(400, 'endpoint fehlt');
    const { changes } = await db.run('DELETE FROM subscriptions WHERE endpoint = ? AND user_id = ?', [endpoint, req.user.id]);
    res.json({ message: 'Abo entfernt', deleted: changes });
});

router.post('/test', async (req, res) => {
    if (!push.enabled) throw new HttpError(400, 'Push ist auf dem Server nicht eingerichtet (VAPID-Schlüssel fehlen).');
    const sent = await push.sendToUser(req.user.id, {
        title: 'Test-Benachrichtigung',
        body: 'Toll! Deine Push-Benachrichtigungen funktionieren.',
        icon: '/icon-192x192.png',
    });
    if (!sent) throw new HttpError(400, 'Kein aktives Gerät gefunden. Bitte Push auf diesem Gerät erneut aktivieren.');
    res.json({ message: 'Test gesendet', sent });
});

// --- Templates (family admins) ---
const admin = [requireFamily, requireAdmin];

router.get('/templates', ...admin, async (req, res) => {
    res.json(await db.all('SELECT * FROM push_configs WHERE family_id = ?', [req.user.family_id]));
});

router.post('/templates', ...admin, async (req, res) => {
    const type = trimOrNull(req.body.type);
    if (!type) throw new HttpError(400, 'Typ fehlt');
    const { title_template: title, body_template: body, icon, badge } = req.body;
    await db.run(
        `INSERT INTO push_configs (family_id, type, title_template, body_template, icon, badge) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(family_id, type) DO UPDATE SET title_template = excluded.title_template, body_template = excluded.body_template, icon = excluded.icon, badge = excluded.badge`,
        [req.user.family_id, type, trimOrNull(title), trimOrNull(body), trimOrNull(icon), trimOrNull(badge)],
    );
    res.json({ success: true });
});

router.post('/test-custom', ...admin, async (req, res) => {
    if (!push.enabled) throw new HttpError(400, 'Push ist auf dem Server nicht eingerichtet (VAPID-Schlüssel fehlen).');
    const { cnt } = await db.get('SELECT COUNT(*) AS cnt FROM subscriptions s JOIN users u ON u.id = s.user_id WHERE u.family_id = ?', [req.user.family_id]);
    if (!cnt) throw new HttpError(400, 'Keine Abonnenten gefunden. Bitte zuerst auf einem Gerät Push-Benachrichtigungen aktivieren.');
    const sent = await push.sendToFamily(req.user.family_id, {
        title: trimOrNull(req.body.title) || 'Test-Push',
        body: trimOrNull(req.body.body) || 'Dies ist eine Testnachricht.',
        icon: trimOrNull(req.body.icon) || '/icon-192x192.png',
        badge: trimOrNull(req.body.badge) || '/icon-192x192.png',
    });
    res.json({ success: true, sent_to: sent });
});

module.exports = router;
