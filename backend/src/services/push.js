'use strict';

const webpush = require('web-push');
const db = require('../db');
const config = require('../config');
const { parseJSON } = require('../utils/http');

const enabled = !!(config.vapid.publicKey && config.vapid.privateKey);

if (enabled) {
    try {
        webpush.setVapidDetails(config.vapid.subject, config.vapid.publicKey, config.vapid.privateKey);
    } catch (err) {
        console.error('[push] Ungültige VAPID-Schlüssel:', err.message);
    }
} else {
    console.warn('[push] Keine VAPID-Schlüssel konfiguriert – Push-Benachrichtigungen sind deaktiviert.');
}

const sendOne = async (sub, payload) => {
    try {
        await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify(payload),
            { TTL: 60 * 60 * 12 },
        );
        return true;
    } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
            await db.run('DELETE FROM subscriptions WHERE endpoint = ?', [sub.endpoint]).catch(() => {});
        } else {
            console.warn('[push] Senden fehlgeschlagen:', err.statusCode || '', err.body || err.message);
        }
        return false;
    }
};

/**
 * Sends to all devices of a family. Respects per-user opt-outs
 * (`notify_<type>: false` inside users.permissions).
 */
const sendToFamily = async (familyId, payload, { excludeUserId = null, notificationType = null } = {}) => {
    if (!enabled) return 0;
    const params = [familyId];
    let sql = `SELECT s.*, u.permissions FROM subscriptions s
               JOIN users u ON s.user_id = u.id
               WHERE u.family_id = ?`;
    if (excludeUserId) { sql += ' AND s.user_id != ?'; params.push(excludeUserId); }
    const subs = await db.all(sql, params);

    const results = await Promise.all(subs.map((sub) => {
        if (notificationType) {
            const perms = parseJSON(sub.permissions, {}) || {};
            if (perms[`notify_${notificationType}`] === false) return false;
        }
        return sendOne(sub, payload);
    }));
    return results.filter(Boolean).length;
};

const sendToUser = async (userId, payload) => {
    if (!enabled) return 0;
    const subs = await db.all('SELECT * FROM subscriptions WHERE user_id = ?', [userId]);
    const results = await Promise.all(subs.map(sub => sendOne(sub, payload)));
    return results.filter(Boolean).length;
};

const fill = (template, data) => String(template || '').replace(/\{(\w+)\}/g, (m, key) => (data[key] !== undefined && data[key] !== null ? String(data[key]) : m));

/** Uses the family's custom template for `type` if there is one. Never throws. */
const sendTemplated = async (familyId, type, data = {}, options = {}) => {
    try {
        if (!enabled) return 0;
        const tpl = await db.get('SELECT * FROM push_configs WHERE family_id = ? AND type = ?', [familyId, type]);
        const payload = {
            title: fill(tpl?.title_template || data.title || 'FamyHub', data),
            body: fill(tpl?.body_template || data.body || '', data),
            icon: tpl?.icon || data.icon || '/icon-192x192.png',
            badge: tpl?.badge || data.badge || '/icon-192x192.png',
            data: data.data || {},
        };
        return await sendToFamily(familyId, payload, { notificationType: type, ...options });
    } catch (err) {
        console.warn('[push] Template-Versand fehlgeschlagen:', err.message);
        return 0;
    }
};

module.exports = { enabled, publicKey: config.vapid.publicKey, sendToFamily, sendToUser, sendTemplated };
