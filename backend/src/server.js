'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const multer = require('multer');

const config = require('./config');
const db = require('./db');
const { migrate } = require('./db/migrate');
const scheduler = require('./services/scheduler');
const { HttpError } = require('./utils/http');

const createApp = () => {
    const app = express();
    app.disable('x-powered-by');
    if (config.trustProxy) app.set('trust proxy', 1);

    app.use(helmet({
        // The UI loads PDF.js / Tesseract language data from CDNs and uses inline styles –
        // a strict CSP would break those features, the other helmet headers stay active.
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: 'same-origin' },
    }));
    app.use(compression());

    if (config.corsOrigins.length) {
        app.use((req, res, next) => {
            const origin = req.headers.origin;
            if (origin && config.corsOrigins.includes(origin)) {
                res.setHeader('Access-Control-Allow-Origin', origin);
                res.setHeader('Vary', 'Origin');
                res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
                if (req.method === 'OPTIONS') return res.sendStatus(204);
            }
            next();
        });
    }

    app.use(express.json({ limit: '5mb' }));
    app.use(express.urlencoded({ extended: false, limit: '1mb' }));

    if (!config.isProduction) {
        app.use((req, res, next) => {
            if (req.path.startsWith('/api')) console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl.replace(/token=[^&]+/, 'token=***')}`);
            next();
        });
    }

    // --- Health ----------------------------------------------------------------
    app.get('/api/ping', (req, res) => res.json({ pong: true, time: new Date().toISOString() }));
    app.get('/api/health', async (req, res) => {
        try {
            await db.get('SELECT 1');
            res.json({ status: 'ok', version: require('../package.json').version });
        } catch (err) {
            res.status(503).json({ status: 'error', error: err.message });
        }
    });

    // --- API -------------------------------------------------------------------
    const routes = {
        auth: './routes/auth',
        calendar: './routes/calendar',
        shopping: './routes/shopping',
        push: './routes/push',
        'push-admin': './routes/push',
        chat: './routes/chat',
        gallery: './routes/gallery',
        meals: './routes/meals',
        sync: './routes/sync',
        recipes: './routes/recipes',
        contacts: './routes/contacts',
        projects: './routes/projects',
        contracts: './routes/contracts',
        wishlists: './routes/wishlists',
        vacations: './routes/vacations',
        vault: './routes/vault',
        weather: './routes/weather',
        documents: './routes/documents',
        'pocket-money': './routes/pocketMoney',
        chores: './routes/chores',
        timeline: './routes/timeline',
        system: './routes/system',
    };
    for (const [mount, file] of Object.entries(routes)) app.use(`/api/${mount}`, require(file));

    app.use('/api', (req, res) => res.status(404).json({ error: 'Unbekannter API-Endpunkt' }));

    // --- Protected uploads -------------------------------------------------------
    app.use('/uploads', require('./routes/files'));

    // --- Frontend (SPA) ----------------------------------------------------------
    if (fs.existsSync(config.publicDir)) {
        app.use(express.static(config.publicDir, {
            index: false,
            setHeaders: (res, file) => {
                // Hashed assets can be cached forever, index.html / sw.js never.
                if (/[\\/]assets[\\/]/.test(file)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                else res.setHeader('Cache-Control', 'no-cache');
            },
        }));
        app.get('*', (req, res) => {
            res.setHeader('Cache-Control', 'no-cache');
            res.sendFile(path.join(config.publicDir, 'index.html'));
        });
    }

    // --- Errors ------------------------------------------------------------------
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
        if (err instanceof multer.MulterError) {
            const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Die Datei ist zu groß.' : `Upload-Fehler: ${err.message}`;
            return res.status(400).json({ error: msg });
        }
        if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Anfrage zu groß' });
        if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Ungültiges JSON' });
        if (err instanceof HttpError || err.status) return res.status(err.status || 400).json({ error: err.message });
        if (/SQLITE_CONSTRAINT/.test(err.code || err.message)) return res.status(409).json({ error: 'Der Eintrag verletzt eine Datenbank-Regel (z. B. existiert er bereits).' });

        console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
        res.status(500).json({ error: 'Interner Serverfehler' });
    });

    return app;
};

const start = async () => {
    await db.open();
    await migrate();
    await scheduler.cleanTemp(null, true).catch(err => console.warn('[startup] Temp-Aufräumen:', err.message));

    const app = createApp();
    const server = app.listen(config.port, () => {
        console.log(`FamyHub läuft auf Port ${config.port} (${config.env})`);
        console.log(`  Daten:   ${config.dataDir}`);
        console.log(`  Uploads: ${config.uploadsDir}`);
        if (config.allowRegistration) console.warn('  ⚠ Öffentliche Registrierung ist AKTIV (ALLOW_REGISTRATION=true)');
    });
    scheduler.start();

    const shutdown = (signal) => {
        console.log(`${signal} empfangen – fahre herunter …`);
        scheduler.stop();
        server.close(async () => {
            await db.close().catch(() => {});
            process.exit(0);
        });
        setTimeout(() => process.exit(0), 8000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    return server;
};

if (require.main === module) {
    start().catch((err) => {
        console.error('Start fehlgeschlagen:', err);
        process.exit(1);
    });
}

module.exports = { createApp, start };
