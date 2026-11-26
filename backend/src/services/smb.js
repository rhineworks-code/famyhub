'use strict';

/**
 * NAS storage via the `smbclient` command line tool (Samba).
 *
 * The previous JavaScript SMB library only spoke NTLMv1 and used DES, which
 * Node 17+ (OpenSSL 3) no longer supports – every connection attempt crashed the
 * whole server, and current NAS systems (Synology DSM 7, QNAP, TrueNAS) reject
 * NTLMv1 anyway. smbclient supports SMB 2/3 and NTLMv2 and is installed in the
 * Docker image.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const config = require('../config');
const settings = require('./settings');

const TIMEOUT_MS = 60_000;
const SAFE_NAME = /^[\w.-]+$/;
const SAFE_SEGMENT = /^[^"\;:*?<>|]+$/;

const getConfig = () => settings.getMany(['docs_storage_type', 'smb_host', 'smb_share', 'smb_user', 'smb_pass', 'smb_port', 'smb_domain']);

/** "dokumente/famyhub/scans" → share "dokumente", folders ["famyhub", "scans"] */
const parseShare = (shareSetting) => {
    const parts = String(shareSetting || '').replace(/\\/g, '/').split('/').map(s => s.trim()).filter(Boolean);
    const [share, ...folders] = parts;
    if (!share || !SAFE_SEGMENT.test(share) || folders.some(f => !SAFE_SEGMENT.test(f))) {
        throw new Error('Ungültiger Freigabename. Format: Freigabe oder Freigabe/Ordner/Unterordner');
    }
    return { share, folders };
};

const friendly = (status) => ({
    NT_STATUS_LOGON_FAILURE: 'Benutzername oder Passwort falsch',
    NT_STATUS_ACCESS_DENIED: 'Keine Berechtigung (Schreibrechte für den Benutzer prüfen)',
    NT_STATUS_BAD_NETWORK_NAME: 'Freigabe nicht gefunden',
    NT_STATUS_HOST_UNREACHABLE: 'Server nicht erreichbar',
    NT_STATUS_CONNECTION_REFUSED: 'Verbindung abgelehnt (Port oder SMB-Dienst prüfen)',
    NT_STATUS_IO_TIMEOUT: 'Zeitüberschreitung – Server nicht erreichbar',
    NT_STATUS_OBJECT_NAME_NOT_FOUND: 'Datei nicht gefunden',
    NT_STATUS_NO_SUCH_FILE: 'Datei nicht gefunden',
    NT_STATUS_OBJECT_PATH_NOT_FOUND: 'Ordner nicht gefunden',
    NT_STATUS_ACCOUNT_DISABLED: 'Benutzerkonto ist deaktiviert',
}[status] || status);

/** Runs smbclient with a command list. Password is passed via environment, never on the command line. */
const run = (cfg, commands) => new Promise((resolve, reject) => {
    let share;
    try { ({ share } = parseShare(cfg.smb_share)); } catch (err) { reject(err); return; }
    const host = String(cfg.smb_host || '').trim();
    if (!host || !/^[\w.:-]+$/.test(host)) { reject(new Error('Ungültiger Servername')); return; }
    const args = [`//${host}/${share}`, '-p', String(parseInt(cfg.smb_port, 10) || 445), '-c', commands];
    if (cfg.smb_user) args.push('-U', String(cfg.smb_user)); else args.push('-N');
    if (cfg.smb_domain) args.push('-W', String(cfg.smb_domain));
    execFile('smbclient', args, { timeout: TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, PASSWD: cfg.smb_pass || '' } }, (err, stdout, stderr) => {
        const output = `${stdout || ''}\n${stderr || ''}`;
        const status = output.match(/NT_STATUS_[A-Z_]+/);
        if (err?.code === 'ENOENT') return reject(new Error('smbclient ist nicht installiert (Docker-Image aktualisieren).'));
        if (err?.killed) return reject(new Error('Zeitüberschreitung – Server nicht erreichbar'));
        if (status) {
            const e = new Error(friendly(status[0]));
            e.code = status[0];
            return reject(e);
        }
        if (err) return reject(new Error(output.trim().split('\n').pop() || err.message));
        resolve(output);
    });
});

const q = (s) => `"${s}"`;
const cdCommand = (folders) => (folders.length ? `cd ${q(folders.join('\\'))}; ` : '');

/** Creates the folder chain inside the share if it does not exist yet. */
const ensureFolders = async (cfg) => {
    const { folders } = parseShare(cfg.smb_share);
    for (let i = 1; i <= folders.length; i += 1) {
        try {
            await run(cfg, `mkdir ${q(folders.slice(0, i).join('\\'))}`);
        } catch (err) {
            if (err.code !== 'NT_STATUS_OBJECT_NAME_COLLISION') throw err;
        }
    }
};

const tempFile = () => path.join(config.tempDir, `smb-${crypto.randomBytes(8).toString('hex')}`);

let foldersReady = null; // key of the config whose folders were already created

const activeConfig = async (forWrite) => {
    const cfg = await getConfig();
    // Reading/deleting works whenever an NAS is configured – otherwise files stored on the NAS
    // would become unreadable after switching back to local storage.
    if (!cfg.smb_host || !cfg.smb_share || (forWrite && cfg.docs_storage_type !== 'smb')) throw new Error('Kein NAS (SMB) eingerichtet.');
    return cfg;
};

const assertName = (filename) => {
    const name = path.basename(String(filename));
    if (!SAFE_NAME.test(name)) throw new Error('Ungültiger Dateiname');
    return name;
};

const writeFileWith = async (cfg, filename, data) => {
    const name = assertName(filename);
    const key = JSON.stringify([cfg.smb_host, cfg.smb_share, cfg.smb_port]);
    if (foldersReady !== key) { await ensureFolders(cfg); foldersReady = key; }
    const tmp = tempFile();
    await fs.promises.mkdir(config.tempDir, { recursive: true });
    await fs.promises.writeFile(tmp, data);
    try {
        await run(cfg, `${cdCommand(parseShare(cfg.smb_share).folders)}put ${q(tmp)} ${q(name)}`);
    } finally {
        fs.promises.rm(tmp, { force: true }).catch(() => {});
    }
};

module.exports = {
    isConfigured: async () => { try { await activeConfig(true); return true; } catch (_) { return false; } },

    writeFile: async (filename, data) => writeFileWith(await activeConfig(true), filename, data),

    readFile: async (filename) => {
        const cfg = await activeConfig(false);
        const name = assertName(filename);
        const tmp = tempFile();
        await fs.promises.mkdir(config.tempDir, { recursive: true });
        try {
            await run(cfg, `${cdCommand(parseShare(cfg.smb_share).folders)}get ${q(name)} ${q(tmp)}`);
            return await fs.promises.readFile(tmp);
        } finally {
            fs.promises.rm(tmp, { force: true }).catch(() => {});
        }
    },

    unlink: async (filename) => {
        const cfg = await activeConfig(false);
        await run(cfg, `${cdCommand(parseShare(cfg.smb_share).folders)}del ${q(assertName(filename))}`);
    },

    /** Connects, creates the folders and writes + deletes a probe file. */
    testConnection: async (cfg) => {
        try {
            if (!cfg.smb_host || !cfg.smb_share) return { ok: false, message: 'Bitte Server und Freigabe angeben.' };
            const probe = `.famyhub-test-${Date.now()}.txt`;
            await ensureFolders(cfg);
            const tmp = tempFile();
            await fs.promises.mkdir(config.tempDir, { recursive: true });
            await fs.promises.writeFile(tmp, 'FamyHub Schreibtest');
            const cd = cdCommand(parseShare(cfg.smb_share).folders);
            try { await run(cfg, `${cd}put ${q(tmp)} ${q(probe)}; del ${q(probe)}`); } finally { fs.promises.rm(tmp, { force: true }).catch(() => {}); }
            return { ok: true, message: 'Verbindung erfolgreich – Lesen und Schreiben funktioniert ✓' };
        } catch (err) {
            return { ok: false, message: `NAS-Fehler: ${err.message}` };
        }
    },

    /** Copies a local file to the NAS (used when moving existing documents). */
    writeFileWith,
};
