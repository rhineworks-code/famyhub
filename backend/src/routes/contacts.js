'use strict';

const db = require('../db');
const { featureGuard } = require('../middleware/auth');
const { createRouter, HttpError, trimOrNull, toBoolInt, uuid } = require('../utils/http');

const router = createRouter();
router.use(featureGuard('contacts'));

const TEXT_FIELDS = ['relationship', 'phone', 'email', 'address', 'notes'];

router.get('/', async (req, res) => {
    res.json(await db.all('SELECT * FROM contacts WHERE family_id = ? ORDER BY is_emergency DESC, is_favorite DESC, name COLLATE NOCASE', [req.user.family_id]));
});

router.post('/', async (req, res) => {
    const name = trimOrNull(req.body.name);
    if (!name) throw new HttpError(400, 'Name fehlt');
    const id = uuid();
    const values = TEXT_FIELDS.map(f => trimOrNull(req.body[f]));
    await db.run(
        `INSERT INTO contacts (id, family_id, name, ${TEXT_FIELDS.join(', ')}, is_emergency, is_favorite) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, req.user.family_id, name, ...values, toBoolInt(req.body.is_emergency), toBoolInt(req.body.is_favorite)],
    );
    res.json(await db.get('SELECT * FROM contacts WHERE id = ?', [id]));
});

router.put('/:id', async (req, res) => {
    const row = await db.get('SELECT * FROM contacts WHERE id = ? AND family_id = ?', [req.params.id, req.user.family_id]);
    if (!row) throw new HttpError(404, 'Kontakt nicht gefunden');
    const next = { ...row };
    if (req.body.name !== undefined) next.name = trimOrNull(req.body.name) || row.name;
    for (const f of TEXT_FIELDS) if (req.body[f] !== undefined) next[f] = trimOrNull(req.body[f]);
    if (req.body.is_emergency !== undefined) next.is_emergency = toBoolInt(req.body.is_emergency);
    if (req.body.is_favorite !== undefined) next.is_favorite = toBoolInt(req.body.is_favorite);
    await db.run(
        `UPDATE contacts SET name = ?, ${TEXT_FIELDS.map(f => `${f} = ?`).join(', ')}, is_emergency = ?, is_favorite = ? WHERE id = ?`,
        [next.name, ...TEXT_FIELDS.map(f => next[f]), next.is_emergency, next.is_favorite, row.id],
    );
    res.json({ message: 'Kontakt aktualisiert' });
});

router.delete('/:id', async (req, res) => {
    const { changes } = await db.run('DELETE FROM contacts WHERE id = ? AND family_id = ?', [req.params.id, req.user.family_id]);
    if (!changes) throw new HttpError(404, 'Kontakt nicht gefunden');
    res.json({ message: 'Kontakt gelöscht' });
});

module.exports = router;
