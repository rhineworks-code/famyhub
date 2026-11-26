'use strict';

const db = require('../db');
const { featureGuard } = require('../middleware/auth');
const { createRouter, HttpError, parseJSON, trimOrNull, toBoolInt, toNumber, uuid } = require('../utils/http');

const router = createRouter();
router.use(featureGuard('contracts'));

// --- Categories ---
router.get('/categories', async (req, res) => {
    res.json(await db.all('SELECT * FROM contract_categories WHERE family_id = ? ORDER BY name COLLATE NOCASE', [req.user.family_id]));
});

router.post('/categories', async (req, res) => {
    const name = trimOrNull(req.body.name);
    if (!name) throw new HttpError(400, 'Name fehlt');
    const id = uuid();
    const predicted = toBoolInt(req.body.is_predicted);
    await db.run('INSERT INTO contract_categories (id, family_id, name, is_predicted) VALUES (?, ?, ?, ?)', [id, req.user.family_id, name, predicted]);
    res.json({ id, name, is_predicted: predicted });
});

router.put('/categories/:id', async (req, res) => {
    const name = trimOrNull(req.body.name);
    if (!name) throw new HttpError(400, 'Name fehlt');
    const { changes } = await db.run('UPDATE contract_categories SET name = ? WHERE id = ? AND family_id = ?', [name, req.params.id, req.user.family_id]);
    if (!changes) throw new HttpError(404, 'Kategorie nicht gefunden');
    res.json({ message: 'Kategorie aktualisiert' });
});

router.delete('/categories/:id', async (req, res) => {
    const { changes } = await db.run('DELETE FROM contract_categories WHERE id = ? AND family_id = ?', [req.params.id, req.user.family_id]);
    if (!changes) throw new HttpError(404, 'Kategorie nicht gefunden');
    res.json({ message: 'Kategorie gelöscht' });
});

// The old query used `users.name`, which does not exist on fresh installs → the contracts page crashed.
router.get('/family-members', async (req, res) => {
    res.json(await db.all('SELECT id, username AS name, username, display_role FROM users WHERE family_id = ? ORDER BY username COLLATE NOCASE', [req.user.family_id]));
});

// --- Contracts ---
const normalize = (body) => {
    const provider = trimOrNull(body.provider);
    const type = trimOrNull(body.type);
    if (!provider || !type) throw new HttpError(400, 'Anbieter und Art sind erforderlich');
    const shares = Array.isArray(body.split_shares) && body.split_shares.length > 0 ? JSON.stringify(body.split_shares) : null;
    return {
        provider, type,
        start_date: trimOrNull(body.start_date),
        end_date: trimOrNull(body.end_date),
        notice_period_months: toNumber(body.notice_period_months, 0),
        cost: toNumber(body.cost, 0),
        billing_interval: toNumber(body.billing_interval, 1) || 1,
        billing_day: toNumber(body.billing_day, null),
        billing_start_month: toNumber(body.billing_start_month, null),
        is_shared: toBoolInt(body.is_shared),
        is_predicted: toBoolInt(body.is_predicted),
        notes: trimOrNull(body.notes),
        split_shares: shares,
    };
};

const FIELDS = ['provider', 'type', 'start_date', 'end_date', 'notice_period_months', 'cost', 'billing_interval', 'billing_day', 'billing_start_month', 'is_shared', 'is_predicted', 'notes', 'split_shares'];

router.get('/', async (req, res) => {
    const rows = await db.all(
        `SELECT c.*, u.username AS user_name FROM contracts c LEFT JOIN users u ON c.user_id = u.id
         WHERE c.family_id = ? ORDER BY c.type, c.provider`,
        [req.user.family_id],
    );
    res.json(rows.map(r => ({ ...r, split_shares: parseJSON(r.split_shares, []) || [] })));
});

router.post('/', async (req, res) => {
    const c = normalize(req.body);
    const id = uuid();
    await db.run(
        `INSERT INTO contracts (id, family_id, user_id, ${FIELDS.join(', ')}) VALUES (?, ?, ?, ${db.placeholders(FIELDS)})`,
        [id, req.user.family_id, req.user.id, ...FIELDS.map(f => c[f])],
    );
    res.json({ id, user_id: req.user.id, user_name: req.user.username, ...c, split_shares: parseJSON(c.split_shares, []) || [] });
});

router.put('/:id', async (req, res) => {
    const c = normalize(req.body);
    const { changes } = await db.run(
        `UPDATE contracts SET ${FIELDS.map(f => `${f} = ?`).join(', ')} WHERE id = ? AND family_id = ?`,
        [...FIELDS.map(f => c[f]), req.params.id, req.user.family_id],
    );
    if (!changes) throw new HttpError(404, 'Vertrag nicht gefunden');
    res.json({ message: 'Vertrag aktualisiert' });
});

router.delete('/:id', async (req, res) => {
    const { changes } = await db.run('DELETE FROM contracts WHERE id = ? AND family_id = ?', [req.params.id, req.user.family_id]);
    if (!changes) throw new HttpError(404, 'Vertrag nicht gefunden');
    res.json({ message: 'Vertrag gelöscht' });
});

module.exports = router;
