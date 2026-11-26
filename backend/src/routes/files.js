'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');

const db = require('../db');
const config = require('../config');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../utils/http');

/**
 * Protected delivery of /uploads/*.
 *
 * The old server exposed the whole uploads folder publicly via express.static –
 * photos, chat pictures and even scanned documents were downloadable without
 * login. Now every request needs a session (cookie or header) and the file must
 * belong to the user's family.
 */
const router = express.Router();

const belongsToFamily = async (rel, familyId, userId) => {
    const parts = rel.split('/');
    if (parts[0] === 'documents' || parts[0] === 'temp') return false; // served only via /api/documents/file

    if (parts[0] === 'avatars') {
        return !!(await db.get('SELECT 1 FROM users WHERE profile_picture = ? AND family_id = ?', [`/uploads/${rel}`, familyId]));
    }
    if (parts[0] === 'timeline') {
        return !!(await db.get('SELECT 1 FROM timeline_posts WHERE media_url = ? AND family_id = ?', [`/uploads/${rel}`, familyId]));
    }
    if (parts.length === 1) {
        const photo = await db.get(
            `SELECT a.created_by, a.id AS album_id FROM photos p JOIN albums a ON a.id = p.album_id
             WHERE p.filename = ? AND a.family_id = ? LIMIT 1`,
            [rel, familyId],
        );
        if (photo) return true;
        if (await db.get('SELECT 1 FROM messages WHERE image_url = ? AND family_id = ?', [rel, familyId])) return true;
        // Event pictures may reference uploads too
        if (await db.get('SELECT 1 FROM events WHERE image_url LIKE ? AND family_id = ?', [`%/${rel}`, familyId])) return true;
    }
    return false;
};

/** Old avatars were stored without file extension – detect the image type from the first bytes. */
const sniffImageType = async (file) => {
    const fh = await fs.promises.open(file, 'r');
    try {
        const { buffer } = await fh.read(Buffer.alloc(12), 0, 12, 0);
        if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
        if (buffer.subarray(0, 4).toString('hex') === '89504e47') return 'image/png';
        if (buffer.subarray(0, 3).toString('latin1') === 'GIF') return 'image/gif';
        if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
        return null;
    } finally {
        await fh.close();
    }
};

router.get('/*', authenticate({ allowQuery: true }), asyncHandler(async (req, res) => {
    let rel;
    try { rel = decodeURIComponent(req.params[0] || ''); } catch (_) { return res.sendStatus(400); }
    rel = rel.replace(/\\/g, '/').replace(/^\/+/, '');
    const abs = path.resolve(config.uploadsDir, rel);
    if (!abs.startsWith(config.uploadsDir + path.sep)) return res.sendStatus(400);
    if (!req.user.family_id || !(await belongsToFamily(rel, req.user.family_id, req.user.id))) return res.sendStatus(404);
    if (!fs.existsSync(abs)) return res.sendStatus(404);

    if (!path.extname(abs)) {
        const type = await sniffImageType(abs).catch(() => null);
        if (type) res.type(type);
    }
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(abs, { dotfiles: 'deny' });
}));

module.exports = router;
