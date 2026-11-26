// Every module of the app. `perm` is the permission key the backend uses.
export const FEATURES = [
    { id: 'calendar', perm: 'calendar', path: '/calendar', label: 'Kalender', icon: 'ri-calendar-2-fill', color: '#FF3B30' },
    { id: 'shopping', perm: 'shopping', path: '/shopping', label: 'Einkauf', icon: 'ri-shopping-cart-2-fill', color: '#34C759' },
    { id: 'chat', perm: 'chat', path: '/chat', label: 'Chat', icon: 'ri-chat-3-fill', color: '#1AA7EC' },
    { id: 'meals', perm: 'meals', path: '/meals', label: 'Essensplan', icon: 'ri-restaurant-2-fill', color: '#FF9500' },
    { id: 'chores', perm: 'chores', path: '/chores', label: 'Aufgaben', icon: 'ri-task-fill', color: '#5856D6' },
    { id: 'pocket_money', perm: 'pocket_money', path: '/pocket-money', label: 'Taschengeld', icon: 'ri-wallet-3-fill', color: '#2B3E6A' },
    { id: 'timeline', perm: 'timeline', path: '/timeline', label: 'Timeline', icon: 'ri-quill-pen-fill', color: '#AF52DE' },
    { id: 'gallery', perm: 'gallery', path: '/gallery', label: 'Galerie', icon: 'ri-image-2-fill', color: '#FF2D55' },
    { id: 'recipes', perm: 'recipes', path: '/recipes', label: 'Rezepte', icon: 'ri-book-open-fill', color: '#A2845E' },
    { id: 'wishlist', perm: 'wishlist', path: '/wishlists', label: 'Wunschlisten', icon: 'ri-gift-2-fill', color: '#FF2D55' },
    { id: 'vacations', perm: 'vacations', path: '/vacations', label: 'Urlaub', icon: 'ri-suitcase-3-fill', color: '#30B0C7' },
    { id: 'projects', perm: 'projects', path: '/projects', label: 'Projekte', icon: 'ri-folder-chart-fill', color: '#007AFF' },
    { id: 'contacts', perm: 'contacts', path: '/contacts', label: 'Kontakte', icon: 'ri-contacts-book-2-fill', color: '#8E8E93' },
    { id: 'contracts', perm: 'contracts', path: '/contracts', label: 'Verträge', icon: 'ri-file-shield-2-fill', color: '#32ADE6' },
    { id: 'documents', perm: 'documents', path: '/documents', label: 'Dokumente', icon: 'ri-file-text-fill', color: '#5AC8FA' },
    { id: 'vault', perm: 'vault', path: '/vault', label: 'Tresor', icon: 'ri-safe-2-fill', color: '#1C1C1E' },
];

export const featureById = Object.fromEntries(FEATURES.map(f => [f.id, f]));

/** Modules visible for a user, in their saved order. */
export const visibleFeatures = (user) => {
    if (!user) return [];
    const perms = user.permissions || {};
    const hidden = new Set(Array.isArray(user.sidebar_hidden) ? user.sidebar_hidden : []);
    const order = Array.isArray(user.sidebar_order) ? user.sidebar_order : [];
    const allowed = FEATURES.filter(f => (user.role === 'admin' || perms[f.perm] !== false) && !hidden.has(f.id));
    const rank = (f) => { const i = order.indexOf(f.id); return i === -1 ? 100 + FEATURES.indexOf(f) : i; };
    return allowed.sort((a, b) => rank(a) - rank(b));
};

/** Modules the user may use at all (ignores "hidden"). */
export const allowedFeatures = (user) => {
    const perms = user?.permissions || {};
    return FEATURES.filter(f => user?.role === 'admin' || perms[f.perm] !== false);
};
