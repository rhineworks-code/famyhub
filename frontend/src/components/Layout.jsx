import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { FEATURES, getPermissionStatus } from '../constants/features';
import { useTranslation } from '../i18n.jsx';

// Preferred modules for the phone tab bar (the rest lives under "Mehr").
const TAB_PREFERENCE = ['calendar', 'shopping', 'chat', 'meals', 'chores', 'timeline'];

const IconTile = ({ icon, tint, size = 'md' }) => (
    <span
        className={`${size === 'lg' ? 'w-12 h-12 text-2xl rounded-[14px]' : 'w-[30px] h-[30px] text-[17px] rounded-[8px]'} shrink-0 inline-flex items-center justify-center text-white`}
        style={{ backgroundColor: tint }}
        aria-hidden="true"
    >
        <i className={icon}></i>
    </span>
);

const Avatar = ({ user, className = 'w-10 h-10 text-base' }) => (
    user?.profile_picture ? (
        <img src={user.profile_picture} alt="" className={`${className} rounded-full object-cover`} />
    ) : (
        <span className={`${className} rounded-full bg-gradient-to-br from-brand-light to-brand-dark text-white font-semibold inline-flex items-center justify-center`}>
            {(user?.username || '?').charAt(0).toUpperCase()}
        </span>
    )
);

const Layout = ({ children, user, onLogout, noPadding = false }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMoreOpen, setIsMoreOpen] = React.useState(false);
    const [isNavEditMode, setIsNavEditMode] = React.useState(false);
    const [navOrder, setNavOrder] = React.useState(user?.sidebar_order || []);
    const [navHidden, setNavHidden] = React.useState(user?.sidebar_hidden || []);
    const dragItemIndex = React.useRef(null);
    const dragOverItemIndex = React.useRef(null);

    React.useEffect(() => { setIsMoreOpen(false); }, [location.pathname]);
    React.useEffect(() => {
        document.body.style.overflow = isMoreOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isMoreOpen]);

    const filteredNav = FEATURES.filter(item => getPermissionStatus(user, item.id));
    const sortedNav = [...filteredNav].sort((a, b) => {
        const ia = navOrder.indexOf(a.id);
        const ib = navOrder.indexOf(b.id);
        if (ia === -1 && ib === -1) return 0;
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
    });
    const visibleNav = sortedNav.filter(item => !navHidden.includes(item.id));

    const saveSidebar = async (order, hidden) => {
        try { await api.put('/auth/profile/sidebar', { order, hidden }); } catch (e) { console.error('Navigation konnte nicht gespeichert werden', e); }
    };

    const handleSort = () => {
        if (dragItemIndex.current === null || dragOverItemIndex.current === null) return;
        const list = [...sortedNav];
        const [moved] = list.splice(dragItemIndex.current, 1);
        list.splice(dragOverItemIndex.current, 0, moved);
        dragItemIndex.current = null;
        dragOverItemIndex.current = null;
        const order = list.map(i => i.id);
        setNavOrder(order);
        saveSidebar(order, navHidden);
    };

    const moveItem = (index, direction) => {
        if (index + direction < 0 || index + direction >= sortedNav.length) return;
        const list = [...sortedNav];
        [list[index], list[index + direction]] = [list[index + direction], list[index]];
        const order = list.map(i => i.id);
        setNavOrder(order);
        saveSidebar(order, navHidden);
    };

    const toggleHidden = (id) => {
        const hidden = navHidden.includes(id) ? navHidden.filter(h => h !== id) : [...navHidden, id];
        setNavHidden(hidden);
        saveSidebar(navOrder, hidden);
    };

    const handleLogout = () => {
        onLogout();
        navigate('/login');
    };

    // Phone tab bar: Start + three modules + "Mehr"
    const tabFeatures = React.useMemo(() => {
        const candidates = visibleNav.filter(f => f.id !== 'dashboard');
        const preferred = TAB_PREFERENCE.map(id => candidates.find(f => f.id === id)).filter(Boolean);
        const rest = candidates.filter(f => !preferred.includes(f));
        return [...preferred, ...rest].slice(0, 3);
    }, [visibleNav]);
    const dashboard = FEATURES[0];
    const isMoreActive = !['/', ...tabFeatures.map(f => f.path)].includes(location.pathname);

    const editControls = (item, index) => (
        <span className="flex items-center gap-1">
            <button type="button" aria-label="Nach oben" disabled={index === 0} onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveItem(index, -1); }} className="w-8 h-8 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"><i className="ri-arrow-up-s-line text-lg"></i></button>
            <button type="button" aria-label="Nach unten" disabled={index === sortedNav.length - 1} onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveItem(index, 1); }} className="w-8 h-8 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"><i className="ri-arrow-down-s-line text-lg"></i></button>
            <button type="button" aria-label={navHidden.includes(item.id) ? t('nav_show') : t('nav_hide')} onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleHidden(item.id); }} className={`w-8 h-8 rounded-full ${navHidden.includes(item.id) ? 'text-slate-400' : 'text-brand-dark dark:text-brand-light'} hover:bg-slate-100 dark:hover:bg-slate-800`}><i className={navHidden.includes(item.id) ? 'ri-eye-off-line text-lg' : 'ri-eye-line text-lg'}></i></button>
        </span>
    );

    return (
        <div className={`${noPadding ? 'h-[100dvh] overflow-hidden' : 'min-h-[100dvh]'} bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row overflow-x-hidden`}>
            {/* ---------- Sidebar (tablet / desktop) ---------- */}
            <aside className="hidden md:flex w-72 h-[100dvh] fixed left-0 top-0 flex-col bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-black/[0.08] dark:border-white/10 z-40">
                <div className="px-5 pt-8 pb-4 flex items-center gap-3">
                    <Avatar user={user} className="w-11 h-11 text-lg" />
                    <div className="min-w-0">
                        <p className="text-[17px] font-semibold text-slate-900 dark:text-white truncate">{user?.username}</p>
                        <p className="text-[13px] text-slate-500 truncate">{user?.display_role || (user?.role === 'admin' ? 'Administrator' : 'Mitglied')}</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar px-3 pb-6">
                    <div className="flex items-center justify-between px-3 pt-2 pb-1">
                        <span className="text-[13px] font-semibold text-slate-500">{t('features')}</span>
                        <button onClick={() => setIsNavEditMode(!isNavEditMode)} className="text-[15px] font-medium text-brand-dark dark:text-brand-light">
                            {isNavEditMode ? 'Fertig' : 'Bearbeiten'}
                        </button>
                    </div>
                    <nav className="space-y-0.5">
                        {sortedNav.map((item, index) => {
                            if (!isNavEditMode && navHidden.includes(item.id)) return null;
                            return (
                                <div
                                    key={item.id}
                                    draggable={isNavEditMode}
                                    onDragStart={(e) => { if (isNavEditMode) { e.dataTransfer.effectAllowed = 'move'; dragItemIndex.current = index; } }}
                                    onDragEnter={() => { if (isNavEditMode) dragOverItemIndex.current = index; }}
                                    onDragOver={(e) => { if (isNavEditMode) e.preventDefault(); }}
                                    onDrop={(e) => { if (isNavEditMode) { e.preventDefault(); handleSort(); } }}
                                >
                                    <NavLink
                                        to={item.path}
                                        end={item.path === '/'}
                                        onClick={(e) => { if (isNavEditMode) e.preventDefault(); }}
                                        className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-[10px] transition-colors
                                            ${isActive && !isNavEditMode ? 'bg-brand-dark/10 dark:bg-brand-light/15' : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'}
                                            ${isNavEditMode ? 'cursor-move' : ''} ${isNavEditMode && navHidden.includes(item.id) ? 'opacity-40' : ''}`}
                                    >
                                        <IconTile icon={item.activeIcon || item.icon} tint={item.tint} />
                                        <span className="flex-1 text-[15px] font-medium text-slate-900 dark:text-white">{t(item.id)}</span>
                                        {isNavEditMode && editControls(item, index)}
                                    </NavLink>
                                </div>
                            );
                        })}
                    </nav>

                    <div className="mt-6 space-y-0.5">
                        <NavLink
                            to="/settings"
                            className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-[10px] transition-colors ${isActive ? 'bg-brand-dark/10 dark:bg-brand-light/15' : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'}`}
                        >
                            <IconTile icon="ri-settings-3-fill" tint="#8E8E93" />
                            <span className="flex-1 text-[15px] font-medium text-slate-900 dark:text-white">{t('settings')}</span>
                        </NavLink>
                        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-[10px] hover:bg-red-500/10 transition-colors">
                            <IconTile icon="ri-logout-box-r-line" tint="#EF4444" />
                            <span className="flex-1 text-left text-[15px] font-medium text-red-600 dark:text-red-400">{t('logout')}</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* ---------- Main ---------- */}
            <div className={`flex-1 md:ml-72 flex flex-col ${noPadding ? 'h-[100dvh] overflow-hidden' : 'min-h-[100dvh]'} relative overflow-x-hidden`}>
                {noPadding && (
                    <header className="md:hidden flex items-center gap-2 px-2 pt-[max(env(safe-area-inset-top),0.5rem)] pb-2 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border-b border-black/[0.08] dark:border-white/10">
                        <button onClick={() => navigate('/')} className="flex items-center text-[17px] text-brand-dark dark:text-brand-light px-2 py-1">
                            <i className="ri-arrow-left-s-line text-2xl -ml-1"></i>{t('dashboard')}
                        </button>
                    </header>
                )}
                {noPadding ? (
                    <main className="flex flex-col flex-1 overflow-hidden">{children}</main>
                ) : (
                    <main className="flex-1 px-4 pt-[max(env(safe-area-inset-top),1.25rem)] pb-28 md:p-8 lg:p-10">
                        <div className="max-w-6xl mx-auto">{children}</div>
                    </main>
                )}
            </div>

            {/* ---------- Tab bar (phone) ---------- */}
            {!noPadding && (
                <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border-t border-black/[0.08] dark:border-white/10 pb-[env(safe-area-inset-bottom)]">
                    <div className="flex justify-around px-1 pt-1.5 pb-1">
                        {[dashboard, ...tabFeatures].map(item => (
                            <NavLink
                                key={item.id}
                                to={item.path}
                                end={item.path === '/'}
                                className={({ isActive }) => `flex flex-col items-center gap-0.5 w-16 py-1 ${isActive ? 'text-brand-dark dark:text-brand-light' : 'text-slate-400'}`}
                            >
                                {({ isActive }) => (
                                    <>
                                        <i className={`${isActive ? (item.activeIcon || item.icon) : item.icon} text-[24px] leading-none`}></i>
                                        <span className="text-[10px] font-medium">{t(item.id)}</span>
                                    </>
                                )}
                            </NavLink>
                        ))}
                        <button onClick={() => setIsMoreOpen(true)} className={`flex flex-col items-center gap-0.5 w-16 py-1 ${isMoreActive ? 'text-brand-dark dark:text-brand-light' : 'text-slate-400'}`}>
                            <i className={`${isMoreActive ? 'ri-apps-2-fill' : 'ri-apps-2-line'} text-[24px] leading-none`}></i>
                            <span className="text-[10px] font-medium">Mehr</span>
                        </button>
                    </div>
                </nav>
            )}

            {/* ---------- "Mehr" sheet (phone) ---------- */}
            {isMoreOpen && (
                <div className="md:hidden fixed inset-0 z-[100] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Alle Bereiche">
                    <button aria-label="Schließen" className="absolute inset-0 bg-black/40" onClick={() => { setIsMoreOpen(false); setIsNavEditMode(false); }}></button>
                    <div className="relative bg-slate-50 dark:bg-slate-950 rounded-t-[22px] max-h-[88dvh] flex flex-col sheet-up">
                        <div className="flex justify-center pt-2"><span className="w-9 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span></div>
                        <div className="flex items-center justify-between px-5 pt-3 pb-2">
                            <button onClick={() => setIsNavEditMode(!isNavEditMode)} className="text-[17px] text-brand-dark dark:text-brand-light">{isNavEditMode ? 'Fertig' : 'Bearbeiten'}</button>
                            <span className="text-[17px] font-semibold text-slate-900 dark:text-white">Alle Bereiche</span>
                            <button onClick={() => { setIsMoreOpen(false); setIsNavEditMode(false); }} className="text-[17px] font-semibold text-brand-dark dark:text-brand-light">Schließen</button>
                        </div>

                        <div className="overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
                            <div className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-[14px] p-3 mb-5">
                                <Avatar user={user} className="w-12 h-12 text-xl" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-[17px] font-semibold text-slate-900 dark:text-white truncate">{user?.username}</p>
                                    <p className="text-[13px] text-slate-500 truncate">{user?.display_role || (user?.role === 'admin' ? 'Administrator' : 'Mitglied')}</p>
                                </div>
                            </div>

                            {isNavEditMode ? (
                                <div className="bg-white dark:bg-slate-800 rounded-[14px] overflow-hidden divide-y divide-black/[0.06] dark:divide-white/10 mb-5">
                                    {sortedNav.map((item, index) => (
                                        <div key={item.id} className={`flex items-center gap-3 px-3 py-2 ${navHidden.includes(item.id) ? 'opacity-40' : ''}`}>
                                            <IconTile icon={item.activeIcon || item.icon} tint={item.tint} />
                                            <span className="flex-1 text-[16px] text-slate-900 dark:text-white">{t(item.id)}</span>
                                            {editControls(item, index)}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="grid grid-cols-4 gap-y-5 gap-x-2 mb-6">
                                    {visibleNav.map(item => (
                                        <NavLink key={item.id} to={item.path} end={item.path === '/'} className="flex flex-col items-center gap-1.5 text-center">
                                            <IconTile icon={item.activeIcon || item.icon} tint={item.tint} size="lg" />
                                            <span className="text-[11px] font-medium leading-tight text-slate-700 dark:text-slate-200">{t(item.id)}</span>
                                        </NavLink>
                                    ))}
                                </div>
                            )}

                            <div className="bg-white dark:bg-slate-800 rounded-[14px] overflow-hidden divide-y divide-black/[0.06] dark:divide-white/10">
                                <NavLink to="/settings" className="flex items-center gap-3 px-3 py-2.5">
                                    <IconTile icon="ri-settings-3-fill" tint="#8E8E93" />
                                    <span className="flex-1 text-[16px] text-slate-900 dark:text-white">{t('settings')}</span>
                                    <i className="ri-arrow-right-s-line text-xl text-slate-300"></i>
                                </NavLink>
                                <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5">
                                    <IconTile icon="ri-logout-box-r-line" tint="#EF4444" />
                                    <span className="flex-1 text-left text-[16px] text-red-600 dark:text-red-400">{t('logout')}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Layout;
