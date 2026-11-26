const KEY = 'fh_theme';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

export const applyTheme = (theme = 'system') => {
    try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
    const dark = theme === 'dark' || (theme === 'system' && media().matches);
    document.documentElement.classList.toggle('dark', dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#000000' : '#F2F2F7');
};

export const watchSystemTheme = (getTheme) => {
    const m = media();
    const fn = () => { if ((getTheme() || 'system') === 'system') applyTheme('system'); };
    m.addEventListener('change', fn);
    return () => m.removeEventListener('change', fn);
};
