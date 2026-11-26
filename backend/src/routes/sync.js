'use strict';

const ics = require('ics');
const crypto = require('crypto');
const db = require('../db');
const { featureGuard } = require('../middleware/auth');
const { createRouter, HttpError, trimOrNull } = require('../utils/http');
const { assertPublicUrl } = require('../utils/net');

const router = createRouter();

const utcParts = (d) => [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()];
const RRULE = { weekly: 'FREQ=WEEKLY', monthly: 'FREQ=MONTHLY', yearly: 'FREQ=YEARLY' };

// PUBLIC: iCal export (secret token in the URL, used by phone calendar apps)
router.get('/export/:token.ics', async (req, res) => {
    const family = await db.get('SELECT id, name FROM families WHERE calendar_token = ?', [req.params.token]);
    if (!family) return res.status(404).send('Not found');

    const events = await db.all('SELECT * FROM events WHERE family_id = ?', [family.id]);
    const formatted = events.map((event) => {
        const start = new Date(event.start);
        if (Number.isNaN(start.getTime())) return null;
        const end = event.end ? new Date(event.end) : new Date(start.getTime() + 3600000);
        const base = {
            uid: `famyhub-${event.id}@${req.hostname}`,
            title: event.title,
            description: event.description || '',
            location: event.location || undefined,
            categories: ['Familie'],
        };
        const rrule = event.event_type === 'birthday' ? RRULE.yearly : RRULE[event.recurrence_pattern];
        if (rrule) base.recurrenceRule = rrule;
        if (event.allDay) {
            const endDay = new Date(Math.max(end.getTime(), start.getTime() + 864e5));
            return { ...base, start: [start.getFullYear(), start.getMonth() + 1, start.getDate()], end: [endDay.getFullYear(), endDay.getMonth() + 1, endDay.getDate()] };
        }
        return { ...base, start: utcParts(start), startInputType: 'utc', startOutputType: 'utc', end: utcParts(end), endInputType: 'utc', endOutputType: 'utc' };
    }).filter(Boolean);

    const { error, value } = ics.createEvents(formatted, { calName: `${family.name} (FamyHub)`, productId: 'famyhub/ics' });
    if (error) {
        console.error('[sync] iCal-Fehler:', error);
        return res.status(500).send('Error creating iCal');
    }
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="famyhub.ics"');
    res.send(value);
});

router.use(featureGuard('calendar'));

router.get('/token', async (req, res) => {
    const row = await db.get('SELECT calendar_token FROM families WHERE id = ?', [req.user.family_id]);
    if (!row) throw new HttpError(404, 'Familie nicht gefunden');
    if (row.calendar_token) return res.json({ token: row.calendar_token });
    const token = crypto.randomBytes(24).toString('hex');
    await db.run('UPDATE families SET calendar_token = ? WHERE id = ?', [token, req.user.family_id]);
    res.json({ token });
});

// New secret link – the old one stops working (e.g. after sharing it by mistake)
router.post('/token/regenerate', async (req, res) => {
    const token = crypto.randomBytes(24).toString('hex');
    await db.run('UPDATE families SET calendar_token = ? WHERE id = ?', [token, req.user.family_id]);
    res.json({ token });
});

router.get('/external', async (req, res) => {
    res.json(await db.all('SELECT * FROM external_calendars WHERE family_id = ?', [req.user.family_id]));
});

router.post('/external', async (req, res) => {
    const name = trimOrNull(req.body.name);
    const url = trimOrNull(req.body.url);
    if (!name || !url) throw new HttpError(400, 'Name und URL sind erforderlich');
    const normalized = url.replace(/^webcal:\/\//i, 'https://');
    await assertPublicUrl(normalized);
    const color = trimOrNull(req.body.color) || '#10b981';
    const { lastID } = await db.run('INSERT INTO external_calendars (family_id, name, url, color) VALUES (?, ?, ?, ?)', [req.user.family_id, name, normalized, color]);
    res.json({ id: lastID, name, url: normalized, color });
});

router.delete('/external/:id', async (req, res) => {
    await db.run('DELETE FROM external_calendars WHERE id = ? AND family_id = ?', [req.params.id, req.user.family_id]);
    res.json({ success: true });
});

module.exports = router;
