import React from 'react';
import api from '../lib/api';
import { useApi } from '../lib/useApi';
import { useAuth, useMembers } from '../lib/auth';
import { euro, fmt, toDate } from '../lib/format';
import { Page, Section, Row, Segmented, Sheet, Form, FormGroup, InputRow, Button, MemberPicker, Empty, Loading, ErrorNote, useAction, cx } from '../ui';

const TxSheet = ({ open, onClose, type, child, onSaved }) => {
    const [f, setF] = React.useState({ amount: '', reason: '', type });
    const [saving, setSaving] = React.useState(false);
    const act = useAction();
    React.useEffect(() => { if (open) setF({ amount: '', reason: '', type }); }, [open, type]);
    const amount = Number(String(f.amount).replace(',', '.'));
    const valid = amount > 0;
    const save = async () => {
        if (!valid) return;
        setSaving(true);
        const ok = await act(() => api.post(`/pocket-money/${child.id}/transaction`, { ...f, amount }), f.type === 'deposit' ? `${euro(amount)} gutgeschrieben` : `${euro(amount)} ausgezahlt`);
        setSaving(false);
        if (ok) { onSaved(); onClose(); }
    };
    return (
        <Sheet open={open} onClose={onClose} title={child?.username} onSave={save} saving={saving} saveDisabled={!valid} saveLabel="Buchen">
            <Form onSubmit={save} className="space-y-6">
                <Segmented value={f.type} onChange={(t) => setF(s => ({ ...s, type: t }))} options={[{ value: 'deposit', label: 'Einzahlung' }, { value: 'withdrawal', label: 'Auszahlung' }]} />
                <div className="flex items-baseline justify-center gap-1 py-2">
                    <input autoFocus inputMode="decimal" placeholder="0,00" value={f.amount} onChange={e => setF(s => ({ ...s, amount: e.target.value.replace(/[^\d.,]/g, '') }))} aria-label="Betrag"
                        className={cx('w-48 bg-transparent text-center text-[48px] font-semibold outline-none placeholder:text-label3', f.type === 'deposit' ? 'text-ok' : 'text-danger')} />
                    <span className="text-title2 text-label2">€</span>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                    {[1, 2, 5, 10, 20].map(v => <button key={v} type="button" onClick={() => setF(s => ({ ...s, amount: String(v) }))} className="press rounded-full bg-card px-4 py-1.5 text-sub font-medium">{v} €</button>)}
                </div>
                <FormGroup>
                    <InputRow placeholder={f.type === 'deposit' ? 'Grund (z. B. Wochentaschengeld)' : 'Wofür? (z. B. Kino)'} value={f.reason} onChange={e => setF(s => ({ ...s, reason: e.target.value }))} />
                </FormGroup>
            </Form>
        </Sheet>
    );
};

export default function PocketMoney() {
    const { user, isAdmin } = useAuth();
    const { members } = useMembers();
    const kids = members.filter(m => m.role !== 'admin');
    const [childId, setChildId] = React.useState(isAdmin ? null : user.id);
    const activeId = childId || (isAdmin ? kids[0]?.id : user.id);
    const child = members.find(m => m.id === activeId) || (activeId === user.id ? user : null);
    const { data, loading, error, reload } = useApi(activeId ? `/pocket-money/${activeId}` : null, { enabled: !!activeId });
    const [tx, setTx] = React.useState(null);

    const groups = React.useMemo(() => {
        const out = [];
        for (const t of data?.transactions || []) {
            const key = fmt(t.created_at, 'MMMM yyyy');
            if (!out.length || out[out.length - 1].key !== key) out.push({ key, items: [] });
            out[out.length - 1].items.push(t);
        }
        return out;
    }, [data]);

    const monthIn = (data?.transactions || []).filter(t => t.type === 'deposit' && toDate(t.created_at).getMonth() === new Date().getMonth() && toDate(t.created_at).getFullYear() === new Date().getFullYear()).reduce((n, t) => n + t.amount, 0);
    const monthOut = (data?.transactions || []).filter(t => t.type === 'withdrawal' && toDate(t.created_at).getMonth() === new Date().getMonth() && toDate(t.created_at).getFullYear() === new Date().getFullYear()).reduce((n, t) => n + t.amount, 0);

    return (
        <Page title="Taschengeld">
            {isAdmin && (
                kids.length === 0
                    ? <Empty icon="ri-user-smile-line" title="Keine Kinder angelegt" text="Lege unter Einstellungen → Familie ein Mitglied ohne Admin-Rechte an." />
                    : <div className="mb-5"><MemberPicker members={kids} value={activeId} onChange={setChildId} /></div>
            )}
            {error && <ErrorNote error={error} onRetry={reload} />}
            {activeId && (loading && !data ? <Loading /> : data && (
                <>
                    <section className="mb-6 overflow-hidden rounded-sheet bg-gradient-to-br from-[#2B3E6A] to-[#1F2D4F] p-5 text-white shadow-pop">
                        <div className="flex items-center justify-between">
                            <span className="text-footnote font-semibold uppercase tracking-wide opacity-75">Guthaben {child?.username ? `· ${child.username}` : ''}</span>
                            <i className="ri-wallet-3-line text-2xl opacity-60"></i>
                        </div>
                        <div className="mt-2 text-[44px] font-bold leading-tight tracking-tight">{euro(data.balance)}</div>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sub">
                            <div className="rounded-cell bg-white/10 px-3 py-2"><div className="text-caption opacity-70">Diesen Monat rein</div><div className="font-semibold text-[#6EE7B7]">+{euro(monthIn)}</div></div>
                            <div className="rounded-cell bg-white/10 px-3 py-2"><div className="text-caption opacity-70">Diesen Monat raus</div><div className="font-semibold text-[#FCA5A5]">−{euro(monthOut)}</div></div>
                        </div>
                        {isAdmin && (
                            <div className="mt-4 grid grid-cols-2 gap-3">
                                <Button variant="none" className="bg-[#1AA7EC] text-white" icon="ri-add-line" onClick={() => setTx('deposit')}>Einzahlen</Button>
                                <Button variant="none" className="bg-white/15 text-white" icon="ri-subtract-line" onClick={() => setTx('withdrawal')}>Auszahlen</Button>
                            </div>
                        )}
                    </section>
                    {groups.length === 0 ? <Empty icon="ri-exchange-dollar-line" title="Noch keine Buchungen" /> : groups.map(g => (
                        <Section key={g.key} title={g.key}>
                            {g.items.map(t => (
                                <Row key={t.id}
                                    leading={<span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg', t.type === 'deposit' ? 'bg-ok/15 text-ok' : 'bg-danger/12 text-danger')}><i className={t.type === 'deposit' ? 'ri-arrow-down-line' : 'ri-arrow-up-line'}></i></span>}
                                    title={t.reason || (t.type === 'deposit' ? 'Einzahlung' : 'Auszahlung')}
                                    subtitle={`${fmt(t.created_at, 'd. MMM, HH:mm')}${t.created_by_name ? ` · ${t.created_by_name}` : ''}`}
                                    right={<span className={cx('font-semibold tabular-nums', t.type === 'deposit' ? 'text-ok' : 'text-label')}>{t.type === 'deposit' ? '+' : '−'}{euro(t.amount)}</span>} />
                            ))}
                        </Section>
                    ))}
                </>
            ))}
            {isAdmin && child && <TxSheet open={!!tx} onClose={() => setTx(null)} type={tx || 'deposit'} child={child} onSaved={reload} />}
        </Page>
    );
}
