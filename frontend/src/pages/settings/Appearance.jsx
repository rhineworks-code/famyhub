import api from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { applyTheme } from '../../lib/theme';
import { allowedFeatures } from '../../lib/features';
import { Page, Section, IconTile, IconButton, Toggle, useAction, cx } from '../../ui';

const THEMES = [
    { value: 'light', label: 'Hell', icon: 'ri-sun-line' },
    { value: 'dark', label: 'Dunkel', icon: 'ri-moon-line' },
    { value: 'system', label: 'Automatisch', icon: 'ri-contrast-2-line' },
];

export default function Appearance() {
    const { user, patchUser } = useAuth();
    const act = useAction();
    const theme = user.theme || 'system';

    const setTheme = async (t) => {
        applyTheme(t);
        patchUser({ theme: t });
        await act(() => api.put('/auth/profile/preferences', { theme: t }));
    };

    const all = allowedFeatures(user);
    const order = Array.isArray(user.sidebar_order) ? user.sidebar_order : [];
    const hidden = Array.isArray(user.sidebar_hidden) ? user.sidebar_hidden : [];
    const rank = (f) => { const i = order.indexOf(f.id); return i === -1 ? 100 + all.indexOf(f) : i; };
    const sorted = [...all].sort((a, b) => rank(a) - rank(b));

    const saveModules = async (nextOrder, nextHidden) => {
        patchUser({ sidebar_order: nextOrder, sidebar_hidden: nextHidden });
        await act(() => api.put('/auth/profile/sidebar', { order: nextOrder, hidden: nextHidden }));
    };
    const move = (idx, dir) => {
        const ids = sorted.map(f => f.id);
        const j = idx + dir;
        if (j < 0 || j >= ids.length) return;
        [ids[idx], ids[j]] = [ids[j], ids[idx]];
        saveModules(ids, hidden);
    };
    const toggle = (id, on) => saveModules(sorted.map(f => f.id), on ? hidden.filter(h => h !== id) : [...hidden, id]);
    const visibleIds = sorted.filter(f => !hidden.includes(f.id)).map(f => f.id);

    return (
        <Page back="/settings" title="Darstellung">
            <Section title="Erscheinungsbild" plain>
                <div className="grid grid-cols-3 gap-3">
                    {THEMES.map(t => (
                        <button key={t.value} onClick={() => setTheme(t.value)} className={cx('press flex flex-col items-center gap-2 rounded-card bg-card p-3', theme === t.value && 'ring-2 ring-accent')}>
                            <span className={cx('flex h-16 w-full items-center justify-center rounded-cell text-2xl',
                                t.value === 'light' ? 'bg-[#F2F2F7] text-[#2B3E6A]' : t.value === 'dark' ? 'bg-[#1C1C1E] text-[#64B5F6]' : 'bg-gradient-to-r from-[#F2F2F7] from-50% to-[#1C1C1E] to-50% text-[#8E8E93]')}>
                                <i className={t.icon}></i>
                            </span>
                            <span className="text-footnote font-medium">{t.label}</span>
                            <i className={cx('text-lg', theme === t.value ? 'ri-checkbox-circle-fill text-accent' : 'ri-checkbox-blank-circle-line text-label3')}></i>
                        </button>
                    ))}
                </div>
            </Section>
            <Section title="Module" footer="Die ersten drei sichtbaren Module erscheinen auf dem Handy in der unteren Leiste. Ausgeblendete Module bleiben unter „Mehr“ verborgen.">
                {sorted.map((f, i) => {
                    const on = !hidden.includes(f.id);
                    const tab = visibleIds.indexOf(f.id);
                    return (
                        <div key={f.id} className="group/row flex items-center gap-3 pl-4">
                            <IconTile icon={f.icon} color={f.color} />
                            <div className="flex min-h-[50px] flex-1 items-center gap-1 border-b hairline pr-3 group-last/row:border-b-0">
                                <span className={cx('flex-1 text-body', !on && 'text-label3')}>{f.label}{on && tab > -1 && tab < 3 && <span className="ml-2 rounded-full bg-accent/12 px-1.5 py-0.5 text-caption font-semibold text-accent">Leiste</span>}</span>
                                <IconButton icon="ri-arrow-up-s-line" label="Nach oben" variant="plain" size={32} disabled={i === 0} onClick={() => move(i, -1)} />
                                <IconButton icon="ri-arrow-down-s-line" label="Nach unten" variant="plain" size={32} disabled={i === sorted.length - 1} onClick={() => move(i, 1)} />
                                <Toggle checked={on} onChange={(v) => toggle(f.id, v)} label={`${f.label} anzeigen`} />
                            </div>
                        </div>
                    );
                })}
            </Section>
        </Page>
    );
}
