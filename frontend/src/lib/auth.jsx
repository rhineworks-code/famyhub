import React from 'react';
import api, { getToken, setToken, setUnauthorizedHandler } from './api';
import { applyTheme, watchSystemTheme } from './theme';

const AuthContext = React.createContext(null);
export const useAuth = () => React.useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = React.useState(null);
    const [ready, setReady] = React.useState(false);
    const userRef = React.useRef(null);
    userRef.current = user;

    const refresh = React.useCallback(async () => {
        if (!getToken()) { setUser(null); return null; }
        try {
            const { data } = await api.get('/auth/me');
            setUser(data);
            applyTheme(data.theme || 'system');
            return data;
        } catch (err) {
            if (err.response?.status === 401) { setToken(null); setUser(null); }
            return null;
        }
    }, []);

    React.useEffect(() => {
        setUnauthorizedHandler(() => setUser(null));
        refresh().finally(() => setReady(true));
        return watchSystemTheme(() => userRef.current?.theme);
    }, [refresh]);

    /** Accepts a login/setup response ({ token, user }). */
    const signIn = React.useCallback((data) => {
        setToken(data.token);
        setUser(data.user);
        applyTheme(data.user?.theme || 'system');
    }, []);

    const signOut = React.useCallback(async () => {
        try { await api.post('/auth/logout'); } catch { /* ignore */ }
        setToken(null);
        setUser(null);
    }, []);

    /** Optimistic local update (after successful API call). */
    const patchUser = React.useCallback((patch) => setUser(u => (u ? { ...u, ...patch } : u)), []);

    const value = React.useMemo(() => ({
        user, ready, refresh, signIn, signOut, patchUser,
        isAdmin: user?.role === 'admin',
    }), [user, ready, refresh, signIn, signOut, patchUser]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/** Family members, cached for the session (used in many pickers). */
const MembersContext = React.createContext({ members: [], reload: () => {} });
export const useMembers = () => React.useContext(MembersContext);

export const MembersProvider = ({ children }) => {
    const { user } = useAuth();
    const [members, setMembers] = React.useState([]);
    const reload = React.useCallback(async () => {
        if (!user?.family_id) return;
        try { const { data } = await api.get('/auth/family/members'); setMembers(data); } catch { /* ignore */ }
    }, [user?.family_id]);
    React.useEffect(() => { reload(); }, [reload]);
    const byId = React.useMemo(() => Object.fromEntries(members.map(m => [m.id, m])), [members]);
    return <MembersContext.Provider value={{ members, byId, reload }}>{children}</MembersContext.Provider>;
};
