import React from 'react';
import api from '../services/api';
import { useTranslation } from '../i18n.jsx';
import { applyOffset } from '../utils/time';

const PocketMoney = ({ user }) => {
    const { t } = useTranslation();
    const isAdmin = user?.role === 'admin';
    const [children, setChildren] = React.useState([]);
    const [selectedChild, setSelectedChild] = React.useState(null);
    const [accountData, setAccountData] = React.useState(null);
    const [isLoading, setIsLoading] = React.useState(true);

    // Transaction Form State
    const [amount, setAmount] = React.useState('');
    const [type, setType] = React.useState('deposit');
    const [reason, setReason] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    React.useEffect(() => {
        if (isAdmin) {
            fetchChildren();
        } else {
            // If child, just load their own account
            loadAccount(user.id);
        }
    }, [user]);

    const fetchChildren = async () => {
        try {
            setIsLoading(true);
            // Fetch all users in family
            const res = await api.get('/auth/family/members');
            // Filter out admins to get 'children'
            const kids = res.data.filter(u => u.role !== 'admin' && u.id !== user.id);
            setChildren(kids);
            if (kids.length > 0) {
                loadAccount(kids[0].id);
                setSelectedChild(kids[0]);
            } else {
                setIsLoading(false);
            }
        } catch (e) {
            console.error('Error fetching children', e);
            setIsLoading(false);
        }
    };

    const loadAccount = async (userId) => {
        try {
            setIsLoading(true);
            const res = await api.get(`/pocket-money/${userId}`);
            setAccountData(res.data);
        } catch (e) {
            console.error('Error loading account', e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTransaction = async (e) => {
        e.preventDefault();
        if (!amount || isNaN(amount) || amount <= 0) return alert(t('pocket_money_error_amount'));

        setIsSubmitting(true);
        try {
            const targetId = isAdmin ? selectedChild.id : user.id; // actually only admin can submit
            await api.post(`/pocket-money/${targetId}/transaction`, {
                amount: parseFloat(amount),
                type,
                reason
            });
            // Reset form and reload
            setAmount('');
            setReason('');
            loadAccount(targetId);
        } catch (e) {
            console.error('Transaction error', e);
            alert(t('pocket_money_error_transaction'));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading && !accountData) {
        return <div className="p-8 flex justify-center"><i className="ri-loader-4-line animate-spin text-4xl text-[#00ADEF]"></i></div>;
    }

    if (isAdmin && children.length === 0) {
        return (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-[1.25rem] shadow-sm max-w-2xl mx-auto mt-8 border border-black/[0.06] dark:border-slate-800">
                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="ri-user-smile-line text-4xl"></i>
                </div>
                <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">{t('pocket_money_no_children')}</h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium">{t('pocket_money_no_children_desc')}</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto flex flex-col gap-6 pb-8">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
                        <i className="ri-wallet-3-fill text-[#00ADEF]"></i>
                        {t('pocket_money_title')}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">{t('pocket_money_subtitle')}</p>
                </div>
                {isAdmin && children.length > 0 && (
                    <div className="flex gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-lg shadow-sm border border-black/[0.06] dark:border-slate-800 overflow-x-auto">
                        {children.map(child => (
                            <button
                                key={child.id}
                                onClick={() => {
                                    setSelectedChild(child);
                                    loadAccount(child.id);
                                }}
                                className={`px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${selectedChild?.id === child.id ? 'bg-[#2B3E6A] text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                            >
                                {child.username || child.name}
                            </button>
                        ))}
                    </div>
                )}
            </header>

            {accountData && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Balance Card */}
                    <div className="col-span-1 lg:col-span-1 flex flex-col gap-6">
                        <div className="bg-gradient-to-br from-[#2B3E6A] to-[#1e2b4a] rounded-[1.25rem] p-8 text-white shadow-xl shadow-[#2B3E6A]/20 relative overflow-hidden">
                            <div className="absolute -top-6 -right-6 text-white/5 rotate-12">
                                <i className="ri-coins-line text-9xl"></i>
                            </div>
                            <div className="relative z-10">
                                <span className="text-[10px] font-black uppercase tracking-widest text-[#00ADEF] mb-1 block">{t('pocket_money_balance')}</span>
                                <h2 className="text-5xl font-black mb-2 opacity-90 truncate">
                                    {(accountData.balance || 0).toFixed(2).replace('.', ',')} €
                                </h2>
                                <p className="text-[#00ADEF] font-bold text-sm">
                                    {t('pocket_money_owner')}: <span className="text-white">{accountData.user.name}</span>
                                </p>
                            </div>
                        </div>

                        {/* Admin Transaction Form */}
                        {isAdmin && (
                            <form onSubmit={handleTransaction} className="bg-white dark:bg-slate-900 rounded-[1.25rem] p-6 shadow-sm border border-black/[0.06] dark:border-slate-800 flex flex-col gap-4">
                                <h3 className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-[#00ADEF]/10 text-[#00ADEF] flex items-center justify-center">
                                        <i className="ri-exchange-dollar-line"></i>
                                    </div>
                                    {t('pocket_money_transaction')}
                                </h3>

                                <div className="flex gap-2 p-1 bg-slate-50 dark:bg-slate-800 rounded-xl border border-black/[0.06] dark:border-white/10">
                                    <button
                                        type="button"
                                        onClick={() => setType('deposit')}
                                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${type === 'deposit' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}`}
                                    >
                                        <i className="ri-add-line mr-1"></i> {t('pocket_money_deposit')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setType('withdrawal')}
                                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${type === 'withdrawal' ? 'bg-red-500 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}`}
                                    >
                                        <i className="ri-subtract-line mr-1"></i> {t('pocket_money_withdrawal')}
                                    </button>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 block mb-1">{t('pocket_money_amount')}</label>
                                    <input
                                        type="number" step="0.01" min="0.01" required
                                        value={amount} onChange={e => setAmount(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-xl px-4 py-3 font-medium outline-none focus:border-[#00ADEF] dark:text-slate-100"
                                        placeholder="0,00"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 block mb-1">{t('pocket_money_reason')}</label>
                                    <input
                                        type="text"
                                        value={reason} onChange={e => setReason(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#00ADEF] dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600"
                                        placeholder={t('pocket_money_reason_placeholder')}
                                    />
                                </div>

                                <button
                                    type="submit" disabled={isSubmitting}
                                    className="w-full mt-2 bg-brand-dark text-white font-black py-3.5 rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg"
                                >
                                    {isSubmitting ? <i className="ri-loader-4-line animate-spin text-xl"></i> : <><i className="ri-check-line text-xl"></i> {t('pocket_money_confirm')}</>}
                                </button>
                            </form>
                        )}
                    </div>

                    {/* Transaction History */}
                    <div className="col-span-1 lg:col-span-2 bg-white dark:bg-slate-900 rounded-[1.25rem] p-6 lg:p-8 shadow-sm border border-black/[0.06] dark:border-slate-800 flex flex-col h-full min-h-[400px]">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg">{t('pocket_money_history')}</h3>
                            <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center">
                                <i className="ri-history-line"></i>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                            {accountData.transactions.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 py-12">
                                    <i className="ri-file-list-3-line text-4xl mb-2 opacity-50"></i>
                                    <p className="font-bold">{t('pocket_money_no_transactions')}</p>
                                </div>
                            ) : (
                                accountData.transactions.map(t_item => (
                                    <div key={t_item.id} className="flex items-center justify-between p-4 rounded-lg border border-black/[0.06] dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${t_item.type === 'deposit' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500' : 'bg-red-50 dark:bg-red-900/20 text-red-500'}`}>
                                                <i className={t_item.type === 'deposit' ? "ri-arrow-right-down-line" : "ri-arrow-right-up-line"}></i>
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 dark:text-slate-100 leading-tight mb-0.5">
                                                    {t_item.reason || (t_item.type === 'deposit' ? t('pocket_money_deposit_label') : t('pocket_money_withdrawal_label'))}
                                                </p>
                                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">
                                                    {new Date(applyOffset(t_item.created_at, user)).toLocaleDateString('de-DE')} • {t('pocket_money_by')} {t_item.created_by_name}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={`font-black text-lg ${t_item.type === 'deposit' ? 'text-emerald-500' : 'text-slate-800 dark:text-slate-100'}`}>
                                            {t_item.type === 'deposit' ? '+' : '-'}{t_item.amount.toFixed(2).replace('.', ',')} €
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PocketMoney;
