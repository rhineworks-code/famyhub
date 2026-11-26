'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const config = require('../config');
const { HttpError } = require('../utils/http');

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.avif', '.bmp']);
const DOC_EXT = new Set([...IMAGE_EXT, '.pdf', '.tif', '.tiff', '.txt']);

const MIME_EXT = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
    'image/heic': '.heic', 'image/heif': '.heif', 'image/avif': '.avif', 'image/bmp': '.bmp',
    'image/tiff': '.tif', 'application/pdf': '.pdf', 'text/plain': '.txt',
};

/** Extension from the original name, or – for blobs without a name (e.g. cropped avatars) – from the MIME type. */
const safeExt = (file, allowed) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (allowed.has(ext)) return ext;
    const fromMime = MIME_EXT[(file.mimetype || '').toLowerCase()];
    return fromMime && allowed.has(fromMime) ? fromMime : null;
};

/**
 * multer instance with randomised file names, a size limit and an
 * extension/MIME whitelist (the old code accepted any file type).
 */
const makeUpload = ({ dir, prefix = '', kind = 'image', maxMb = config.maxUploadMb, nameFn } = {}) => {
    const allowed = kind === 'document' ? DOC_EXT : IMAGE_EXT;
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            const target = typeof dir === 'function' ? dir(req) : dir;
            fs.mkdir(target, { recursive: true }, (err) => cb(err, target));
        },
        filename: (req, file, cb) => {
            const ext = safeExt(file, allowed) || '';
            const base = nameFn ? nameFn(req, file) : `${prefix}${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
            cb(null, `${base}${ext}`);
        },
    });
    return multer({
        storage,
        limits: { fileSize: maxMb * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
            const ext = safeExt(file, allowed);
            const mimeOk = kind === 'document'
                ? /^(image\/|application\/pdf|text\/plain)/.test(file.mimetype || '')
                : /^image\//.test(file.mimetype || '');
            if (!ext || !mimeOk) return cb(new HttpError(400, 'Dateityp wird nicht unterstützt.'));
            cb(null, true);
        },
    });
};

/** Deletes a file but never outside of the uploads directory. */
const safeUnlink = (filePath) => {
    if (!filePath) return;
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(config.uploadsDir + path.sep) && !resolved.startsWith(config.dataDir + path.sep)) return;
    fs.promises.unlink(resolved).catch(() => {});
};

/** Resolves a public "/uploads/..." URL or bare filename to an absolute path inside the uploads dir. */
const resolveUploadUrl = (url) => {
    if (!url) return null;
    const rel = String(url).replace(/^\/?uploads\//, '').replace(/^\/+/, '');
    const resolved = path.resolve(config.uploadsDir, rel);
    if (!resolved.startsWith(config.uploadsDir + path.sep)) return null;
    return resolved;
};

module.exports = { makeUpload, safeUnlink, resolveUploadUrl, IMAGE_EXT, DOC_EXT };
