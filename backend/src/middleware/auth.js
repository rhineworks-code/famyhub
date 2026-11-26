'use strict';

const db = require('../db');
const users = require('../services/users');

const COOKIE_NAME = 'fh_token';

const readCookie = (req, name) => {
    const header = req.headers.cookie;
    if (!header) return null;
    for (const part of header.split(';')) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
    }
    return null;
};

/**
 * Token sources, in order: Authorization header, session cookie, ?token= query (legacy links).
 * The cookie only exists so that <img>/<iframe>/download links can load protected files.
 * It is therefore accepted for read-only requests only – state-changing requests always
 * need the Authorization header, which makes CSRF attacks impossible.
 */
const extractToken = (req, { allowQuery = false } = {}) => {
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) return header.slice(7).trim();
    const readOnly = req.method === 'GET' || req.method === 'HEAD';
    const cookie = readOnly ? readCookie(req, COOKIE_NAME) : null;
    if (cookie) return cookie;
    if (allowQuery && typeof req.query.token === 'string') return req.query.token;
    return null;
};

const loadUserFromToken = async (token) => {
    if (!token) return null;
    let payload;
    try { payload = users.verifyToken(token, 'session'); } catch (_) { return null; }
    const row = await db.get('SELECT * FROM users WHERE id = ?', [payload.sub]);
    if (!row) return null;
    if ((row.token_version || 0) !== (payload.tv || 0)) return null; // password changed / logged out everywhere
    return row;
};

const touchLastActive = (req, row) => {
    const cache = req.app.locals.lastActive || (req.app.locals.lastActive = new Map());
    const now = Date.now();
    if (now - (cache.get(row.id) || 0) < 60_000) return;
    cache.set(row.id, now);
    db.run('UPDATE users SET last_active = ? WHERE id = ?', [new Date(now).toISOString(), row.id]).catch(() => {});
};

/**
 * Builds req.user from the database on every request – roles, family
 * membership and permissions are therefore always current (the old code
 * trusted whatever was baked into a long-lived token).
 */
const attachUser = (row) => ({
    id: row.id,
    username: row.username,
    name: row.name || row.username,
    email: row.email,
    family_id: row.family_id,
    role: users.isAdminRow(row) ? 'admin' : (row.role || 'member'),
    is_admin: users.isAdminRow(row) ? 1 : 0,
    _row: row,
});

const authenticate = (options = {}) => async (req, res, next) => {
    try {
        const row = await loadUserFromToken(extractToken(req, options));
        if (!row) return res.status(401).json({ error: 'Nicht angemeldet' });
        req.user = attachUser(row);
        touchLastActive(req, row);
        next();
    } catch (err) {
        next(err);
    }
};

const requireAuth = authenticate();

const requireFamily = (req, res, next) => {
    if (!req.user?.family_id) return res.status(403).json({ error: 'Keine Familienzugehörigkeit' });
    next();
};

const requireAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Nur für Administratoren' });
    next();
};

const requireSystemAdmin = async (req, res, next) => {
    try {
        if (!(await users.isSystemAdmin(req.user._row))) {
            return res.status(403).json({ error: 'Nur der System-Administrator darf das.' });
        }
        next();
    } catch (err) { next(err); }
};

/** Blocks a module for users whose permission for it was switched off by an admin. */
const requireFeature = (feature) => async (req, res, next) => {
    try {
        if (!(await users.hasFeature(req.user._row, feature))) {
            return res.status(403).json({ error: 'Dieses Modul ist für dich deaktiviert.' });
        }
        next();
    } catch (err) { next(err); }
};

/** Standard stack for a feature router. */
const featureGuard = (feature) => [requireAuth, requireFamily, requireFeature(feature)];

module.exports = {
    COOKIE_NAME, extractToken, loadUserFromToken, authenticate, requireAuth, requireFamily, requireAdmin,
    requireSystemAdmin, requireFeature, featureGuard, attachUser,
};
