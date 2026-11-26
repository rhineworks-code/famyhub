'use strict';

const db = require('../db');
const { featureGuard } = require('../middleware/auth');
const { createRouter, HttpError, parseJSON, trimOrNull, toBoolInt, uuid } = require('../utils/http');

const router = createRouter();
router.use(featureGuard('projects'));

const INTERVALS = { '7_days': [7, 0], '14_days': [14, 0], '1_month': [0, 1], '2_months': [0, 2], '3_months': [0, 3], '6_months': [0, 6], '9_months': [0, 9], '12_months': [0, 12] };

const parseAssigned = (value) => {
    const parsed = parseJSON(value, null);
    if (Array.isArray(parsed)) return parsed;
    return value ? [value] : [];
};

const projectOfFamily = async (id, familyId) => {
    const p = await db.get('SELECT * FROM projects WHERE id = ? AND family_id = ?', [id, familyId]);
    if (!p) throw new HttpError(404, 'Projekt nicht gefunden');
    return p;
};

router.get('/', async (req, res) => {
    const projects = await db.all('SELECT * FROM projects WHERE family_id = ? ORDER BY deadline IS NULL, deadline ASC, created_at DESC', [req.user.family_id]);
    if (projects.length === 0) return res.json([]);
    const ids = projects.map(p => p.id);
    const todos = await db.all(`SELECT id, project_id, task, completed, urgency FROM project_todos WHERE project_id IN (${db.placeholders(ids)}) ORDER BY created_at`, ids);
    const milestones = await db.all(`SELECT id, project_id, title, due_date, completed FROM project_milestones WHERE project_id IN (${db.placeholders(ids)}) ORDER BY due_date IS NULL, due_date, created_at`, ids);
    res.json(projects.map(p => ({
        ...p,
        assigned_to: parseAssigned(p.assigned_to),
        todos: todos.filter(t => t.project_id === p.id).map(({ project_id, ...t }) => t),
        milestones: milestones.filter(m => m.project_id === p.id).map(({ project_id, ...m }) => m),
    })));
});

router.post('/', async (req, res) => {
    const title = trimOrNull(req.body.title);
    if (!title) throw new HttpError(400, 'Titel fehlt');
    const id = uuid();
    const assigned = Array.isArray(req.body.assigned_to) ? req.body.assigned_to : [];
    const interval = INTERVALS[req.body.recurring_interval] ? req.body.recurring_interval : null;
    await db.run(
        'INSERT INTO projects (id, family_id, title, description, deadline, recurring_interval, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, req.user.family_id, title, trimOrNull(req.body.description), trimOrNull(req.body.deadline), interval, JSON.stringify(assigned)],
    );
    res.json({ id, title, description: req.body.description || null, deadline: req.body.deadline || null, recurring_interval: interval, assigned_to: assigned, todos: [], milestones: [] });
});

router.put('/:id', async (req, res) => {
    const project = await projectOfFamily(req.params.id, req.user.family_id);
    const title = req.body.title !== undefined ? trimOrNull(req.body.title) : project.title;
    if (!title) throw new HttpError(400, 'Titel fehlt');
    const assigned = Array.isArray(req.body.assigned_to) ? req.body.assigned_to : parseAssigned(project.assigned_to);
    const interval = req.body.recurring_interval !== undefined ? (INTERVALS[req.body.recurring_interval] ? req.body.recurring_interval : null) : project.recurring_interval;
    await db.run(
        'UPDATE projects SET title = ?, description = ?, deadline = ?, recurring_interval = ?, assigned_to = ? WHERE id = ?',
        [title,
            req.body.description !== undefined ? trimOrNull(req.body.description) : project.description,
            req.body.deadline !== undefined ? trimOrNull(req.body.deadline) : project.deadline,
            interval, JSON.stringify(assigned), project.id],
    );
    res.json({ message: 'Projekt aktualisiert' });
});

/** Completing a recurring project moves the deadline forward and resets all todos/milestones. */
router.post('/:id/complete', async (req, res) => {
    const project = await projectOfFamily(req.params.id, req.user.family_id);
    let nextDeadline = null;
    const step = INTERVALS[project.recurring_interval];
    if (project.deadline && step) {
        const [y, m, dd] = String(project.deadline).slice(0, 10).split('-').map(Number);
        // Month steps are clamped to the month's last day (31 Jan + 1 month = 28 Feb, not 3 March).
        const targetMonth = new Date(Date.UTC(y, m - 1 + step[1], 1));
        const lastDay = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0)).getUTCDate();
        const d = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth(), Math.min(dd, lastDay)));
        d.setUTCDate(d.getUTCDate() + step[0]);
        nextDeadline = d.toISOString().slice(0, 10);
    }
    await db.transaction(async (tx) => {
        if (nextDeadline) await tx.run('UPDATE projects SET deadline = ? WHERE id = ?', [nextDeadline, project.id]);
        await tx.run('UPDATE project_todos SET completed = 0 WHERE project_id = ?', [project.id]);
        await tx.run('UPDATE project_milestones SET completed = 0 WHERE project_id = ?', [project.id]);
    });
    res.json({ message: 'Projekt erledigt und zurückgesetzt', nextDeadline });
});

router.delete('/:id', async (req, res) => {
    const project = await projectOfFamily(req.params.id, req.user.family_id);
    await db.run('DELETE FROM projects WHERE id = ?', [project.id]);
    res.json({ message: 'Projekt gelöscht' });
});

// --- Todos ---
router.post('/:projectId/todos', async (req, res) => {
    const task = trimOrNull(req.body.task);
    if (!task) throw new HttpError(400, 'Aufgabe fehlt');
    const project = await projectOfFamily(req.params.projectId, req.user.family_id);
    const id = uuid();
    const urgency = req.body.urgency || 'normal';
    await db.run('INSERT INTO project_todos (id, project_id, task, urgency) VALUES (?, ?, ?, ?)', [id, project.id, task, urgency]);
    res.json({ id, task, completed: 0, urgency });
});

const updateChild = async (table, req, res, fields) => {
    const project = await projectOfFamily(req.params.projectId, req.user.family_id);
    const childId = req.params.todoId || req.params.milestoneId;
    const sets = [];
    const params = [];
    for (const [field, transform] of Object.entries(fields)) {
        if (req.body[field] !== undefined) { sets.push(`${field} = ?`); params.push(transform(req.body[field])); }
    }
    if (sets.length === 0) throw new HttpError(400, 'Keine Änderungen');
    const { changes } = await db.run(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ? AND project_id = ?`, [...params, childId, project.id]);
    if (!changes) throw new HttpError(404, 'Eintrag nicht gefunden');
    res.json({ message: 'Aktualisiert' });
};

router.put('/:projectId/todos/:todoId', (req, res) => updateChild('project_todos', req, res, { task: v => trimOrNull(v) || '', completed: toBoolInt, urgency: v => String(v) }));

router.delete('/:projectId/todos/:todoId', async (req, res) => {
    const project = await projectOfFamily(req.params.projectId, req.user.family_id);
    const { changes } = await db.run('DELETE FROM project_todos WHERE id = ? AND project_id = ?', [req.params.todoId, project.id]);
    if (!changes) throw new HttpError(404, 'Aufgabe nicht gefunden');
    res.json({ message: 'Aufgabe gelöscht' });
});

// --- Milestones ---
router.post('/:projectId/milestones', async (req, res) => {
    const title = trimOrNull(req.body.title);
    if (!title) throw new HttpError(400, 'Titel fehlt');
    const project = await projectOfFamily(req.params.projectId, req.user.family_id);
    const id = uuid();
    const due = trimOrNull(req.body.due_date);
    await db.run('INSERT INTO project_milestones (id, project_id, title, due_date) VALUES (?, ?, ?, ?)', [id, project.id, title, due]);
    res.json({ id, title, due_date: due, completed: 0 });
});

router.put('/:projectId/milestones/:milestoneId', (req, res) => updateChild('project_milestones', req, res, { title: v => trimOrNull(v) || '', due_date: v => trimOrNull(v), completed: toBoolInt }));

router.delete('/:projectId/milestones/:milestoneId', async (req, res) => {
    const project = await projectOfFamily(req.params.projectId, req.user.family_id);
    const { changes } = await db.run('DELETE FROM project_milestones WHERE id = ? AND project_id = ?', [req.params.milestoneId, project.id]);
    if (!changes) throw new HttpError(404, 'Meilenstein nicht gefunden');
    res.json({ message: 'Meilenstein gelöscht' });
});

module.exports = router;
