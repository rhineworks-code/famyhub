import { format, isToday, isTomorrow, isYesterday, formatDistanceToNowStrict, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

export const toDate = (v) => {
    if (!v) return null;
    if (v instanceof Date) return v;
    const s = String(v);
    // SQLite "YYYY-MM-DD HH:MM:SS" is UTC without zone marker
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) return new Date(s.replace(' ', 'T') + 'Z');
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? parseISO(s) : new Date(s);
};

export const fmt = (v, pattern) => { const d = toDate(v); return d && !isNaN(d) ? format(d, pattern, { locale: de }) : ''; };
export const fmtDate = (v) => fmt(v, 'd. MMM yyyy');
export const fmtDay = (v) => fmt(v, 'EEEE, d. MMMM');
export const fmtTime = (v) => fmt(v, 'HH:mm');
export const ymd = (d) => format(d, 'yyyy-MM-dd');

export const relDay = (v) => {
    const d = toDate(v);
    if (!d) return '';
    if (isToday(d)) return 'Heute';
    if (isTomorrow(d)) return 'Morgen';
    if (isYesterday(d)) return 'Gestern';
    return format(d, 'EEE, d. MMM', { locale: de });
};

export const ago = (v) => {
    const d = toDate(v);
    if (!d) return '';
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'gerade eben';
    return `vor ${formatDistanceToNowStrict(d, { locale: de })}`;
};

export const euro = (n) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);

export const greeting = () => {
    const h = new Date().getHours();
    if (h < 5) return 'Gute Nacht';
    if (h < 11) return 'Guten Morgen';
    if (h < 17) return 'Guten Tag';
    if (h < 22) return 'Guten Abend';
    return 'Gute Nacht';
};

export const initials = (name = '?') => name.trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase() || '?';

// Stable person colours
const PALETTE = ['#2B3E6A', '#E8577B', '#7C6CE0', '#1AA7EC', '#10B981', '#F59E0B', '#14B8A6', '#EC4899', '#6366F1', '#EA580C'];
export const personColor = (id) => PALETTE[Math.abs(Number(id) || String(id).split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % PALETTE.length];

/** Value for <input type="datetime-local"> */
export const toLocalInput = (v) => { const d = toDate(v); return d && !isNaN(d) ? format(d, "yyyy-MM-dd'T'HH:mm") : ''; };
/** Local date + time strings → ISO */
export const fromLocal = (date, time = '00:00') => (date ? new Date(`${date}T${time || '00:00'}`).toISOString() : null);

export const COLORS = ['#2B3E6A', '#1AA7EC', '#34C759', '#FF9500', '#FF3B30', '#FF2D55', '#AF52DE', '#5856D6', '#30B0C7', '#8E8E93'];
