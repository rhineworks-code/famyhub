'use strict';

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const AdmZip = require('adm-zip');
const multer = require('multer');

const db = require('../db');
const config = require('../config');
const users = require('../services/users');
const { requireAuth, requireFamily, requireAdmin, requireSystemAdmin, COOKIE_NAME } = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const { createRouter, HttpError, trimOrNull, inviteCode } = require('../utils/http');

const router = createRouter();

const backupUpload = multer({
    dest: config.tempDir,
    limits: { fileSize: 4 * 1024 * 1024 * 1024 },
    fileFilter: (req, file, cb) => (/\.zip$/i.test(file.originalname) ? cb(null, true) : cb(new HttpError(400, 'Bitte eine .zip-Datei hochladen.'))),
});

const systemAdmin = [requireAuth, requireFamily, requireAdmin, requireSystemAdmin];

const userCount = async () => (await db.get('SELECT COUNT(*) AS n FROM users')).n;

/** Consistent snapshot of the live database (safe while the app is running). */
const snapshotDatabase = async () => {
    const target = path.join(config.tempDir, `snapshot-${Date.now()}.db`);
    await db.run('VACUUM INTO ?', [target]);
    return target;
};

/**
 * Restores a backup ZIP created by FamyHub (data/family.db + uploads/**).
 * Only these two locations are extracted and every path is validated – the
 * old version extracted *anything* into the application directory, which
 * allowed overwriting the server code.
 */
const restoreBackup = async (zipPath) => {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();
    const dbEntry = entries.find(e => e.entryName.replace(/\\/g, '/') === 'data/family.db');
    if (!dbEntry) throw new HttpError(400, 'Das Archiv enthält keine data/family.db – ist es ein FamyHub-Backup?');

    const header = dbEntry.getData().subarray(0, 16).toString('latin1');
    if (!header.startsWith('SQLite format 3')) throw new HttpError(400, 'data/family.db ist keine gültige SQLite-Datenbank.');

    // 1. Uploads
    for (const entry of entries) {
        const name = entry.entryName.replace(/\\/g, '/');
        if (entry.isDirectory || !name.startsWith('uploads/')) continue;
        const rel = name.slice('uploads/'.length);
        const target = path.resolve(config.uploadsDir, rel);
        if (!target.startsWith(config.uploadsDir + path.sep)) continue; // zip slip
        if (rel.startsWith('temp/')) continue;
        await fs.promises.mkdir(path.dirname(target), { recursive: true });
        await fs.promises.writeFile(target, entry.getData());
    }

    // 2. Database: keep a safety copy, then replace the file while the connection is closed.
    const safety = `${config.dbPath}.pre-import-${Date.now()}.bak`;
    await db.close();
    try {
        if (fs.existsSync(config.dbPath)) await fs.promises.copyFile(config.dbPath, safety);
        for (const suffix of ['-wal', '-shm']) await fs.promises.rm(config.dbPath + suffix, { force: true });
        await fs.promises.writeFile(config.dbPath, dbEntry.getData());
    } finally {
        await db.open();
        db.refreshColumns();
        await require('../db/migrate').migrate();
    }
};

// ---------------------------------------------------------------------------

router.get('/time', requireAuth, (req, res) => res.json({ serverTime: Date.now() }));

// First start: create family + admin (only while no user exists)
router.post('/setup-initial', rateLimit({ max: 10 }), async (req, res) => {
    if ((await userCount()) > 0) throw new HttpError(403, 'Das System ist bereits eingerichtet.');
    const username = trimOrNull(req.body.username);
    const email = trimOrNull(req.body.email);
    const familyName = trimOrNull(req.body.familyName);
    const { password } = req.body;
    if (!username || !email || !password || !familyName) throw new HttpError(400, 'Alle Felder sind erforderlich.');
    const pwError = users.validatePassword(password);
    if (pwError) throw new HttpError(400, pwError);

    const { lastID: familyId } = await db.run('INSERT INTO families (name, invite_code) VALUES (?, ?)', [familyName, inviteCode()]);
    const userId = await users.insertUser({ username, email: email.toLowerCase(), password, familyId, role: 'admin' });
    const row = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    const token = users.signSession(row);
    res.cookie(COOKIE_NAME, token, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: config.sessionDays * 864e5, path: '/' });
    res.status(201).json({ message: 'System erfolgreich eingerichtet.', token, user: await users.toPublicUser(row) });
});

// First start: restore a backup instead (only while no user exists)
router.post('/import-initial', rateLimit({ max: 5 }), backupUpload.single('backup'), async (req, res) => {
    try {
        if ((await userCount()) > 0) throw new HttpError(403, 'Import ohne Anmeldung ist nur bei einer Neuinstallation möglich.');
        if (!req.file) throw new HttpError(400, 'Keine Backup-Datei hochgeladen.');
        await restoreBackup(req.file.path);
        res.json({ message: 'Backup erfolgreich eingespielt. Du kannst dich jetzt anmelden.' });
    } finally {
        if (req.file) fs.promises.rm(req.file.path, { force: true }).catch(() => {});
    }
});

// Backup download
router.get('/export', ...systemAdmin, async (req, res) => {
    const snapshot = await snapshotDatabase();
    const filename = `famyhub_backup_${new Date().toISOString().slice(0, 10)}.zip`;
    res.attachment(filename);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', (err) => { console.error('[backup]', err); res.destroy(err); });
    res.on('close', () => fs.promises.rm(snapshot, { force: true }).catch(() => {}));

    archive.pipe(res);
    archive.file(snapshot, { name: 'data/family.db' });
    archive.glob('**/*', { cwd: config.uploadsDir, ignore: ['temp/**'], dot: false }, { prefix: 'uploads' });
    await archive.finalize();
});

// Backup restore (running system)
router.post('/import', ...systemAdmin, backupUpload.single('backup'), async (req, res) => {
    try {
        if (!req.file) throw new HttpError(400, 'Keine Backup-Datei hochgeladen.');
        await restoreBackup(req.file.path);
        res.json({ message: 'Backup erfolgreich eingespielt. Bitte neu anmelden.', requiresRestart: false });
    } finally {
        if (req.file) fs.promises.rm(req.file.path, { force: true }).catch(() => {});
    }
});

// In-app code updates were removed: the container image is the update mechanism now.
router.post('/update', ...systemAdmin, (req, res) => {
    res.status(410).json({ error: 'Updates werden jetzt über ein neues Docker-Image eingespielt (docker compose pull && docker compose up -d).' });
});

// Factory reset (system admin, password confirmation)
router.post('/reset', ...systemAdmin, async (req, res) => {
    const row = req.user._row;
    if (!(await users.verifyPassword(req.body.password, row.password || row.password_hash))) throw new HttpError(401, 'Ungültiges Passwort.');

    console.warn(`[system] WERKSRESET durch ${row.username}`);
    const backup = path.join(config.dataDir, `family.db.before-reset-${Date.now()}.bak`);
    await db.run('VACUUM INTO ?', [backup]);

    await db.close();
    for (const suffix of ['', '-wal', '-shm']) await fs.promises.rm(config.dbPath + suffix, { force: true });
    for (const dir of ['avatars', 'documents', 'timeline', 'temp']) {
        await fs.promises.rm(path.join(config.uploadsDir, dir), { recursive: true, force: true });
        await fs.promises.mkdir(path.join(config.uploadsDir, dir), { recursive: true });
    }
    await db.open();
    db.refreshColumns();
    await require('../db/migrate').migrate();

    res.json({ message: `System wurde zurückgesetzt. Eine Sicherung der alten Datenbank liegt unter data/${path.basename(backup)}.` });
});

module.exports = router;
