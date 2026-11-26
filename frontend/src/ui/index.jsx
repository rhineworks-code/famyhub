import React from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { initials, personColor } from '../lib/format';
import { uploadUrl } from '../lib/api';

export const cx = (...c) => c.filter(Boolean).join(' ');

/* ---------------------------------------------------------------- Layout -- */

/** Screen with an iOS large title. */
export const Page = ({ title, subtitle, actions, back, children, wide = false, className }) => {
    const navigate = useNavigate();
    return (
        <div className={cx('mx-auto w-full pb-10', wide ? 'max-w-6xl' : 'max-w-3xl', className)}>
            {back && (
                <button onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))} className="press -ml-2 mb-1 flex items-center text-body text-accent">
                    <i className="ri-arrow-left-s-line text-[26px] leading-none"></i>{typeof back === 'string' ? 'Zurück' : 'Zurück'}
                </button>
            )}
            <header className="mb-5 flex items-end justify-between gap-3 px-1">
                <div className="min-w-0">
                    {subtitle && <p className="text-footnote font-semibold uppercase tracking-wide text-label2">{subtitle}</p>}
                    <h1 className="truncate text-large font-bold">{title}</h1>
                </div>
                {actions && <div className="flex shrink-0 items-center gap-2 pb-1">{actions}</div>}
            </header>
            {children}
        </div>
    );
};

/** Grouped list section (iOS "inset grouped"). */
export const Section = ({ title, footer, action, children, className, plain = false }) => (
    <section className={cx('mb-7', className)}>
        {(title || action) && (
            <div className="mb-1.5 flex items-end justify-between px-4">
                {title && <h2 className="text-footnote font-semibold uppercase tracking-wide text-label2">{title}</h2>}
                {action}
            </div>
        )}
        {plain ? children : <div className="overflow-hidden rounded-card bg-card">{children}</div>}
        {footer && <p className="mt-1.5 px-4 text-footnote text-label2">{footer}</p>}
    </section>
);

export const IconTile = ({ icon, color = '#8E8E93', size = 30, className }) => (
    <span
        aria-hidden="true"
        className={cx('inline-flex shrink-0 items-center justify-center text-white', className)}
        style={{ backgroundColor: color, width: size, height: size, borderRadius: size * 0.27, fontSize: size * 0.58 }}
    >
        <i className={icon}></i>
    </span>
);

/** A list row. Renders a Link (to), a button (onClick) or a plain div. */
export const Row = ({ icon, color, leading, title, subtitle, value, right, chevron, to, onClick, destructive, children, className, multiline }) => {
    const content = (
        <>
            {leading}
            {icon && <IconTile icon={icon} color={color} />}
            <div className={cx('flex min-w-0 flex-1 items-center gap-3 self-stretch border-b hairline py-[11px] pr-4 group-last/row:border-b-0')}>
                <div className="min-w-0 flex-1">
                    <div className={cx('text-body', multiline ? 'break-words' : 'truncate', destructive ? 'text-danger' : 'text-label')}>{title}</div>
                    {subtitle && <div className={cx('text-footnote text-label2', multiline ? 'break-words' : 'truncate')}>{subtitle}</div>}
                    {children}
                </div>
                {value !== undefined && value !== null && <span className="shrink-0 text-body text-label2">{value}</span>}
                {right}
                {(chevron || to) && <i className="ri-arrow-right-s-line -mr-1 text-[22px] text-label3"></i>}
            </div>
        </>
    );
    const cls = cx('group/row flex w-full items-center gap-3 pl-4 text-left', (to || onClick) && 'press active:bg-fill/10', className);
    if (to) return <Link to={to} className={cls}>{content}</Link>;
    if (onClick) {
        // div instead of <button>: rows often contain their own buttons (checkboxes, toggles).
        return (
            <div role="button" tabIndex={0} onClick={onClick} className={cx(cls, 'cursor-pointer')}
                onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); onClick(e); } }}>
                {content}
            </div>
        );
    }
    return <div className={cls}>{content}</div>;
};

export const Card = ({ children, className, onClick, to, padded = true }) => {
    const cls = cx('block rounded-card bg-card', padded && 'p-4', (onClick || to) && 'press', className);
    if (to) return <Link to={to} className={cls}>{children}</Link>;
    if (onClick) return <button type="button" onClick={onClick} className={cx(cls, 'w-full text-left')}>{children}</button>;
    return <div className={cls}>{children}</div>;
};

/* --------------------------------------------------------------- Controls -- */

export const Spinner = ({ className }) => (
    <span className={cx('inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent', className)} aria-label="Lädt" />
);

const BTN = {
    filled: 'bg-tint text-white',
    tinted: 'bg-accent/12 text-accent',
    gray: 'bg-fill/15 text-label',
    plain: 'text-accent',
    destructive: 'bg-danger/12 text-danger',
    danger: 'bg-danger text-white',
    none: '',
};

export const Button = ({ variant = 'filled', size = 'md', icon, loading, full, className, children, ...props }) => (
    <button
        type="button"
        {...props}
        disabled={props.disabled || loading}
        className={cx(
            'press inline-flex items-center justify-center gap-1.5 font-semibold disabled:opacity-40',
            size === 'sm' ? 'h-8 rounded-full px-3.5 text-sub' : size === 'lg' ? 'h-[50px] rounded-cell px-5 text-body' : 'h-11 rounded-cell px-4 text-body',
            variant === 'plain' && 'h-auto px-1',
            BTN[variant], full && 'w-full', className,
        )}
    >
        {loading ? <Spinner className="h-4 w-4" /> : icon && <i className={cx(icon, 'text-[1.15em]')}></i>}
        {children}
    </button>
);

export const IconButton = ({ icon, label, onClick, variant = 'tinted', className, size = 36, ...props }) => (
    <button
        type="button"
        aria-label={label}
        title={label}
        onClick={onClick}
        {...props}
        className={cx('press inline-flex shrink-0 items-center justify-center rounded-full disabled:opacity-40', BTN[variant] || BTN.tinted, className)}
        style={{ width: size, height: size, fontSize: size * 0.55 }}
    >
        <i className={icon}></i>
    </button>
);

export const Segmented = ({ options, value, onChange, className }) => (
    <div role="tablist" className={cx('flex rounded-[9px] bg-fill/15 p-0.5', className)}>
        {options.map((o) => {
            const active = o.value === value;
            return (
                <button
                    key={o.value}
                    role="tab"
                    type="button"
                    aria-selected={active}
                    onClick={() => onChange(o.value)}
                    className={cx('flex-1 truncate rounded-[7px] px-3 py-1.5 text-footnote transition-all', active ? 'bg-card font-semibold text-label shadow-soft dark:bg-[#636366]' : 'font-medium text-label')}
                >
                    {o.label}
                </button>
            );
        })}
    </div>
);

export const Toggle = ({ checked, onChange, label, disabled }) => (
    <button
        type="button"
        role="switch"
        aria-checked={!!checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx('relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors disabled:opacity-40', checked ? 'bg-ok' : 'bg-fill/30')}
    >
        <span className={cx('absolute left-0 top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-[2px]')} />
    </button>
);

export const Field = React.forwardRef(({ label, hint, className, as = 'input', children, ...props }, ref) => {
    const id = React.useId();
    const Tag = as;
    return (
        <label htmlFor={id} className={cx('block', className)}>
            {label && <span className="mb-1.5 block px-1 text-footnote font-medium text-label2">{label}</span>}
            <Tag id={id} ref={ref} {...props} className={cx('field', as === 'textarea' && 'min-h-[96px] resize-y', as === 'select' && 'appearance-none bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10')}
                style={as === 'select' ? { backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%238E8E93%27 stroke-width=%272.5%27%3E%3Cpath d=%27M6 9l6 6 6-6%27/%3E%3C/svg%3E")' } : undefined}>
                {children}
            </Tag>
            {hint && <span className="mt-1 block px-1 text-footnote text-label2">{hint}</span>}
        </label>
    );
});
Field.displayName = 'Field';

export const SearchField = ({ value, onChange, placeholder = 'Suchen' }) => (
    <label className="flex h-9 items-center gap-1.5 rounded-[10px] bg-fill/15 px-2.5">
        <i className="ri-search-line text-label3"></i>
        <span className="sr-only">{placeholder}</span>
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-transparent text-body outline-none" type="search" />
        {value && <button type="button" aria-label="Leeren" onClick={() => onChange('')} className="text-label3"><i className="ri-close-circle-fill"></i></button>}
    </label>
);

export const Chip = ({ active, onClick, children, color }) => (
    <button
        type="button"
        onClick={onClick}
        className={cx('press shrink-0 rounded-full px-3.5 py-1.5 text-sub font-medium', active ? 'bg-tint text-white' : 'bg-card text-label')}
        style={active && color ? { backgroundColor: color } : undefined}
    >
        {children}
    </button>
);

export const Badge = ({ children, color = '#FF3B30' }) => (
    <span className="inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 text-caption font-semibold text-white" style={{ backgroundColor: color, height: 20 }}>{children}</span>
);

export const Avatar = ({ user, name, src, size = 40, color, className }) => {
    const label = name || user?.username || user?.name || '?';
    const pic = src || user?.profile_picture;
    const [broken, setBroken] = React.useState(false);
    if (pic && !broken) {
        return <img src={uploadUrl(pic)} alt="" onError={() => setBroken(true)} className={cx('shrink-0 rounded-full object-cover', className)} style={{ width: size, height: size }} />;
    }
    return (
        <span className={cx('inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white', className)}
            style={{ width: size, height: size, fontSize: size * 0.4, backgroundColor: color || personColor(user?.id ?? label) }}>
            {initials(label)}
        </span>
    );
};

export const Empty = ({ icon = 'ri-inbox-line', title, text, action }) => (
    <div className="flex flex-col items-center px-6 py-12 text-center">
        <span className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-fill/12 text-[30px] text-label3"><i className={icon}></i></span>
        <p className="text-headline font-semibold">{title}</p>
        {text && <p className="mt-1 max-w-xs text-sub text-label2">{text}</p>}
        {action && <div className="mt-4">{action}</div>}
    </div>
);

export const Loading = () => <div className="flex justify-center py-16 text-label3"><Spinner /></div>;

export const ErrorNote = ({ error, onRetry }) => (
    <div className="rounded-card bg-danger/10 p-4 text-sub text-danger">
        {error?.response?.data?.error || 'Daten konnten nicht geladen werden.'}
        {onRetry && <button onClick={onRetry} className="ml-2 font-semibold underline">Erneut versuchen</button>}
    </div>
);

/* ------------------------------------------------------------------ Sheet -- */

/** Bottom sheet on phones, centered dialog on larger screens. */
export const Sheet = ({ open, onClose, title, children, onSave, saveLabel = 'Sichern', saving, saveDisabled, cancelLabel = 'Abbrechen', size = 'md', footer }) => {
    React.useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
    }, [open, onClose]);
    if (!open) return null;
    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal="true" aria-label={title}>
            <button type="button" aria-label="Schließen" onClick={onClose} className="anim-fade absolute inset-0 bg-black/40" />
            <div className={cx('anim-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-sheet bg-bg shadow-pop md:rounded-sheet', size === 'lg' ? 'md:max-w-2xl' : size === 'xl' ? 'md:max-w-4xl' : 'md:max-w-lg')}>
                <div className="flex justify-center pt-2 md:hidden"><span className="h-[5px] w-9 rounded-full bg-fill/40" /></div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pb-2 pt-2.5">
                    <button type="button" onClick={onClose} className="press justify-self-start text-body text-accent">{onSave ? cancelLabel : ''}</button>
                    <h2 className="truncate text-headline font-semibold">{title}</h2>
                    {onSave ? (
                        <button type="button" onClick={onSave} disabled={saving || saveDisabled} className="press justify-self-end text-body font-semibold text-accent disabled:opacity-40">
                            {saving ? <Spinner className="h-4 w-4" /> : saveLabel}
                        </button>
                    ) : (
                        <button type="button" onClick={onClose} className="press justify-self-end text-body font-semibold text-accent">Fertig</button>
                    )}
                </div>
                <div className="overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-2">{children}</div>
                {footer}
            </div>
        </div>,
        document.body,
    );
};

/** Form wrapper for sheets: submit on Enter. */
export const Form = ({ onSubmit, children, className }) => (
    <form className={cx('space-y-4', className)} onSubmit={(e) => { e.preventDefault(); onSubmit?.(); }}>
        {children}
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
    </form>
);

/* ------------------------------------------------- Toasts & confirmations -- */

const FeedbackContext = React.createContext({ toast: () => {}, confirm: async () => false });
export const useFeedback = () => React.useContext(FeedbackContext);

export const FeedbackProvider = ({ children }) => {
    const [toasts, setToasts] = React.useState([]);
    const [dialog, setDialog] = React.useState(null);

    const toast = React.useCallback((message, type = 'ok') => {
        const id = Math.random();
        setToasts(t => [...t, { id, message, type }]);
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
    }, []);

    const confirm = React.useCallback((opts) => new Promise((resolve) => {
        setDialog({ ...(typeof opts === 'string' ? { title: opts } : opts), resolve });
    }), []);

    const close = (result) => { dialog?.resolve(result); setDialog(null); };
    const value = React.useMemo(() => ({ toast, confirm }), [toast, confirm]);

    return (
        <FeedbackContext.Provider value={value}>
            {children}
            {createPortal(
                <div className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),12px)] z-[300] flex flex-col items-center gap-2 px-4">
                    {toasts.map(t => (
                        <div key={t.id} role="status" className="anim-toast glass pointer-events-auto flex max-w-sm items-center gap-2 rounded-full px-4 py-2.5 text-sub font-medium shadow-pop">
                            <i className={t.type === 'error' ? 'ri-error-warning-fill text-danger' : 'ri-checkbox-circle-fill text-ok'}></i>
                            {t.message}
                        </div>
                    ))}
                </div>,
                document.body,
            )}
            {dialog && createPortal(
                <div className="fixed inset-0 z-[310] flex items-center justify-center p-8" role="alertdialog" aria-modal="true" aria-label={dialog.title}>
                    <div className="anim-fade absolute inset-0 bg-black/40" />
                    <div className="anim-pop glass relative w-full max-w-[290px] overflow-hidden rounded-[14px] text-center">
                        <div className="px-4 pb-4 pt-5">
                            <p className="text-headline font-semibold">{dialog.title}</p>
                            {dialog.message && <p className="mt-1 text-footnote text-label">{dialog.message}</p>}
                        </div>
                        <div className="grid grid-cols-2 border-t hairline">
                            <button autoFocus onClick={() => close(false)} className="press border-r hairline py-3 text-body text-accent">{dialog.cancelText || 'Abbrechen'}</button>
                            <button onClick={() => close(true)} className={cx('press py-3 text-body font-semibold', dialog.destructive ? 'text-danger' : 'text-accent')}>{dialog.confirmText || 'OK'}</button>
                        </div>
                    </div>
                </div>,
                document.body,
            )}
        </FeedbackContext.Provider>
    );
};

/* ---------------------------------------------------------------- Pickers -- */

export const ColorPicker = ({ value, onChange, colors }) => (
    <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Farbe">
        {colors.map(c => (
            <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={c} onClick={() => onChange(c)}
                className={cx('press h-8 w-8 rounded-full ring-offset-2 ring-offset-bg', value === c && 'ring-2 ring-label')} style={{ backgroundColor: c }} />
        ))}
    </div>
);

/** Horizontal avatar picker. `value` is an id, or an array when `multi`. */
export const MemberPicker = ({ members, value, onChange, multi = false, allowNone = false, noneLabel = 'Alle' }) => {
    const selected = (id) => (multi ? (value || []).map(String).includes(String(id)) : String(value ?? '') === String(id ?? ''));
    const toggle = (id) => {
        if (!multi) return onChange(id);
        const cur = (value || []).map(String);
        onChange(cur.includes(String(id)) ? cur.filter(x => x !== String(id)) : [...cur, String(id)]);
    };
    return (
        <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 py-1">
            {allowNone && (
                <button type="button" onClick={() => onChange(multi ? [] : null)} className="press flex w-14 shrink-0 flex-col items-center gap-1">
                    <span className={cx('flex h-12 w-12 items-center justify-center rounded-full bg-fill/15 text-xl text-label2', (multi ? !(value || []).length : value == null || value === '') && 'ring-[3px] ring-accent')}><i className="ri-group-line"></i></span>
                    <span className="w-full truncate text-center text-caption">{noneLabel}</span>
                </button>
            )}
            {members.map(m => (
                <button key={m.id} type="button" onClick={() => toggle(m.id)} className="press flex w-14 shrink-0 flex-col items-center gap-1">
                    <span className={cx('rounded-full', selected(m.id) && 'ring-[3px] ring-accent ring-offset-2 ring-offset-bg')}><Avatar user={m} size={48} /></span>
                    <span className="w-full truncate text-center text-caption">{m.username}</span>
                </button>
            ))}
        </div>
    );
};

/** Grouped form block inside sheets: rows separated by hairlines. */
export const FormGroup = ({ children, title, footer }) => (
    <div>
        {title && <p className="mb-1.5 px-4 text-footnote font-semibold uppercase tracking-wide text-label2">{title}</p>}
        <div className="divide-y divide-sep/60 overflow-hidden rounded-cell bg-card">{children}</div>
        {footer && <p className="mt-1.5 px-4 text-footnote text-label2">{footer}</p>}
    </div>
);

/** Borderless input row for FormGroup. */
export const InputRow = React.forwardRef(({ label, as = 'input', className, children, ...props }, ref) => {
    const Tag = as;
    return (
        <label className={cx('flex min-h-[46px] items-center gap-3 px-4', as === 'textarea' && 'items-start py-3', className)}>
            {label && <span className={cx('w-28 shrink-0 text-body', as === 'textarea' && 'pt-0.5')}>{label}</span>}
            <Tag ref={ref} {...props} className={cx('min-w-0 flex-1 bg-transparent py-3 text-body text-label outline-none placeholder:text-label3', label && as !== 'textarea' && 'text-right', as === 'textarea' && 'min-h-[80px] resize-none py-0', as === 'select' && 'appearance-none text-accent')}>
                {children}
            </Tag>
        </label>
    );
});
InputRow.displayName = 'InputRow';

export const ToggleRow = ({ label, checked, onChange, icon, color, subtitle }) => (
    <div className="flex min-h-[46px] items-center gap-3 px-4 py-1.5">
        {icon && <IconTile icon={icon} color={color} />}
        <div className="min-w-0 flex-1">
            <div className="text-body">{label}</div>
            {subtitle && <div className="text-footnote text-label2">{subtitle}</div>}
        </div>
        <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
);

/** Swipe-free "more" menu: an action sheet. */
export const ActionSheet = ({ open, onClose, title, actions }) => {
    if (!open) return null;
    return createPortal(
        <div className="fixed inset-0 z-[250] flex items-end justify-center p-2 md:items-center" role="dialog" aria-modal="true">
            <button type="button" aria-label="Schließen" onClick={onClose} className="anim-fade absolute inset-0 bg-black/40" />
            <div className="anim-sheet relative w-full max-w-md space-y-2 pb-[env(safe-area-inset-bottom)]">
                <div className="glass overflow-hidden rounded-[14px]">
                    {title && <p className="border-b hairline px-4 py-3 text-center text-footnote text-label2">{title}</p>}
                    {actions.filter(Boolean).map((a, i) => (
                        <button key={i} type="button" onClick={() => { onClose(); a.onClick(); }}
                            className={cx('press flex w-full items-center justify-center gap-2 border-b hairline py-[15px] text-[19px] last:border-b-0', a.destructive ? 'text-danger' : 'text-accent')}>
                            {a.icon && <i className={a.icon}></i>}{a.label}
                        </button>
                    ))}
                </div>
                <button type="button" onClick={onClose} className="press glass w-full rounded-[14px] py-[15px] text-[19px] font-semibold text-accent">Abbrechen</button>
            </div>
        </div>,
        document.body,
    );
};

/** Simple circular check button (shopping, chores, todos). */
export const Check = ({ checked, onChange, color = 'rgb(var(--tint))', label = 'Erledigt' }) => (
    <button type="button" role="checkbox" aria-checked={!!checked} aria-label={label} onClick={(e) => { e.stopPropagation(); e.preventDefault(); onChange(!checked); }}
        className="press flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border-2 transition-colors"
        style={checked ? { backgroundColor: color, borderColor: color } : { borderColor: 'rgb(var(--label3))' }}>
        {checked && <i className="ri-check-line text-[16px] font-bold text-white"></i>}
    </button>
);

/** Run an async action with toast feedback. */
export const useAction = () => {
    const { toast } = useFeedback();
    return React.useCallback(async (fn, success) => {
        try {
            const r = await fn();
            if (success) toast(success);
            return r ?? true;
        } catch (err) {
            toast(err?.response?.data?.error || err?.message || 'Etwas ist schiefgelaufen.', 'error');
            return false;
        }
    }, [toast]);
};
