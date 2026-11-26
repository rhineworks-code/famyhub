'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

require('dotenv').config();

const ROOT_DIR = path.resolve(__dirname, '..');

const bool = (value, fallback = false) => {
    if (value === undefined || value === null || value === '') return fallback;
    return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT_DIR, 'data'));
const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || path.join(ROOT_DIR, 'uploads'));

for (const dir of [DATA_DIR, UPLOADS_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
}

/**
 * JWT secret: taken from the environment. If none is configured, a random
 * secret is generated once and persisted inside the data volume so that
 * sessions survive restarts – but nobody can ever forge tokens with a
 * well-known default value again.
 */
const resolveJwtSecret = () => {
    const fromEnv = (process.env.JWT_SECRET || '').trim();
    const insecureDefaults = ['supersecret', 'supersecretfamilykeychangeinproduction', 'famyhub_secret_key_2024'];
    if (fromEnv && !insecureDefaults.includes(fromEnv) && fromEnv.length >= 32) return fromEnv;

    if (fromEnv) {
        console.warn('[config] JWT_SECRET ist zu kurz oder ein bekannter Standardwert – es wird ein zufälliger Schlüssel verwendet.');
    }

    const secretFile = path.join(DATA_DIR, '.jwt_secret');
    try {
        const stored = fs.readFileSync(secretFile, 'utf8').trim();
        if (stored.length >= 32) return stored;
    } catch (_) { /* not yet created */ }

    const generated = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(secretFile, generated, { mode: 0o600 });
    console.log('[config] Neuer JWT-Schlüssel erzeugt und in data/.jwt_secret gespeichert.');
    return generated;
};

const config = {
    env: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    port: Number.isInteger(parseInt(process.env.PORT, 10)) ? parseInt(process.env.PORT, 10) : 3265,

    rootDir: ROOT_DIR,
    dataDir: DATA_DIR,
    dbPath: path.join(DATA_DIR, 'family.db'),
    uploadsDir: UPLOADS_DIR,
    documentsDir: path.join(UPLOADS_DIR, 'documents'),
    avatarsDir: path.join(UPLOADS_DIR, 'avatars'),
    timelineDir: path.join(UPLOADS_DIR, 'timeline'),
    tempDir: path.join(UPLOADS_DIR, 'temp'),
    publicDir: path.resolve(process.env.PUBLIC_DIR || path.join(ROOT_DIR, 'public')),

    jwtSecret: resolveJwtSecret(),
    sessionDays: parseInt(process.env.SESSION_DAYS, 10) || 7,
    rememberMeDays: parseInt(process.env.REMEMBER_ME_DAYS, 10) || 90,

    // Open self-registration (anyone can create a new family). Off by default.
    allowRegistration: bool(process.env.ALLOW_REGISTRATION, false),
    // Set to true when the app runs behind a reverse proxy (needed for correct client IPs / secure cookies).
    trustProxy: bool(process.env.TRUST_PROXY, false),
    // Optional: comma separated list of allowed CORS origins (only needed for a separately hosted frontend).
    corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),

    vapid: {
        publicKey: process.env.PUBLIC_VAPID_KEY || process.env.VAPID_PUBLIC_KEY || '',
        privateKey: process.env.PRIVATE_VAPID_KEY || process.env.VAPID_PRIVATE_KEY || '',
        subject: process.env.VAPID_SUBJECT || 'mailto:admin@famyhub.local',
    },

    // Fallback SMTP (used for password reset if a family has no own SMTP settings)
    smtp: {
        host: process.env.SMTP_HOST || '',
        port: parseInt(process.env.SMTP_PORT, 10) || 587,
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        from: process.env.SMTP_FROM || '',
    },

    timezone: process.env.TZ || 'Europe/Berlin',
    maxUploadMb: parseInt(process.env.MAX_UPLOAD_MB, 10) || 25,
};

for (const dir of [config.documentsDir, config.avatarsDir, config.timelineDir, config.tempDir]) {
    fs.mkdirSync(dir, { recursive: true });
}

module.exports = config;
