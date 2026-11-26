import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth, MembersProvider } from './lib/auth';
import { allowedFeatures } from './lib/features';
import AppShell from './layout/AppShell';
import { Loading, Empty, Button } from './ui';
import AuthScreen from './pages/auth/AuthScreen';
import Onboarding from './pages/auth/Onboarding';

const pages = {
    dashboard: lazy(() => import('./pages/Dashboard')),
    calendar: lazy(() => import('./pages/Calendar')),
    shopping: lazy(() => import('./pages/Shopping')),
    chat: lazy(() => import('./pages/Chat')),
    meals: lazy(() => import('./pages/Meals')),
    chores: lazy(() => import('./pages/Chores')),
    pocket_money: lazy(() => import('./pages/PocketMoney')),
    timeline: lazy(() => import('./pages/Timeline')),
    gallery: lazy(() => import('./pages/Gallery')),
    recipes: lazy(() => import('./pages/Recipes')),
    wishlist: lazy(() => import('./pages/Wishlists')),
    vacations: lazy(() => import('./pages/Vacations')),
    projects: lazy(() => import('./pages/Projects')),
    contacts: lazy(() => import('./pages/Contacts')),
    contracts: lazy(() => import('./pages/Contracts')),
    documents: lazy(() => import('./pages/Documents')),
    vault: lazy(() => import('./pages/Vault')),
    settings: lazy(() => import('./pages/Settings')),
};

class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { error: null }; }
    static getDerivedStateFromError(error) { return { error }; }
    componentDidCatch(error, info) { console.error(error, info); }
    render() {
        if (this.state.error) {
            return (
                <Empty icon="ri-bug-line" title="Hier ist etwas schiefgelaufen" text={String(this.state.error.message || this.state.error)}
                    action={<Button onClick={() => window.location.reload()}>Neu laden</Button>} />
            );
        }
        return this.props.children;
    }
}

const Splash = () => (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-bg">
        <img src="/icon-192x192.png" alt="" className="h-20 w-20 rounded-[22px] shadow-pop" />
        <Loading />
    </div>
);

const Wrap = ({ name }) => {
    const Page = pages[name];
    return (
        <ErrorBoundary key={name}>
            <Suspense fallback={<Loading />}><Page /></Suspense>
        </ErrorBoundary>
    );
};

export default function App() {
    const { user, ready } = useAuth();
    if (!ready) return <Splash />;
    if (!user) return <AuthScreen />;
    if (!user.family_id) return <Onboarding />;

    const allowed = allowedFeatures(user);
    return (
        <MembersProvider>
            <Routes>
                <Route element={<AppShell />}>
                    <Route index element={<Wrap name="dashboard" />} />
                    {allowed.map(f => <Route key={f.id} path={`${f.path.slice(1)}/*`} element={<Wrap name={f.id} />} />)}
                    <Route path="settings/*" element={<Wrap name="settings" />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            </Routes>
        </MembersProvider>
    );
}
