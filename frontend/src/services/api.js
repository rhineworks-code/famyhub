import axios from 'axios';

const TOKEN_KEY = 'token';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    withCredentials: true,
});

export const getToken = () => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};

/** Stores the session token (the server additionally sets an httpOnly cookie for file requests). */
export const setToken = (token) => {
    try {
        if (token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
    } catch { /* private mode */ }
};

export const clearSession = async () => {
    setToken(null);
    try { await api.post('/auth/logout'); } catch { /* offline */ }
};

api.interceptors.request.use((config) => {
    const token = getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Expired / revoked session → back to the login page (except for the auth calls themselves).
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const url = error.config?.url || '';
        if (status === 401 && getToken() && !url.startsWith('/auth/login') && !url.startsWith('/auth/logout')) {
            setToken(null);
            if (!window.location.pathname.startsWith('/login')) window.location.assign('/login');
        }
        return Promise.reject(error);
    },
);

/** URL of a protected document file (auth via session cookie). */
export const documentUrl = (filename, { download = false } = {}) =>
    `/api/documents/file/${encodeURIComponent(filename)}${download ? '?download=1' : ''}`;

export default api;
