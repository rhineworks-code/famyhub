'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');

const db = require('../db');
const config = require('../config');
const users = require('../services/users');
const mail = require('../services/mail');
const { makeUpload, safeUnlink, resolveUploadUrl } = require('../services/uploads');
const { requireAuth, requireAdmin, requireFamily, requireSystemAdmin, COOKIE_NAME } = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const { createRouter, HttpError, inviteCode, trimOrNull, parseJSON } = require('../utils/http');

const router = createRouter();

authenticator.options = { window: 1 };

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyFn: (req) => `${req.ip}|${String(req.body?.email || req.body?.username || '').toLowerCase()}` });
const ipLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });

const avatarUpload = makeUpload({
    dir: config.avatarsDir,
    kind: 'image',
    maxMb: 5,
    nameFn: (req) => `avatar-${req.user.id}-${Date.now()}`,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const setSessionCookie = (req, res, token, rememberMe) => {
    const days = rememberMe ? config.rememberMeDays : config.sessionDays;
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: req.secure,
        maxAge: days * 24 * 60 * 60 * 1000,
        path: '/',
    });
};

/** Issues a session (JSON token + httpOnly cookie for file requests) and returns the login response body. */
const issueSession = async (req, res, row, rememberMe = false) => {
    const token = users.signSession(row, rememberMe);
    setSessionCookie(req, res, token, rememberMe);
    return { token, user: await users.toPublicUser(row) };
};

const createFamily = async (name) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
            const { lastID } = await db.run('INSERT INTO families (name, invite_code) VALUES (?, ?)', [name, inviteCode()]);
            return lastID;
        } catch (err) {
            if (!/UNIQUE/.test(err.message)) throw err;
        }
    }
    throw new Error('Einladungscode konnte nicht erzeugt werden');
};

const assertUnique = async (username, email, excludeId = null) => {
    const row = await db.get(
        'SELECT id FROM users WHERE (LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)) AND id != ?',
        [username, email, excludeId || 0],
    );
    if (row) throw new HttpError(400, 'Benutzername oder E-Mail-Adresse wird bereits verwendet.');
};

const normalizeEmail = (email) => {
    const e = trimOrNull(email);
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new HttpError(400, 'Bitte eine gültige E-Mail-Adresse angeben.');
    return e.toLowerCase();
};

const memberOfMyFamily = async (req, id) => {
    const row = await db.get('SELECT * FROM users WHERE id = ? AND family_id = ?', [id, req.user.family_id]);
    if (!row) throw new HttpError(404, 'Mitglied nicht gefunden');
    return row;
};

const countAdmins = async (familyId) => (await db.get("SELECT COUNT(*) AS n FROM users WHERE family_id = ? AND (role = 'admin' OR is_admin = 1)", [familyId])).n;

// ---------------------------------------------------------------------------
// Public endpoints
// ---------------------------------------------------------------------------

// Is the system initialised? (used by the login page to show the setup wizard)
router.get('/status', async (req, res) => {
    const row = await db.get('SELECT COUNT(*) AS count FROM users');
    res.json({ initialized: row.count > 0, userCount: row.count, registrationOpen: config.allowRegistration || row.count === 0 });
});

/**
 * Registration.
 *  - with `invite_code`: joins that family as member
 *  - without: creates a new family (only for the very first user or if ALLOW_REGISTRATION=true)
 * The old version let *anyone* register and become an admin with full system rights.
 */
router.post('/register', ipLimiter, async (req, res) => {
    const username = trimOrNull(req.body.username || req.body.name);
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    const invite = trimOrNull(req.body.invite_code || req.body.inviteCode);

    if (!username) throw new HttpError(400, 'Benutzername ist erforderlich');
    const pwError = users.validatePassword(password);
    if (pwError) throw new HttpError(400, pwError);
    await assertUnique(username, email);

    const { count } = await db.get('SELECT COUNT(*) AS count FROM users');
    let familyId;
    let role;

    if (invite) {
        const family = await db.get('SELECT id FROM families WHERE UPPER(invite_code) = UPPER(?)', [invite]);
        if (!family) throw new HttpError(400, 'Ungültiger Einladungscode');
        familyId = family.id;
        role = 'member';
    } else {
        if (count > 0 && !config.allowRegistration) {
            throw new HttpError(403, 'Die Registrierung ist deaktiviert. Bitte lass dich von einem Familien-Admin einladen.');
        }
        const familyName = trimOrNull(req.body.family_name) || `${username}s Familie`;
        familyId = await createFamily(familyName);
        role = 'admin';
    }

    const userId = await users.insertUser({ username, email, password, familyId, role });
    const row = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    res.status(201).json({ message: 'Registrierung erfolgreich', ...(await issueSession(req, res, row)) });
});

router.post('/login', loginLimiter, async (req, res) => {
    const identifier = trimOrNull(req.body.username || req.body.email);
    const { password, rememberMe } = req.body;
    if (!identifier || !password) throw new HttpError(400, 'Benutzername/E-Mail und Passwort sind erforderlich');

    const row = await users.findByLogin(identifier);
    const ok = row && await users.verifyPassword(password, row.password || row.password_hash);
    if (!ok) throw new HttpError(401, 'Benutzername oder Passwort ist falsch');

    if (row.two_factor_enabled && row.two_factor_secret) {
        return res.json({ twoFactorRequired: true, tempToken: users.signTwoFactorTicket(row, rememberMe) });
    }
    loginLimiter.reset(req);
    res.json(await issueSession(req, res, row, !!rememberMe));
});

router.post('/login/2fa', loginLimiter, async (req, res) => {
    const { code, tempToken } = req.body;
    let ticket;
    try { ticket = users.verifyToken(tempToken, '2fa'); } catch (_) { throw new HttpError(401, 'Die Anmeldung ist abgelaufen. Bitte erneut einloggen.'); }

    const row = await db.get('SELECT * FROM users WHERE id = ?', [ticket.sub]);
    if (!row || (row.token_version || 0) !== (ticket.tv || 0)) throw new HttpError(401, 'Benutzer nicht gefunden');
    if (!row.two_factor_secret || !authenticator.check(String(code || '').replace(/\s/g, ''), row.two_factor_secret)) {
        throw new HttpError(401, 'Ungültiger 2FA-Code');
    }
    res.json(await issueSession(req, res, row, req.body.rememberMe ?? ticket.rm));
});

router.post('/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    res.json({ message: 'Abgemeldet' });
});

// Password reset via e-mail code
router.post('/password/forgot', ipLimiter, async (req, res) => {
    const email = trimOrNull(req.body.email);
    const generic = { message: 'Falls die E-Mail-Adresse bekannt ist, wurde ein Code verschickt.' };
    if (!email) throw new HttpError(400, 'E-Mail-Adresse fehlt');

    const row = await db.get('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email]);
    if (!row) return res.json(generic);

    const code = String(crypto.randomInt(100000, 1000000));
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await db.run('UPDATE users SET reset_code = ?, reset_expires = ? WHERE id = ?', [await users.hashPassword(code), expires, row.id]);

    try {
        await mail.sendMail(row.family_id, {
            to: row.email,
            subject: 'FamyHub – Passwort zurücksetzen',
            text: `Hallo ${row.username},\n\ndein Code zum Zurücksetzen des Passworts lautet: ${code}\n\nDer Code ist 15 Minuten gültig. Falls du das nicht angefordert hast, kannst du diese E-Mail ignorieren.`,
        });
    } catch (err) {
        console.error('[auth] Reset-Mail fehlgeschlagen:', err.message);
        throw new HttpError(500, 'Die E-Mail konnte nicht versendet werden. Bitte wende dich an deinen Familien-Admin.');
    }
    res.json(generic);
});

router.post('/password/reset', loginLimiter, async (req, res) => {
    const { email, code, newPassword } = req.body;
    const pwError = users.validatePassword(newPassword);
    if (pwError) throw new HttpError(400, pwError);

    const row = await db.get('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [trimOrNull(email) || '']);
    const valid = row && row.reset_code && row.reset_expires && new Date(row.reset_expires) > new Date()
        && await users.verifyPassword(String(code || '').trim(), row.reset_code);
    if (!valid) throw new HttpError(400, 'Der Code ist ungültig oder abgelaufen.');

    await users.setPassword(row.id, newPassword);
    await db.run('UPDATE users SET reset_code = NULL, reset_expires = NULL WHERE id = ?', [row.id]);
    res.json({ message: 'Passwort wurde geändert. Du kannst dich jetzt anmelden.' });
});

// ---------------------------------------------------------------------------
// Everything below requires a session
// ---------------------------------------------------------------------------

router.use(requireAuth);

router.get('/me', async (req, res) => {
    // Re-issue the file cookie if it is missing (e.g. after an upgrade).
    if (!(req.headers.cookie || '').includes(`${COOKIE_NAME}=`) && (req.headers.authorization || '').startsWith('Bearer ')) {
        setSessionCookie(req, res, req.headers.authorization.slice(7));
    }
    res.json(await users.toPublicUser(req.user._row));
});

// Family: create / join (onboarding for users without a family)
router.post('/family/create', async (req, res) => {
    const name = trimOrNull(req.body.name);
    if (!name) throw new HttpError(400, 'Familienname fehlt');
    if (req.user.family_id) throw new HttpError(400, 'Du gehörst bereits zu einer Familie.');
    if (!config.allowRegistration && (await db.get('SELECT COUNT(*) AS n FROM families')).n > 0) {
        throw new HttpError(403, 'Neue Familien können nur angelegt werden, wenn ALLOW_REGISTRATION aktiv ist.');
    }
    const familyId = await createFamily(name);
    await db.run("UPDATE users SET family_id = ?, role = 'admin', is_admin = 1 WHERE id = ?", [familyId, req.user.id]);
    const fam = await db.get('SELECT invite_code FROM families WHERE id = ?', [familyId]);
    res.json({ message: 'Familie erstellt', family_id: familyId, invite_code: fam.invite_code });
});

router.post('/family/join', async (req, res) => {
    const code = trimOrNull(req.body.inviteCode || req.body.invite_code);
    if (!code) throw new HttpError(400, 'Einladungscode fehlt');
    const family = await db.get('SELECT id FROM families WHERE UPPER(invite_code) = UPPER(?)', [code]);
    if (!family) throw new HttpError(404, 'Ungültiger Einladungscode');
    if (req.user.family_id && req.user.role === 'admin' && (await countAdmins(req.user.family_id)) <= 1) {
        throw new HttpError(400, 'Du bist der einzige Admin deiner aktuellen Familie und kannst sie nicht verlassen.');
    }
    await db.run("UPDATE users SET family_id = ?, role = 'member', is_admin = 0 WHERE id = ?", [family.id, req.user.id]);
    res.json({ message: 'Familie beigetreten', family_id: family.id });
});

// --- Own profile -------------------------------------------------------------

router.put('/profile', async (req, res) => {
    const updates = [];
    const params = [];
    if (req.body.email !== undefined) {
        const email = normalizeEmail(req.body.email);
        const clash = await db.get('SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?', [email, req.user.id]);
        if (clash) throw new HttpError(400, 'Diese E-Mail-Adresse wird bereits verwendet.');
        updates.push('email = ?'); params.push(email);
    }
    if (req.body.display_role !== undefined) { updates.push('display_role = ?'); params.push(trimOrNull(req.body.display_role)); }
    if (updates.length === 0) throw new HttpError(400, 'Keine Änderungen');
    params.push(req.user.id);
    await db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ message: 'Profil aktualisiert' });
});

router.put('/profile/dashboard', async (req, res) => {
    await db.run('UPDATE users SET dashboard_widgets = ? WHERE id = ?', [JSON.stringify(req.body.widgets ?? null), req.user.id]);
    res.json({ message: 'Dashboard gespeichert' });
});

router.put('/profile/sidebar', async (req, res) => {
    const { order, hidden } = req.body;
    if (hidden !== undefined) {
        await db.run('UPDATE users SET sidebar_order = ?, sidebar_hidden = ? WHERE id = ?', [JSON.stringify(order ?? null), JSON.stringify(hidden), req.user.id]);
    } else {
        await db.run('UPDATE users SET sidebar_order = ? WHERE id = ?', [JSON.stringify(order ?? null), req.user.id]);
    }
    res.json({ message: 'Seitenleiste gespeichert' });
});

router.post('/profile/upload', avatarUpload.single('avatar'), async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Keine Datei hochgeladen');
    const url = `/uploads/avatars/${req.file.filename}`;
    const old = req.user._row.profile_picture;
    await db.run('UPDATE users SET profile_picture = ? WHERE id = ?', [url, req.user.id]);
    if (old && old !== url) safeUnlink(resolveUploadUrl(old));
    res.json({ profile_picture: url });
});

router.put('/profile/preferences', async (req, res) => {
    const allowed = { language: v => (['de', 'en'].includes(v) ? v : 'de'), theme: v => (['dark', 'light', 'system'].includes(v) ? v : 'system'), timezone: v => String(v).slice(0, 64), time_offset: v => parseInt(v, 10) || 0 };
    const updates = [];
    const params = [];
    for (const [key, sanitize] of Object.entries(allowed)) {
        if (req.body[key] !== undefined) { updates.push(`${key} = ?`); params.push(sanitize(req.body[key])); }
    }
    if (updates.length === 0) throw new HttpError(400, 'Keine Änderungen');
    params.push(req.user.id);
    await db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ message: 'Einstellungen gespeichert' });
});

router.post('/profile/pin', async (req, res) => {
    const pin = String(req.body.pin || '');
    if (!/^\d{4,12}$/.test(pin)) throw new HttpError(400, 'Die PIN muss aus 4–12 Ziffern bestehen.');
    await db.run('UPDATE users SET pin_code = ? WHERE id = ?', [await users.hashPassword(pin), req.user.id]);
    res.json({ message: 'PIN gespeichert' });
});

router.post('/profile/password', async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const row = req.user._row;
    if (!(await users.verifyPassword(currentPassword, row.password || row.password_hash))) {
        throw new HttpError(401, 'Das aktuelle Passwort ist falsch');
    }
    const pwError = users.validatePassword(newPassword);
    if (pwError) throw new HttpError(400, pwError);
    await users.setPassword(row.id, newPassword);
    // All other sessions are now invalid – hand this device a fresh one.
    const fresh = await db.get('SELECT * FROM users WHERE id = ?', [row.id]);
    res.json({ message: 'Passwort geändert', ...(await issueSession(req, res, fresh)) });
});

router.post('/profile/2fa/setup', async (req, res) => {
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(req.user.email || req.user.username, 'FamyHub', secret);
    const qrCodeUrl = await QRCode.toDataURL(otpauth);
    // Secret is stored but 2FA only becomes active after /verify.
    await db.run('UPDATE users SET two_factor_secret = ?, two_factor_enabled = 0 WHERE id = ?', [secret, req.user.id]);
    res.json({ secret, qrCodeUrl });
});

router.post('/profile/2fa/verify', async (req, res) => {
    const row = await db.get('SELECT two_factor_secret FROM users WHERE id = ?', [req.user.id]);
    if (!row?.two_factor_secret) throw new HttpError(400, 'Einrichtung wurde nicht gestartet');
    if (!authenticator.check(String(req.body.code || '').replace(/\s/g, ''), row.two_factor_secret)) throw new HttpError(400, 'Ungültiger Code');
    await db.run('UPDATE users SET two_factor_enabled = 1 WHERE id = ?', [req.user.id]);
    res.json({ message: '2FA erfolgreich aktiviert' });
});

router.post('/profile/2fa/disable', async (req, res) => {
    await db.run('UPDATE users SET two_factor_enabled = 0, two_factor_secret = NULL WHERE id = ?', [req.user.id]);
    res.json({ message: '2FA deaktiviert' });
});

router.post('/profile/mood', async (req, res) => {
    const emoji = trimOrNull(req.body.mood_emoji);
    const text = trimOrNull(req.body.mood_text);
    await db.run('UPDATE users SET mood_emoji = ?, mood_text = ? WHERE id = ?', [emoji ? emoji.slice(0, 16) : null, text ? text.slice(0, 140) : null, req.user.id]);
    res.json({ message: 'Status aktualisiert' });
});

// --- Family ------------------------------------------------------------------

router.get('/family', requireFamily, async (req, res) => {
    const fam = await db.get('SELECT id, name, invite_code, calendar_token, smtp_host, smtp_port, smtp_user, smtp_from FROM families WHERE id = ?', [req.user.family_id]);
    if (!fam) throw new HttpError(404, 'Familie nicht gefunden');
    if (req.user.role !== 'admin') {
        delete fam.smtp_host; delete fam.smtp_port; delete fam.smtp_user; delete fam.smtp_from;
    }
    res.json(fam);
});

router.get('/family/members', requireFamily, async (req, res) => {
    const rows = await db.all(
        `SELECT * FROM users WHERE family_id = ? ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, username COLLATE NOCASE`,
        [req.user.family_id],
    );
    const isAdmin = req.user.role === 'admin';
    res.json(await Promise.all(rows.map(async (r) => ({
        id: r.id,
        username: r.username,
        name: r.name || r.username,
        email: r.email,
        role: users.isAdminRow(r) ? 'admin' : (r.role || 'member'),
        display_role: r.display_role,
        profile_picture: r.profile_picture,
        mood_emoji: r.mood_emoji,
        mood_text: r.mood_text,
        last_active: r.last_active,
        points_balance: r.points_balance || 0,
        ...(isAdmin ? { permissions: await users.getPermissions(r), two_factor_enabled: !!r.two_factor_enabled } : {}),
    }))));
});

router.put('/family/name', requireFamily, requireAdmin, async (req, res) => {
    const name = trimOrNull(req.body.name);
    if (!name) throw new HttpError(400, 'Name fehlt');
    await db.run('UPDATE families SET name = ? WHERE id = ?', [name.slice(0, 80), req.user.family_id]);
    res.json({ message: 'Familienname gespeichert' });
});

router.post('/family/invite-code/regenerate', requireFamily, requireAdmin, async (req, res) => {
    const code = inviteCode();
    await db.run('UPDATE families SET invite_code = ? WHERE id = ?', [code, req.user.family_id]);
    res.json({ invite_code: code });
});

router.post('/family/members', requireFamily, requireAdmin, async (req, res) => {
    const username = trimOrNull(req.body.username);
    if (!username) throw new HttpError(400, 'Benutzername fehlt');
    // Children often have no e-mail address – a unique placeholder keeps the NOT NULL/UNIQUE constraint happy.
    const email = trimOrNull(req.body.email)
        ? normalizeEmail(req.body.email)
        : `${username.toLowerCase().replace(/[^a-z0-9._-]/g, '')}.${crypto.randomBytes(3).toString('hex')}@famyhub.local`;
    const { password } = req.body;
    const pwError = users.validatePassword(password);
    if (pwError) throw new HttpError(400, pwError);
    await assertUnique(username, email);
    const role = req.body.role === 'admin' ? 'admin' : 'member';
    const id = await users.insertUser({ username, email, password, familyId: req.user.family_id, role });
    if (req.body.display_role) await db.run('UPDATE users SET display_role = ? WHERE id = ?', [trimOrNull(req.body.display_role), id]);
    res.status(201).json({ id, username, email, role });
});

router.put('/family/members/:id', requireFamily, requireAdmin, async (req, res) => {
    const member = await memberOfMyFamily(req, req.params.id);
    const username = trimOrNull(req.body.username) || member.username;
    const email = req.body.email !== undefined ? normalizeEmail(req.body.email) : member.email;
    const role = req.body.role === undefined ? member.role : (req.body.role === 'admin' ? 'admin' : 'member');
    const displayRole = req.body.display_role !== undefined ? trimOrNull(req.body.display_role) : member.display_role;

    if (member.role === 'admin' && role !== 'admin' && (await countAdmins(req.user.family_id)) <= 1) {
        throw new HttpError(400, 'Die Familie braucht mindestens einen Admin.');
    }
    await assertUnique(username, email, member.id);
    const cols = await db.columns('users');
    const nameSql = cols.has('name') ? ', name = ?' : '';
    const params = [username, email, role, role === 'admin' ? 1 : 0, displayRole];
    if (nameSql) params.push(username);
    params.push(member.id);
    await db.run(`UPDATE users SET username = ?, email = ?, role = ?, is_admin = ?, display_role = ?${nameSql} WHERE id = ?`, params);
    res.json({ message: 'Mitglied aktualisiert' });
});

router.put('/user/:id/permissions', requireFamily, requireAdmin, async (req, res) => {
    const member = await memberOfMyFamily(req, req.params.id);
    const incoming = req.body.permissions && typeof req.body.permissions === 'object' ? req.body.permissions : {};
    // Merge – keeps e.g. notify_* flags that the permissions dialog does not know about.
    const merged = { ...(parseJSON(member.permissions, {}) || {}) };
    for (const [k, v] of Object.entries(incoming)) merged[k] = !!v;
    await db.run('UPDATE users SET permissions = ? WHERE id = ?', [JSON.stringify(merged), member.id]);
    // The legacy table would otherwise shadow nothing, but keep it in sync for clarity.
    await db.run('DELETE FROM user_permissions WHERE user_id = ?', [member.id]);
    res.json({ message: 'Berechtigungen gespeichert' });
});

router.post('/admin/reset-password/:id', requireFamily, requireAdmin, async (req, res) => {
    const member = await memberOfMyFamily(req, req.params.id);
    const pwError = users.validatePassword(req.body.newPassword);
    if (pwError) throw new HttpError(400, pwError);
    await users.setPassword(member.id, req.body.newPassword);
    res.json({ message: 'Passwort zurückgesetzt' });
});

router.delete('/family/members/:id', requireFamily, requireAdmin, async (req, res) => {
    const member = await memberOfMyFamily(req, req.params.id);
    if (member.id === req.user.id) throw new HttpError(400, 'Du kannst dich nicht selbst löschen.');

    await db.transaction(async (tx) => {
        const id = member.id;
        // Personal data of the member is removed, shared family data is kept but un-linked.
        await tx.run('DELETE FROM subscriptions WHERE user_id = ?', [id]);
        await tx.run('DELETE FROM user_permissions WHERE user_id = ?', [id]);
        await tx.run('DELETE FROM album_access WHERE user_id = ?', [id]);
        await tx.run('DELETE FROM meal_votes WHERE user_id = ?', [id]);
        await tx.run('DELETE FROM timeline_reactions WHERE user_id = ?', [id]);
        await tx.run('UPDATE wishlist_items SET reserved_by = NULL WHERE reserved_by = ?', [id]);
        await tx.run('DELETE FROM wishlists WHERE user_id = ?', [id]);
        await tx.run('UPDATE chores SET assigned_to = NULL WHERE assigned_to = ?', [id]);
        await tx.run('UPDATE chores SET completed_by = NULL WHERE completed_by = ?', [id]);
        await tx.run("DELETE FROM vault WHERE user_id = ? AND COALESCE(is_shared, 0) = 0", [id]);
        await tx.run('DELETE FROM users WHERE id = ?', [id]);
    });
    if (member.profile_picture) safeUnlink(resolveUploadUrl(member.profile_picture));
    res.json({ message: 'Mitglied gelöscht' });
});

// Display roles ("Mama", "Papa", …)
router.get('/family/roles', requireFamily, async (req, res) => {
    res.json(await db.all('SELECT * FROM family_roles WHERE family_id = ? ORDER BY id', [req.user.family_id]));
});

router.post('/family/roles', requireFamily, requireAdmin, async (req, res) => {
    const name = trimOrNull(req.body.name);
    if (!name) throw new HttpError(400, 'Rollenname fehlt');
    const { lastID } = await db.run('INSERT INTO family_roles (family_id, name) VALUES (?, ?)', [req.user.family_id, name.slice(0, 40)]);
    res.json({ id: lastID, name });
});

router.delete('/family/roles/:id', requireFamily, requireAdmin, async (req, res) => {
    const { changes } = await db.run('DELETE FROM family_roles WHERE id = ? AND family_id = ?', [req.params.id, req.user.family_id]);
    if (!changes) throw new HttpError(404, 'Rolle nicht gefunden');
    res.json({ message: 'Rolle gelöscht' });
});

// --- SMTP (per family) -----------------------------------------------------------

router.get('/admin/smtp', requireFamily, requireAdmin, async (req, res) => {
    const row = await db.get('SELECT smtp_host AS host, smtp_port AS port, smtp_user AS user, smtp_from AS "from", smtp_pass FROM families WHERE id = ?', [req.user.family_id]);
    // The password is never sent back to the browser.
    res.json(row ? { host: row.host, port: row.port, user: row.user, from: row.from, pass: '', hasPassword: !!row.smtp_pass } : {});
});

router.post('/admin/smtp', requireFamily, requireAdmin, async (req, res) => {
    const { host, port, user, pass, from } = req.body;
    const params = [trimOrNull(host), parseInt(port, 10) || null, trimOrNull(user), trimOrNull(from)];
    let sql = 'UPDATE families SET smtp_host = ?, smtp_port = ?, smtp_user = ?, smtp_from = ?';
    if (pass) { sql += ', smtp_pass = ?'; params.push(pass); }
    sql += ' WHERE id = ?';
    params.push(req.user.family_id);
    await db.run(sql, params);
    res.json({ message: 'SMTP-Einstellungen gespeichert' });
});

// --- System statistics (system admin only) ------------------------------------

const dirSize = async (dir) => {
    let total = 0;
    let entries = [];
    try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); } catch (_) { return 0; }
    for (const entry of entries) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) total += await dirSize(p);
        else if (entry.isFile()) total += (await fs.promises.stat(p).catch(() => ({ size: 0 }))).size;
    }
    return total;
};

router.get('/admin/stats', requireFamily, requireAdmin, requireSystemAdmin, async (req, res) => {
    const dbSize = (await fs.promises.stat(config.dbPath).catch(() => ({ size: 0 }))).size;
    const uploads = await dirSize(config.uploadsDir);
    res.json({
        storage: { database: dbSize, uploads, total: dbSize + uploads },
        system: {
            platform: os.platform(), arch: os.arch(), uptime: os.uptime(), cpus: os.cpus().length,
            memory: { total: os.totalmem(), free: os.freemem() }, nodeVersion: process.version,
        },
    });
});

router.post('/admin/cleanup', requireFamily, requireAdmin, requireSystemAdmin, async (req, res) => {
    await db.exec('VACUUM');
    res.json({ message: 'Datenbank wurde erfolgreich komprimiert (VACUUM).' });
});

module.exports = router;
