import React from 'react';
import api from '../services/api';
import { useTranslation } from '../i18n.jsx';

const Contracts = ({ user }) => {
    const { t } = useTranslation();
    const [contracts, setContracts] = React.useState([]);
    const [categories, setCategories] = React.useState([]);
    const [familyMembers, setFamilyMembers] = React.useState([]);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = React.useState(false);
    const [newCategoryName, setNewCategoryName] = React.useState('');
    const [newCategoryType, setNewCategoryType] = React.useState('0');

    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [editingContract, setEditingContract] = React.useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = React.useState(null);
    const [formData, setFormData] = React.useState({
        provider: '', type: '', start_date: '', end_date: '',
        notice_period_months: '', cost: '', billing_interval: 1, billing_day: '', billing_start_month: null,
        is_shared: 0, is_predicted: 0, notes: '', split_shares: []
    });
    const [filter, setFilter] = React.useState('all');

    const currentUser = user || {};

    const fetchData = async () => {
        try {
            const [contractsRes, categoriesRes, membersRes] = await Promise.all([
                api.get('/contracts'),
                api.get('/contracts/categories'),
                api.get('/contracts/family-members')
            ]);
            setContracts(contractsRes.data);
            setCategories(categoriesRes.data);
            setFamilyMembers(membersRes.data);
        } catch (err) {
            console.error('Error fetching contracts data:', err);
        }
    };

    React.useEffect(() => { fetchData(); }, []);

    const handleOpenModal = (contract = null) => {
        if (contract) {
            setEditingContract(contract);
            setFormData({
                provider: contract.provider,
                type: contract.type,
                start_date: contract.start_date || '',
                end_date: contract.end_date || '',
                notice_period_months: contract.notice_period_months !== null ? contract.notice_period_months : '',
                cost: contract.cost !== null ? contract.cost : '',
                billing_interval: contract.billing_interval || 1,
                billing_day: contract.billing_day || '',
                billing_start_month: contract.billing_start_month || null,
                is_shared: contract.is_shared || 0,
                is_predicted: contract.is_predicted || 0,
                notes: contract.notes || '',
                split_shares: contract.split_shares || []
            });
        } else {
            setEditingContract(null);
            setFormData({
                provider: '', type: '', start_date: '', end_date: '',
                notice_period_months: '', cost: '', billing_interval: 1, billing_day: '', billing_start_month: null,
                is_shared: 0, is_predicted: 0, notes: '', split_shares: []
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        // Validate: if split_shares defined, sum must not exceed cost
        if (formData.split_shares && formData.split_shares.length > 0) {
            const totalSplit = formData.split_shares.reduce((s, sh) => s + (Number(sh.amount) || 0), 0);
            if (totalSplit > Number(formData.cost)) {
                alert(t('contracts_split_exceeds'));
                return;
            }
        }
        try {
            const payload = { ...formData };
            // Clean split_shares: remove empty ones
            payload.split_shares = (formData.split_shares || []).filter(s => s.amount > 0);
            if (editingContract) {
                await api.put(`/contracts/${editingContract.id}`, payload);
            } else {
                await api.post('/contracts', payload);
            }
            setIsModalOpen(false);
            fetchData();
        } catch (err) {
            console.error('Error saving contract:', err);
        }
    };

    const handleDelete = async (id) => {
        try {
            await api.delete(`/contracts/${id}`);
            setDeleteConfirmId(null);
            fetchData();
        } catch (err) { console.error('Error deleting contract:', err); }
    };

    const handleAddCategory = async (e) => {
        e.preventDefault();
        if (!newCategoryName.trim()) return;
        try {
            await api.post('/contracts/categories', { name: newCategoryName, is_predicted: parseInt(newCategoryType) });
            setNewCategoryName('');
            fetchData();
        } catch(e) { console.error('Error adding category:', e); }
    };

    const handleDeleteCategory = async (id) => {
        if (!confirm(t('contracts_confirm_delete_category'))) return;
        try {
            await api.delete(`/contracts/categories/${id}`);
            fetchData();
        } catch(e) { console.error('Error deleting category:', e); }
    };

    // Update split share for a specific member
    const handleSplitAmountChange = (userId, amount) => {
        const existing = formData.split_shares || [];
        const idx = existing.findIndex(s => s.user_id === userId);
        let updated;
        if (idx >= 0) {
            updated = existing.map(s => s.user_id === userId ? { ...s, amount: parseFloat(amount) || 0 } : s);
        } else {
            updated = [...existing, { user_id: userId, amount: parseFloat(amount) || 0 }];
        }
        setFormData({ ...formData, split_shares: updated });
    };

    const getSplitAmount = (userId) => {
        const share = (formData.split_shares || []).find(s => s.user_id === userId);
        return share ? share.amount : '';
    };

    const totalSplitAmount = (formData.split_shares || []).reduce((s, sh) => s + (Number(sh.amount) || 0), 0);
    const remainingAmount = Math.max(0, Number(formData.cost || 0) - totalSplitAmount);
    const splitExceeds = totalSplitAmount > Number(formData.cost || 0);

    const getStatusColor = (endDateStr, noticePeriodMonths) => {
        if (!endDateStr) return 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400';
        const endDate = new Date(endDateStr);
        const today = new Date();
        const noticeDate = new Date(endDate);
        noticeDate.setMonth(noticeDate.getMonth() - noticePeriodMonths);
        const diffNoticeDays = Math.ceil((noticeDate - today) / (1000 * 60 * 60 * 24));
        const diffEndDays = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
        if (diffEndDays < 0) return 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-black/[0.06] dark:border-white/10';
        if (diffNoticeDays < 0) return 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30';
        if (diffNoticeDays <= 30) return 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30';
        return 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30';
    };

    const getStatusText = (endDateStr, noticePeriodMonths) => {
        if (!endDateStr) return 'Laufend';
        const endDate = new Date(endDateStr);
        const today = new Date();
        const noticeDate = new Date(endDate);
        noticeDate.setMonth(noticeDate.getMonth() - noticePeriodMonths);
        const diffNoticeDays = Math.ceil((noticeDate - today) / (1000 * 60 * 60 * 24));
        const diffEndDays = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
        if (diffEndDays < 0) return t('contracts_status_expired');
        if (diffNoticeDays < 0) return t('contracts_status_notice_passed');
        if (diffNoticeDays <= 30) return `Kündigung in ${diffNoticeDays} Tagen`;
        return `Aktiv bis ${endDate.toLocaleDateString('de-DE')}`;
    };

    // Helper: get the share amount for the logged-in user in a contract
    const getMyShare = (contract) => {
        if (!contract.split_shares || contract.split_shares.length === 0) return null;
        const share = contract.split_shares.find(s => Number(s.user_id) === Number(currentUser.id));
        return share ? share.amount : null;
    };

    // Helper: billing interval label
    const getBillingIntervalLabel = (months) => {
        if (months === 1) return 'Monatlich';
        if (months === 3) return 'Vierteljährlich';
        if (months === 6) return 'Halbjährlich';
        if (months === 12) return 'Jährlich';
        return `Alle ${months} Monate`;
    };

    // Helper: compute all deduction months from start month + interval
    const MONTHS_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    const MONTHS_FULL = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

    const getBillingMonths = (startMonth, interval) => {
        if (!startMonth || interval <= 1) return [];
        const months = [];
        let current = startMonth - 1;
        const paymentsPerYear = 12 / interval;
        for (let i = 0; i < paymentsPerYear; i++) {
            months.push(current);
            current = (current + interval) % 12;
        }
        return months.sort((a,b) => a - b);
    };

    const contractTypes = ['Internet', 'Mobilfunk', 'Versicherung', 'Streaming', 'Strom/Gas', 'Fitnessstudio', 'Ausgabe', 'Sonstiges'];
    const predictedTypes = ['Einkauf', 'Vergnügen', 'Haushalt', 'Auto', 'Kleidung', 'Geschenke', 'Sonstiges'];

    const filteredContracts = contracts.filter(c => {
        if (filter === 'shared') return c.is_shared;
        if (filter === 'mine') {
            // Own non-shared contracts
            if (!c.is_shared && Number(c.user_id) === Number(currentUser.id)) return true;
            // Shared contracts where the user has a personal split share
            if (c.is_shared && c.split_shares && c.split_shares.some(s => Number(s.user_id) === Number(currentUser.id))) return true;
            return false;
        }
        return true;
    });

    // For totalMonthlyCost in 'mine' view, use the user's share for split contracts
    const totalMonthlyCost = filteredContracts.reduce((sum, c) => {
        if (filter === 'mine' && c.is_shared && c.split_shares) {
            const myShare = c.split_shares.find(s => Number(s.user_id) === Number(currentUser.id));
            return sum + ((Number(myShare?.amount) || 0) / (Number(c.billing_interval) || 1));
        }
        return sum + ((Number(c.cost) || 0) / (Number(c.billing_interval) || 1));
    }, 0);

    // Calculate burden per person – split_shares take priority over generic "Gemeinsam"
    const burdenPerPerson = contracts.reduce((acc, c) => {
        const monthlyCost = (Number(c.cost) || 0) / (Number(c.billing_interval) || 1);
        if (c.is_shared && c.split_shares && c.split_shares.length > 0) {
            // Assign split costs directly to persons
            c.split_shares.forEach(share => {
                const member = familyMembers.find(m => m.id === share.user_id);
                const name = member ? member.name : `User ${share.user_id}`;
                const shareMonthly = (Number(share.amount) || 0) / (Number(c.billing_interval) || 1);
                acc[name] = (acc[name] || 0) + shareMonthly;
            });
        } else if (c.is_shared) {
            acc['Gemeinsam'] = (acc['Gemeinsam'] || 0) + monthlyCost;
        } else {
            const name = c.user_name || t('unknown');
            acc[name] = (acc[name] || 0) + monthlyCost;
        }
        return acc;
    }, {});

    const maxBurden = Math.max(...Object.values(burdenPerPerson), 1);

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
                        <i className="ri-file-paper-2-line text-brand-dark"></i>
                        {t('contracts_title')}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">{t('contracts_subtitle')}</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsCategoryModalOpen(true)}
                        className="bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-black/[0.06] dark:border-slate-800 px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-lg font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shrink-0"
                        title={t('contracts_categories_manage')}
                    >
                        <i className="ri-list-settings-line text-xl"></i>
                        <span className="hidden sm:inline">{t('contracts_categories_manage')}</span>
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex-1 bg-brand-dark text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-lg font-black shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                    >
                        <i className="ri-add-line text-xl"></i>
                        {t('new')}
                    </button>
                </div>
            </header>

            {/* Summary & Filter Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0">
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-[1.25rem] border border-slate-50 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-8 items-center transition-colors duration-500">
                    <div className="flex-1 w-full">
                        <div className="flex justify-between items-end mb-4">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('contracts_monthly_burden')}</span>
                            <span className="text-2xl font-black text-brand-dark">{totalMonthlyCost.toFixed(2)} €</span>
                        </div>
                        <div className="flex gap-3 items-end h-16">
                            {Object.entries(burdenPerPerson).map(([name, amount]) => (
                                <div key={name} className="flex-1 flex flex-col items-center group relative">
                                    <div
                                        className={`w-full rounded-t-lg transition-all duration-500 ${name === 'Gemeinsam' ? 'bg-brand-light' : 'bg-brand-dark/20 group-hover:bg-brand-dark/40'}`}
                                        style={{ height: `${(amount / maxBurden) * 100}%`, minHeight: '4px' }}
                                    ></div>
                                </div>
                            ))}
                        </div>
                        {/* Labels and amounts below bars */}
                        <div className="flex gap-3 mt-2">
                            {Object.entries(burdenPerPerson).map(([name, amount]) => (
                                <div key={name} className="flex-1 flex flex-col items-center">
                                    <div className="text-[9px] font-black uppercase tracking-tighter text-slate-400 dark:text-slate-500 truncate w-full text-center">{name}</div>
                                    <div className="text-[11px] font-black text-brand-dark dark:text-brand-light mt-0.5">{amount.toFixed(2)} €</div>
                                    <div className="text-[8px] text-slate-400 dark:text-slate-500 font-medium">/Mo.</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-black/[0.06] dark:border-white/10">
                        <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filter === 'all' ? 'bg-white dark:bg-slate-700 text-brand-dark dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>{t('contracts_filter_all')}</button>
                        <button onClick={() => setFilter('mine')} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filter === 'mine' ? 'bg-white dark:bg-slate-700 text-brand-dark dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>{t('contracts_filter_mine')}</button>
                        <button onClick={() => setFilter('shared')} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filter === 'shared' ? 'bg-white dark:bg-slate-700 text-brand-dark dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>{t('contracts_filter_shared')}</button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 overflow-y-auto pb-8 custom-scrollbar">
                {filteredContracts.length === 0 ? (
                    <div className="col-span-full py-20 text-center opacity-40 dark:text-slate-400">
                        <i className="ri-file-paper-2-line text-6xl mb-4 block"></i>
                        <p className="font-bold">{t('contracts_no_contracts')}</p>
                    </div>
                ) : (
                    filteredContracts.map(contract => {
                        const myShare = getMyShare(contract);
                        const hasSplit = contract.split_shares && contract.split_shares.length > 0;
                        return (
                            <div key={contract.id} className={`bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-lg sm:rounded-[1.25rem] border transition-all flex flex-col h-full hover:shadow-md ${contract.is_predicted ? 'border-dashed border-slate-200 dark:border-slate-800' : 'border-slate-50 dark:border-slate-800 shadow-sm'} transition-colors duration-500`}>
                                <div className="flex justify-between items-start mb-3 sm:mb-4">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-1">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-brand-light dark:text-brand-light/80">{contract.type}</div>
                                            {contract.is_shared ? (
                                                <div className="flex items-center gap-1 bg-brand-light/10 dark:bg-brand-light/20 px-2 py-0.5 rounded-full">
                                                    <i className="ri-group-line text-[9px] text-brand-dark dark:text-brand-light"></i>
                                                    <span className="text-[9px] font-bold text-brand-dark dark:text-brand-light uppercase tracking-wide">{t('contracts_filter_shared')}</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                                                    <div className="w-3 h-3 bg-brand-light/20 dark:bg-brand-light/30 rounded-full flex items-center justify-center text-[7px] font-bold text-brand-dark dark:text-brand-light">
                                                        {contract.user_name?.charAt(0) || '?'}
                                                    </div>
                                                    <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400">{contract.user_name}</span>
                                                </div>
                                            )}
                                            {contract.is_predicted === 1 && (
                                                <div className="bg-amber-100 dark:bg-amber-500/20 px-2 py-0.5 rounded-full text-[9px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">{t('contracts_planned')}</div>
                                            )}
                                        </div>
                                        <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 leading-tight">{contract.provider}</h3>
                                    </div>
                                    <div className="text-right flex flex-col items-end shrink-0 ml-2">
                                        <div className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-800/50 px-2 sm:px-3 py-1 rounded-xl transition-colors">
                                            {contract.cost > 0 ? `${Number(contract.cost).toFixed(2)} €` : '-'}
                                        </div>
                                        {contract.billing_interval > 1 && (
                                            <div className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider">
                                                {getBillingIntervalLabel(contract.billing_interval)}
                                            </div>
                                        )}
                                        {/* Show user's personal share when in 'Meine' view and contract is shared */}
                                        {filter === 'mine' && contract.is_shared && myShare !== null && (
                                            <div className="mt-1 text-[9px] font-black text-brand-dark dark:text-brand-light bg-brand-light/10 dark:bg-brand-light/20 px-2 py-0.5 rounded-lg">
                                                Dein Anteil: {Number(myShare).toFixed(2)} €
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Split shares display */}
                                {hasSplit && (
                                    <div className="mb-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-white/10">
                                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 flex items-center gap-1">
                                            <i className="ri-scales-3-line"></i>
                                            {t('contracts_split_costs')}
                                        </div>
                                        <div className="space-y-1.5">
                                            {contract.split_shares.map(share => {
                                                const member = familyMembers.find(m => m.id === share.user_id);
                                                const name = member ? member.name : `User ${share.user_id}`;
                                                const isMe = share.user_id === currentUser.id;
                                                return (
                                                    <div key={share.user_id} className={`flex items-center justify-between rounded-lg px-2 py-1 ${isMe ? 'bg-brand-light/10 dark:bg-brand-light/20 ring-1 ring-brand-light/30' : ''}`}>
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-5 h-5 bg-brand-light/20 dark:bg-brand-light/30 rounded-full flex items-center justify-center text-[8px] font-black text-brand-dark dark:text-brand-light">{name.charAt(0)}</div>
                                                            <span className={`text-[11px] font-bold ${isMe ? 'text-brand-dark dark:text-brand-light' : 'text-slate-500 dark:text-slate-400'}`}>
                                                                {isMe ? `${name} (${t('contracts_split_your_share')})` : name}
                                                            </span>
                                                        </div>
                                                        <span className={`text-[12px] font-black ${isMe ? 'text-brand-dark dark:text-brand-light' : 'text-slate-600 dark:text-slate-300'}`}>
                                                            {Number(share.amount).toFixed(2)} €
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {/* My highlighted share summary if I'm in the split */}
                                        {myShare !== null && (
                                            <div className="mt-2 pt-2 border-t border-brand-light/20 dark:border-brand-light/10 text-right">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-brand-dark dark:text-brand-light">
                                                    {t('contracts_split_your_share')}: {Number(myShare).toFixed(2)} €
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex-1 flex flex-col justify-end gap-3 sm:gap-4">
                                    <div className={`px-3 py-2 sm:px-4 sm:py-3 rounded-xl sm:rounded-lg text-[10px] sm:text-xs font-bold flex items-center gap-2 ${getStatusColor(contract.end_date, contract.notice_period_months)}`}>
                                        <i className="ri-time-line"></i>
                                        <span className="truncate">{getStatusText(contract.end_date, contract.notice_period_months)}</span>
                                    </div>
                                    {contract.notes && (
                                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-500 italic line-clamp-2">{contract.notes}</p>
                                    )}
                                    {(contract.billing_day || (contract.billing_interval > 1 && contract.billing_start_month)) && (
                                        <div className="flex flex-col gap-0.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-white/10/50">
                                            {contract.billing_day && (
                                                <div className="flex items-center gap-1.5">
                                                    <i className="ri-calendar-schedule-line text-brand-dark dark:text-brand-light"></i>
                                                    <span>Wird am {contract.billing_day}. abgebucht</span>
                                                </div>
                                            )}
                                            {contract.billing_interval > 1 && contract.billing_start_month && (
                                                <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-slate-200 dark:border-white/10">
                                                    <i className="ri-calendar-event-line text-brand-dark dark:text-brand-light"></i>
                                                    <span>Monate: {getBillingMonths(contract.billing_start_month, contract.billing_interval).map(idx => MONTHS_DE[idx]).join(', ')}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {deleteConfirmId === contract.id ? (
                                        <div className="flex gap-2 pt-3 sm:pt-4 border-t border-red-100 dark:border-red-900/30 mt-1 sm:mt-2">
                                            <span className="flex-1 text-xs font-bold text-red-600 dark:text-red-400 flex items-center">{t('contracts_confirm_delete_contract')}</span>
                                            <button onClick={() => handleDelete(contract.id)} className="px-3 py-2 rounded-xl text-xs font-black bg-red-500 hover:bg-red-600 text-white transition-colors">{t('delete')}</button>
                                            <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-2 rounded-xl text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">{t('cancel')}</button>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2 pt-3 sm:pt-4 border-t border-slate-100 dark:border-slate-800 mt-1 sm:mt-2">
                                            <button onClick={() => handleOpenModal(contract)} className="flex-1 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 py-2 sm:py-3 rounded-xl text-sm font-bold hover:bg-brand-light/10 dark:hover:bg-brand-light/20 hover:text-brand-dark dark:hover:text-brand-light transition-colors">{t('edit')}</button>
                                            <button onClick={() => setDeleteConfirmId(contract.id)} className="w-10 sm:w-12 flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 py-2 sm:py-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-colors"><i className="ri-delete-bin-line"></i></button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Contract Form Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-[1.25rem] shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-200 border dark:border-slate-800 transition-colors duration-500">
                        <div className="sticky top-0 p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white/90 dark:bg-slate-900/90 backdrop-blur-md z-10">
                            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">{editingContract ? t('contracts_edit') : t('contracts_new')}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                <i className="ri-close-line text-2xl"></i>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-8">
                            {/* Type Selector */}
                            <div className="flex gap-4 p-1 bg-slate-100 dark:bg-slate-800 rounded-[0.75rem] border border-black/[0.06] dark:border-white/10">
                                <button type="button" onClick={() => setFormData({ ...formData, is_shared: 0, is_predicted: 0, split_shares: [] })} className={`flex-1 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${!formData.is_shared && !formData.is_predicted ? 'bg-white dark:bg-slate-700 text-brand-dark dark:text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>Eigene</button>
                                <button type="button" onClick={() => setFormData({ ...formData, is_shared: 1, is_predicted: 0 })} className={`flex-1 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${formData.is_shared ? 'bg-white dark:bg-slate-700 text-brand-dark dark:text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>Gemeinsam</button>
                                <button type="button" onClick={() => setFormData({ ...formData, is_shared: 0, is_predicted: 1, split_shares: [] })} className={`flex-1 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${formData.is_predicted ? 'bg-white dark:bg-slate-700 text-brand-dark dark:text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>Planung</button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{formData.is_predicted ? t('contracts_field_title_planned') : t('contracts_field_provider')}</label>
                                    <input type="text" required value={formData.provider} onChange={e => setFormData({ ...formData, provider: e.target.value })} className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg focus:ring-4 focus:ring-brand-light/10 outline-none font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600" placeholder={formData.is_predicted ? 'z.B. Wöchentlicher Einkauf' : 'z.B. Telekom'} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('contracts_field_category')} *</label>
                                    <select required value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg focus:ring-4 focus:ring-brand-light/10 outline-none font-bold text-slate-800 dark:text-slate-100 appearance-none">
                                        <option value="">Auswählen...</option>
                                        {formData.is_predicted ? (
                                            <>
                                                {predictedTypes.map(tp => <option key={tp} value={tp}>{tp}</option>)}
                                                {categories.filter(c => c.is_predicted === 1).length > 0 && <option disabled>──────────</option>}
                                                {categories.filter(c => c.is_predicted === 1).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                            </>
                                        ) : (
                                            <>
                                                {contractTypes.map(tp => <option key={tp} value={tp}>{tp}</option>)}
                                                {categories.filter(c => c.is_predicted === 0).length > 0 && <option disabled>──────────</option>}
                                                {categories.filter(c => c.is_predicted === 0).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                            </>
                                        )}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('contracts_field_cost')}</label>
                                    <input type="number" step="0.01" min="0" value={formData.cost} onChange={e => setFormData({ ...formData, cost: e.target.value })} className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg focus:ring-4 focus:ring-brand-light/20 outline-none font-bold text-slate-800 dark:text-slate-100" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('contracts_field_interval')}</label>
                                    <select value={formData.billing_interval} onChange={e => setFormData({ ...formData, billing_interval: parseInt(e.target.value) || 1 })} className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg focus:ring-4 focus:ring-brand-light/20 outline-none font-bold text-slate-800 dark:text-slate-100 appearance-none">
                                        <option value="1">{t('contracts_field_interval_monthly')}</option>
                                        <option value="3">{t('contracts_field_interval_quarterly')}</option>
                                        <option value="6">{t('contracts_field_interval_half_yearly')}</option>
                                        <option value="12">{t('contracts_field_interval_yearly')}</option>
                                    </select>
                                </div>
                            </div>

                            {/* Billing Day */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Abbuchungstag (1–31)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm pointer-events-none">Am</span>
                                        <input
                                            type="number" min="1" max="31"
                                            value={formData.billing_day}
                                            onChange={e => setFormData({ ...formData, billing_day: e.target.value })}
                                            placeholder="—"
                                            className="w-full pl-12 pr-16 py-4 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg focus:ring-4 focus:ring-brand-light/20 outline-none font-bold text-slate-800 dark:text-slate-100"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm pointer-events-none">des Monats</span>
                                    </div>
                                </div>
                                {formData.billing_interval > 1 && (
                                    <div className="sm:col-span-2 space-y-2 mt-2">
                                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Abbuchungs-Monate (Einen startmonat auswählen)</label>
                                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                                            {MONTHS_DE.map((month, index) => {
                                                const activeMonths = formData.billing_start_month ? getBillingMonths(formData.billing_start_month, formData.billing_interval) : [];
                                                const isActive = activeMonths.includes(index);
                                                const isStart = formData.billing_start_month === index + 1;
                                                return (
                                                    <button
                                                        key={index}
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, billing_start_month: index + 1 })}
                                                        className={`py-2 sm:py-3 rounded-lg text-[11px] sm:text-xs font-bold transition-all border border-transparent ${isStart ? 'bg-brand-dark dark:bg-brand-light text-white dark:text-slate-900 shadow-md ring-2 ring-brand-dark/20' : isActive ? 'bg-brand-light/10 text-brand-dark dark:bg-brand-light/20 dark:text-brand-light border-brand-light/30' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700'}`}
                                                    >
                                                        {month}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ---- SPLIT SHARES SECTION (only for Gemeinsam) ---- */}
                            {formData.is_shared === 1 && familyMembers.length > 0 && (
                                <div className="bg-brand-light/5 dark:bg-brand-light/10 rounded-[1rem] border border-brand-light/20 dark:border-brand-light/10 p-5 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <i className="ri-scales-3-line text-brand-dark dark:text-brand-light"></i>
                                            <span className="text-sm font-black text-brand-dark dark:text-brand-light">{t('contracts_split_costs')}</span>
                                        </div>
                                        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${splitExceeds ? 'bg-red-100 text-red-600' : remainingAmount > 0 ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400' : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'}`}>
                                            {splitExceeds ? t('contracts_split_exceeds') : `${t('contracts_split_remaining')}: ${remainingAmount.toFixed(2)} €`}
                                        </span>
                                    </div>
                                    <div className="space-y-3">
                                        {familyMembers.map(member => (
                                            <div key={member.id} className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-brand-light/20 dark:bg-brand-light/30 rounded-full flex items-center justify-center text-sm font-black text-brand-dark dark:text-brand-light shrink-0">
                                                    {member.name.charAt(0)}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="text-xs font-black text-slate-600 dark:text-slate-300">{member.name}</div>
                                                    {member.display_role && <div className="text-[10px] text-slate-400">{member.display_role}</div>}
                                                </div>
                                                <div className="relative w-32">
                                                    <input
                                                        type="number" step="0.01" min="0"
                                                        placeholder="0,00"
                                                        value={getSplitAmount(member.id)}
                                                        onChange={e => handleSplitAmountChange(member.id, e.target.value)}
                                                        className={`w-full px-3 py-2 text-right bg-white dark:bg-slate-800 border rounded-lg outline-none font-bold text-sm text-slate-800 dark:text-slate-100 ${splitExceeds ? 'border-red-300 dark:border-red-700' : 'border-black/[0.06] dark:border-white/10'} focus:ring-2 focus:ring-brand-light/30`}
                                                    />
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none">€</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {/* Total bar */}
                                    {Number(formData.cost) > 0 && (
                                        <div className="mt-2">
                                            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-300 ${splitExceeds ? 'bg-red-500' : 'bg-emerald-500'}`}
                                                    style={{ width: `${Math.min(100, (totalSplitAmount / Number(formData.cost)) * 100)}%` }}
                                                ></div>
                                            </div>
                                            <div className="flex justify-between mt-1 text-[10px] font-bold text-slate-400">
                                                <span>{t('contracts_split_total_check')}: {totalSplitAmount.toFixed(2)} €</span>
                                                <span>{Number(formData.cost).toFixed(2)} €</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('contracts_field_notice')}</label>
                                    <input type="number" min="0" max="24" value={formData.notice_period_months} onChange={e => setFormData({ ...formData, notice_period_months: e.target.value })} className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg focus:ring-4 focus:ring-brand-light/20 outline-none font-bold text-slate-800 dark:text-slate-100" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('contracts_field_start')}</label>
                                    <input type="date" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg focus:ring-4 focus:ring-brand-light/20 outline-none font-bold text-slate-800 dark:text-slate-100" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('contracts_field_end')}</label>
                                    <input type="date" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg focus:ring-4 focus:ring-brand-light/20 outline-none font-bold text-slate-800 dark:text-slate-100" />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('contracts_field_notes')}</label>
                                <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows="2" className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg focus:ring-4 focus:ring-brand-light/10 outline-none font-bold resize-none text-slate-800 dark:text-slate-100" />
                            </div>
                            <button type="submit" disabled={splitExceeds} className="w-full py-5 bg-brand-dark text-white rounded-[1rem] font-black shadow-xl hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                {editingContract ? t('contracts_save_changes') : t('contracts_create_btn')}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Category Management Modal */}
            {isCategoryModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-[1.25rem] shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] border dark:border-slate-800 transition-colors duration-500">
                        <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">{t('contracts_categories_title')}</h2>
                            <button onClick={() => setIsCategoryModalOpen(false)} className="w-10 h-10 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                <i className="ri-close-line text-2xl"></i>
                            </button>
                        </div>
                        <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar">
                            <div className="space-y-4 mb-8">
                                {categories.length === 0 ? (
                                    <p className="text-center text-slate-400 dark:text-slate-500 font-medium py-4">{t('contracts_category_no_categories')}</p>
                                ) : (
                                    categories.map(cat => (
                                        <div key={cat.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 px-4 py-3 rounded-xl border border-black/[0.06] dark:border-white/10">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-800 dark:text-slate-100">{cat.name}</span>
                                                <span className="text-[10px] font-black uppercase text-brand-light tracking-widest">{cat.is_predicted ? 'Ausgaben-Planung' : 'Vertrag / Abo'}</span>
                                            </div>
                                            <button onClick={() => handleDeleteCategory(cat.id)} className="w-8 h-8 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
                                                <i className="ri-delete-bin-line"></i>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                            <form onSubmit={handleAddCategory} className="bg-brand-light/5 dark:bg-brand-light/10 p-4 sm:p-5 rounded-lg border border-brand-light/20 dark:border-brand-light/10">
                                <h3 className="text-sm font-black text-brand-dark dark:text-brand-light mb-4 text-center">{t('contracts_category_add_title')}</h3>
                                <div className="space-y-3">
                                    <input type="text" required placeholder={t('contracts_category_name_placeholder')} value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-light outline-none font-bold text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600" />
                                    <select value={newCategoryType} onChange={e => setNewCategoryType(e.target.value)} className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-light outline-none font-bold text-sm text-slate-800 dark:text-slate-100 appearance-none">
                                        <option value="0">{t('contracts_category_type_standard')}</option>
                                        <option value="1">{t('contracts_category_type_planning')}</option>
                                    </select>
                                    <button type="submit" className="w-full py-3 bg-brand-dark text-white rounded-xl font-black shadow-md hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
                                        <i className="ri-add-line"></i> {t('contracts_category_add_btn')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Contracts;
