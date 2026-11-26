'use strict';

const SMB2 = require('smb2');
const settings = require('./settings');

const TIMEOUT_MS = 15_000;

const withTimeout = (promise, label) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`SMB-Zeitüberschreitung bei ${label}`)), TIMEOUT_MS)),
]);

/** "Share/Sub/Folder" → share "\\host\Share", base path "Sub\Folder" (smb2 expects backslashes). */
const parseShare = (shareSetting, host) => {
    const raw = String(shareSetting || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const [shareName, ...rest] = raw.split('/');
    return { share: `\\\\${host}\\${shareName}`, basePath: rest.filter(Boolean).join('\\') };
};

const createClient = (cfg, autoCloseTimeout = 0) => {
    const { share, basePath } = parseShare(cfg.smb_share, cfg.smb_host);
    const client = new SMB2({
        share,
        domain: cfg.smb_domain || 'WORKGROUP',
        username: cfg.smb_user || '',
        password: cfg.smb_pass || '',
        port: parseInt(cfg.smb_port, 10) || 445,
        autoCloseTimeout,
    });
    return { client, basePath };
};

let cached = { key: null, client: null, basePath: '' };

const getConfig = () => settings.getMany(['docs_storage_type', 'smb_host', 'smb_share', 'smb_user', 'smb_pass', 'smb_port', 'smb_domain']);

const getClient = async () => {
    const cfg = await getConfig();
    if (cfg.docs_storage_type !== 'smb' || !cfg.smb_host || !cfg.smb_share) {
        cached = { key: null, client: null, basePath: '' };
        return null;
    }
    const key = JSON.stringify(cfg);
    if (cached.client && cached.key === key) return cached;
    const { client, basePath } = createClient(cfg);
    cached = { key, client, basePath };
    return cached;
};

const fullPath = (basePath, filename) => {
    const clean = String(filename).replace(/[\\/]+/g, '_'); // file names never contain path separators
    return basePath ? `${basePath}\\${clean}` : clean;
};

const call = async (method, filename, ...args) => {
    const conn = await getClient();
    if (!conn) throw new Error('SMB ist nicht konfiguriert.');
    return withTimeout(new Promise((resolve, reject) => {
        conn.client[method](fullPath(conn.basePath, filename), ...args, (err, result) => (err ? reject(err) : resolve(result)));
    }), method);
};

module.exports = {
    isConfigured: async () => !!(await getClient()),
    writeFile: (filename, data) => call('writeFile', filename, data),
    readFile: (filename) => call('readFile', filename),
    unlink: (filename) => call('unlink', filename),
    testConnection: async (cfg) => {
        try {
            const { client, basePath } = createClient(cfg, 1000);
            await withTimeout(new Promise((resolve, reject) => client.readdir(basePath || '', err => (err ? reject(err) : resolve()))), 'readdir');
            return { ok: true, message: 'SMB Verbindung erfolgreich ✓' };
        } catch (err) {
            return { ok: false, message: `SMB Fehler: ${err.message}` };
        }
    },
};
