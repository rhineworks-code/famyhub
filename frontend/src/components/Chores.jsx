import React from 'react';
import api from '../services/api';
import { useTranslation } from '../i18n.jsx';
import { applyOffset } from '../utils/time';

const Chores = ({ user }) => {
    const { t } = useTranslation();
    const isAdmin = user?.role === 'admin';
    const [chores, setChores] = React.useState([]);
    const [leaderboard, setLeaderboard] = React.useState([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [showConfetti, setShowConfetti] = React.useState(false);
    const [pointsEarned, setPointsEarned] = React.useState(0);

    // Form State
    const [showForm, setShowForm] = React.useState(false);
    const [editingChore, setEditingChore] = React.useState(null);
    const [title, setTitle] = React.useState('');
    const [points, setPoints] = React.useState(10);
    const [assignedTo, setAssignedTo] = React.useState('');
    const [recurringInterval, setRecurringInterval] = React.useState('none');
    const [history, setHistory] = React.useState([]);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    React.useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const res = await api.get('/chores');
            setChores(res.data.chores || []);
            setLeaderboard(res.data.leaderboard || []);
            setHistory(res.data.history || []);
        } catch (e) {
            console.error('Error fetching chores', e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditClick = (chore) => {
        setEditingChore(chore);
        setTitle(chore.title);
        setPoints(chore.points);
        setAssignedTo(chore.assigned_to || '');
        setRecurringInterval(chore.is_recurring ? chore.recurring_interval : 'none');
        setShowForm(true);
    };

    const handleAddChore = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;

        setIsSubmitting(true);
        try {
            const choreData = {
                title,
                points: parseInt(points, 10),
                assigned_to: assignedTo || null,
                is_recurring: recurringInterval !== 'none',
                recurring_interval: recurringInterval
            };

            if (editingChore) {
                await api.put(`/chores/${editingChore.id}`, choreData);
            } else {
                await api.post('/chores', choreData);
            }

            setTitle('');
            setPoints(10);
            setAssignedTo('');
            setRecurringInterval('none');
            setShowForm(false);
            setEditingChore(null);
            fetchData();
        } catch (e) {
            alert(t('chores_save_error') || t('save_error') || 'Fehler beim Speichern der Aufgabe');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleComplete = async (chore) => {
        if (!window.confirm(`${t('confirm_complete')} "${chore.title}"`)) return;

        try {
            const res = await api.put(`/chores/${chore.id}/complete`);
            if (res.data.points > 0) {
                setPointsEarned(res.data.points);
                setShowConfetti(true);
                setTimeout(() => setShowConfetti(false), 3000);
            }
            fetchData();
        } catch (e) {
            alert(e.response?.data?.error || t('save_error'));
        }
    };

    const handleDelete = async (choreId) => {
        if (!window.confirm(t('confirm_delete'))) return;
        try {
            await api.delete(`/chores/${choreId}`);
            fetchData();
        } catch (e) {
            alert(t('delete_error') || 'Fehler beim Löschen');
        }
    };

    // Derived states
    const activeChores = chores.filter(c => !c.completed);
    const completedChores = chores.filter(c => c.completed).slice(0, 10); // Show last 10
    const myPoints = leaderboard.find(u => u.id === user.id)?.points_balance || user.points_balance || 0;

    return (
        <div className="max-w-5xl mx-auto flex flex-col gap-8 pb-12 relative overflow-hidden">
            {/* Super simple CSS Confetti Overlay */}
            {showConfetti && (
                <div className="fixed inset-0 pointer-events-none z-50 flex flex-col items-center justify-center bg-white/40 dark:bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="animate-bounce">
                        <i className="ri-medal-2-fill text-[#FBBF24] text-[150px] drop-shadow-2xl"></i>
                    </div>
                    <h2 className="text-4xl font-black text-slate-800 dark:text-slate-100 mt-4 tracking-tight drop-shadow-md">
                        + {pointsEarned} {t('points')}!
                    </h2>
                    <p className="text-[#FBBF24] font-bold text-2xl uppercase tracking-widest mt-2 animate-pulse">Super gemacht!</p>
                </div>
            )}

            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-2">
                <div>
                    <h1 className="text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
                        <i className="ri-star-smile-fill text-amber-400"></i>
                        {t('chores_title')}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">{t('chores_subtitle')}</p>
                </div>
                {!isAdmin && (
                    <div className="bg-gradient-to-br from-amber-400 to-orange-500 text-white px-8 py-4 rounded-[1rem] font-black shadow-lg flex flex-col items-center justify-center min-w-[140px] transform hover:scale-105 transition-transform">
                        <span className="text-[10px] uppercase tracking-widest opacity-80 mb-1">Deine Punkte</span>
                        <div className="flex items-center gap-2">
                            <i className="ri-copper-coin-fill text-3xl"></i>
                            <span className="text-4xl leading-none">{myPoints}</span>
                        </div>
                    </div>
                )}
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Main Content Area */}
                <div className="col-span-1 lg:col-span-8 flex flex-col gap-6">
                    {/* Active Chores */}
                    <div className="bg-white dark:bg-slate-900 rounded-[1.25rem] p-6 lg:p-8 shadow-sm border border-black/[0.06] dark:border-slate-800 flex flex-col h-full min-h-[400px]">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="font-black text-slate-800 dark:text-slate-100 text-xl flex items-center gap-2">
                                <i className="ri-clipboard-check-line text-[#00ADEF]"></i> {t('chores_active_missions')}
                            </h3>
                            {isAdmin && (
                                <button
                                    onClick={() => {
                                        if (showForm && editingChore) {
                                            setEditingChore(null);
                                            setTitle('');
                                            setPoints(10);
                                            setAssignedTo('');
                                            setRecurringInterval('none');
                                        } else {
                                            setShowForm(!showForm);
                                        }
                                    }}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-all ${showForm ? (editingChore ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 rotate-45') : 'bg-[#00ADEF] text-white hover:bg-[#0095ce] shadow-lg shadow-cyan-200/50'}`}
                                >
                                    <i className={editingChore ? 'ri-close-line' : 'ri-add-line'}></i>
                                </button>
                            )}
                        </div>

                        {/* Add/Edit Form */}
                        {showForm && isAdmin && (
                            <form onSubmit={handleAddChore} className="mb-8 bg-slate-50 dark:bg-slate-800 p-6 rounded-[1rem] border border-black/[0.06] dark:border-white/10 animate-in slide-in-from-top-4">
                                <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 border-b border-slate-200 dark:border-white/10 pb-2">
                                    {editingChore ? t('chores_edit_mission') : t('chores_new_mission')}
                                </h4>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest ml-1 mb-1 block">{t('chores_title_label')}</label>
                                        <input
                                            type="text" required autoFocus
                                            className="w-full bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/10 rounded-xl px-4 py-3 font-medium outline-none focus:border-[#00ADEF] dark:text-slate-100"
                                            value={title} onChange={e => setTitle(e.target.value)}
                                            placeholder={t('chore_placeholder')}
                                        />
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest ml-1 mb-1 block">{t('points')}</label>
                                            <input
                                                type="number" min="0" required
                                                className="w-full bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/10 rounded-xl px-4 py-3 font-bold text-amber-500 outline-none focus:border-amber-400"
                                                value={points} onChange={e => setPoints(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest ml-1 mb-1 block">{t('chores_assign_to')}</label>
                                            <select
                                                className="w-full bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/10 rounded-xl px-4 py-3 font-medium outline-none focus:border-[#00ADEF] dark:text-slate-100"
                                                value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
                                            >
                                                <option value="">{t('chores_all_members')}</option>
                                                {leaderboard.map(u => (
                                                    <option key={u.id} value={u.id}>{u.username || u.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="mb-4">
                                        <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest ml-1 mb-1 block">{t('chores_repetition')}</label>
                                        <select
                                            className="w-full bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/10 rounded-xl px-4 py-3 font-medium outline-none focus:border-[#00ADEF] dark:text-slate-100"
                                            value={recurringInterval} onChange={e => setRecurringInterval(e.target.value)}
                                        >
                                            <option value="none">{t('chores_once')}</option>
                                            <option value="daily">{t('chores_daily')}</option>
                                            <option value="3d">{t('chores_3d')}</option>
                                            <option value="weekly">{t('chores_weekly')}</option>
                                            <option value="biweekly">{t('chores_biweekly')}</option>
                                            <option value="monthly">{t('chores_monthly')}</option>
                                            <option value="3m">{t('chores_3m')}</option>
                                            <option value="6m">{t('chores_6m')}</option>
                                            <option value="yearly">{t('chores_yearly')}</option>
                                        </select>
                                    </div>
                                    <button
                                        type="submit" disabled={isSubmitting}
                                        className="w-full bg-[#00ADEF] text-white font-bold py-3.5 rounded-xl hover:bg-[#0095ce] transition-colors mt-2"
                                    >
                                        {editingChore ? t('chores_save_changes') : t('chores_save_mission')}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* List */}
                        {isLoading ? (
                            <div className="py-12 flex justify-center"><i className="ri-loader-4-line animate-spin text-3xl text-slate-300"></i></div>
                        ) : activeChores.length === 0 ? (
                            <div className="py-16 flex flex-col items-center justify-center text-slate-400 text-center">
                                <i className="ri-leaf-line text-6xl opacity-30 mb-4"></i>
                                <h4 className="font-black text-xl mb-1 text-slate-500">{t('chores_everything_done')}</h4>
                                <p className="text-sm">{t('chores_no_open_missions')}</p>
                            </div>
                        ) : (
                            <div className="grid gap-4 auto-rows-min">
                                {activeChores.map(chore => (
                                    <div key={chore.id} className="group relative bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-[#00ADEF]/30 p-4 rounded-lg flex items-center justify-between transition-all hover:shadow-md">

                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-500 flex flex-col items-center justify-center font-black shrink-0 relative overflow-hidden group-hover:scale-110 transition-transform">
                                                <div className="absolute inset-0 bg-gradient-to-br from-amber-400/20 to-orange-500/20 text-slate-100"></div>
                                                <span className="relative z-10 text-sm">{chore.points}</span>
                                                <i className="ri-copper-coin-fill text-[8px] absolute bottom-1 right-1 opacity-50"></i>
                                            </div>
                                            <div className="min-w-0 pr-4">
                                                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-lg leading-tight truncate">{chore.title}</h4>
                                                {chore.assigned_to && (
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-[#00ADEF] bg-[#00ADEF]/10 px-2 py-0.5 rounded-md mt-1 inline-block">
                                                        Zugeordnet: {chore.assigned_to_name}
                                                    </span>
                                                )}
                                                {!chore.assigned_to && (
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md mt-1 inline-block">
                                                        Für Alle
                                                    </span>
                                                )}
                                                {chore.is_recurring === 1 && (
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-md mt-1 ml-2 inline-block">
                                                        <i className="ri-refresh-line mr-1"></i> {
                                                            chore.recurring_interval === 'daily' ? t('chores_daily') :
                                                                chore.recurring_interval === '3d' ? t('chores_3d') :
                                                                    chore.recurring_interval === 'weekly' ? t('chores_weekly') :
                                                                        chore.recurring_interval === 'biweekly' ? t('chores_biweekly') :
                                                                            chore.recurring_interval === 'monthly' ? t('chores_monthly') :
                                                                                chore.recurring_interval === '3m' ? t('chores_3m') :
                                                                                    chore.recurring_interval === '6m' ? t('chores_6m') : t('chores_yearly')
                                                        }
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {/* Edit/Delete Buttons for Admin */}
                                            {isAdmin && (
                                                <div className="flex items-center">
                                                    <button onClick={() => handleEditClick(chore)} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-300 dark:text-slate-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-500 transition-colors">
                                                        <i className="ri-edit-line"></i>
                                                    </button>
                                                    <button onClick={() => handleDelete(chore.id)} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-300 dark:text-slate-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors">
                                                        <i className="ri-delete-bin-line"></i>
                                                    </button>
                                                </div>
                                            )}

                                            {/* Action Button */}
                                            {chore.completed_today ? (
                                                <div className="bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 border border-emerald-200 dark:border-emerald-800 transition-colors">
                                                    <i className="ri-check-double-line"></i>
                                                    <span>{t('chores_done_today')}</span>
                                                </div>
                                            ) : (!chore.assigned_to || chore.assigned_to === user.id || isAdmin) ? (
                                                <button
                                                    onClick={() => handleComplete(chore)}
                                                    className="bg-emerald-500 hover:bg-emerald-600 px-5 py-2.5 rounded-xl font-bold text-white shadow-md transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                                                >
                                                    <i className="ri-check-line"></i>
                                                    <span className="hidden sm:inline">{t('chores_done_btn')}</span>
                                                </button>
                                            ) : (
                                                <div className="bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1 cursor-not-allowed transition-colors" title="Dieser Person zugeordnet">
                                                    <i className="ri-lock-line"></i> {t('chores_blocked')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar (Leaderboard & History) */}
                <div className="col-span-1 lg:col-span-4 flex flex-col gap-8">
                    {/* Leaderboard */}
                    <div className="bg-gradient-to-br from-[#2B3E6A] to-[#1e2b4a] rounded-[1.25rem] p-6 lg:p-8 text-white shadow-xl shadow-[#2B3E6A]/20 relative overflow-hidden">
                        <div className="absolute -top-10 -right-10 text-white/5 rotate-12">
                            <i className="ri-trophy-line text-[180px]"></i>
                        </div>
                        <div className="relative z-10">
                            <h3 className="font-black text-2xl mb-6 flex items-center gap-2">
                                <i className="ri-bar-chart-grouped-fill text-[#00ADEF]"></i> {t('chores_leaderboard')}
                            </h3>
                            <div className="space-y-4">
                                {leaderboard.sort((a, b) => b.points_balance - a.points_balance).map((kid, index) => (
                                    <div key={kid.id} className="flex items-center gap-4 bg-white/10 p-3 rounded-lg backdrop-blur-sm border border-black/[0.06]/5">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${index === 0 ? 'bg-amber-400 text-amber-900 shadow-[0_0_15px_rgba(251,191,36,0.5)]' : index === 1 ? 'bg-slate-300 text-slate-800' : index === 2 ? 'bg-orange-400/80 text-orange-900' : 'bg-white/20 text-white'}`}>
                                            {index + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold truncate text-lg leading-none mb-1">{kid.username || kid.name}</p>
                                        </div>
                                        <div className="font-black text-2xl text-[#00ADEF] shrink-0">
                                            {kid.points_balance || 0}
                                        </div>
                                    </div>
                                ))}
                                {leaderboard.length === 0 && (
                                <p className="text-white/50 text-sm font-medium italic text-center">{t('chores_no_participants')}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* History */}
                    <div className="bg-white dark:bg-slate-900 rounded-[1.25rem] p-6 lg:p-8 shadow-sm border border-black/[0.06] dark:border-slate-800 flex flex-col flex-1 min-h-[300px] transition-colors">
                        <h3 className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-6">
                            <i className="ri-history-line text-slate-400"></i> {t('chores_recently_done')}
                        </h3>
                        <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            {history.length === 0 ? (
                                <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-6 italic font-medium">{t('chores_no_history')}</p>
                            ) : (
                                history.map(item => (
                                    <div key={item.id} className="flex items-start gap-3 border-b border-slate-50 dark:border-slate-800 pb-4 last:border-0 last:pb-0">
                                        <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                                            <i className="ri-check-double-line"></i>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-slate-700 dark:text-slate-200 text-sm leading-tight mb-0.5">{item.title}</p>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                                                {item.completed_by_name} • <span className="text-amber-500">+{item.points_earned} {t('points')}</span>
                                            </p>
                                            <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
                                                {applyOffset(item.completed_at, user).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Chores;
