import { Link, Route, Routes } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Page, Section, Row, Avatar, useFeedback } from '../ui';
import Profile from './settings/Profile';
import Security from './settings/Security';
import Appearance from './settings/Appearance';
import Notifications from './settings/Notifications';
import Family from './settings/Family';
import System from './settings/System';

const Root = () => {
    const { user, isAdmin, signOut } = useAuth();
    const { confirm } = useFeedback();
    const logout = async () => { if (await confirm({ title: 'Abmelden?', confirmText: 'Abmelden', destructive: true })) signOut(); };
    return (
        <Page title="Einstellungen">
            <Link to="/settings/profile" className="press mb-7 flex items-center gap-4 rounded-card bg-card p-4">
                <Avatar user={user} size={62} />
                <div className="min-w-0 flex-1">
                    <div className="truncate text-title3 font-semibold">{user.username}</div>
                    <div className="truncate text-footnote text-label2">{[user.display_role, user.email].filter(Boolean).join(' · ')}</div>
                </div>
                <i className="ri-arrow-right-s-line text-[22px] text-label3"></i>
            </Link>
            <Section>
                <Row icon="ri-shield-keyhole-fill" color="#34C759" title="Passwort & Sicherheit" value={user.two_factor_enabled ? '2FA an' : undefined} to="/settings/security" />
                <Row icon="ri-contrast-2-fill" color="#5856D6" title="Darstellung & Module" to="/settings/appearance" />
                <Row icon="ri-notification-3-fill" color="#FF3B30" title="Mitteilungen" to="/settings/notifications" />
            </Section>
            <Section>
                <Row icon="ri-home-heart-fill" color="#2B3E6A" title="Familie" subtitle={isAdmin ? 'Mitglieder, Rechte, Einladungscode' : 'Mitglieder & Einladungscode'} to="/settings/family" />
                {isAdmin && <Row icon="ri-server-fill" color="#8E8E93" title="System" subtitle="E-Mail, Speicher, Backup" to="/settings/system" />}
            </Section>
            <Section>
                <Row title="Abmelden" destructive onClick={logout} />
            </Section>
            <p className="text-center text-footnote text-label3">FamyHub 3.0</p>
        </Page>
    );
};

export default function Settings() {
    const { isAdmin } = useAuth();
    return (
        <Routes>
            <Route index element={<Root />} />
            <Route path="profile" element={<Profile />} />
            <Route path="security" element={<Security />} />
            <Route path="appearance" element={<Appearance />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="family" element={<Family />} />
            {isAdmin && <Route path="system" element={<System />} />}
            <Route path="*" element={<Root />} />
        </Routes>
    );
}
