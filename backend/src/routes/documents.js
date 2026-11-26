'use strict';

const fs = require('fs');
const path = require('path');

const db = require('../db');
const config = require('../config');
const settings = require('../services/settings');
const smb = require('../services/smb');
const { extractText } = require('../services/textExtract');
const { makeUpload, safeUnlink } = require('../services/uploads');
const { requireAuth, requireFamily, requireFeature, requireAdmin, requireSystemAdmin, authenticate } = require('../middleware/auth');
const { createRouter, HttpError, trimOrNull, toBoolInt, uuid } = require('../utils/http');

const router = createRouter();

const DEFAULT_DIR = config.documentsDir;
const TEMP_DIR = path.join(DEFAULT_DIR, 'temp');
fs.mkdirSync(TEMP_DIR, { recursive: true });

const upload = makeUpload({ dir: TEMP_DIR, kind: 'document', maxMb: config.maxUploadMb, nameFn: () => `${Date.now()}-${uuid()}` });

const MIME = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.heic': 'image/heic', '.tif': 'image/tiff', '.tiff': 'image/tiff', '.txt': 'text/plain' };

/** Private documents are only visible to their owner (the old API returned all documents to everyone). */
const VISIBLE = '(COALESCE(d.is_shared, 0) = 1 OR d.user_id = ?)';

const getStorage = async () => {
    const s = await settings.getMany(['docs_storage_type', 'docs_storage_path']);
    return { type: s.docs_storage_type === 'smb' ? 'smb' : 'local', path: trimOrNull(s.docs_storage_path) || DEFAULT_DIR };
};

const localDirFor = (storagePath) => (storagePath && storagePath !== 'smb' ? storagePath : DEFAULT_DIR);

const removeStoredFile = async (doc) => {
    try {
        if (doc.storage_path === 'smb') await smb.unlink(doc.filename);
        else await fs.promises.unlink(path.join(localDirFor(doc.storage_path), path.basename(doc.filename)));
    } catch (err) {
        console.warn(`[documents] Datei ${doc.filename} konnte nicht gelöscht werden: ${err.message}`);
    }
};

const docOfUser = async (req, id) => {
    const doc = await db.get(`SELECT d.* FROM documents d WHERE d.id = ? AND d.family_id = ? AND ${VISIBLE}`, [id, req.user.family_id, req.user.id]);
    if (!doc) throw new HttpError(404, 'Dokument nicht gefunden');
    return doc;
};

/** Ids out of `ids` the user may modify. */
const ownIds = async (req, ids) => {
    if (!Array.isArray(ids) || ids.length === 0) throw new HttpError(400, 'IDs fehlen');
    const clean = ids.map(String).slice(0, 1000);
    const rows = await db.all(`SELECT d.id, d.user_id, d.filename, d.storage_path FROM documents d WHERE d.id IN (${db.placeholders(clean)}) AND d.family_id = ? AND ${VISIBLE}`, [...clean, req.user.family_id, req.user.id]);
    return rows;
};

const familyTagIds = async (familyId, tagIds) => {
    if (!Array.isArray(tagIds) || tagIds.length === 0) return [];
    const rows = await db.all(`SELECT id FROM document_tags WHERE family_id = ? AND id IN (${db.placeholders(tagIds)})`, [familyId, ...tagIds]);
    return rows.map(r => r.id);
};

// ---------------------------------------------------------------------------
// File delivery. Registered before the feature guard so that the browser can
// load files via cookie (or the legacy ?token= link) inside <img>/<iframe>.
// ---------------------------------------------------------------------------
router.get('/file/:filename', authenticate({ allowQuery: true }), requireFamily, requireFeature('documents'), async (req, res) => {
    const filename = path.basename(req.params.filename);
    const doc = await db.get(`SELECT d.* FROM documents d WHERE d.filename = ? AND d.family_id = ? AND ${VISIBLE}`, [filename, req.user.family_id, req.user.id]);
    if (!doc) throw new HttpError(404, 'Dokument nicht gefunden');

    const ext = path.extname(filename).toLowerCase();
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(`${doc.title || 'dokument'}${ext}`)}`);

    if (doc.storage_path === 'smb') {
        try {
            return res.send(await smb.readFile(filename));
        } catch (err) {
            console.error('[documents] SMB-Lesefehler:', err.message);
            throw new HttpError(502, 'Datei konnte nicht vom NAS gelesen werden');
        }
    }

    const dirs = [localDirFor(doc.storage_path), DEFAULT_DIR, TEMP_DIR];
    for (const dir of dirs) {
        const p = path.join(dir, filename);
        if (fs.existsSync(p)) return res.sendFile(p);
    }
    throw new HttpError(404, 'Datei nicht gefunden');
});

router.use(requireAuth, requireFamily, requireFeature('documents'));

// --- Categories & tags ---------------------------------------------------------
for (const [route, table] of [['categories', 'document_categories'], ['tags', 'document_tags']]) {
    router.get(`/${route}`, async (req, res) => {
        res.json(await db.all(`SELECT * FROM ${table} WHERE family_id = ? ORDER BY name COLLATE NOCASE`, [req.user.family_id]));
    });
    router.post(`/${route}`, async (req, res) => {
        const name = trimOrNull(req.body.name);
        if (!name) throw new HttpError(400, 'Name fehlt');
        const color = trimOrNull(req.body.color) || '#6366f1';
        const { lastID } = await db.run(`INSERT INTO ${table} (family_id, name, color) VALUES (?, ?, ?)`, [req.user.family_id, name, color]);
        res.json({ id: lastID, name, color });
    });
    router.delete(`/${route}/:id`, async (req, res) => {
        const { changes } = await db.run(`DELETE FROM ${table} WHERE id = ? AND family_id = ?`, [req.params.id, req.user.family_id]);
        if (changes) {
            if (route === 'categories') await db.run('UPDATE documents SET category_id = NULL WHERE category_id = ? AND family_id = ?', [req.params.id, req.user.family_id]);
            else await db.run('DELETE FROM document_tag_mapping WHERE tag_id = ?', [req.params.id]);
        }
        res.json({ message: route === 'categories' ? 'Kategorie gelöscht' : 'Tag gelöscht' });
    });
}

// --- List ----------------------------------------------------------------------
router.get('/', async (req, res) => {
    const archived = req.query.archived === 'true' ? 1 : 0;
    const rows = await db.all(
        `SELECT d.*, c.name AS category_name, c.color AS category_color, u.username AS owner_name
         FROM documents d
         LEFT JOIN document_categories c ON d.category_id = c.id
         LEFT JOIN users u ON d.user_id = u.id
         WHERE d.family_id = ? AND COALESCE(d.is_archived, 0) = ? AND ${VISIBLE}
         ORDER BY d.created_at DESC`,
        [req.user.family_id, archived, req.user.id],
    );
    const ids = rows.map(r => r.id);
    const tags = ids.length
        ? await db.all(`SELECT m.document_id, t.id, t.name, t.color FROM document_tag_mapping m JOIN document_tags t ON t.id = m.tag_id WHERE m.document_id IN (${db.placeholders(ids)})`, ids)
        : [];
    res.json(rows.map(r => ({
        ...r,
        is_shared: r.is_shared ? 1 : 0,
        tags: tags.filter(t => t.document_id === r.id).map(({ document_id, ...t }) => t),
    })));
});

// --- Storage settings (global, system admin) -----------------------------------
router.get('/storage-info', async (req, res) => {
    const s = await settings.getMany(['docs_storage_type', 'docs_storage_path', 'smb_host', 'smb_share', 'smb_user', 'smb_port']);
    const type = s.docs_storage_type === 'smb' ? 'smb' : 'local';
    const p = trimOrNull(s.docs_storage_path) || DEFAULT_DIR;
    const info = {
        type, path: p, isDefault: p === DEFAULT_DIR,
        smb_host: s.smb_host || '', smb_share: s.smb_share || '', smb_user: s.smb_user || '', smb_port: s.smb_port || '445',
        exists: false, writable: false,
    };
    if (type === 'smb') {
        info.exists = info.writable = await smb.isConfigured();
    } else {
        info.exists = fs.existsSync(p);
        try { fs.accessSync(p, fs.constants.W_OK); info.writable = true; } catch (_) { /* not writable */ }
    }
    res.json(info);
});

router.post('/storage-path', requireAdmin, requireSystemAdmin, async (req, res) => {
    const { type, path: newPath, smb_host: host, smb_share: share, smb_user: user, smb_pass: pass, smb_port: port, test } = req.body;

    let localPath = trimOrNull(newPath) || DEFAULT_DIR;
    if (type !== 'smb') {
        localPath = path.resolve(localPath);
        // Documents may only be stored inside the data/uploads volumes – never in system directories.
        const allowedRoots = [config.uploadsDir, config.dataDir, ...(process.env.DOCS_ALLOWED_ROOTS || '').split(',').map(s => s.trim()).filter(Boolean).map(r => path.resolve(r))];
        if (!allowedRoots.some(root => localPath === root || localPath.startsWith(root + path.sep))) {
            throw new HttpError(400, `Der Pfad muss innerhalb von ${allowedRoots.join(' oder ')} liegen.`);
        }
    }

    if (test) {
        if (type === 'smb') {
            const saved = await settings.getMany(['smb_pass']);
            return res.json(await smb.testConnection({ smb_host: host, smb_share: share, smb_user: user, smb_pass: pass || saved.smb_pass, smb_port: port }));
        }
        try {
            await fs.promises.mkdir(localPath, { recursive: true });
            await fs.promises.access(localPath, fs.constants.W_OK);
            return res.json({ ok: true, message: 'Lokaler Pfad ist beschreibbar ✓' });
        } catch (err) {
            return res.json({ ok: false, message: `Fehler: ${err.message}` });
        }
    }

    await settings.set('docs_storage_type', type === 'smb' ? 'smb' : 'local');
    await settings.set('docs_storage_path', type === 'smb' ? '' : localPath);
    await settings.set('smb_host', trimOrNull(host) || '');
    await settings.set('smb_share', trimOrNull(share) || '');
    await settings.set('smb_user', trimOrNull(user) || '');
    await settings.set('smb_port', trimOrNull(port) || '445');
    if (pass) await settings.set('smb_pass', pass);
    res.json({ message: 'Speichereinstellungen gespeichert' });
});

// --- Upload --------------------------------------------------------------------
router.post('/', upload.single('file'), async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Keine Datei hochgeladen');
    const tempPath = req.file.path;
    const { filename, mimetype } = req.file;

    try {
        const storage = await getStorage();
        let text = trimOrNull(req.body.content_text) || '';
        if (!text) text = await extractText(tempPath, mimetype);

        const title = trimOrNull(req.body.title) || req.file.originalname.replace(/\.[^.]+$/, '');
        const [categories, tags] = await Promise.all([
            db.all('SELECT * FROM document_categories WHERE family_id = ?', [req.user.family_id]),
            db.all('SELECT * FROM document_tags WHERE family_id = ?', [req.user.family_id]),
        ]);
        const haystack = `${title} ${text}`.toLowerCase();
        const suggestedCategory = categories.find(c => c.name && haystack.includes(c.name.toLowerCase())) || null;
        const suggestedTags = tags.filter(t => t.name && haystack.includes(t.name.toLowerCase()));

        let categoryId = req.body.category_id ? Number(req.body.category_id) : null;
        if (categoryId && !categories.some(c => c.id === categoryId)) categoryId = null;
        if (!categoryId && suggestedCategory) categoryId = suggestedCategory.id;

        // Move the file to its final place *before* answering – the old version answered first
        // and moved asynchronously, so opening a fresh upload often returned 404.
        let storagePath;
        if (storage.type === 'smb') {
            await smb.writeFile(filename, await fs.promises.readFile(tempPath));
            await fs.promises.unlink(tempPath).catch(() => {});
            storagePath = 'smb';
        } else {
            await fs.promises.mkdir(storage.path, { recursive: true });
            const finalPath = path.join(storage.path, filename);
            try {
                await fs.promises.rename(tempPath, finalPath);
            } catch (err) {
                if (err.code !== 'EXDEV') throw err; // different volume → copy + delete
                await fs.promises.copyFile(tempPath, finalPath);
                await fs.promises.unlink(tempPath).catch(() => {});
            }
            storagePath = storage.path;
        }

        const id = uuid();
        await db.transaction(async (tx) => {
            await tx.run(
                'INSERT INTO documents (id, family_id, user_id, category_id, title, filename, storage_path, is_shared, content_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [id, req.user.family_id, req.user.id, categoryId, title, filename, storagePath, toBoolInt(req.body.is_shared), text || null],
            );
            for (const t of suggestedTags) await tx.run('INSERT OR IGNORE INTO document_tag_mapping (document_id, tag_id) VALUES (?, ?)', [id, t.id]);
        });

        res.status(201).json({
            id, title, filename,
            suggestions: suggestedCategory || suggestedTags.length ? { category: suggestedCategory, tags: suggestedTags } : null,
        });
    } catch (err) {
        safeUnlink(tempPath);
        throw err;
    }
});

// --- Modify ----------------------------------------------------------------------
router.put('/:id', async (req, res) => {
    const doc = await docOfUser(req, req.params.id);
    const { title, category_id: categoryId, is_archived: archived, is_shared: shared, content_text: text, tagIds } = req.body;
    const sets = [];
    const params = [];
    if (title !== undefined) { sets.push('title = ?'); params.push(trimOrNull(title) || doc.title); }
    if (categoryId !== undefined) {
        const cat = categoryId ? await db.get('SELECT id FROM document_categories WHERE id = ? AND family_id = ?', [categoryId, req.user.family_id]) : null;
        sets.push('category_id = ?'); params.push(cat ? cat.id : null);
    }
    if (archived !== undefined) { sets.push('is_archived = ?'); params.push(toBoolInt(archived)); }
    if (shared !== undefined) {
        if (doc.user_id !== req.user.id && req.user.role !== 'admin') throw new HttpError(403, 'Nur der Besitzer kann die Freigabe ändern');
        sets.push('is_shared = ?'); params.push(toBoolInt(shared));
    }
    if (text !== undefined) { sets.push('content_text = ?'); params.push(text); }
    if (sets.length === 0 && tagIds === undefined) throw new HttpError(400, 'Keine Änderungen');

    const validTags = tagIds !== undefined ? await familyTagIds(req.user.family_id, tagIds) : null;
    await db.transaction(async (tx) => {
        if (sets.length) await tx.run(`UPDATE documents SET ${sets.join(', ')} WHERE id = ?`, [...params, doc.id]);
        if (validTags) {
            await tx.run('DELETE FROM document_tag_mapping WHERE document_id = ?', [doc.id]);
            for (const tagId of validTags) await tx.run('INSERT OR IGNORE INTO document_tag_mapping (document_id, tag_id) VALUES (?, ?)', [doc.id, tagId]);
        }
    });
    res.json({ message: 'Dokument aktualisiert' });
});

router.post('/bulk-update', async (req, res) => {
    const { updates = {}, tagIdsToAdd, tagIdsToRemove } = req.body;
    let docs = await ownIds(req, req.body.ids);
    // Only the owner (or an admin) may change who can see a document.
    if (updates.is_shared !== undefined && req.user.role !== 'admin') docs = docs.filter(d => d.user_id === req.user.id);
    if (docs.length === 0) return res.json({ message: 'Keine Dokumente geändert' });
    const ids = docs.map(d => d.id);

    const sets = [];
    const params = [];
    if (updates.category_id !== undefined) {
        const cat = updates.category_id ? await db.get('SELECT id FROM document_categories WHERE id = ? AND family_id = ?', [updates.category_id, req.user.family_id]) : null;
        sets.push('category_id = ?'); params.push(cat ? cat.id : null);
    }
    if (updates.is_shared !== undefined) { sets.push('is_shared = ?'); params.push(toBoolInt(updates.is_shared)); }
    if (updates.is_archived !== undefined) { sets.push('is_archived = ?'); params.push(toBoolInt(updates.is_archived)); }

    const add = await familyTagIds(req.user.family_id, tagIdsToAdd);
    const remove = await familyTagIds(req.user.family_id, tagIdsToRemove);

    await db.transaction(async (tx) => {
        if (sets.length) await tx.run(`UPDATE documents SET ${sets.join(', ')} WHERE id IN (${db.placeholders(ids)})`, [...params, ...ids]);
        for (const docId of ids) for (const tagId of add) await tx.run('INSERT OR IGNORE INTO document_tag_mapping (document_id, tag_id) VALUES (?, ?)', [docId, tagId]);
        if (remove.length) await tx.run(`DELETE FROM document_tag_mapping WHERE document_id IN (${db.placeholders(ids)}) AND tag_id IN (${db.placeholders(remove)})`, [...ids, ...remove]);
    });
    res.json({ message: `${ids.length} Dokumente aktualisiert` });
});

router.delete('/:id', async (req, res) => {
    const doc = await docOfUser(req, req.params.id);
    await db.run('DELETE FROM documents WHERE id = ?', [doc.id]);
    await removeStoredFile(doc);
    res.json({ message: 'Dokument gelöscht' });
});

router.post('/bulk-delete', async (req, res) => {
    const docs = await ownIds(req, req.body.ids);
    if (docs.length) {
        const ids = docs.map(d => d.id);
        await db.run(`DELETE FROM documents WHERE id IN (${db.placeholders(ids)})`, ids);
        for (const d of docs) await removeStoredFile(d);
    }
    res.json({ message: `${docs.length} Dokumente gelöscht` });
});

// Re-run text extraction (works for local and SMB storage)
router.post('/:id/reextract', async (req, res) => {
    const doc = await docOfUser(req, req.params.id);
    res.json({ message: 'Texterkennung gestartet' });

    setImmediate(async () => {
        let filePath = path.join(localDirFor(doc.storage_path), doc.filename);
        let temp = null;
        try {
            if (doc.storage_path === 'smb') {
                temp = path.join(TEMP_DIR, `reextract-${doc.filename}`);
                await fs.promises.writeFile(temp, await smb.readFile(doc.filename));
                filePath = temp;
            }
            const ext = path.extname(doc.filename).toLowerCase();
            const text = await extractText(filePath, MIME[ext] || '');
            await db.run('UPDATE documents SET content_text = ? WHERE id = ?', [text || '[Kein Text erkannt]', doc.id]);
        } catch (err) {
            console.error('[documents] Texterkennung fehlgeschlagen:', err.message);
        } finally {
            if (temp) fs.promises.unlink(temp).catch(() => {});
        }
    });
});

module.exports = router;
