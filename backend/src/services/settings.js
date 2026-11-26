'use strict';

const db = require('../db');

const get = async (key, fallback = null) => {
    const row = await db.get('SELECT value FROM app_settings WHERE key = ?', [key]);
    return row ? row.value : fallback;
};

const getMany = async (prefixOrKeys) => {
    const rows = Array.isArray(prefixOrKeys)
        ? await db.all(`SELECT key, value FROM app_settings WHERE key IN (${db.placeholders(prefixOrKeys)})`, prefixOrKeys)
        : await db.all('SELECT key, value FROM app_settings WHERE key LIKE ?', [`${prefixOrKeys}%`]);
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
};

const set = (key, value) => db.run(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    [key, value === undefined || value === null ? '' : String(value)],
);

module.exports = { get, getMany, set };
