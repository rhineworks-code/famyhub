import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { visibleFeatures } from '../lib/features';
import { Avatar, IconTile, Sheet, cx } from '../ui';

const HOME = { id: 'home', path: '/', label: 'Übersicht', icon: 'ri-home-5-fill', color: '#2B3E6A' };
const SETTINGS = { id: 'settings', path: '/settings', label: 'Einstellungen', icon: 'ri-settings-3-fill', color: '#8E8E93' };

const Sidebar = ({ features }) => {
    const { user } = useAuth();
    const item = (f) => (
        <NavLink key={f.id} to={f.path} end={f.path === '/'}
            className={({ isActive }) => cx('press flex items-center gap-3 rounded-[10px] px-2.5 py-[7px] text-[15px]', isActive ? 'bg-tint text-white' : 'text-label hover:bg-fill/12')}>
            {({ isActive }) => (<><IconTile icon={f.icon} color={isActive ? 'rgba(255,255,255,.22)' : f.color} size={28} /><span className="truncate font-medium">{f.label}</span></>)}
        </NavLink>
    );
    return (
        <aside className="safe-top sticky top-0 hidden h-dvh w-[260px] shrink-0 flex-col border-r hairline bg-card/70 backdrop-blur-xl md:flex">
            <div className="flex items-center gap-2.5 px-5 pb-3 pt-6">
                <img src="/icon-192x192.png" alt="" className="h-8 w-8 rounded-[9px]" />
                <span className="text-title3 font-bold tracking-tight">FamyHub</span>
            </div>
            <nav className="no-scrollbar flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
                {item(HOME)}
                <div className="px-2.5 pb-1 pt-4 text-caption font-semibold uppercase tracking-wide text-label3">Module</div>
                {features.map(item)}
            </nav>
            <NavLink to="/settings" className={({ isActive }) => cx('press m-3 flex items-center gap-3 rounded-card p-2.5', isActive ? 'bg-tint text-white' : 'bg-fill/10')}>
                <Avatar user={user} size={36} />
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sub font-semibold">{user?.username}</div>
                    <div className="truncate text-caption opacity-70">Einstellungen</div>
                </div>
                <i className="ri-settings-3-line text-lg opacity-70"></i>
            </NavLink>
        </aside>
    );
};

const TabBar = ({ features, onMore, moreActive }) => {
    const tab = (f) => (
        <NavLink key={f.id} to={f.path} end={f.path === '/'}
            className={({ isActive }) => cx('flex flex-1 flex-col items-center gap-0.5 pt-1.5 text-[10px] font-medium', isActive ? 'text-accent' : 'text-label3')}>
            <i className={cx(f.icon.replace('-fill', '-line'), 'text-[25px] leading-none')}></i>
            <span className="max-w-full truncate px-1">{f.label}</span>
        </NavLink>
    );
    return (
        <nav className="glass safe-bottom fixed inset-x-0 bottom-0 z-40 border-t hairline md:hidden" aria-label="Hauptnavigation">
            <div className="flex h-[52px]">
                {tab(HOME)}
                {features.slice(0, 3).map(tab)}
                <button type="button" onClick={onMore} className={cx('flex flex-1 flex-col items-center gap-0.5 pt-1.5 text-[10px] font-medium', moreActive ? 'text-accent' : 'text-label3')}>
                    <i className="ri-apps-2-line text-[25px] leading-none"></i>Mehr
                </button>
            </div>
        </nav>
    );
};

const MoreSheet = ({ open, onClose, features }) => {
    const { user } = useAuth();
    return (
        <Sheet open={open} onClose={onClose} title="Alle Module">
            <NavLink to="/settings" onClick={onClose} className="press mb-5 flex items-center gap-3 rounded-card bg-card p-3">
                <Avatar user={user} size={46} />
                <div className="min-w-0 flex-1">
                    <div className="truncate text-headline font-semibold">{user?.username}</div>
                    <div className="text-footnote text-label2">Profil & Einstellungen</div>
                </div>
                <i className="ri-arrow-right-s-line text-[22px] text-label3"></i>
            </NavLink>
            <div className="grid grid-cols-4 gap-x-2 gap-y-5 pb-2">
                {features.map(f => (
                    <NavLink key={f.id} to={f.path} onClick={onClose} className="press flex flex-col items-center gap-1.5 text-center">
                        <IconTile icon={f.icon} color={f.color} size={56} />
                        <span className="w-full truncate text-caption font-medium">{f.label}</span>
                    </NavLink>
                ))}
            </div>
        </Sheet>
    );
};

export default function AppShell() {
    const { user } = useAuth();
    const location = useLocation();
    const features = React.useMemo(() => visibleFeatures(user), [user]);
    const [more, setMore] = React.useState(false);
    const mainRef = React.useRef(null);

    React.useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);

    const inTabs = location.pathname === '/' || features.slice(0, 3).some(f => location.pathname.startsWith(f.path));
    // Chat needs the full height without page padding.
    const fullBleed = location.pathname.startsWith('/chat');

    return (
        <div className="flex min-h-dvh bg-bg text-label">
            <Sidebar features={features} />
            <main ref={mainRef} className={cx('min-w-0 flex-1', fullBleed ? '' : 'safe-top px-4 pb-[calc(env(safe-area-inset-bottom)+84px)] pt-4 md:px-8 md:pb-10 md:pt-8')}>
                <Outlet />
            </main>
            <TabBar features={features} onMore={() => setMore(true)} moreActive={!inTabs} />
            <MoreSheet open={more} onClose={() => setMore(false)} features={[...features, SETTINGS]} />
        </div>
    );
}

export { HOME, SETTINGS };
