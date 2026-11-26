'use strict';

const db = require('../db');
const { featureGuard } = require('../middleware/auth');
const { createRouter, HttpError, trimOrNull, toBoolInt, toNumber, parseDbDate } = require('../utils/http');
const config = require('../config');

const router = createRouter();
router.use(featureGuard('chores'));

const isParent = (req) => req.user.role === 'admin';
const INTERVALS = ['daily', '3d', 'weekly', 'biweekly', 'monthly', '3m', '6m', 'yearly'];

/** Calendar date (YYYY-MM-DD) in the family's time zone – the container runs in UTC. */
const localDay = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const localParts = (date) => {
    const [y, m] = localDay(date).split('-').map(Number);
    return { y, m };
};

/** Was a recurring chore already done in the current interval? (single source of truth for list + complete) */
const doneInInterval = (interval, lastCompletion, now = new Date()) => {
    if (!lastCompletion) return false;
    const last = parseDbDate(lastCompletion);
    const days = (now - last) / 864e5;
    const a = localParts(last);
    const b = localParts(now);
    const months = (b.y - a.y) * 12 + (b.m - a.m);
    switch (interval || 'daily') {
        case 'daily': return localDay(last) === localDay(now);
        case '3d': return days < 3;
        case 'weekly': return days < 7;
        case 'biweekly': return days < 14;
        case 'monthly': return months === 0;
        case '3m': return months < 3;
        case '6m': return months < 6;
        case 'yearly': return a.y === b.y;
        default: return false;
    }
};

router.get('/', async (req, res) => {
    const familyId = req.user.family_id;
    const leaderboard = await db.all(
        "SELECT id, username, username AS name, points_balance, role, profile_picture FROM users WHERE family_id = ? AND role != 'admin' ORDER BY points_balance DESC",
        [familyId],
    );
    const chores = await db.all('SELECT * FROM chores WHERE family_id = ? ORDER BY completed ASC, due_date IS NULL, due_date ASC, id DESC', [familyId]);
    const last = await db.all('SELECT chore_id, MAX(completed_at) AS last FROM chore_completions WHERE family_id = ? GROUP BY chore_id', [familyId]);
    const lastByChore = new Map(last.map(r => [r.chore_id, r.last]));
    const history = await db.all(
        `SELECT cc.*, c.title, COALESCE(u.username, 'Unbekannt') AS completed_by_name
         FROM chore_completions cc
         JOIN chores c ON cc.chore_id = c.id
         LEFT JOIN users u ON cc.user_id = u.id
         WHERE cc.family_id = ? ORDER BY cc.completed_at DESC LIMIT 20`,
        [familyId],
    );
    res.json({
        chores: chores.map(c => ({
            ...c,
            completed_today: c.is_recurring ? doneInInterval(c.recurring_interval, lastByChore.get(c.id)) : c.completed === 1,
        })),
        leaderboard,
        history,
    });
});

const normalize = (body) => {
    const title = trimOrNull(body.title);
    if (!title) throw new HttpError(400, 'Titel fehlt');
    return {
        title,
        description: trimOrNull(body.description) || '',
        points: Math.max(0, Math.min(10000, toNumber(body.points, 10))),
        assigned_to: body.assigned_to ? Number(body.assigned_to) : null,
        due_date: trimOrNull(body.due_date),
        is_recurring: toBoolInt(body.is_recurring),
        recurring_interval: INTERVALS.includes(body.recurring_interval) ? body.recurring_interval : 'daily',
    };
};

const assertMember = async (userId, familyId) => {
    if (!userId) return;
    const u = await db.get('SELECT id FROM users WHERE id = ? AND family_id = ?', [userId, familyId]);
    if (!u) throw new HttpError(400, 'Zugewiesenes Mitglied nicht gefunden');
};

router.post('/', async (req, res) => {
    if (!isParent(req)) throw new HttpError(403, 'Nur Eltern können Aufgaben erstellen');
    const c = normalize(req.body);
    await assertMember(c.assigned_to, req.user.family_id);
    const { lastID } = await db.run(
        'INSERT INTO chores (family_id, title, description, points, assigned_to, due_date, is_recurring, recurring_interval) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [req.user.family_id, c.title, c.description, c.points, c.assigned_to, c.due_date, c.is_recurring, c.recurring_interval],
    );
    res.json({ id: lastID, message: 'Aufgabe erstellt' });
});

router.put('/:id', async (req, res) => {
    if (!isParent(req)) throw new HttpError(403, 'Nur Eltern können Aufgaben bearbeiten');
    const c = normalize(req.body);
    await assertMember(c.assigned_to, req.user.family_id);
    const { changes } = await db.run(
        `UPDATE chores SET title = ?, description = ?, points = ?, assigned_to = ?, due_date = ?, is_recurring = ?, recurring_interval = ?
         WHERE id = ? AND family_id = ?`,
        [c.title, c.description, c.points, c.assigned_to, c.due_date, c.is_recurring, c.recurring_interval, req.params.id, req.user.family_id],
    );
    if (!changes) throw new HttpError(404, 'Aufgabe nicht gefunden');
    res.json({ message: 'Aufgabe aktualisiert' });
});

router.put('/:id/complete', async (req, res) => {
    const chore = await db.get('SELECT * FROM chores WHERE id = ? AND family_id = ?', [req.params.id, req.user.family_id]);
    if (!chore) throw new HttpError(404, 'Aufgabe nicht gefunden');
    if (chore.assigned_to && chore.assigned_to !== req.user.id && !isParent(req)) throw new HttpError(403, 'Diese Aufgabe ist jemand anderem zugewiesen');

    if (chore.is_recurring) {
        const last = await db.get('SELECT MAX(completed_at) AS last FROM chore_completions WHERE chore_id = ?', [chore.id]);
        if (doneInInterval(chore.recurring_interval, last?.last)) throw new HttpError(400, 'Diese Aufgabe wurde im aktuellen Intervall schon erledigt');
    } else if (chore.completed) {
        throw new HttpError(400, 'Aufgabe ist bereits erledigt');
    }

    const points = chore.points || 0;
    // A parent ticking off a child's task credits the child.
    const creditTo = chore.assigned_to && isParent(req) ? chore.assigned_to : req.user.id;
    await db.transaction(async (tx) => {
        await tx.run('INSERT INTO chore_completions (chore_id, user_id, family_id, points_earned) VALUES (?, ?, ?, ?)', [chore.id, creditTo, req.user.family_id, points]);
        if (!chore.is_recurring) {
            await tx.run('UPDATE chores SET completed = 1, completed_by = ?, completed_at = ? WHERE id = ?', [creditTo, new Date().toISOString(), chore.id]);
        }
        if (points > 0) await tx.run('UPDATE users SET points_balance = COALESCE(points_balance, 0) + ? WHERE id = ?', [points, creditTo]);
    });
    res.json({ message: points > 0 ? 'Erledigt! Punkte gesammelt.' : 'Aufgabe als erledigt markiert.', points });
});

// Undo a one-off chore (e.g. ticked by mistake)
router.put('/:id/reopen', async (req, res) => {
    if (!isParent(req)) throw new HttpError(403, 'Nur Eltern können Aufgaben zurücksetzen');
    const chore = await db.get('SELECT * FROM chores WHERE id = ? AND family_id = ?', [req.params.id, req.user.family_id]);
    if (!chore) throw new HttpError(404, 'Aufgabe nicht gefunden');
    await db.run('UPDATE chores SET completed = 0, completed_by = NULL, completed_at = NULL WHERE id = ?', [chore.id]);
    res.json({ message: 'Aufgabe wieder offen' });
});

router.delete('/:id', async (req, res) => {
    if (!isParent(req)) throw new HttpError(403, 'Nur Eltern können Aufgaben löschen');
    await db.run('DELETE FROM chores WHERE id = ? AND family_id = ?', [req.params.id, req.user.family_id]);
    res.json({ message: 'Gelöscht' });
});

module.exports = router;
module.exports.doneInInterval = doneInInterval;
