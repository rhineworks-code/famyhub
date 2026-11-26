import { useCallback, useEffect, useRef, useState } from 'react';
import api from './api';

/** GET with loading/error state and a reload function. */
export const useApi = (url, { initial = null, enabled = true, interval = 0 } = {}) => {
    const [data, setData] = useState(initial);
    const [loading, setLoading] = useState(enabled);
    const [error, setError] = useState(null);
    const alive = useRef(true);

    const reload = useCallback(async () => {
        if (!url) return;
        try {
            const res = await api.get(url);
            if (alive.current) { setData(res.data); setError(null); }
            return res.data;
        } catch (err) {
            if (alive.current) setError(err);
        } finally {
            if (alive.current) setLoading(false);
        }
    }, [url]);

    useEffect(() => {
        alive.current = true;
        if (enabled) { setLoading(true); reload(); }
        return () => { alive.current = false; };
    }, [reload, enabled]);

    useEffect(() => {
        if (!interval || !enabled) return undefined;
        const id = setInterval(() => { if (document.visibilityState === 'visible') reload(); }, interval);
        return () => clearInterval(id);
    }, [interval, reload, enabled]);

    return { data, setData, loading, error, reload };
};
