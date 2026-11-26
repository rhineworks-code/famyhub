import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './components/Login';
import ErrorBoundary from './components/ErrorBoundary';
import api, { getToken, clearSession } from './services/api';
import { subscribeUser, unsubscribeUser, isPushSupported } from './services/push';
import { FEATURES, getPermissionStatus } from './constants/features';
import { useTranslation } from './i18n.jsx';

// Every module is loaded on demand – the old bundle shipped 1.3 MB of JavaScript on the login page.
const Dashboard = lazy(() => import('./components/Dashboard'));
const Calendar = lazy(() => import('./components/Calendar'));
const ShoppingList = lazy(() => import('./components/ShoppingList'));
const MealPlanner = lazy(() => import('./components/MealPlanner'));
const Contracts = lazy(() => import('./components/Contracts'));
const Gallery = lazy(() => import('./components/Gallery'));
const RecipeBox = lazy(() => import('./components/RecipeBox'));
const Contacts = lazy(() => import('./components/Contacts'));
const Projects = lazy(() => import('./components/Projects'));
const Wishlists = lazy(() => import('./components/Wishlist'));
const Vacations = lazy(() => import('./components/Vacations'));
const Vault = lazy(() => import('./components/Vault'));
const Documents = lazy(() => import('./components/Documents'));
const PocketMoney = lazy(() => import('./components/PocketMoney'));
const Chores = lazy(() => import('./components/Chores'));
const Timeline = lazy(() => import('./components/Timeline'));
const ChatRoom = lazy(() => import('./components/ChatRoom'));
const Register = lazy(() => import('./components/Register'));
const Onboarding = lazy(() => import('./components/Onboarding'));
const Settings = lazy(() => import('./components/Settings'));

const FEATURE_COMPONENTS = {
    calendar: Calendar,
    meals: MealPlanner,
    contracts: Contracts,
    gallery: Gallery,
    shopping: ShoppingList,
    recipes: RecipeBox,
    contacts: Contacts,
    projects: Projects,
    wishlist: Wishlists,
    vacations: Vacations,
    vault: Vault,
    documents: Documents,
    pocket_money: PocketMoney,
    chores: Chores,
    chat: ChatRoom,
    timeline: Timeline,
};

const Spinner = () => (
    <div className="flex h-full min-h-[50vh] w-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-light/30 border-t-brand-dark" />
    </div>
);

const ProtectedRoute = ({ children, user, isLoading }) => {
    const { t } = useTranslation();
    if (isLoading) return <div className="flex h-screen items-center justify-center">{t('loading')}</div>;
    if (!user) return <Navigate to="/login" replace />;
    if (!user.family_id) return <Navigate to="/onboarding" replace />;
    return children;
};

function App() {
    const [user, setUser] = React.useState(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [pushEnabled, setPushEnabled] = React.useState(false);

    const checkAuth = React.useCallback(async () => {
        if (!getToken()) {
            setUser(null);
            setIsLoading(false);
            return;
        }
        try {
            const res = await api.get('/auth/me');
            setUser(res.data);
        } catch (e) {
            if (e.response?.status === 401) setUser(null);
            else console.error('Auth check failed:', e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        checkAuth();
        if (isPushSupported()) {
            navigator.serviceWorker.ready
                .then(reg => reg.pushManager.getSubscription())
                .then(sub => setPushEnabled(!!sub))
                .catch(() => {});
        }
    }, [checkAuth]);

    // Light / dark / automatic (follows the device setting, like iOS)
    React.useEffect(() => {
        const theme = user?.theme || 'system';
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const apply = () => {
            const dark = theme === 'dark' || (theme === 'system' && media.matches);
            document.documentElement.classList.toggle('dark', dark);
            document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#000000' : '#F2F2F7');
        };
        apply();
        media.addEventListener('change', apply);
        return () => media.removeEventListener('change', apply);
    }, [user?.theme]);

    const handleLogout = async () => {
        await clearSession();
        setUser(null);
    };

    const handlePushToggle = async () => {
        if (pushEnabled) {
            if (await unsubscribeUser()) setPushEnabled(false);
            return;
        }
        const permission = await Notification.requestPermission();
        if (permission === 'granted' && await subscribeUser()) setPushEnabled(true);
    };

    const page = (content, options = {}) => (
        <ProtectedRoute user={user} isLoading={isLoading}>
            <Layout user={user} onLogout={handleLogout} noPadding={options.noPadding}>
                <ErrorBoundary>
                    <Suspense fallback={<Spinner />}>{content}</Suspense>
                </ErrorBoundary>
            </Layout>
        </ProtectedRoute>
    );

    return (
        <Router>
            <Suspense fallback={<Spinner />}>
                <Routes>
                    <Route path="/login" element={<Login setUser={setUser} />} />
                    <Route path="/register" element={<Register setUser={setUser} />} />
                    <Route path="/onboarding" element={user ? <Onboarding setUser={setUser} /> : <Navigate to="/login" />} />

                    <Route path="/" element={page(<Dashboard user={user} />)} />

                    {FEATURES.slice(1).map((feature) => {
                        const Component = FEATURE_COMPONENTS[feature.id];
                        if (!Component) return null;
                        return (
                            <Route
                                key={feature.id}
                                path={feature.path}
                                element={user && !isLoading && !getPermissionStatus(user, feature.id)
                                    ? <Navigate to="/" replace />
                                    : page(<Component user={user} />, { noPadding: feature.id === 'chat' })}
                            />
                        );
                    })}

                    <Route path="/settings" element={page(
                        <Settings user={user} onUpdateUser={checkAuth} handlePushToggle={handlePushToggle} pushEnabled={pushEnabled} />,
                    )} />

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Suspense>
        </Router>
    );
}

export default App;
