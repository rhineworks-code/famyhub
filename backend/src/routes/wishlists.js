'use strict';

const axios = require('axios');
const db = require('../db');
const { featureGuard } = require('../middleware/auth');
const { createRouter, HttpError, trimOrNull, toNumber, uuid } = require('../utils/http');
const { assertPublicUrl } = require('../utils/net');

const router = createRouter();
router.use(featureGuard('wishlist'));

/** Reads the og:image / twitter:image of a product page for the preview picture. */
const fetchPreviewImage = async (rawUrl) => {
    if (!rawUrl) return null;
    const target = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    try {
        await assertPublicUrl(target);
        const response = await axios.get(target, {
            timeout: 5000,
            maxContentLength: 3 * 1024 * 1024,
            maxRedirects: 3,
            responseType: 'text',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
                Accept: 'text/html,application/xhtml+xml',
                'Accept-Language': 'de-DE,de;q=0.9,en;q=0.7',
            },
        });
        const html = typeof response.data === 'string' ? response.data : '';
        const patterns = [
            /<meta[^>]*property=['"]og:image['"][^>]*content=['"]([^'"]+)['"]/i,
            /<meta[^>]*content=['"]([^'"]+)['"][^>]*property=['"]og:image['"]/i,
            /<meta[^>]*name=['"]twitter:image['"][^>]*content=['"]([^'"]+)['"]/i,
            /<meta[^>]*content=['"]([^'"]+)['"][^>]*name=['"]twitter:image['"]/i,
            /data-old-hires=["']([^"']+)["']/i,
            /id="landingImage"[^>]*src=["']([^"']+)["']/i,
        ];
        for (const re of patterns) {
            const m = html.match(re);
            if (m && m[1]) {
                const img = m[1].replace(/&amp;/g, '&');
                return new URL(img, target).href;
            }
        }
    } catch (err) {
        console.warn('[wishlist] Vorschaubild nicht ladbar:', err.message);
    }
    return null;
};

const listOfFamily = async (listId, familyId) => {
    const list = await db.get('SELECT * FROM wishlists WHERE id = ? AND family_id = ?', [listId, familyId]);
    if (!list) throw new HttpError(404, 'Wunschliste nicht gefunden');
    return list;
};

const itemOfList = async (itemId, listId) => {
    const item = await db.get('SELECT * FROM wishlist_items WHERE id = ? AND wishlist_id = ?', [itemId, listId]);
    if (!item) throw new HttpError(404, 'Wunsch nicht gefunden');
    return item;
};

router.get('/', async (req, res) => {
    const lists = await db.all(
        `SELECT w.*, COALESCE(u.username, 'Unbekannt') AS owner_name FROM wishlists w
         LEFT JOIN users u ON w.user_id = u.id WHERE w.family_id = ? ORDER BY w.created_at DESC`,
        [req.user.family_id],
    );
    if (lists.length === 0) return res.json([]);
    const items = await db.all(
        `SELECT i.*, u.username AS reserved_by_name FROM wishlist_items i
         JOIN wishlists w ON i.wishlist_id = w.id
         LEFT JOIN users u ON i.reserved_by = u.id
         WHERE w.family_id = ? ORDER BY i.created_at ASC`,
        [req.user.family_id],
    );
    res.json(lists.map(list => ({
        ...list,
        // The owner must not see who reserved (= bought) which gift.
        items: items.filter(i => i.wishlist_id === list.id).map(i => (list.user_id === req.user.id ? { ...i, reserved_by: null, reserved_by_name: null } : i)),
    })));
});

router.post('/', async (req, res) => {
    const title = trimOrNull(req.body.title);
    if (!title) throw new HttpError(400, 'Titel fehlt');
    const id = uuid();
    await db.run('INSERT INTO wishlists (id, family_id, user_id, title) VALUES (?, ?, ?, ?)', [id, req.user.family_id, req.user.id, title]);
    res.json({ id, family_id: req.user.family_id, user_id: req.user.id, title, items: [], owner_name: req.user.username });
});

router.put('/:id', async (req, res) => {
    const list = await listOfFamily(req.params.id, req.user.family_id);
    if (list.user_id !== req.user.id) throw new HttpError(403, 'Nur die eigene Liste kann umbenannt werden');
    const title = trimOrNull(req.body.title);
    if (!title) throw new HttpError(400, 'Titel fehlt');
    await db.run('UPDATE wishlists SET title = ? WHERE id = ?', [title, list.id]);
    res.json({ success: true });
});

router.delete('/:id', async (req, res) => {
    const list = await listOfFamily(req.params.id, req.user.family_id);
    if (list.user_id !== req.user.id && req.user.role !== 'admin') throw new HttpError(403, 'Keine Berechtigung');
    await db.run('DELETE FROM wishlists WHERE id = ?', [list.id]);
    res.json({ success: true });
});

// --- Items ---
router.post('/:listId/items', async (req, res) => {
    const list = await listOfFamily(req.params.listId, req.user.family_id);
    if (list.user_id !== req.user.id) throw new HttpError(403, 'Du kannst nur deiner eigenen Liste Wünsche hinzufügen');
    const title = trimOrNull(req.body.title);
    if (!title) throw new HttpError(400, 'Titel fehlt');
    const url = trimOrNull(req.body.url);
    const imageUrl = await fetchPreviewImage(url);
    const id = uuid();
    const price = toNumber(req.body.price, null);
    const notes = trimOrNull(req.body.notes);
    await db.run('INSERT INTO wishlist_items (id, wishlist_id, title, url, price, notes, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, list.id, title, url, price, notes, imageUrl]);
    res.json({ id, wishlist_id: list.id, title, url, price, notes, image_url: imageUrl, reserved_by: null });
});

router.put('/:listId/items/:itemId', async (req, res) => {
    const list = await listOfFamily(req.params.listId, req.user.family_id);
    if (list.user_id !== req.user.id) throw new HttpError(403, 'Du kannst nur deine eigene Liste bearbeiten');
    const item = await itemOfList(req.params.itemId, list.id);
    const title = trimOrNull(req.body.title);
    if (!title) throw new HttpError(400, 'Titel fehlt');
    const url = trimOrNull(req.body.url);
    let imageUrl = item.image_url;
    if (!url) imageUrl = null;
    else if (url !== item.url || !imageUrl) imageUrl = await fetchPreviewImage(url);
    await db.run('UPDATE wishlist_items SET title = ?, url = ?, price = ?, notes = ?, image_url = ? WHERE id = ?', [title, url, toNumber(req.body.price, null), trimOrNull(req.body.notes), imageUrl, item.id]);
    res.json({ success: true, image_url: imageUrl });
});

router.delete('/:listId/items/:itemId', async (req, res) => {
    const list = await listOfFamily(req.params.listId, req.user.family_id);
    if (list.user_id !== req.user.id) throw new HttpError(403, 'Du kannst nur aus deiner eigenen Liste löschen');
    await db.run('DELETE FROM wishlist_items WHERE id = ? AND wishlist_id = ?', [req.params.itemId, list.id]);
    res.json({ success: true });
});

// --- Reservations ---
// Bug in the old version: the item id was never checked against the list/family,
// so items of *other families* could be (un)reserved.
router.post('/:listId/items/:itemId/reserve', async (req, res) => {
    const list = await listOfFamily(req.params.listId, req.user.family_id);
    if (list.user_id === req.user.id) throw new HttpError(400, 'Du kannst Wünsche auf deiner eigenen Liste nicht reservieren!');
    const item = await itemOfList(req.params.itemId, list.id);
    if (item.reserved_by) throw new HttpError(400, 'Dieser Wunsch ist bereits reserviert.');
    const { changes } = await db.run('UPDATE wishlist_items SET reserved_by = ? WHERE id = ? AND reserved_by IS NULL', [req.user.id, item.id]);
    if (!changes) throw new HttpError(409, 'Dieser Wunsch wurde gerade von jemand anderem reserviert.');
    res.json({ success: true, reserved_by: req.user.id, reserved_by_name: req.user.username });
});

router.post('/:listId/items/:itemId/unreserve', async (req, res) => {
    const list = await listOfFamily(req.params.listId, req.user.family_id);
    const item = await itemOfList(req.params.itemId, list.id);
    if (item.reserved_by !== req.user.id && req.user.role !== 'admin') throw new HttpError(403, 'Du kannst nur deine eigenen Reservierungen aufheben.');
    await db.run('UPDATE wishlist_items SET reserved_by = NULL WHERE id = ?', [item.id]);
    res.json({ success: true, reserved_by: null, reserved_by_name: null });
});

module.exports = router;
