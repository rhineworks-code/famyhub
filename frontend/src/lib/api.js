import axios from 'axios';

const TOKEN_KEY = 'token';

const api = axios.create({ baseURL: '/api', withCredentials: true });

export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
export const setToken = (token) => {
    try { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ }
};

api.interceptors.request.use((config) => {
    const token = getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

api.interceptors.response.use(
    (res) => res,
    (error) => {
        const url = error.config?.url || '';
        if (error.response?.status === 401 && getToken() && !url.startsWith('/auth/login') && !url.startsWith('/auth/logout')) {
            setToken(null);
            onUnauthorized?.();
        }
        return Promise.reject(error);
    },
);

/** Readable error message from an axios error. */
export const errorText = (err, fallback = 'Etwas ist schiefgelaufen.') =>
    err?.response?.data?.error || err?.response?.data?.message
    || (err?.message === 'Network Error' ? 'Keine Verbindung zum Server.' : (!err?.response && !err?.isAxiosError && err?.message) || fallback);

/** Protected file URLs – loaded via the session cookie. */
export const uploadUrl = (name) => (!name ? null : name.startsWith('/uploads/') ? name : `/uploads/${name}`);
export const documentUrl = (filename, download = false) => `/api/documents/file/${encodeURIComponent(filename)}${download ? '?download=1' : ''}`;

export default api;
