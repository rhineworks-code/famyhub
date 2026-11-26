'use strict';

const crypto = require('crypto');

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

/** Wraps an async route handler so rejected promises end up in the error middleware. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Creates an express.Router whose handlers may be async functions. */
const createRouter = () => {
    const express = require('express');
    const router = express.Router();
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
        const original = router[method].bind(router);
        router[method] = (path, ...handlers) => original(path, ...handlers.map(h => (typeof h === 'function' && h.length < 4 ? asyncHandler(h) : h)));
    }
    return router;
};

const parseJSON = (value, fallback = null) => {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch (_) { return fallback; }
};

const toBoolInt = (value) => (value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0);

const toNumber = (value, fallback = null) => {
    if (value === null || value === undefined || value === '') return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const uuid = () => crypto.randomUUID();

/** Readable invite codes without ambiguous characters. */
const inviteCode = (length = 8) => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.randomBytes(length);
    return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
};

const trimOrNull = (value) => {
    if (value === undefined || value === null) return null;
    const s = String(value).trim();
    return s === '' ? null : s;
};

/**
 * SQLite CURRENT_TIMESTAMP values ("2026-01-01 10:00:00") are UTC but carry no
 * zone marker – JavaScript would interpret them as local time.
 */
const parseDbDate = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    const s = String(value);
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s)) return new Date(s.replace(' ', 'T') + 'Z');
    return new Date(s);
};

module.exports = { HttpError, asyncHandler, createRouter, parseJSON, toBoolInt, toNumber, uuid, inviteCode, trimOrNull, parseDbDate };
