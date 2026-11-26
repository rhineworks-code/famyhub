'use strict';

const dns = require('dns').promises;
const net = require('net');
const { HttpError } = require('./http');

const BLOCK_PRIVATE = ['1', 'true', 'yes'].includes(String(process.env.BLOCK_PRIVATE_URLS || '').toLowerCase());

const isPrivateIp = (ip) => {
    if (net.isIPv4(ip)) {
        const [a, b] = ip.split('.').map(Number);
        return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
    }
    const lower = ip.toLowerCase();
    return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80') || lower.startsWith('::ffff:127.');
};

/**
 * Validates URLs the server fetches on behalf of users (iCal feeds, product previews).
 * Only http(s) is allowed. Requests into the local network are allowed by default
 * (self-hosted Nextcloud calendars are common in homelabs) and can be blocked with
 * BLOCK_PRIVATE_URLS=true.
 */
const assertPublicUrl = async (raw) => {
    let url;
    try { url = new URL(raw); } catch (_) { throw new HttpError(400, 'Ungültige URL'); }
    if (!['http:', 'https:'].includes(url.protocol)) throw new HttpError(400, 'Nur http- und https-Adressen sind erlaubt');
    if (!BLOCK_PRIVATE) return url;
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const addresses = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true }).catch(() => [])).map(a => a.address);
    if (addresses.length === 0 || addresses.some(isPrivateIp)) throw new HttpError(400, 'Diese Adresse ist nicht erlaubt');
    return url;
};

module.exports = { assertPublicUrl, isPrivateIp };
