'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const config = require('../config');
const { parseJSON } = require('../utils/http');

const FEATURES = [
    'calendar', 'shopping', 'meals', 'documents', 'wishlist', 'contracts', 'gallery', 'vacations', 'chat',
    'contacts', 'projects', 'vault', 'recipes', 'pocket_money', 'chores', 'timeline',
];

const BCRYPT_ROUNDS = 12;

const hashPassword = (plain) => bcrypt.hash(String(plain), BCRYPT_ROUNDS);
const verifyPassword = async (plain, hash) => {
    if (!hash || plain === undefined || plain === null) return false;
    try { return await bcrypt.compare(String(plain), hash); } catch (_) { return false; }
};

const validatePassword = (pw) => {
    if (typeof pw !== 'string' || pw.length < 6) return 'Das Passwort muss mindestens 6 Zeichen lang sein.';
    if (pw.length > 200) return 'Das Passwort ist zu lang.';
    return null;
};

const isAdminRow = (row) => !!row && (row.role === 'admin' || row.is_admin === 1);

/**
 * Effective permissions of a user. Historically there were two stores:
 * the `user_permissions` table (written on user creation) and the
 * `users.permissions` JSON (written by the settings page). The JSON wins.
 * Keys not mentioned are treated as enabled.
 */
const getPermissions = async (userRow) => {
    const result = {};
    const rows = await db.all('SELECT feature_name, is_enabled FROM user_permissions WHERE user_id = ?', [userRow.id]);
    for (const r of rows) result[r.feature_name] = !!r.is_enabled;
    const json = parseJSON(userRow.permissions, {}) || {};
    for (const [k, v] of Object.entries(json)) result[k] = v !== false;
    for (const f of FEATURES) if (result[f] === undefined) result[f] = true;
    return result;
};

const hasFeature = async (userRow, feature) => {
    if (!feature || isAdminRow(userRow)) return true;
    const perms = await getPermissions(userRow);
    return perms[feature] !== false;
};

/** Public representation of a user (what the frontend gets). Never contains secrets. */
const toPublicUser = async (row) => ({
    id: row.id,
    username: row.username,
    name: row.name || row.username,
    email: row.email,
    family_id: row.family_id,
    role: isAdminRow(row) ? 'admin' : (row.role || 'member'),
    display_role: row.display_role || null,
    profile_picture: row.profile_picture || null,
    language: row.language || 'de',
    theme: row.theme || 'system',
    two_factor_enabled: !!row.two_factor_enabled,
    permissions: await getPermissions(row),
    dashboard_widgets: parseJSON(row.dashboard_widgets, null),
    sidebar_order: parseJSON(row.sidebar_order, null),
    sidebar_hidden: parseJSON(row.sidebar_hidden, null),
    timezone: row.timezone || config.timezone,
    time_offset: row.time_offset || 0,
    mood_emoji: row.mood_emoji || null,
    mood_text: row.mood_text || null,
    is_system_admin: await isSystemAdmin(row),
});

const signSession = (row, rememberMe = false) => {
    const days = rememberMe ? config.rememberMeDays : config.sessionDays;
    return jwt.sign(
        { sub: row.id, tv: row.token_version || 0, typ: 'session' },
        config.jwtSecret,
        { expiresIn: `${days}d` },
    );
};

const signTwoFactorTicket = (row, rememberMe) => jwt.sign(
    { sub: row.id, tv: row.token_version || 0, typ: '2fa', rm: !!rememberMe },
    config.jwtSecret,
    { expiresIn: '5m' },
);

const verifyToken = (token, expectedType = 'session') => {
    const payload = jwt.verify(token, config.jwtSecret);
    if (payload.typ !== expectedType) throw new Error('Wrong token type');
    return payload;
};

/**
 * Inserts a user. Works with the current schema as well as old databases
 * where `name` / `password_hash` are NOT NULL columns.
 */
const insertUser = async ({ username, email, password, familyId, role = 'member' }) => {
    const cols = await db.columns('users');
    const hash = await hashPassword(password);
    const fields = { username, email, password: hash, family_id: familyId ?? null, role, is_admin: role === 'admin' ? 1 : 0 };
    if (cols.has('name')) fields.name = username;
    if (cols.has('password_hash')) fields.password_hash = hash;

    const keys = Object.keys(fields);
    const { lastID } = await db.run(
        `INSERT INTO users (${keys.join(', ')}) VALUES (${db.placeholders(keys)})`,
        keys.map(k => fields[k]),
    );
    return lastID;
};

/** Updates the password and invalidates all existing sessions of that user. */
const setPassword = async (userId, plain) => {
    const cols = await db.columns('users');
    const hash = await hashPassword(plain);
    const extra = cols.has('password_hash') ? ', password_hash = ?' : '';
    const params = cols.has('password_hash') ? [hash, hash, userId] : [hash, userId];
    await db.run(`UPDATE users SET password = ?${extra}, token_version = COALESCE(token_version, 0) + 1 WHERE id = ?`, params);
};

const bumpTokenVersion = (userId) => db.run('UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = ?', [userId]);

const findByLogin = (identifier) => db.get(
    'SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1',
    [identifier, identifier],
);

/** The "system admin" is an admin of the first family – the owner of this installation. */
const isSystemAdmin = async (userRow) => {
    if (!isAdminRow(userRow)) return false;
    const first = await db.get('SELECT MIN(id) AS id FROM families');
    return !!first && first.id === userRow.family_id;
};

module.exports = {
    FEATURES, hashPassword, verifyPassword, validatePassword, isAdminRow, getPermissions, hasFeature,
    toPublicUser, signSession, signTwoFactorTicket, verifyToken, insertUser, setPassword, bumpTokenVersion,
    findByLogin, isSystemAdmin,
};
