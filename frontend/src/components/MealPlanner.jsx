import React from 'react';
import api from '../services/api';
import { getAppTime } from '../utils/time';
import { useTranslation } from '../i18n.jsx';

const MealPlanner = ({ user }) => {
    const { t } = useTranslation();
    const [viewMode, setViewMode] = React.useState('day'); // 'day', '3day', 'week'
    const [dateOffset, setDateOffset] = React.useState(0); // Offset based on viewMode units
    const [meals, setMeals] = React.useState({});
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [selectedSlot, setSelectedSlot] = React.useState(null);
    const [mealText, setMealText] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);

    const mealTypes = ['Frühstück', 'Mittagessen', 'Abendessen'];
    const mealTypeStyles = {
        'Frühstück': { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200', icon: 'ri-sun-line' },
        'Mittagessen': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200', icon: 'ri-restaurant-line' },
        'Abendessen': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200', icon: 'ri-moon-line' }
    };

    const getDisplayRange = () => {
        const now = getAppTime(user);
        now.setHours(0, 0, 0, 0);
        const start = new Date(now);

        if (viewMode === 'week') {
            const day = start.getDay();
            const diff = (day === 0 ? -6 : 1) - day + (dateOffset * 7);
            start.setDate(now.getDate() + diff);
        } else if (viewMode === '3day') {
            start.setDate(now.getDate() + (dateOffset * 3));
        } else {
            start.setDate(now.getDate() + dateOffset);
        }

        const numDays = viewMode === 'week' ? 7 : (viewMode === '3day' ? 3 : 1);
        const displayDays = [];
        for (let i = 0; i < numDays; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            displayDays.push(d);
        }

        return displayDays;
    };

    const getISOWeek = (date) => {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    };

    const fetchMeals = async () => {
        const displayDays = getDisplayRange();
        const start = displayDays[0];
        const end = displayDays[displayDays.length - 1];

        try {
            setIsLoading(true);
            const res = await api.get('/meals', {
                params: {
                    start: start.toLocaleDateString('en-CA'),
                    end: end.toLocaleDateString('en-CA')
                }
            });
            const mealMap = {};
            // Group by date, then by type, value is an array of meals
            res.data.forEach(m => {
                const dateKey = m.meal_date.split('T')[0];
                if (!mealMap[dateKey]) mealMap[dateKey] = {};
                if (!mealMap[dateKey][m.meal_type]) mealMap[dateKey][m.meal_type] = [];
                mealMap[dateKey][m.meal_type].push(m);
            });
            setMeals(mealMap);
        } catch (err) { console.error(err); } finally { setIsLoading(false); }
    };

    React.useEffect(() => {
        fetchMeals();
    }, [dateOffset, viewMode]);

    const handleNext = () => setDateOffset(prev => prev + 1);
    const handlePrev = () => setDateOffset(prev => prev - 1);

    const openModal = (date, type, existingMeal = null) => {
        setSelectedSlot({ date, type, id: existingMeal?.id });
        setMealText(existingMeal?.meal_name || '');
        setIsModalOpen(true);
    };

    const saveMeal = async (e) => {
        e.preventDefault();
        try {
            if (selectedSlot.id) {
                await api.put(`/meals/${selectedSlot.id}`, { meal_name: mealText });
            } else {
                await api.post('/meals', {
                    meal_date: selectedSlot.date,
                    meal_type: selectedSlot.type,
                    meal_name: mealText,
                    forceAdd: true // Always allow multiple entries via modal
                });
            }
            setIsModalOpen(false);
            fetchMeals();
        } catch (err) { console.error(err); }
    };

    const deleteMeal = async (id) => {
        if (!window.confirm(t('confirm_delete_meal'))) return;
        try {
            await api.delete(`/meals/${id}`);
            fetchMeals();
        } catch (err) { console.error(err); }
    };

    const toggleVote = async (e, id) => {
        e.stopPropagation();
        try {
            await api.post(`/meals/${id}/vote`);
            fetchMeals();
        } catch (err) { console.error(err); }
    };

    // Drag & Drop Handlers
    const onDragStart = (e, meal) => {
        e.dataTransfer.setData('mealId', meal.id);
        e.currentTarget.style.opacity = '0.5';
    };

    const onDragEnd = (e) => {
        e.currentTarget.style.opacity = '1';
    };

    const onDragOver = (e) => {
        e.preventDefault();
        e.currentTarget.classList.add('bg-brand-light/10');
    };

    const onDragLeave = (e) => {
        e.currentTarget.classList.remove('bg-brand-light/10');
    };

    const onDrop = async (e, targetDate, targetType) => {
        e.preventDefault();
        e.currentTarget.classList.remove('bg-brand-light/10');
        const mealId = e.dataTransfer.getData('mealId');

        try {
            await api.patch(`/meals/${mealId}/move`, {
                date: targetDate,
                meal_type: targetType
            });
            fetchMeals();
        } catch (err) { console.error(err); }
    };

    // Import / Export
    const exportPlan = () => {
        const dataStr = JSON.stringify(meals, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const exportFileDefaultName = `${t('meal_plan_export_prefix')}_${getAppTime(user).toLocaleDateString()}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    const importPlan = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const importedMeals = JSON.parse(event.target.result);
                // Simple bulk import (could be more robust)
                for (const date in importedMeals) {
                    for (const type in importedMeals[date]) {
                        for (const meal of importedMeals[date][type]) {
                            await api.post('/meals', {
                                meal_date: date,
                                meal_type: type,
                                meal_name: meal.meal_name,
                                forceAdd: true
                            });
                        }
                    }
                }
                fetchMeals();
                alert(t('import_success'));
            } catch (err) {
                alert(t('import_error'));
                console.error(err);
            }
        };
        reader.readAsText(file);
    };

    const displayDays = getDisplayRange();
    const firstDay = displayDays[0];
    const monthName = firstDay.toLocaleString(t('locale') || 'de-DE', { month: 'long' });
    const year = firstDay.getFullYear();
    const kw = getISOWeek(firstDay);

    const dayLabelsShort = [t('sun_short'), t('mon_short'), t('tue_short'), t('wed_short'), t('thu_short'), t('fri_short'), t('sat_short')];
    const dayLabelsFull = [t('sunday'), t('monday'), t('tuesday'), t('wednesday'), t('thursday'), t('friday'), t('saturday')];

    const mealTypeKeys = {
        'Frühstück': 'breakfast',
        'Mittagessen': 'lunch',
        'Abendessen': 'dinner'
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[1.25rem] shadow-sm border border-black/[0.06] dark:border-slate-800 p-4 md:p-8 overflow-hidden flex flex-col min-h-[600px] transition-colors duration-500">
            <header className="flex flex-col lg:flex-row justify-between items-center mb-8 gap-6 px-2">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight leading-none">{t('meal_planner_title')}</h2>
                        <div className="flex items-center gap-2 mt-2">
                            <p className="text-brand-dark dark:text-brand-light font-black uppercase text-[10px] tracking-widest leading-none">
                                {viewMode === 'day' ? t('day_view') : viewMode === '3day' ? t('three_day_view') : t('week_view')}
                            </p>
                            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                            <div className="flex gap-2">
                                <button onClick={exportPlan} className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-brand-dark dark:hover:text-brand-light transition-colors">{t('export')}</button>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-brand-dark dark:hover:text-brand-light transition-colors cursor-pointer">
                                    {t('import')}
                                    <input type="file" className="hidden" accept=".json" onChange={importPlan} />
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-black/[0.06] dark:border-white/10 shadow-inner">
                        <button
                            onClick={() => { setViewMode('day'); setDateOffset(0); }}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'day' ? 'bg-white dark:bg-slate-700 text-brand-dark dark:text-brand-light shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
                        > {t('day')} </button>
                        <button
                            onClick={() => { setViewMode('3day'); setDateOffset(0); }}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === '3day' ? 'bg-white dark:bg-slate-700 text-brand-dark dark:text-brand-light shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
                        > 3 {t('days_plural')} </button>
                        <button
                            onClick={() => { setViewMode('week'); setDateOffset(0); }}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'week' ? 'bg-white dark:bg-slate-700 text-brand-dark dark:text-brand-light shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
                        > {t('week')} </button>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-black/[0.06] dark:border-slate-800 shadow-sm transition-all hover:bg-white dark:hover:bg-slate-800 hover:border-brand-light/30">
                    <button onClick={handlePrev} className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition">
                        <i className="ri-arrow-left-s-line text-xl text-brand-dark dark:text-brand-light"></i>
                    </button>
                    <div className="flex flex-col items-center min-w-[140px] px-4 border-x border-slate-200 dark:border-white/10">
                        <span className="font-black text-slate-700 dark:text-slate-200 tracking-tighter text-lg leading-none">
                            {t('kw')} {kw}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-1 whitespace-nowrap">
                            {monthName} {year}
                        </span>
                    </div>
                    <button onClick={handleNext} className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition">
                        <i className="ri-arrow-right-s-line text-xl text-brand-dark dark:text-brand-light"></i>
                    </button>
                </div>
            </header>
            <div className={`flex-1 overflow-x-auto pb-4 custom-scrollbar ${isLoading ? 'opacity-50 grayscale transition-all' : ''}`}>
                <div className={`grid gap-6 ${viewMode === 'day' ? 'grid-cols-1 max-w-2xl mx-auto' : viewMode === '3day' ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 lg:grid-cols-7 lg:min-w-[1000px]'}`}>
                    {displayDays.map((dateObj) => {
                        const dateKey = dateObj.toLocaleDateString('en-CA');
                        const today = getAppTime(user);
                        today.setHours(0,0,0,0);
                        const isToday = dateKey === today.toLocaleDateString('en-CA');
                        const isPast = dateObj < today;
                        const isFuture = dateObj > today;

                        const dayLabelShort = dayLabelsShort[dateObj.getDay()];
                        const dayLabelFull = dayLabelsFull[dateObj.getDay()];

                        let dateHeaderClass = 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border border-black/[0.06] dark:border-slate-800';
                        if (isToday) dateHeaderClass = 'bg-brand-dark dark:bg-brand-light text-white dark:text-slate-900 shadow-xl scale-105 z-10';
                        else if (isPast) dateHeaderClass = 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800/50 opacity-70';
                        else if (isFuture) dateHeaderClass = 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50';

                        return (
                            <div key={dateKey} className="flex flex-col gap-4">
                                <div className={`text-center p-5 rounded-[1rem] transition-all flex flex-col items-center justify-center ${dateHeaderClass}`}>
                                    <div className="text-[10px] font-black uppercase tracking-widest opacity-60 leading-none mb-1">{viewMode === 'week' ? dayLabelShort : dayLabelFull}</div>
                                    <div className="text-2xl font-black tracking-tighter leading-none">{dateObj.getDate()}</div>
                                </div>

                                <div className="space-y-4">
                                    {mealTypes.map(type => {
                                        const slotMeals = meals[dateKey]?.[type] || [];
                                        const style = mealTypeStyles[type];
                                        return (
                                            <div
                                                key={type}
                                                onDragOver={onDragOver}
                                                onDragLeave={onDragLeave}
                                                onDrop={(e) => onDrop(e, dateKey, type)}
                                                className={`flex flex-col gap-2 p-3 rounded-[1rem] border border-transparent transition-all min-h-[140px] ${slotMeals.length === 0 ? 'bg-slate-50/50 dark:bg-slate-800/30 border-dashed border-slate-200 dark:border-white/10' : 'bg-slate-50/30 dark:bg-slate-800/20'}`}
                                            >
                                                <div className="flex items-center justify-between px-2 mb-1">
                                                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${style.bg} dark:bg-opacity-20 ${style.border} dark:border-opacity-30 border`}>
                                                        <i className={`${style.icon} ${style.text} dark:text-current text-[10px]`}></i>
                                                        <span className={`text-[9px] font-black uppercase tracking-widest ${style.text} dark:text-current`}>{t(mealTypeKeys[type] || type)}</span>
                                                    </div>
                                                    <button onClick={() => openModal(dateKey, type)} className="w-6 h-6 rounded-full bg-white dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 flex items-center justify-center hover:bg-brand-dark dark:hover:bg-brand-light hover:text-white dark:hover:text-slate-900 transition-all shadow-sm">
                                                        <i className="ri-add-line text-xs"></i>
                                                    </button>
                                                </div>

                                                {slotMeals.map(meal => (
                                                    <div
                                                        key={meal.id}
                                                        draggable
                                                        onDragStart={(e) => onDragStart(e, meal)}
                                                        onDragEnd={onDragEnd}
                                                        onClick={() => openModal(dateKey, type, meal)}
                                                        className="group relative bg-white dark:bg-slate-800 p-4 rounded-lg border border-black/[0.06] dark:border-white/10 shadow-sm hover:border-brand-light/30 transition-all cursor-move active:scale-95"
                                                    >
                                                        <div className="flex flex-col gap-2">
                                                            {meal.meal_name && meal.meal_name.trim() ? (
                                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-tight italic line-clamp-3">"{meal.meal_name}"</span>
                                                            ) : (
                                                                <span className="text-xs font-bold text-slate-300 dark:text-slate-600 leading-tight italic">{t('no_name')}</span>
                                                            )}
                                                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50 dark:border-white/10">
                                                                <button
                                                                    onClick={(e) => toggleVote(e, meal.id)}
                                                                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all ${meal.has_voted ? 'bg-brand-dark dark:bg-brand-light text-white dark:text-slate-900' : 'bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:bg-brand-light/10 dark:hover:bg-brand-light/20 hover:text-brand-dark dark:hover:text-brand-light'}`}
                                                                >
                                                                    <i className={meal.has_voted ? 'ri-heart-fill' : 'ri-heart-line text-[10px]'}></i>
                                                                    <span className="text-[10px] font-black">{meal.vote_count || 0}</span>
                                                                </button>
                                                                <button onClick={(e) => { e.stopPropagation(); deleteMeal(meal.id); }} className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-slate-300 dark:text-slate-600 hover:text-red-500 transition-all">
                                                                    <i className="ri-delete-bin-line text-xs"></i>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}

                                                {slotMeals.length === 0 && (
                                                    <div className="flex-1 flex flex-col items-center justify-center opacity-20 dark:opacity-40 group">
                                                        <i className="ri-restaurant-line text-xl dark:text-slate-100"></i>
                                                        <span className="text-[7px] font-black uppercase tracking-widest mt-1 dark:text-slate-100">{t('empty_slot')}</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-[1.25rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-transparent dark:border-slate-800">
                        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{t(mealTypeKeys[selectedSlot.type] || selectedSlot.type)}</h3>
                                <p className="text-brand-dark dark:text-brand-light font-bold uppercase tracking-widest text-xs">
                                    {new Date(selectedSlot.date + 'T00:00:00').toLocaleDateString(t('locale') || 'de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                <i className="ri-close-line text-2xl"></i>
                            </button>
                        </div>
                        <form onSubmit={saveMeal} className="p-8 space-y-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">{t('what_to_eat')}</label>
                                <textarea
                                    className="w-full h-32 p-6 bg-slate-50 dark:bg-slate-800/50 border border-transparent focus:border-brand-light dark:focus:border-brand-light focus:bg-white dark:focus:bg-slate-800 outline-none rounded-[0.75rem] font-bold text-slate-700 dark:text-slate-200 transition-all resize-none"
                                    placeholder={t('meal_placeholder_eg')}
                                    value={mealText}
                                    onChange={(e) => setMealText(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <button type="submit" className="w-full py-5 bg-brand-dark dark:bg-brand-light text-white dark:text-slate-900 rounded-[1rem] font-black shadow-xl hover:bg-slate-800 dark:hover:bg-brand-light/90 transition-all active:scale-95">
                                {selectedSlot.id ? t('save_changes') : t('save_plan')}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MealPlanner;
