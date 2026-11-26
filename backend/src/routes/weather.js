'use strict';

const axios = require('axios');
const { requireAuth } = require('../middleware/auth');
const { createRouter, HttpError } = require('../utils/http');

const router = createRouter();
router.use(requireAuth);

const DEFAULT = { lat: Number(process.env.WEATHER_LAT) || 50.1109, lon: Number(process.env.WEATHER_LON) || 8.6821 };
const CACHE_MS = 15 * 60 * 1000;
const cache = new Map();

router.get('/', async (req, res) => {
    const lat = req.query.lat !== undefined ? Number(req.query.lat) : DEFAULT.lat;
    const lon = req.query.lon !== undefined ? Number(req.query.lon) : DEFAULT.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new HttpError(400, 'Ungültige Koordinaten');

    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return res.json(hit.data);

    try {
        const { data } = await axios.get('https://api.open-meteo.com/v1/forecast', {
            timeout: 6000,
            params: {
                latitude: lat,
                longitude: lon,
                current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m',
                daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum',
                timezone: 'auto',
            },
        });
        cache.set(key, { data, expires: Date.now() + CACHE_MS });
        res.json(data);
    } catch (err) {
        if (hit) return res.json(hit.data);
        console.warn('[weather]', err.message);
        throw new HttpError(502, 'Wetterdaten konnten nicht geladen werden');
    }
});

module.exports = router;
