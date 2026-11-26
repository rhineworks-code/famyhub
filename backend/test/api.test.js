'use strict';

/**
 * End-to-end API tests against a real server instance with a temporary database.
 * Run with: npm test
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'famyhub-test-'));
process.env.DATA_DIR = path.join(tmp, 'data');
process.env.UPLOADS_DIR = path.join(tmp, 'uploads');
process.env.PUBLIC_DIR = path.join(tmp, 'public-missing');
process.env.NODE_ENV = 'production';
process.env.PORT = '0';

let base;
let server;

const call = async (method, url, { token, body, form, headers = {} } = {}) => {
    const opts = { method, headers: { ...headers } };
    if (token) opts.headers.Authorization = `Bearer ${token}`;
    if (form) opts.body = form;
    else if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers['Content-Type'] = 'application/json'; }
    const res = await fetch(base + url, opts);
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) { /* not json */ }
    return { status: res.status, body: json, text, headers: res.headers };
};

const ctx = {};

before(async () => {
    const { start } = require('../src/server');
    server = await start();
    await new Promise(r => (server.listening ? r() : server.on('listening', r)));
    base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    require('../src/services/scheduler').stop();
    await new Promise(r => server.close(r));
    await require('../src/db').close();
    fs.rmSync(tmp, { recursive: true, force: true });
});

test('setup + login', async () => {
    let r = await call('GET', '/api/auth/status');
    assert.equal(r.body.initialized, false);

    r = await call('POST', '/api/system/setup-initial', { body: { username: 'mama', email: 'mama@example.org', password: 'geheim123', familyName: 'Test' } });
    assert.equal(r.status, 201, r.text);
    ctx.admin = r.body.token;
    assert.equal(r.body.user.role, 'admin');

    r = await call('POST', '/api/system/setup-initial', { body: { username: 'x', email: 'x@example.org', password: 'geheim123', familyName: 'X' } });
    assert.equal(r.status, 403, 'second setup must be refused');

    r = await call('POST', '/api/auth/login', { body: { email: 'MAMA@example.org', password: 'falsch' } });
    assert.equal(r.status, 401);
    r = await call('POST', '/api/auth/login', { body: { email: 'mama', password: 'geheim123' } });
    assert.equal(r.status, 200);
    assert.ok(r.headers.get('set-cookie').includes('fh_token='), 'session cookie set');
    assert.ok(r.body.user.permissions.calendar);
});

test('open registration is closed by default', async () => {
    const r = await call('POST', '/api/auth/register', { body: { name: 'evil', email: 'evil@example.org', password: 'geheim123' } });
    assert.equal(r.status, 403);
});

test('invalid / forged tokens are rejected', async () => {
    const jwt = require('jsonwebtoken');
    const forged = jwt.sign({ id: 1, role: 'admin', family_id: 1 }, 'supersecretfamilykeychangeinproduction');
    let r = await call('GET', '/api/auth/me', { token: forged });
    assert.equal(r.status, 401);
    r = await call('GET', '/api/calendar');
    assert.equal(r.status, 401);
});

test('family members, roles and permissions', async () => {
    let r = await call('POST', '/api/auth/family/members', { token: ctx.admin, body: { username: 'kind', password: 'kind1234', role: 'member' } });
    assert.equal(r.status, 201, r.text);
    ctx.kindId = r.body.id;

    r = await call('POST', '/api/auth/login', { body: { username: 'kind', password: 'kind1234' } });
    ctx.kind = r.body.token;
    assert.equal(r.body.user.role, 'member');

    // Member must not be able to use admin endpoints
    r = await call('POST', '/api/auth/family/members', { token: ctx.kind, body: { username: 'x2', password: 'geheim123' } });
    assert.equal(r.status, 403);
    r = await call('GET', '/api/system/export', { token: ctx.kind });
    assert.equal(r.status, 403);

    // Disable vault for the child → backend blocks it
    r = await call('PUT', `/api/auth/user/${ctx.kindId}/permissions`, { token: ctx.admin, body: { permissions: { vault: false } } });
    assert.equal(r.status, 200);
    r = await call('GET', '/api/vault', { token: ctx.kind });
    assert.equal(r.status, 403);
    r = await call('GET', '/api/auth/me', { token: ctx.kind });
    assert.equal(r.body.permissions.vault, false);
    r = await call('GET', '/api/auth/family/members', { token: ctx.admin });
    assert.equal(r.body.find(m => m.id === ctx.kindId).permissions.vault, false);

    // Admin cannot delete himself; must keep one admin
    const me = (await call('GET', '/api/auth/me', { token: ctx.admin })).body;
    r = await call('DELETE', `/api/auth/family/members/${me.id}`, { token: ctx.admin });
    assert.equal(r.status, 400);
    r = await call('PUT', `/api/auth/family/members/${me.id}`, { token: ctx.admin, body: { role: 'member' } });
    assert.equal(r.status, 400);

    // SMTP password is never returned
    await call('POST', '/api/auth/admin/smtp', { token: ctx.admin, body: { host: 'smtp.example.org', port: 587, user: 'u', pass: 'topsecret', from: 'a@b.c' } });
    r = await call('GET', '/api/auth/admin/smtp', { token: ctx.admin });
    assert.equal(r.body.pass, '');
    assert.equal(r.body.hasPassword, true);
    r = await call('GET', '/api/auth/family', { token: ctx.kind });
    assert.ok(!('smtp_pass' in r.body) && !('smtp_host' in r.body));
});

test('password change invalidates old sessions but returns a new one', async () => {
    const login = await call('POST', '/api/auth/login', { body: { username: 'kind', password: 'kind1234' } });
    const old = login.body.token;
    const r = await call('POST', '/api/auth/profile/password', { token: old, body: { currentPassword: 'kind1234', newPassword: 'kind5678' } });
    assert.equal(r.status, 200, r.text);
    assert.equal((await call('GET', '/api/auth/me', { token: old })).status, 401);
    assert.equal((await call('GET', '/api/auth/me', { token: r.body.token })).status, 200);
    ctx.kind = r.body.token;
});

test('calendar: CRUD, recurrence, family isolation', async () => {
    let r = await call('POST', '/api/calendar', { token: ctx.admin, body: { title: 'Zahnarzt', start: '2026-12-01T09:00:00.000Z', end: '2026-12-01T10:00:00.000Z' } });
    assert.equal(r.status, 200, r.text);
    const id = r.body.id;

    r = await call('POST', '/api/calendar', { token: ctx.admin, body: { title: 'Sport', start: new Date().toISOString(), recurrence_pattern: 'weekly' } });
    const seriesId = r.body.id;
    r = await call('GET', '/api/calendar', { token: ctx.admin });
    const instances = r.body.filter(e => e.real_id === seriesId);
    assert.ok(instances.length > 50, 'weekly series expanded');
    assert.ok(instances[0].series_start);

    // Editing an instance id edits the series
    r = await call('PUT', `/api/calendar/${instances[3].id}`, { token: ctx.admin, body: { title: 'Sport!', start: instances[0].series_start, recurrence_pattern: 'weekly' } });
    assert.equal(r.status, 200, r.text);

    r = await call('PUT', `/api/calendar/${id}`, { token: ctx.admin, body: { title: 'x', start: '2026-12-02T10:00:00Z', end: '2026-12-02T09:00:00Z' } });
    assert.equal(r.status, 400, 'end before start rejected');

    r = await call('GET', '/api/sync/token', { token: ctx.admin });
    const ics = await call('GET', `/api/sync/export/${r.body.token}.ics`);
    assert.equal(ics.status, 200);
    assert.ok(ics.text.includes('BEGIN:VCALENDAR') && ics.text.includes('Zahnarzt') && ics.text.includes('RRULE:FREQ=WEEKLY'));
});

test('shopping, meals, recipes, contacts, projects', async () => {
    let r = await call('GET', '/api/shopping/lists', { token: ctx.kind });
    const listId = r.body[0].id;
    r = await call('POST', '/api/shopping', { token: ctx.kind, body: { name: 'Milch', list_id: listId } });
    assert.equal(r.status, 200);
    r = await call('POST', '/api/shopping/bulk', { token: ctx.kind, body: { list_id: listId, items: ['Eier', { name: 'Mehl' }, ''] } });
    assert.equal(r.status, 200);
    r = await call('GET', `/api/shopping?list_id=${listId}`, { token: ctx.kind });
    assert.equal(r.body.length, 3);
    r = await call('PUT', `/api/shopping/${r.body[0].id}`, { token: ctx.kind, body: { completed: 1 } });
    assert.equal(r.status, 200);

    r = await call('POST', '/api/meals', { token: ctx.kind, body: { date: '2026-12-01', meal_type: 'dinner', recipe_name: 'Pizza' } });
    const mealId = r.body.id;
    r = await call('POST', `/api/meals/${mealId}/vote`, { token: ctx.admin });
    assert.equal(r.body.voted, true);
    r = await call('GET', '/api/meals?start=2026-11-30&end=2026-12-07', { token: ctx.admin });
    assert.equal(r.body[0].vote_count, 1);

    r = await call('POST', '/api/recipes', { token: ctx.admin, body: { title: 'Kuchen', ingredients: [{ name: 'Mehl', amount: '200g' }] } });
    assert.equal(r.status, 200, r.text);
    r = await call('GET', '/api/recipes', { token: ctx.admin });
    assert.equal(r.body[0].creator_name, 'mama');

    r = await call('POST', '/api/contacts', { token: ctx.admin, body: { name: 'Kinderarzt', phone: '123', is_emergency: true } });
    assert.equal(r.body.is_emergency, 1);

    r = await call('POST', '/api/projects', { token: ctx.admin, body: { title: 'Rasen', deadline: '2026-01-31', recurring_interval: '1_month' } });
    const pid = r.body.id;
    await call('POST', `/api/projects/${pid}/todos`, { token: ctx.admin, body: { task: 'Mähen' } });
    r = await call('POST', `/api/projects/${pid}/complete`, { token: ctx.admin });
    assert.equal(r.body.nextDeadline, '2026-02-28', 'month end is clamped');
    r = await call('GET', '/api/projects', { token: ctx.admin });
    assert.equal(r.body[0].todos.length, 1);
});

test('chat keeps the newest messages', async () => {
    for (let i = 0; i < 205; i += 1) {
        await require('../src/db').run("INSERT INTO messages (family_id, user_id, user_name, content, created_at) VALUES (1, 1, 'mama', ?, ?)", [`m${i}`, new Date(Date.now() - (300 - i) * 1000).toISOString()]);
    }
    let r = await call('POST', '/api/chat', { token: ctx.kind, body: { content: 'neueste' } });
    assert.equal(r.status, 200);
    r = await call('GET', '/api/chat', { token: ctx.admin });
    assert.equal(r.body.length, 200);
    assert.equal(r.body[r.body.length - 1].content, 'neueste');
    const msgId = r.body[r.body.length - 1].id;
    r = await call('POST', `/api/chat/${msgId}/react`, { token: ctx.admin, body: { emoji: '👍' } });
    assert.equal(JSON.parse(r.body.reactions)['👍'].length, 1);
});

test('pocket money handles string amounts', async () => {
    let r = await call('POST', `/api/pocket-money/${ctx.kindId}/transaction`, { token: ctx.admin, body: { amount: '5,50', type: 'deposit' } });
    assert.equal(r.status, 200, r.text);
    r = await call('POST', `/api/pocket-money/${ctx.kindId}/transaction`, { token: ctx.admin, body: { amount: '2', type: 'withdrawal' } });
    assert.equal(r.body.balance, 3.5);
    r = await call('POST', `/api/pocket-money/${ctx.kindId}/transaction`, { token: ctx.admin, body: { amount: '-1', type: 'deposit' } });
    assert.equal(r.status, 400);
    r = await call('POST', `/api/pocket-money/${ctx.kindId}/transaction`, { token: ctx.kind, body: { amount: 100, type: 'deposit' } });
    assert.equal(r.status, 403);
});

test('chores: points and interval check', async () => {
    let r = await call('POST', '/api/chores', { token: ctx.admin, body: { title: 'Zimmer aufräumen', points: 20, is_recurring: true, recurring_interval: 'daily' } });
    const id = r.body.id;
    r = await call('PUT', `/api/chores/${id}/complete`, { token: ctx.kind });
    assert.equal(r.status, 200, r.text);
    r = await call('PUT', `/api/chores/${id}/complete`, { token: ctx.kind });
    assert.equal(r.status, 400, 'only once per day');
    r = await call('GET', '/api/chores', { token: ctx.kind });
    assert.equal(r.body.chores[0].completed_today, true);
    assert.equal(r.body.leaderboard.find(u => u.id === ctx.kindId).points_balance, 20);
});

test('wishlist reservations are hidden from the owner', async () => {
    let r = await call('POST', '/api/wishlists', { token: ctx.kind, body: { title: 'Weihnachten' } });
    const listId = r.body.id;
    r = await call('POST', `/api/wishlists/${listId}/items`, { token: ctx.kind, body: { title: 'Lego' } });
    const itemId = r.body.id;
    r = await call('POST', `/api/wishlists/${listId}/items/${itemId}/reserve`, { token: ctx.kind });
    assert.equal(r.status, 400, 'own list');
    r = await call('POST', `/api/wishlists/${listId}/items/${itemId}/reserve`, { token: ctx.admin });
    assert.equal(r.status, 200);
    r = await call('GET', '/api/wishlists', { token: ctx.kind });
    assert.equal(r.body[0].items[0].reserved_by, null);
    r = await call('GET', '/api/wishlists', { token: ctx.admin });
    assert.equal(r.body[0].items[0].reserved_by_name, 'mama');
});

test('vacations incl. packing list and dream destinations', async () => {
    let r = await call('POST', '/api/vacations', { token: ctx.admin, body: { title: 'Ostsee', start_date: '2026-07-01', end_date: '2026-07-14' } });
    const vid = r.body.id;
    r = await call('POST', `/api/vacations/${vid}/items`, { token: ctx.admin, body: { title: 'Sonnencreme' } });
    assert.equal(r.status, 200, r.text);
    r = await call('PUT', `/api/vacations/${vid}/items/${r.body.id}/toggle`, { token: ctx.admin });
    assert.equal(r.status, 200);
    r = await call('GET', `/api/vacations/${vid}/items`, { token: ctx.admin });
    assert.equal(r.body[0].is_packed, 1);
    r = await call('POST', '/api/vacations/destinations', { token: ctx.admin, body: { title: 'Island' } });
    assert.equal(r.status, 200);
    r = await call('GET', '/api/vacations/destinations', { token: ctx.admin });
    assert.equal(r.body.length, 1);
});

test('vault: private entries stay private', async () => {
    let r = await call('POST', '/api/vault', { token: ctx.admin, body: { title: 'Bank', encrypted_data: 'U2FsdGVk...', is_shared: 0 } });
    assert.equal(r.status, 200);
    await call('POST', '/api/vault', { token: ctx.admin, body: { title: 'WLAN', encrypted_data: 'U2FsdGVk...', is_shared: 1 } });
    await call('PUT', `/api/auth/user/${ctx.kindId}/permissions`, { token: ctx.admin, body: { permissions: { vault: true } } });
    r = await call('GET', '/api/vault', { token: ctx.kind });
    assert.deepEqual(r.body.map(v => v.title), ['WLAN']);
});

test('uploads are protected and family-scoped', async () => {
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a40000000049454e44ae426082', 'hex');
    let r = await call('POST', '/api/gallery/albums', { token: ctx.admin, body: { name: 'Urlaub' } });
    const albumId = r.body.id;
    const form = new FormData();
    form.append('photos', new Blob([png], { type: 'image/png' }), 'bild.png');
    r = await call('POST', `/api/gallery/albums/${albumId}/upload`, { token: ctx.admin, form });
    assert.equal(r.status, 200, r.text);
    const file = r.body[0].filename;

    assert.equal((await call('GET', `/uploads/${file}`)).status, 401, 'no anonymous access');
    assert.equal((await call('GET', `/uploads/${file}`, { token: ctx.admin })).status, 200);
    assert.equal((await call('GET', '/uploads/../data/family.db', { token: ctx.admin })).status, 404);

    const bad = new FormData();
    bad.append('photos', new Blob(['<script>'], { type: 'text/html' }), 'x.html');
    r = await call('POST', `/api/gallery/albums/${albumId}/upload`, { token: ctx.admin, form: bad });
    assert.equal(r.status, 400, 'html upload refused');

    // A second family must not see the photo
    const db = require('../src/db');
    const { lastID: fam2 } = await db.run("INSERT INTO families (name, invite_code) VALUES ('Fremd', 'FREMD123')");
    const users = require('../src/services/users');
    const uid = await users.insertUser({ username: 'fremd', email: 'fremd@example.org', password: 'geheim123', familyId: fam2, role: 'admin' });
    const login = await call('POST', '/api/auth/login', { body: { username: 'fremd', password: 'geheim123' } });
    ctx.foreign = login.body.token;
    assert.ok(uid);
    assert.equal((await call('GET', `/uploads/${file}`, { token: ctx.foreign })).status, 404);
    assert.equal((await call('GET', `/api/gallery/albums/${albumId}`, { token: ctx.foreign })).status, 403);
    // Foreign admin is not system admin
    assert.equal((await call('GET', '/api/system/export', { token: ctx.foreign })).status, 403);
    // …and cannot touch our events
    const ev = (await call('GET', '/api/calendar', { token: ctx.admin })).body.find(e => e.title === 'Zahnarzt');
    assert.equal((await call('DELETE', `/api/calendar/${ev.id}`, { token: ctx.foreign })).status, 404);
});

test('documents: upload, privacy, file access', async () => {
    const form = new FormData();
    form.append('file', new Blob(['Rechnung Stadtwerke 2026'], { type: 'text/plain' }), 'rechnung.txt');
    form.append('title', 'Rechnung');
    form.append('is_shared', '0');
    let r = await call('POST', '/api/documents', { token: ctx.admin, form });
    assert.equal(r.status, 201, r.text);
    const filename = r.body.filename;

    r = await call('GET', '/api/documents', { token: ctx.admin });
    assert.equal(r.body.length, 1);
    assert.ok(r.body[0].content_text.includes('Stadtwerke'));
    r = await call('GET', '/api/documents', { token: ctx.kind });
    assert.equal(r.body.length, 0, 'private document hidden from others');

    r = await call('GET', `/api/documents/file/${filename}`, { token: ctx.admin });
    assert.equal(r.status, 200);
    assert.equal(r.text, 'Rechnung Stadtwerke 2026');
    assert.equal((await call('GET', `/api/documents/file/${filename}`, { token: ctx.kind })).status, 404);
    assert.equal((await call('GET', `/uploads/documents/${filename}`, { token: ctx.admin })).status, 404, 'not reachable via /uploads');
});

test('timeline posts and polls', async () => {
    let r = await call('POST', '/api/timeline', { token: ctx.admin, body: { type: 'poll', content: 'Pizza?', poll_data: JSON.stringify({ question: 'Pizza?', options: [{ id: 1, text: 'Ja' }, { id: 2, text: 'Nein' }] }) } });
    assert.equal(r.status, 200, r.text);
    const id = r.body.id;
    r = await call('POST', `/api/timeline/${id}/vote`, { token: ctx.kind, body: { optionId: 1 } });
    assert.equal(r.body.poll_data.options[0].votes.length, 1);
    r = await call('GET', '/api/timeline', { token: ctx.kind });
    assert.ok(r.body[0].created_at.endsWith('Z'));
    assert.equal((await call('POST', `/api/timeline/${id}/comments`, { token: ctx.foreign, body: { content: 'hi' } })).status, 404);
});

test('backup export contains database and uploads', async () => {
    const r = await fetch(`${base}/api/system/export`, { headers: { Authorization: `Bearer ${ctx.admin}` } });
    assert.equal(r.status, 200);
    const buf = Buffer.from(await r.arrayBuffer());
    const AdmZip = require('adm-zip');
    const names = new AdmZip(buf).getEntries().map(e => e.entryName);
    assert.ok(names.includes('data/family.db'));
    assert.ok(names.some(n => n.startsWith('uploads/')));
});
