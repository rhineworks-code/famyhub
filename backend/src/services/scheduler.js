'use strict';

const db = require('../db');
const config = require('../config');
const push = require('./push');
const { expandEvents } = require('../routes/calendar');

const sent = new Map(); // dedupe key → expiry

const once = (key, ttlMs) => {
    const now = Date.now();
    for (const [k, exp] of sent) if (exp < now) sent.delete(k);
    if (sent.has(key)) return false;
    sent.set(key, now + ttlMs);
    return true;
};

const localClock = (date = new Date()) => {
    const parts = new Intl.DateTimeFormat('de-DE', { timeZone: config.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit' })
        .formatToParts(date).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
    return { hour: Number(parts.hour), minute: Number(parts.minute), day: `${parts.year}-${parts.month}-${parts.day}` };
};

const fmtTime = (d) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: config.timezone });

/** 15-minute reminders for timed events (including recurring series). */
const remindEvents = async () => {
    const now = new Date();
    const from = new Date(now.getTime() + 14 * 60 * 1000);
    const to = new Date(now.getTime() + 16 * 60 * 1000);
    const rows = await db.all(
        "SELECT * FROM events WHERE COALESCE(allDay, 0) = 0 AND (start BETWEEN ? AND ? OR COALESCE(recurrence_pattern, 'none') != 'none')",
        [from.toISOString(), to.toISOString()],
    );
    const instances = expandEvents(rows, new Date(now.getTime() - 60 * 1000), to);
    for (const ev of instances) {
        const start = new Date(ev.start);
        const minutes = Math.round((start - now) / 60000);
        if (minutes !== 15) continue;
        if (!once(`event:${ev.id}:${ev.start}`, 60 * 60 * 1000)) continue;
        await push.sendTemplated(ev.family_id, 'calendar', {
            title: `Erinnerung: ${ev.title}`,
            body: `Beginnt in 15 Minuten um ${fmtTime(start)} Uhr.`,
            event_title: ev.title,
            start_time: fmtTime(start),
            data: { url: '/calendar' },
        });
    }
};

/** Daily at 09:00: projects with a deadline in 5, 3 or 1 day(s). */
const remindProjects = async (clock) => {
    if (clock.hour !== 9 || clock.minute !== 0 || !once(`projects:${clock.day}`, 2 * 3600 * 1000)) return;
    const projects = await db.all('SELECT * FROM projects WHERE deadline IS NOT NULL');
    const today = new Date(`${clock.day}T00:00:00Z`);
    for (const p of projects) {
        const deadline = new Date(`${String(p.deadline).slice(0, 10)}T00:00:00Z`);
        const days = Math.round((deadline - today) / 864e5);
        if (![5, 3, 1].includes(days)) continue;
        await push.sendTemplated(p.family_id, 'projects', {
            title: `Projekt: ${p.title}`,
            body: `Noch ${days} Tag${days === 1 ? '' : 'e'} bis zum Termin (${deadline.toLocaleDateString('de-DE', { timeZone: 'UTC' })}).`,
            project_title: p.title,
            days_left: days,
            data: { url: '/projects' },
        });
    }
};

/** Daily at 00:00: reset everybody's mood/status. */
const resetMoods = async (clock) => {
    if (clock.hour !== 0 || clock.minute !== 0 || !once(`mood:${clock.day}`, 2 * 3600 * 1000)) return;
    await db.run('UPDATE users SET mood_emoji = NULL, mood_text = NULL');
};

/**
 * Housekeeping for temp folders (failed uploads used to pile up there).
 * Files that are still referenced by a document are rescued into the document
 * folder instead of being deleted – the old upload code sometimes left the only
 * copy of a document inside documents/temp.
 */
const cleanTemp = async (clock, force = false) => {
    if (!force && (clock.minute !== 30 || !once(`temp:${clock.day}:${clock.hour}`, 2 * 3600 * 1000))) return;
    const fs = require('fs');
    const path = require('path');
    const docsTemp = path.join(config.documentsDir, 'temp');
    for (const dir of [config.tempDir, docsTemp]) {
        const entries = await fs.promises.readdir(dir).catch(() => []);
        for (const name of entries) {
            const p = path.join(dir, name);
            const stat = await fs.promises.stat(p).catch(() => null);
            if (!stat || !stat.isFile()) continue;
            if (dir === docsTemp) {
                const doc = await db.get('SELECT storage_path FROM documents WHERE filename = ?', [name]);
                if (doc) {
                    const targetDir = doc.storage_path && doc.storage_path !== 'smb' ? doc.storage_path : config.documentsDir;
                    const target = path.join(targetDir, name);
                    if (!fs.existsSync(target)) {
                        await fs.promises.mkdir(targetDir, { recursive: true }).catch(() => {});
                        await fs.promises.rename(p, target).catch(() => {});
                    }
                    continue;
                }
            }
            if (Date.now() - stat.mtimeMs > 24 * 3600 * 1000) await fs.promises.unlink(p).catch(() => {});
        }
    }
};

const tick = async () => {
    const clock = localClock();
    for (const job of [remindEvents, () => remindProjects(clock), () => resetMoods(clock), () => cleanTemp(clock)]) {
        try { await job(); } catch (err) { console.error('[scheduler]', err.message); }
    }
};

let timer = null;
const start = () => {
    if (timer) return;
    // Align to the start of the next minute so "exactly 15 minutes before" is hit reliably.
    const delay = 60_000 - (Date.now() % 60_000) + 500;
    setTimeout(() => { tick(); timer = setInterval(tick, 60_000); }, delay).unref();
};
const stop = () => { if (timer) clearInterval(timer); timer = null; };

module.exports = { start, stop, tick, cleanTemp };
