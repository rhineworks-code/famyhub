'use strict';

const ical = require('node-ical');
const db = require('../db');
const { featureGuard } = require('../middleware/auth');
const { createRouter, HttpError, trimOrNull, toBoolInt } = require('../utils/http');
const { assertPublicUrl } = require('../utils/net');

const router = createRouter();
router.use(featureGuard('calendar'));

// ---------------------------------------------------------------------------
// External iCal feeds are cached for 10 minutes. The old code downloaded every
// feed on *every* calendar request, which made the page slow and could get the
// server rate-limited by Google/Outlook.
// ---------------------------------------------------------------------------
const FEED_TTL_MS = 10 * 60 * 1000;
const feedCache = new Map();

const loadFeed = async (cal) => {
    const key = `${cal.id}|${cal.url}`;
    const hit = feedCache.get(key);
    if (hit && hit.expires > Date.now()) return hit.events;
    try {
        await assertPublicUrl(cal.url);
        const data = await ical.async.fromURL(cal.url, { timeout: 10_000 });
        const events = Object.values(data).filter(e => e && e.type === 'VEVENT');
        feedCache.set(key, { events, expires: Date.now() + FEED_TTL_MS });
        return events;
    } catch (err) {
        console.warn(`[calendar] Feed "${cal.name}" nicht ladbar: ${err.message}`);
        return hit ? hit.events : [];
    }
};

const addInterval = (date, pattern, type) => {
    const d = new Date(date);
    if (pattern === 'weekly') d.setDate(d.getDate() + 7);
    else if (pattern === 'monthly') d.setMonth(d.getMonth() + 1);
    else if (pattern === 'yearly' || type === 'birthday') d.setFullYear(d.getFullYear() + 1);
    else return null;
    return d;
};

/** Expands weekly / monthly / yearly series and birthdays into single instances. */
const expandEvents = (events, rangeStart, rangeEnd) => {
    const out = [];
    for (const event of events) {
        const type = event.event_type || 'normal';
        const pattern = event.recurrence_pattern || 'none';
        if (type !== 'birthday' && pattern === 'none') { out.push(event); continue; }

        const seriesStart = new Date(event.start);
        if (Number.isNaN(seriesStart.getTime())) continue;
        const duration = event.end ? (new Date(event.end) - seriesStart) : 0;

        let current = new Date(seriesStart);
        // Jump close to the range start instead of iterating from the year 1970.
        if (current < rangeStart) {
            if (pattern === 'weekly') {
                const weeks = Math.floor((rangeStart - current) / (7 * 864e5));
                current.setDate(current.getDate() + weeks * 7);
            } else if (pattern === 'yearly' || type === 'birthday') {
                const years = rangeStart.getFullYear() - current.getFullYear() - 1;
                if (years > 0) current.setFullYear(current.getFullYear() + years);
            }
        }

        for (let i = 0; current && current <= rangeEnd && i < 600; i += 1) {
            if (current >= rangeStart) {
                const day = current.toISOString().slice(0, 10);
                out.push({
                    ...event,
                    id: `${event.id}-${day}`,
                    real_id: event.id,
                    series_start: event.start,
                    series_end: event.end || null,
                    start: current.toISOString(),
                    end: duration ? new Date(current.getTime() + duration).toISOString() : null,
                    is_instance: true,
                });
            }
            current = addInterval(current, pattern, type);
        }
    }
    return out;
};

const EVENT_FIELDS = ['title', 'start', 'end', 'allDay', 'description', 'color', 'location', 'image_url', 'user_id',
    'external_uid', 'external_calendar_id', 'is_external', 'event_type', 'recurrence_pattern'];

const normalizeEvent = (body, req) => {
    const title = trimOrNull(body.title);
    if (!title) throw new HttpError(400, 'Titel fehlt');
    const start = body.start ? new Date(body.start) : null;
    if (!start || Number.isNaN(start.getTime())) throw new HttpError(400, 'Ungültiges Startdatum');
    const end = body.end ? new Date(body.end) : null;
    if (end && Number.isNaN(end.getTime())) throw new HttpError(400, 'Ungültiges Enddatum');
    if (end && end < start) throw new HttpError(400, 'Das Ende liegt vor dem Beginn');

    return {
        title,
        start: start.toISOString(),
        end: end ? end.toISOString() : null,
        allDay: toBoolInt(body.allDay),
        description: trimOrNull(body.description),
        color: trimOrNull(body.color),
        location: trimOrNull(body.location),
        image_url: trimOrNull(body.image_url),
        user_id: body.user_id ? Number(body.user_id) : req.user.id,
        external_uid: trimOrNull(body.external_uid),
        external_calendar_id: body.external_calendar_id ? Number(body.external_calendar_id) : null,
        is_external: toBoolInt(body.is_external),
        event_type: ['normal', 'birthday'].includes(body.event_type) ? body.event_type : 'normal',
        recurrence_pattern: ['none', 'weekly', 'monthly', 'yearly'].includes(body.recurrence_pattern) ? body.recurrence_pattern : 'none',
    };
};

const insertEvent = async (ev, familyId) => {
    const keys = [...EVENT_FIELDS, 'family_id'];
    const { lastID } = await db.run(
        `INSERT INTO events (${keys.join(', ')}) VALUES (${db.placeholders(keys)})`,
        [...EVENT_FIELDS.map(k => ev[k]), familyId],
    );
    return lastID;
};

// ---------------------------------------------------------------------------

router.get('/', async (req, res) => {
    const familyId = req.user.family_id;
    const local = await db.all('SELECT * FROM events WHERE family_id = ?', [familyId]);
    const externals = await db.all('SELECT * FROM external_calendars WHERE family_id = ?', [familyId]);

    let all = local.map(e => ({ ...e, is_external: e.is_external || 0, readOnly: false }));

    const feeds = await Promise.all(externals.map(async (cal) => ({ cal, events: await loadFeed(cal) })));
    for (const { cal, events } of feeds) {
        for (const ev of events) {
            const overridden = local.some(le => le.external_uid === ev.uid && Number(le.external_calendar_id) === cal.id);
            if (overridden || !ev.start) continue;
            all.push({
                id: `ext-${cal.id}-${ev.uid}`,
                title: ev.summary || 'Unbenannt',
                start: new Date(ev.start).toISOString(),
                end: ev.end ? new Date(ev.end).toISOString() : null,
                allDay: ev.datetype === 'date',
                description: ev.description || '',
                location: ev.location || '',
                color: cal.color || '#94a3b8',
                readOnly: false,
                is_external: 1,
                external_name: cal.name,
                external_uid: ev.uid,
                external_calendar_id: cal.id,
                user_id: cal.user_id || null,
            });
        }
    }

    const rangeStart = new Date(); rangeStart.setFullYear(rangeStart.getFullYear() - 1);
    const rangeEnd = new Date(); rangeEnd.setFullYear(rangeEnd.getFullYear() + 2);
    all = expandEvents(all, rangeStart, rangeEnd);

    res.json(all.filter(e => e.start).map(e => ({ ...e, user_id: e.user_id || null })));
});

router.post('/', async (req, res) => {
    const ev = normalizeEvent(req.body, req);
    const id = await insertEvent(ev, req.user.family_id);
    res.json({ id, ...ev });
});

router.put('/:id', async (req, res) => {
    const ev = normalizeEvent(req.body, req);

    // Editing an external event for the first time creates a local override.
    if (String(req.params.id).startsWith('ext-')) {
        if (!ev.external_uid || !ev.external_calendar_id) throw new HttpError(400, 'Externe Termin-Daten fehlen');
        const cal = await db.get('SELECT id FROM external_calendars WHERE id = ? AND family_id = ?', [ev.external_calendar_id, req.user.family_id]);
        if (!cal) throw new HttpError(404, 'Kalender nicht gefunden');
        const id = await insertEvent({ ...ev, is_external: 1 }, req.user.family_id);
        return res.json({ message: 'Externer Termin übernommen', id });
    }

    const id = String(req.params.id).split('-')[0]; // instance ids look like "12-2026-05-01"
    const sets = EVENT_FIELDS.map(k => `${k} = ?`).join(', ');
    const { changes } = await db.run(
        `UPDATE events SET ${sets} WHERE id = ? AND family_id = ?`,
        [...EVENT_FIELDS.map(k => ev[k]), id, req.user.family_id],
    );
    if (!changes) throw new HttpError(404, 'Termin nicht gefunden');
    res.json({ message: 'Termin aktualisiert', changes });
});

router.delete('/:id', async (req, res) => {
    const id = String(req.params.id).split('-')[0];
    const { changes } = await db.run('DELETE FROM events WHERE id = ? AND family_id = ?', [id, req.user.family_id]);
    if (!changes) throw new HttpError(404, 'Termin nicht gefunden');
    res.json({ message: 'Termin gelöscht', changes });
});

// --- External calendars --------------------------------------------------------

router.get('/external', async (req, res) => {
    res.json(await db.all('SELECT * FROM external_calendars WHERE family_id = ? ORDER BY name', [req.user.family_id]));
});

router.post('/external', async (req, res) => {
    const url = trimOrNull(req.body.url);
    if (!url) throw new HttpError(400, 'URL fehlt');
    const normalized = url.replace(/^webcal:\/\//i, 'https://');
    await assertPublicUrl(normalized);
    const name = trimOrNull(req.body.name) || 'Extern';
    const color = trimOrNull(req.body.color) || '#3788d8';
    const { lastID } = await db.run(
        'INSERT INTO external_calendars (family_id, name, url, color, user_id) VALUES (?, ?, ?, ?, ?)',
        [req.user.family_id, name, normalized, color, req.body.user_id || null],
    );
    res.json({ id: lastID, name, url: normalized, color });
});

router.delete('/external/:id', async (req, res) => {
    const { changes } = await db.run('DELETE FROM external_calendars WHERE id = ? AND family_id = ?', [req.params.id, req.user.family_id]);
    if (!changes) throw new HttpError(404, 'Kalender nicht gefunden');
    for (const key of feedCache.keys()) if (key.startsWith(`${req.params.id}|`)) feedCache.delete(key);
    res.json({ message: 'Externer Kalender gelöscht' });
});

module.exports = router;
module.exports.expandEvents = expandEvents;
