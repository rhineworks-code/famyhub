export const FEATURES = [
    { id: 'dashboard', label: 'Dashboard', icon: 'ri-home-4-line', activeIcon: 'ri-home-4-fill', path: '/', tint: '#2B3E6A' },
    { id: 'timeline', label: 'Timeline', icon: 'ri-history-line', activeIcon: 'ri-history-fill', path: '/timeline', tint: '#14B8A6' },
    { id: 'calendar', label: 'Kalender', icon: 'ri-calendar-event-line', activeIcon: 'ri-calendar-event-fill', path: '/calendar', tint: '#E8577B' },
    { id: 'meals', label: 'Mahlzeiten', icon: 'ri-restaurant-line', activeIcon: 'ri-restaurant-fill', path: '/meals', tint: '#F59E0B' },
    { id: 'contracts', label: 'Verträge', icon: 'ri-file-paper-2-line', activeIcon: 'ri-file-paper-2-fill', path: '/contracts', tint: '#64748B' },
    { id: 'gallery', label: 'Galerie', icon: 'ri-image-line', activeIcon: 'ri-image-fill', path: '/gallery', tint: '#0EA5E9' },
    { id: 'shopping', label: 'Einkauf', icon: 'ri-shopping-basket-2-line', activeIcon: 'ri-shopping-basket-2-fill', path: '/shopping', tint: '#10B981' },
    { id: 'recipes', label: 'Rezepte', icon: 'ri-book-open-line', activeIcon: 'ri-book-open-fill', path: '/recipes', tint: '#EA580C' },
    { id: 'contacts', label: 'Kontakte', icon: 'ri-contacts-book-line', activeIcon: 'ri-contacts-book-fill', path: '/contacts', tint: '#6366F1' },
    { id: 'projects', label: 'Projekte', icon: 'ri-hammer-line', activeIcon: 'ri-hammer-fill', path: '/projects', tint: '#8B5CF6' },
    { id: 'wishlist', label: 'Wünsche', icon: 'ri-gift-line', activeIcon: 'ri-gift-fill', path: '/wishlists', tint: '#EC4899' },
    { id: 'vacations', label: 'Urlaub', icon: 'ri-plane-line', activeIcon: 'ri-plane-fill', path: '/vacations', tint: '#06B6D4' },
    { id: 'vault', label: 'Tresor', icon: 'ri-safe-2-line', activeIcon: 'ri-safe-2-fill', path: '/vault', tint: '#475569' },
    { id: 'chat', label: 'Chat', icon: 'ri-chat-smile-2-line', activeIcon: 'ri-chat-smile-2-fill', path: '/chat', tint: '#1AA7EC' },
    { id: 'documents', label: 'Dokumente', icon: 'ri-file-search-line', activeIcon: 'ri-file-search-fill', path: '/documents', tint: '#8E8E93' },
    { id: 'pocket_money', label: 'Taschengeld', icon: 'ri-wallet-3-line', activeIcon: 'ri-wallet-3-fill', path: '/pocket-money', tint: '#16A34A' },
    { id: 'chores', label: 'Missionen', icon: 'ri-star-smile-line', activeIcon: 'ri-star-smile-fill', path: '/chores', tint: '#7C6CE0' }
];

export const getPermissionStatus = (user, featureId) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (featureId === 'dashboard') return true;
    if (!user.permissions) return true;
    return user.permissions[featureId] !== false;
};
