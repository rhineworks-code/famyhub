'use strict';

/**
 * Minimal in-memory rate limiter (no external dependency).
 * Good enough for a single-container family app; protects login, 2FA and
 * password-reset endpoints against brute force.
 */
const rateLimit = ({ windowMs = 15 * 60 * 1000, max = 10, keyFn = (req) => req.ip, message = 'Zu viele Versuche. Bitte warte einige Minuten.' } = {}) => {
    const hits = new Map();

    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of hits) if (entry.reset <= now) hits.delete(key);
    }, Math.min(windowMs, 60_000)).unref();

    const middleware = (req, res, next) => {
        const key = keyFn(req);
        const now = Date.now();
        let entry = hits.get(key);
        if (!entry || entry.reset <= now) {
            entry = { count: 0, reset: now + windowMs };
            hits.set(key, entry);
        }
        entry.count += 1;
        if (entry.count > max) {
            res.set('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
            return res.status(429).json({ error: message });
        }
        next();
    };
    // Successful logins should not count against the limit.
    middleware.reset = (req) => hits.delete(keyFn(req));
    return middleware;
};

module.exports = rateLimit;
