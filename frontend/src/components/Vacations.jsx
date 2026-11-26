import React from 'react';
import api from '../services/api';
import { getAppTime } from '../utils/time';
import { useTranslation } from '../i18n.jsx';

const Vacations = ({ user }) => {
    const { t } = useTranslation();
    const [vacations, setVacations] = React.useState([]);
    const [selectedVacationId, setSelectedVacationId] = React.useState(null);
    const [items, setItems] = React.useState([]);
    const [destinations, setDestinations] = React.useState([]);
    const [viewMode, setViewMode] = React.useState('planned'); // 'planned' | 'dreams'

    // Modals
    const [isVacationModalOpen, setIsVacationModalOpen] = React.useState(false);
    const [isDestinationModalOpen, setIsDestinationModalOpen] = React.useState(false);

    // Forms
    const [vacationData, setVacationData] = React.useState({ title: '', destination: '', start_date: '', end_date: '' });
    const [newItemTitle, setNewItemTitle] = React.useState('');
    const [newItemCategory, setNewItemCategory] = React.useState('Allgemein');
    const [destinationData, setDestinationData] = React.useState({ title: '', notes: '' });
    const [editingDestId, setEditingDestId] = React.useState(null);

    const fetchVacations = async () => {
        try {
            const response = await api.get('/vacations');
            setVacations(response.data);
            if (response.data.length > 0 && !selectedVacationId) {
                setSelectedVacationId(response.data[0].id);
            }
        } catch (err) {
            console.error('Error fetching vacations:', err);
        }
    };

    const fetchDestinations = async () => {
        try {
            const response = await api.get('/vacations/destinations');
            setDestinations(response.data);
        } catch (err) {
            console.error('Error fetching destinations:', err);
        }
    };

    const fetchItems = async (vacationId) => {
        if (!vacationId) return;
        try {
            const response = await api.get(`/vacations/${vacationId}/items`);
            setItems(response.data);
        } catch (err) {
            console.error('Error fetching items:', err);
        }
    };

    React.useEffect(() => {
        fetchVacations();
        fetchDestinations();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    React.useEffect(() => {
        fetchItems(selectedVacationId);
    }, [selectedVacationId]);

    // --- Vacation Actions ---
    const handleSaveVacation = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/vacations', vacationData);
            setVacationData({ title: '', destination: '', start_date: '', end_date: '' });
            setIsVacationModalOpen(false);
            await fetchVacations();
            setSelectedVacationId(res.data.id);
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteVacation = async (id) => {
        if (!confirm(t('confirm_delete_vacation'))) return;
        try {
            await api.delete(`/vacations/${id}`);
            if (selectedVacationId === id) setSelectedVacationId(null);
            fetchVacations();
        } catch (err) {
            console.error(err);
        }
    };

    // --- Item Actions ---
    const handleAddItem = async (e) => {
        e.preventDefault();
        if (!selectedVacationId || !newItemTitle.trim()) return;

        try {
            await api.post(`/vacations/${selectedVacationId}/items`, {
                title: newItemTitle,
                category: newItemCategory
            });
            setNewItemTitle('');
            fetchItems(selectedVacationId);
        } catch (err) {
            console.error(err);
        }
    };

    const handleToggleItem = async (itemId) => {
        try {
            // Optimistic update
            setItems(items.map(item => item.id === itemId ? { ...item, is_packed: !item.is_packed } : item));
            await api.put(`/vacations/${selectedVacationId}/items/${itemId}/toggle`);
        } catch (err) {
            console.error(err);
            fetchItems(selectedVacationId); // Revert on error
        }
    };

    const handleDeleteItem = async (itemId) => {
        try {
            await api.delete(`/vacations/${selectedVacationId}/items/${itemId}`);
            fetchItems(selectedVacationId);
        } catch (err) {
            console.error(err);
        }
    };

    // --- Destination Actions ---
    const handleOpenDestinationModal = (dest = null) => {
        if (dest) {
            setEditingDestId(dest.id);
            setDestinationData({ title: dest.title, notes: dest.notes || '' });
        } else {
            setEditingDestId(null);
            setDestinationData({ title: '', notes: '' });
        }
        setIsDestinationModalOpen(true);
    };

    const handleSaveDestination = async (e) => {
        e.preventDefault();
        try {
            if (editingDestId) {
                // Determine if we need a PUT endpoint. Since backend doesn't have PUT /destinations/:id yet, I need to add that later or handle it.
                // Wait! I didn't add the PUT endpoint in vacations.js yet. I must add it.
                await api.put(`/vacations/destinations/${editingDestId}`, destinationData);
            } else {
                await api.post('/vacations/destinations', destinationData);
            }
            setDestinationData({ title: '', notes: '' });
            setEditingDestId(null);
            setIsDestinationModalOpen(false);
            fetchDestinations();
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteDestination = async (id) => {
        if (!confirm(t('confirm_delete_wish'))) return;
        try {
            await api.delete(`/vacations/destinations/${id}`);
            fetchDestinations();
        } catch (err) {
            console.error(err);
        }
    };

    const selectedVacation = vacations.find(v => v.id === selectedVacationId);

    // Group items by category
    const groupedItems = items.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
    }, {});

    // Countdown Logic
    const getCountdownText = (startDateStr) => {
        if (!startDateStr) return null;
        const start = new Date(startDateStr);
        const today = getAppTime(user);
        today.setHours(0, 0, 0, 0);

        const diffTime = start - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return t('trip_over');
        if (diffDays === 0) return t('trip_today');
        return t('trip_countdown', { count: diffDays });
    };

    return (
        <div className="h-full flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
                        <i className="ri-plane-line text-sky-500"></i>
                        {t('vacations_title')}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">{t('vacations_subtitle')}</p>
                </div>
                <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-lg border border-transparent dark:border-white/10">
                    <button
                        onClick={() => setViewMode('planned')}
                        className={`px-6 py-2 rounded-xl font-bold transition-all ${viewMode === 'planned' ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        {t('planned_trips')}
                    </button>
                    <button
                        onClick={() => setViewMode('dreams')}
                        className={`px-6 py-2 rounded-xl font-bold transition-all ${viewMode === 'dreams' ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        {t('wish_destinations')}
                    </button>
                </div>
            </header>

            <div className="flex-1 flex flex-col lg:flex-row gap-8 overflow-hidden min-h-0">
                {viewMode === 'planned' ? (
                    <>
                        {/* Sidebar: List of Vacations */}
                        <div className="w-full lg:w-80 flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar">
                            <button
                                onClick={() => setIsVacationModalOpen(true)}
                                className="w-full bg-slate-50 dark:bg-slate-800/50 text-sky-600 dark:text-sky-400 border border-dashed border-sky-200 dark:border-sky-900/50 px-6 py-4 rounded-[1rem] font-bold shadow-sm hover:border-sky-300 dark:hover:border-sky-700 transition-all flex items-center justify-center gap-2 mb-2"
                            >
                                <i className="ri-add-line text-xl"></i>
                                {t('new_trip')}
                            </button>
                            {vacations.map(vacation => {
                                const countdown = getCountdownText(vacation.start_date);
                                return (
                                    <button
                                        key={vacation.id}
                                        onClick={() => setSelectedVacationId(vacation.id)}
                                        className={`flex flex-col p-5 rounded-[1rem] border transition-all text-left ${selectedVacationId === vacation.id
                                            ? 'bg-white dark:bg-slate-800 border-sky-500 dark:border-sky-400 shadow-xl'
                                            : 'bg-white/50 dark:bg-slate-800/30 border-transparent hover:bg-white dark:hover:bg-slate-800 hover:border-slate-100 dark:hover:border-slate-700'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start w-full mb-2">
                                            <h3 className="font-black text-slate-800 dark:text-slate-100 truncate">{vacation.title}</h3>
                                            {countdown && (
                                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${countdown === t('trip_over') ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500' : 'bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400'}`}>
                                                    {countdown}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-sm font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                            <i className="ri-map-pin-line text-sky-500"></i>
                                            {vacation.destination || t('no_destination')}
                                        </div>
                                    </button>
                                );
                            })}
                            {vacations.length === 0 && (
                                <div className="bg-white dark:bg-slate-900 rounded-[1rem] border border-dashed border-slate-100 dark:border-slate-800 p-8 text-center">
                                    <p className="text-slate-400 dark:text-slate-500 font-bold text-sm">{t('no_trips_planned')}</p>
                                </div>
                            )}
                        </div>

                        {/* Main: Items View */}
                        <div className="flex-1 bg-white dark:bg-slate-900 rounded-[1.25rem] border border-black/[0.06] dark:border-slate-800 shadow-sm flex flex-col overflow-hidden transition-colors duration-500">
                            {selectedVacation ? (
                                <>
                                    <div className="p-8 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div>
                                            <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 mb-2">{selectedVacation.title}</h2>
                                            <p className="font-bold text-slate-500 dark:text-slate-400 flex items-center gap-3">
                                                <span className="flex items-center gap-1"><i className="ri-map-pin-line text-sky-500"></i> {selectedVacation.destination}</span>
                                                {selectedVacation.start_date && (
                                                    <span className="flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-black/[0.06] dark:border-white/10">
                                                        <i className="ri-calendar-event-line text-slate-400 dark:text-slate-500"></i>
                                                        {new Date(selectedVacation.start_date).toLocaleDateString(t('language') === 'de' ? 'de-DE' : 'en-US')}
                                                        {selectedVacation.end_date ? ` - ${new Date(selectedVacation.end_date).toLocaleDateString(t('language') === 'de' ? 'de-DE' : 'en-US')}` : ''}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <button onClick={() => handleDeleteVacation(selectedVacation.id)} className="w-12 h-12 bg-white dark:bg-slate-800 rounded-lg border border-black/[0.06] dark:border-white/10 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:border-red-100 dark:hover:border-red-900/50 transition-all shadow-sm flex items-center justify-center shrink-0">
                                            <i className="ri-delete-bin-line text-xl"></i>
                                        </button>
                                    </div>

                                    <div className="flex-1 flex flex-col overflow-hidden">
                                        {/* Add Item Form */}
                                        <form onSubmit={handleAddItem} className="p-6 border-b border-slate-50 dark:border-slate-800 flex gap-3 flex-col sm:flex-row">
                                            <select
                                                value={newItemCategory}
                                                onChange={e => setNewItemCategory(e.target.value)}
                                                className="sm:w-48 px-5 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-black/[0.06] dark:border-white/10 font-bold outline-none focus:border-sky-300 dark:focus:border-sky-500 text-slate-800 dark:text-slate-100 appearance-none"
                                            >
                                                <option value="Allgemein">{t('packing_category_allgemein')}</option>
                                                <option value="Kleidung">{t('packing_category_kleidung')}</option>
                                                <option value="Kulturbeutel">{t('packing_category_kulturbeutel')}</option>
                                                <option value="Dokumente">{t('packing_category_dokumente')}</option>
                                                <option value="Elektronik">{t('packing_category_elektronik')}</option>
                                                <option value="Apotheke">{t('packing_category_apotheke')}</option>
                                            </select>
                                            <input
                                                type="text" required
                                                value={newItemTitle}
                                                onChange={e => setNewItemTitle(e.target.value)}
                                                placeholder={t('item_placeholder')}
                                                className="flex-1 px-5 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-black/[0.06] dark:border-white/10 font-bold outline-none focus:border-sky-300 dark:focus:border-sky-500 text-slate-800 dark:text-slate-100"
                                            />
                                            <button type="submit" className="bg-sky-500 dark:bg-sky-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-sky-600 dark:hover:bg-sky-500 transition-colors">
                                                {t('add_item_btn')}
                                            </button>
                                        </form>

                                        {/* Packlist View */}
                                        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                                            {Object.keys(groupedItems).length === 0 ? (
                                                <div className="text-center py-20 text-slate-300 dark:text-slate-700">
                                                    <i className="ri-suitcase-2-line text-6xl mb-4 text-slate-200 dark:text-slate-800"></i>
                                                    <p className="font-bold">{t('empty_packlist')}</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-8 max-w-3xl">
                                                    {/* Sort categories arbitrarily, or just iterate */}
                                                    {Object.keys(groupedItems).sort().map(category => (
                                                        <div key={category}>
                                                            <h3 className="text-sm font-black uppercase tracking-widest text-sky-500 dark:text-sky-400 mb-4 flex items-center gap-2">
                                                                <i className="ri-folder-open-line"></i> {t(`packing_category_${category.toLowerCase()}`) || category}
                                                            </h3>
                                                            <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-[1rem] border border-black/[0.06] dark:border-slate-800 p-2 space-y-1">
                                                                {groupedItems[category].map(item => (
                                                                    <div key={item.id} className={`flex items-center justify-between p-3 rounded-lg group transition-colors ${item.is_packed ? 'opacity-50' : 'hover:bg-white dark:hover:bg-slate-700/50'}`}>
                                                                        <button
                                                                            onClick={() => handleToggleItem(item.id)}
                                                                            className="flex-1 flex items-center gap-4 text-left"
                                                                        >
                                                                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${item.is_packed ? 'bg-sky-500 border-sky-500 text-white' : 'border-slate-300 dark:border-white/10'}`}>
                                                                                {item.is_packed && <i className="ri-check-line text-sm"></i>}
                                                                            </div>
                                                                            <span className={`font-bold transition-all ${item.is_packed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}`}>
                                                                                {item.title}
                                                                            </span>
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeleteItem(item.id)}
                                                                            className="w-8 h-8 flex items-center justify-center text-slate-300 dark:text-slate-600 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 dark:hover:text-red-400 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
                                                                        >
                                                                            <i className="ri-close-line"></i>
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                                    <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-[1rem] flex items-center justify-center text-5xl text-slate-200 dark:text-slate-700 mb-6">
                                        <i className="ri-plane-line"></i>
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">{t('select_trip')}</h3>
                                    <p className="text-slate-400 dark:text-slate-500 font-medium max-w-xs">{t('select_trip_desc')}</p>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-6 px-2">
                            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">{t('wish_destinations_header')}</h2>
                            <button
                                onClick={() => setIsDestinationModalOpen(true)}
                                className="bg-sky-500 dark:bg-sky-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-sky-600 dark:hover:bg-sky-500 shadow-md transition-all flex items-center gap-2"
                            >
                                <i className="ri-add-line text-lg"></i>
                                {t('new_wish_destination')}
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-8">
                            {destinations.length === 0 ? (
                                <div className="text-center py-24 text-slate-300 dark:text-slate-700">
                                    <i className="ri-earth-line text-7xl mb-4 text-slate-200 dark:text-slate-800"></i>
                                    <p className="font-bold text-lg dark:text-slate-100">{t('no_wish_destinations')}</p>
                                    <p className="text-sm font-medium mt-1 dark:text-slate-400">{t('dream_together')}</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {destinations.map(dest => {
                                        const imageUrl = `https://loremflickr.com/600/400/${encodeURIComponent(dest.title)},travel,city/all`;
                                        return (
                                            <div key={dest.id} className="bg-white dark:bg-slate-800 rounded-[1.25rem] border border-black/[0.06] dark:border-white/10 shadow-sm hover:shadow-xl hover:shadow-sky-100/30 dark:hover:shadow-sky-900/20 transition-all relative group flex flex-col overflow-hidden">

                                                {/* Header Image */}
                                                <div className="h-48 bg-slate-200 relative">
                                                    <img
                                                        src={imageUrl}
                                                        alt={dest.title}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&q=80&w=600&h=400'; }}
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent"></div>
                                                    <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                                                        <div className="w-10 h-10 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm text-sky-600 dark:text-sky-400 rounded-full flex items-center justify-center font-bold text-sm shadow-sm" title={`Hinzugefügt von ${dest.user_name || 'Unbekannt'}`}>
                                                            {(dest.user_name || 'U').charAt(0).toUpperCase()}
                                                        </div>
                                                    </div>
                                                    <h3 className="absolute bottom-4 left-6 right-6 text-2xl font-black text-white leading-tight drop-shadow-md">{dest.title}</h3>
                                                </div>

                                                <div className="p-6 flex-1 flex flex-col">
                                                    {dest.notes && (
                                                        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mb-6 leading-relaxed bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg">{dest.notes}</p>
                                                    )}

                                                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                                                        <span className="text-xs font-bold text-slate-400">
                                                            <i className="ri-time-line mr-1"></i>
                                                            {new Date(dest.created_at).toLocaleDateString()}
                                                        </span>
                                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                            <button
                                                                onClick={() => handleOpenDestinationModal(dest)}
                                                                className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-all"
                                                            >
                                                                <i className="ri-edit-line"></i>
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteDestination(dest.id)}
                                                                className="w-10 h-10 flex items-center justify-center text-red-300 hover:bg-red-50 hover:text-red-500 rounded-full transition-all"
                                                            >
                                                                <i className="ri-delete-bin-line"></i>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Vacation Modal */}
            {isVacationModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-[1.25rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-transparent dark:border-slate-800">
                        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">{t('new_trip')}</h2>
                            <button onClick={() => setIsVacationModalOpen(false)} className="w-10 h-10 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                                <i className="ri-close-line text-2xl"></i>
                            </button>
                        </div>
                        <form onSubmit={handleSaveVacation} className="p-8 space-y-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('field_title')}</label>
                                <input
                                    type="text" required
                                    value={vacationData.title}
                                    onChange={e => setVacationData({ ...vacationData, title: e.target.value })}
                                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg focus:ring-4 focus:ring-sky-100 dark:focus:ring-sky-900/30 outline-none font-bold text-slate-800 dark:text-slate-100"
                                    placeholder="z.B. Sommerurlaub 2026"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('location_placeholder_eg').replace('z.B. ', '')}</label>
                                <input
                                    type="text"
                                    value={vacationData.destination}
                                    onChange={e => setVacationData({ ...vacationData, destination: e.target.value })}
                                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg focus:ring-4 focus:ring-sky-100 dark:focus:ring-sky-900/30 outline-none font-bold text-slate-800 dark:text-slate-100"
                                    placeholder="z.B. Mallorca, Spanien"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('projects_field_deadline')}</label>
                                    <input
                                        type="date"
                                        value={vacationData.start_date}
                                        onChange={e => setVacationData({ ...vacationData, start_date: e.target.value })}
                                        className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-xl focus:ring-4 focus:ring-sky-100 dark:focus:ring-sky-900/30 outline-none font-bold text-slate-800 dark:text-slate-100"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('field_end')}</label>
                                    <input
                                        type="date"
                                        value={vacationData.end_date}
                                        onChange={e => setVacationData({ ...vacationData, end_date: e.target.value })}
                                        className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-xl focus:ring-4 focus:ring-sky-100 dark:focus:ring-sky-900/30 outline-none font-bold text-slate-800 dark:text-slate-100"
                                    />
                                </div>
                            </div>
                            <button type="submit" className="w-full py-5 bg-sky-500 dark:bg-sky-600 text-white rounded-[1rem] font-black shadow-xl hover:bg-sky-600 dark:hover:bg-sky-500 transition-all">
                                {t('create_trip_btn')}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Destination Modal */}
            {isDestinationModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-[1.25rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-transparent dark:border-slate-800">
                        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-sky-50/50 dark:bg-sky-900/30">
                            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">{editingDestId ? t('edit') : t('new_wish_destination')}</h2>
                            <button onClick={() => setIsDestinationModalOpen(false)} className="w-10 h-10 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                                <i className="ri-close-line text-2xl"></i>
                            </button>
                        </div>
                        <form onSubmit={handleSaveDestination} className="p-8 space-y-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('field_title')}</label>
                                <input
                                    type="text" required
                                    value={destinationData.title}
                                    onChange={e => setDestinationData({ ...destinationData, title: e.target.value })}
                                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg focus:ring-4 focus:ring-sky-100 dark:focus:ring-sky-900/30 outline-none font-bold text-slate-800 dark:text-slate-100"
                                    placeholder="z.B. Island Rundreise"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('projects_field_description')}</label>
                                <textarea
                                    value={destinationData.notes}
                                    onChange={e => setDestinationData({ ...destinationData, notes: e.target.value })}
                                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg focus:ring-4 focus:ring-sky-100 dark:focus:ring-sky-900/30 outline-none font-bold min-h-[120px] resize-none text-slate-800 dark:text-slate-100"
                                    placeholder={t('wish_notes_placeholder')}
                                />
                            </div>
                            <button type="submit" className="w-full py-5 bg-sky-500 dark:bg-sky-600 text-white rounded-[1rem] font-black shadow-xl hover:bg-sky-600 dark:hover:bg-sky-500 transition-all focus:ring-4 focus:ring-sky-200 outline-none">
                                {editingDestId ? t('save') : t('add_to_wishlist_btn')}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Vacations;
