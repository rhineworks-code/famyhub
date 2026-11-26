'use strict';

const db = require('../db');
const { featureGuard } = require('../middleware/auth');
const { createRouter, HttpError, trimOrNull } = require('../utils/http');

const router = createRouter();
router.use(featureGuard('pocket_money'));

const isParent = (req) => req.user.role === 'admin';
const round2 = (n) => Math.round(n * 100) / 100;

router.get('/:userId', async (req, res) => {
    const targetId = Number(req.params.userId);
    if (!isParent(req) && req.user.id !== targetId) throw new HttpError(403, 'Zugriff verweigert');

    const user = await db.get('SELECT id, username, pocket_money_balance FROM users WHERE id = ? AND family_id = ?', [targetId, req.user.family_id]);
    if (!user) throw new HttpError(404, 'Benutzer nicht gefunden');
    const transactions = await db.all(
        `SELECT t.*, u.username AS created_by_name FROM pocket_money_transactions t
         LEFT JOIN users u ON t.created_by = u.id
         WHERE t.user_id = ? ORDER BY t.created_at DESC, t.id DESC LIMIT 500`,
        [user.id],
    );
    res.json({ user: { id: user.id, name: user.username }, balance: user.pocket_money_balance || 0, transactions });
});

router.post('/:userId/transaction', async (req, res) => {
    if (!isParent(req)) throw new HttpError(403, 'Nur Eltern (Admins) können Taschengeld verwalten');
    // Bug in the old version: amounts arrived as strings ("5" + 10 = "105") and an invalid amount
    // crashed the request with "alert is not defined".
    const amount = round2(Number(String(req.body.amount ?? '').replace(',', '.')));
    const { type } = req.body;
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) throw new HttpError(400, 'Ungültiger Betrag');
    if (type !== 'deposit' && type !== 'withdrawal') throw new HttpError(400, 'Ungültiger Typ');

    const user = await db.get('SELECT id FROM users WHERE id = ? AND family_id = ?', [req.params.userId, req.user.family_id]);
    if (!user) throw new HttpError(404, 'Kind nicht gefunden');

    const balance = await db.transaction(async (tx) => {
        await tx.run('INSERT INTO pocket_money_transactions (user_id, amount, type, reason, created_by) VALUES (?, ?, ?, ?, ?)', [user.id, amount, type, trimOrNull(req.body.reason) || '', req.user.id]);
        const delta = type === 'deposit' ? amount : -amount;
        await tx.run('UPDATE users SET pocket_money_balance = ROUND(COALESCE(pocket_money_balance, 0) + ?, 2) WHERE id = ?', [delta, user.id]);
        return (await tx.get('SELECT pocket_money_balance AS b FROM users WHERE id = ?', [user.id])).b;
    });
    res.json({ message: 'Transaktion erfolgreich', balance });
});

module.exports = router;
