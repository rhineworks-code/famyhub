import React from 'react';
import api from '../services/api';
import { format, addDays, startOfToday, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, startOfDay } from 'date-fns';
import { getAppTime } from '../utils/time';
import { de, enUS } from 'date-fns/locale';
import { useTranslation } from '../i18n.jsx';

const Calendar = ({ user }) => {
    const { t, language } = useTranslation();
    const dateLocale = language === 'de' ? de : enUS;
const [events, setEvents] = React.useState([]);
    const [selectedDate, setSelectedDate] = React.useState(startOfDay(getAppTime(user)));
    const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = React.useState(false);
    const [isEditMode, setIsEditMode] = React.useState(false);
    const [selectedEvent, setSelectedEvent] = React.useState(null);
    const [newEvent, setNewEvent] = React.useState({
        title: '', start: '', end: '', allDay: false, color: '#3788d8', description: '', location: '', image_url: '', 
        external_uid: null, external_calendar_id: null, is_external: 0,
        event_type: 'normal', recurrence_pattern: 'none'
    });
    const [isTypeSelectModalOpen, setIsTypeSelectModalOpen] = React.useState(false);

    const [viewMode, setViewMode] = React.useState('agenda'); // agenda, week, month
    const [searchQuery, setSearchQuery] = React.useState('');
    const [isSearchOpen, setIsSearchOpen] = React.useState(false);
    const [isFilterModalOpen, setIsFilterModalOpen] = React.useState(false);
    const [selectedColorFilter, setSelectedColorFilter] = React.useState('');

    // External Calendars
    const [isSyncModalOpen, setIsSyncModalOpen] = React.useState(false);
    const [externalSources, setExternalSources] = React.useState([]);
    const [newExternalSource, setNewExternalSource] = React.useState({ name: '', url: '', color: '#3788d8', user_id: '' });

    const [familyMembers, setFamilyMembers] = React.useState([]);

    const days = Array.from({ length: 14 }).map((_, i) => addDays(startOfDay(getAppTime(user)), i));

    React.useEffect(() => {
        fetchEvents();
        fetchExternalSources();
        fetchFamilyMembers();
    }, []);

    const fetchEvents = async () => {
        try {
            const res = await api.get('/calendar');
            setEvents(res.data.map(e => ({ ...e, start: new Date(e.start), end: e.end ? new Date(e.end) : null })));
        } catch (error) { console.error(error); }
    };

    // Opens the edit form. For an occurrence of a recurring series the *series* is edited,
    // so the original start date is used (otherwise saving would move the whole series).
    const handleEditFromInstance = (event) => {
        const start = event.is_instance && event.series_start ? event.series_start : event.start;
        const end = event.is_instance ? event.series_end : event.end;
        setSelectedEvent(event);
        setIsDetailModalOpen(false);
        setIsEditMode(true);
        setNewEvent({
            title: event.title,
            start: format(new Date(start), "yyyy-MM-dd'T'HH:mm"),
            end: end ? format(new Date(end), "yyyy-MM-dd'T'HH:mm") : '',
            allDay: !!event.allDay,
            color: event.color,
            description: event.description || '',
            location: event.location || '',
            image_url: event.image_url || '',
            user_id: event.user_id || '',
            external_uid: event.external_uid || null,
            external_calendar_id: event.external_calendar_id || null,
            is_external: event.is_external || 0,
            event_type: event.event_type || 'normal',
            recurrence_pattern: event.recurrence_pattern || 'none',
            id: event.real_id || event.id // Use real_id for the PUT request
        });
        setIsAddModalOpen(true);
    };

    const fetchExternalSources = async () => {
        try {
            const res = await api.get('/calendar/external');
            setExternalSources(res.data);
        } catch (error) { console.error(error); }
    };
    
    const fetchFamilyMembers = async () => {
        try {
            const res = await api.get('/auth/family/members');
            setFamilyMembers(res.data);
        } catch (error) { console.error(error); }
    };

    const handleAddExternalSource = async (e) => {
        e.preventDefault();
        try {
            await api.post('/calendar/external', newExternalSource);
            fetchExternalSources();
            fetchEvents();
            setNewExternalSource({ name: '', url: '', color: '#3788d8', user_id: '' });
        } catch (error) { console.error('Error adding external source:', error); }
    };

    const handleDeleteExternalSource = async (id) => {
        if (!window.confirm(t('confirm_delete_calendar'))) return;
        try {
            await api.delete(`/calendar/external/${id}`);
            fetchExternalSources();
            fetchEvents();
        } catch (error) { console.error('Error deleting external source:', error); }
    };

    const handleAddEvent = async (e) => {
        e.preventDefault();
        try {
            const eventToSave = {
                ...newEvent,
                start: new Date(newEvent.start).toISOString(),
                end: newEvent.end ? new Date(newEvent.end).toISOString() : null
            };
            await api.post('/calendar', eventToSave);
            fetchEvents();
            setIsAddModalOpen(false);
            setNewEvent({ title: '', start: '', end: '', allDay: false, color: '#3788d8', description: '', location: '', image_url: '', user_id: '', external_uid: null, external_calendar_id: null, is_external: 0 });
        } catch (error) {
            console.error('Error adding event:', error);
        }
    };

    const handleUpdateEvent = async (e) => {
        e.preventDefault();
        try {
            const eventToSave = {
                ...newEvent,
                start: new Date(newEvent.start).toISOString(),
                end: newEvent.end ? new Date(newEvent.end).toISOString() : null
            };
            await api.put(`/calendar/${newEvent.id}`, eventToSave); // Use newEvent.id which we set in handleEditFromInstance
            fetchEvents();
            setIsAddModalOpen(false);
            setIsDetailModalOpen(false);
            setIsEditMode(false);
            setNewEvent({ title: '', start: '', end: '', allDay: false, color: '#3788d8', description: '', location: '', image_url: '', user_id: '', external_uid: null, external_calendar_id: null, is_external: 0, event_type: 'normal', recurrence_pattern: 'none' });
        } catch (error) {
            console.error('Error updating event:', error);
        }
    };

    const handleDeleteEvent = async (id) => {
        const deleteId = selectedEvent.real_id || id;
        if (!window.confirm(t('confirm_delete_event'))) return;
        try {
            await api.delete(`/calendar/${deleteId}`);
            fetchEvents();
            setIsDetailModalOpen(false);
        } catch (error) {
            console.error('Error deleting event:', error);
        }
    };

    const filteredEvents = events.filter(e => {
        if (searchQuery && !e.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        if (selectedColorFilter && e.color !== selectedColorFilter) return false;
        return true;
    });

    const dailyEvents = filteredEvents.filter(e => isSameDay(new Date(e.start), selectedDate))
        .sort((a, b) => new Date(a.start) - new Date(b.start));

    // View Computations
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const monthDays = eachDayOfInterval({ start: startDate, end: endDate });

    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return (
        <div className="flex flex-col h-full bg-transparent font-outfit transition-colors duration-500">
            {/* Header Area */}
            <div className="p-6 pb-2">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight transition-colors">
                        {format(selectedDate, 'MMMM yyyy', { locale: dateLocale })}
                    </h2>
                    <div className="flex gap-2">
                        <button onClick={() => setIsSearchOpen(!isSearchOpen)} className={`w-10 h-10 rounded-xl shadow-sm border flex items-center justify-center transition-all ${isSearchOpen ? 'bg-brand-dark text-white border-brand-dark' : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-100 dark:border-white/10'}`}>
                            <i className="ri-search-line"></i>
                        </button>
                        <button onClick={() => setIsSyncModalOpen(true)} className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-black/[0.06] dark:border-white/10 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-brand-dark dark:hover:text-white transition-colors">
                            <i className="ri-settings-4-line"></i>
                        </button>
                    </div>
                </div>

                {isSearchOpen && (
                    <div className="mb-6 animate-in slide-in-from-top-2">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder={t('search_placeholder')}
                            className="w-full bg-white dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 shadow-sm rounded-lg px-4 py-3 font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-light/50 transition-colors"
                        />
                    </div>
                )}

                {/* Horizontal Date Scroller (Only for Agenda) */}
                {viewMode === 'agenda' && (
                    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-4 -mx-2 px-2">
                        {days.map((day, i) => {
                            const isSelected = isSameDay(day, selectedDate);
                            return (
                                <button
                                    key={i}
                                    onClick={() => setSelectedDate(day)}
                                    className={`flex flex-col items-center min-w-[3.5rem] py-4 rounded-lg transition-all duration-300 ${isSelected ? 'bg-brand-dark text-white shadow-lg scale-105' : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-black/[0.06] dark:border-white/10'
                                        }`}
                                >
                                    <span className="text-[10px] font-black uppercase tracking-widest mb-1">
                                        {format(day, 'EEEEEE', { locale: dateLocale })}
                                    </span>
                                    <span className="text-lg font-black">{format(day, 'd')}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Content Area Based on View Mode */}
            <div className="flex-1 overflow-y-auto px-6 pb-24 space-y-6">

                {viewMode === 'agenda' && (
                    <div className="space-y-8">
                        {/* Summary / All Day Section */}
                        <div className="flex items-center gap-2 py-4">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 dark:text-slate-600 uppercase tracking-widest">{t('today')} • {format(selectedDate, 'eeee, d. MMMM', { locale: dateLocale })}</span>
                            <div className="h-[1px] flex-1 bg-slate-50 dark:bg-slate-800"></div>
                        </div>

                        {familyMembers.length === 0 ? (
                            <div className="py-20 text-center text-slate-400 dark:text-slate-500 font-bold">{t('loading_members')}</div>
                        ) : (
                            <div className="space-y-10">
                                {familyMembers.map(member => {
                                    const memberEvents = dailyEvents.filter(e => e.user_id === member.id || (!e.user_id && !member.id)); // handle legacy/null
                                    
                                    // Also include "Shared" events in every lane or a separate lane?
                                    // User said "Max, Maxine, Maxi untereinander". Let's do a lane per member.
                                    
                                    return (
                                        <div key={member.id} className="animate-in fade-in slide-in-from-left-4 duration-500">
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="w-12 h-12 rounded-lg bg-brand-light/10 dark:bg-brand-light/20 flex items-center justify-center text-brand-dark dark:text-brand-light font-black text-xl shadow-sm border border-brand-light/20 dark:border-brand-light/30 transition-colors">
                                                    {member.username.charAt(0)}
                                                </div>
                                                <div>
                                                    <h3 className="font-black text-slate-800 dark:text-slate-100 text-xl tracking-tight transition-colors">{member.username}</h3>
                                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{memberEvents.length} {t('appointments_label')}</p>
                                                </div>
                                            </div>

                                            <div className="space-y-4 pl-4 border-l-2 border-slate-50 dark:border-slate-800 ml-6">
                                                {memberEvents.length === 0 ? (
                                                    <p className="text-sm text-slate-300 dark:text-slate-600 font-bold italic py-2">{t('no_events_msg')}</p>
                                                ) : (
                                                    memberEvents.map(event => (
                                                        <div
                                                            key={event.id}
                                                            onClick={() => { setSelectedEvent(event); setIsDetailModalOpen(true); }}
                                                            className="flex group cursor-pointer animate-in fade-in zoom-in-95 duration-300"
                                                        >
                                                            <div className="w-16 pt-1 shrink-0">
                                                                <span className="text-xs font-black text-slate-800 dark:text-slate-100">{format(new Date(event.start), 'HH:mm')}</span>
                                                            </div>
                                                            <div className="flex-1 relative pl-4">
                                                                <div
                                                                    className="absolute left-0 top-0 bottom-0 w-1 rounded-full"
                                                                    style={{ backgroundColor: event.color || '#3788d8' }}
                                                                ></div>
                                                                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-black/[0.06] dark:border-white/10 group-hover:shadow-md transition-all">
                                                                    <div className="flex justify-between items-start gap-2">
                                                                        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                                                                            {event.event_type === 'birthday' && <span>🎂</span>}
                                                                            {event.recurrence_pattern !== 'none' && <span>🔄</span>}
                                                                            {event.title}
                                                                        </h4>
                                                                        {event.is_external === 1 && (
                                                                            <span className="shrink-0 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-500 text-[8px] font-black uppercase tracking-widest border border-slate-200 dark:border-white/10">{t('external')}</span>
                                                                        )}
                                                                    </div>
                                                                    {event.location && (
                                                                        <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-[9px] font-bold uppercase tracking-widest mt-1">
                                                                            <i className="ri-map-pin-2-fill text-brand-light"></i>
                                                                            {event.location}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Shared / Unassigned Events Section */}
                                {dailyEvents.filter(e => !e.user_id).length > 0 && (
                                    <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 font-black text-xl transition-colors">
                                                <i className="ri-group-line"></i>
                                            </div>
                                            <div>
                                                <h3 className="font-black text-slate-800 dark:text-slate-100 text-xl tracking-tight transition-colors">{t('shared_all')}</h3>
                                            </div>
                                        </div>
                                        <div className="space-y-4 pl-4 border-l-2 border-slate-50 dark:border-slate-800 ml-6">
                                            {dailyEvents.filter(e => !e.user_id).map(event => (
                                                <div
                                                    key={event.id}
                                                    onClick={() => { setSelectedEvent(event); setIsDetailModalOpen(true); }}
                                                    className="flex group cursor-pointer"
                                                >
                                                    <div className="w-16 pt-1 shrink-0">
                                                        <span className="text-xs font-black text-slate-800 dark:text-slate-100">{format(new Date(event.start), 'HH:mm')}</span>
                                                    </div>
                                                    <div className="flex-1 relative pl-4">
                                                        <div
                                                            className="absolute left-0 top-0 bottom-0 w-1 rounded-full"
                                                            style={{ backgroundColor: event.color || '#3788d8' }}
                                                        ></div>
                                                        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-black/[0.06] dark:border-white/10 group-hover:shadow-md transition-all">
                                                            <div className="flex justify-between items-start gap-2">
                                                                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{event.title}</h4>
                                                                {event.is_external === 1 && (
                                                                    <span className="shrink-0 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-500 text-[8px] font-black uppercase tracking-widest border border-slate-200 dark:border-white/10">{t('external')}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {viewMode === 'week' && (
                    <div className="overflow-x-auto no-scrollbar pb-4 -mx-6 px-6">
                        <div className="grid grid-cols-7 gap-2 min-w-[700px]">
                            {weekDays.map(day => (
                                <div key={day.toISOString()} className="flex flex-col items-center">
                                    <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-widest transition-colors">{format(day, 'EEEEEE', { locale: dateLocale })}</div>
                                    <div className={`w-9 h-9 flex items-center justify-center rounded-lg font-black text-sm mb-4 transition-all ${isSameDay(day, startOfToday()) ? 'bg-brand-dark text-white shadow-lg' : isSameDay(day, selectedDate) ? 'bg-brand-light/20 dark:bg-brand-light/30 text-brand-dark dark:text-brand-light' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-black/[0.06] dark:border-white/10'}`}>{format(day, 'd')}</div>
                                    <div className="w-full space-y-2">
                                        {filteredEvents.filter(e => isSameDay(new Date(e.start), day)).map(e => (
                                            <div
                                                key={e.id}
                                                onClick={() => { setSelectedEvent(e); setIsDetailModalOpen(true); }}
                                                className="relative p-2 rounded-xl text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 shadow-sm cursor-pointer hover:shadow-md transition-all overflow-hidden"
                                            >
                                                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: e.color || '#3788d8' }}></div>
                                                <div className="truncate">{e.title}</div>
                                                {/* Initial of user if assigned */}
                                                {e.user_id && (
                                                    <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-md bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-[7px] font-black border border-black/[0.06] dark:border-white/10 transition-colors uppercase">
                                                        {familyMembers.find(m => m.id === e.user_id)?.username.charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {viewMode === 'month' && (
                    <div className="grid grid-cols-7 gap-1">
                        {[t('mon_short'), t('tue_short'), t('wed_short'), t('thu_short'), t('fri_short'), t('sat_short'), t('sun_short')].map(d => <div key={d} className="text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 py-2 transition-colors">{d}</div>)}
                        {monthDays.map((day, i) => (
                            <div key={i} onClick={() => { setSelectedDate(day); setViewMode('agenda'); }} className={`aspect-square flex flex-col items-center p-1 rounded-xl text-sm font-bold cursor-pointer transition-colors ${!isSameMonth(day, monthStart) ? 'text-slate-200 dark:text-slate-800' : isSameDay(day, startOfToday()) ? 'bg-brand-dark text-white shadow-lg' : isSameDay(day, selectedDate) ? 'bg-brand-light/20 dark:bg-brand-light/30 text-brand-dark dark:text-brand-light' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent hover:border-slate-100 dark:hover:border-slate-700'}`}>
                                <span>{format(day, 'd')}</span>
                                <div className="flex gap-0.5 mt-1 flex-wrap justify-center w-full">
                                    {filteredEvents.filter(e => isSameDay(new Date(e.start), day)).slice(0, 3).map((e, idx) => <span key={idx} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: e.color || '#3788d8' }}></span>)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Bottom Floating Nav */}
            <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] md:bottom-6 md:left-[calc(50%+9rem)] left-1/2 -translate-x-1/2 z-40 flex items-center justify-between w-[90%] max-w-sm bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl p-2 px-4 rounded-[1.25rem] shadow-2xl border border-black/[0.06] dark:border-white/10 z-50 transition-colors duration-500">

                <button
                    onClick={() => setViewMode(v => v === 'agenda' ? 'week' : v === 'week' ? 'month' : 'agenda')}
                    className="flex flex-col items-center gap-1 w-14"
                >
                    <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 flex items-center justify-center text-xl transition-colors hover:bg-slate-100 dark:hover:bg-slate-700">
                        <i className={viewMode === 'agenda' ? 'ri-list-check' : viewMode === 'week' ? 'ri-layout-column-line' : 'ri-grid-fill'}></i>
                    </div>
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{viewMode === 'agenda' ? t('agenda') : viewMode === 'week' ? t('week') : t('month')}</span>
                </button>

                <button
                    onClick={() => { setSelectedDate(startOfToday()); setViewMode('agenda'); }}
                    className="flex flex-col items-center gap-1 w-14"
                >
                    <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 flex items-center justify-center text-xl transition-colors hover:bg-slate-100 dark:hover:bg-slate-700">
                        <i className="ri-calendar-check-line"></i>
                    </div>
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('today')}</span>
                </button>

                <div className="flex flex-col items-center px-2 -mt-6">
                    <button
                        onClick={() => {
                            setIsTypeSelectModalOpen(true);
                        }}
                        className="w-16 h-16 rounded-full bg-brand-dark text-white flex items-center justify-center text-3xl shadow-xl hover:scale-105 transition-all"
                    >
                        <i className="ri-add-line"></i>
                    </button>
                    <span className="text-[9px] font-black text-brand-dark uppercase tracking-widest mt-2">{t('add_btn')}</span>
                </div>

                <button
                    onClick={() => setIsFilterModalOpen(true)}
                    className="flex flex-col items-center gap-1 w-14"
                >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl transition-all ${selectedColorFilter ? 'bg-brand-dark text-white shadow-md' : 'bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                        <i className="ri-filter-2-line"></i>
                    </div>
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('filter')}</span>
                </button>
            </div>

            {/* Quick Add/Edit Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[1.25rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10 max-h-[90vh] overflow-y-auto border border-white/10 transition-colors">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">{isEditMode ? t('edit_event') : t('new_event')}</h3>
                            <button
                                onClick={() => {
                                    setIsAddModalOpen(false);
                                    setIsEditMode(false);
                                }}
                                className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                                <i className="ri-close-line text-xl"></i>
                            </button>
                        </div>

                        <form onSubmit={isEditMode ? handleUpdateEvent : handleAddEvent} className="space-y-4 font-outfit">
                            {/* Event Type Display (readonly in edit) */}
                            {newEvent.event_type !== 'normal' && (
                                <div className="bg-brand-light/10 dark:bg-brand-light/20 p-3 rounded-xl border border-brand-light/30 flex items-center justify-between">
                                    <span className="text-xs font-black uppercase tracking-widest text-brand-dark dark:text-brand-light">
                                        {newEvent.event_type === 'birthday' ? `🎂 ${t('birthday') || 'Geburtstag'}` : `🔄 ${t('recurring_event') || 'Serientermin'}`}
                                    </span>
                                    <button type="button" onClick={() => setIsTypeSelectModalOpen(true)} className="text-[10px] font-black uppercase text-brand-dark/50 dark:text-brand-light/50 hover:text-brand-dark underline">{t('change_type') || 'Ändern'}</button>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">{newEvent.event_type === 'birthday' ? (t('birthday_child_name') || 'Name des Geburtstagskindes') : t('title_label')}</label>
                                <input
                                    type="text"
                                    required
                                    value={newEvent.title}
                                    onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-transparent dark:border-white/10 rounded-lg px-4 py-3 placeholder:text-slate-400 dark:placeholder:text-slate-600 font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-light/50 transition-colors"
                                    placeholder={t('event_placeholder_eg')}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">{newEvent.event_type === 'birthday' ? (t('birthday_date') || 'Datum') : t('start_label')}</label>
                                    <input
                                        type={newEvent.event_type === 'birthday' ? 'date' : 'datetime-local'}
                                        required
                                        value={newEvent.event_type === 'birthday' ? newEvent.start.split('T')[0] : newEvent.start}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setNewEvent({ ...newEvent, start: newEvent.event_type === 'birthday' ? `${val}T00:00` : val });
                                        }}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-transparent dark:border-white/10 rounded-lg px-4 py-3 font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-light/50 transition-colors"
                                    />
                                </div>
                                {newEvent.event_type !== 'birthday' && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">{t('end_label')}</label>
                                        <input
                                            type="datetime-local"
                                            value={newEvent.end || ''}
                                            onChange={e => setNewEvent({ ...newEvent, end: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-900 border border-transparent dark:border-white/10 rounded-lg px-4 py-3 font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-light/50 transition-colors"
                                        />
                                    </div>
                                )}
                            </div>

                            {newEvent.event_type !== 'birthday' && (
                                <div className="flex items-center gap-3 py-2">
                                    <input
                                        type="checkbox"
                                        id="allDay"
                                        checked={newEvent.allDay}
                                        onChange={e => setNewEvent({ ...newEvent, allDay: e.target.checked })}
                                        className="w-5 h-5 rounded-lg text-brand-dark focus:ring-brand-light bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-white/10"
                                    />
                                    <label htmlFor="allDay" className="font-bold text-slate-600 dark:text-slate-400">{t('all_day_label')}</label>
                                </div>
                            )}

                            {newEvent.event_type === 'recurring' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">{t('recurrence_pattern') || 'Wiederholung'}</label>
                                    <select
                                        value={newEvent.recurrence_pattern}
                                        onChange={e => setNewEvent({ ...newEvent, recurrence_pattern: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-transparent dark:border-white/10 rounded-lg px-4 py-3 font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-light/50 appearance-none transition-colors"
                                    >
                                        <option value="none">Keine</option>
                                        <option value="weekly">Wöchentlich</option>
                                        <option value="monthly">Monatlich</option>
                                        <option value="yearly">Jährlich</option>
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">{t('location_label')}</label>
                                <input
                                    type="text"
                                    value={newEvent.location || ''}
                                    onChange={e => setNewEvent({ ...newEvent, location: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-transparent dark:border-white/10 rounded-lg px-4 py-3 placeholder:text-slate-400 dark:placeholder:text-slate-600 font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-light/50 transition-colors"
                                    placeholder={t('location_placeholder_eg')}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">{t('image_url_label')}</label>
                                <input
                                    type="url"
                                    value={newEvent.image_url || ''}
                                    onChange={e => setNewEvent({ ...newEvent, image_url: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-transparent dark:border-white/10 rounded-lg px-4 py-3 placeholder:text-slate-400 dark:placeholder:text-slate-600 font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-light/50 transition-colors"
                                    placeholder="https://"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">{t('family_member_label')}</label>
                                <select
                                    value={newEvent.user_id || ''}
                                    onChange={e => setNewEvent({ ...newEvent, user_id: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-transparent dark:border-white/10 rounded-lg px-4 py-3 font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-light/50 appearance-none transition-colors"
                                >
                                    <option value="">({t('shared_all')})</option>
                                    {familyMembers.map(member => (
                                        <option key={member.id} value={member.id}>{member.username}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">{t('color_label')}</label>
                                <div className="flex gap-2">
                                    {['#3788d8', '#f87171', '#4ade80', '#fbbf24', '#c084fc'].map(color => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setNewEvent({ ...newEvent, color })}
                                            className={`w-10 h-10 rounded-full transition-transform ${newEvent.color === color ? 'scale-110 ring-4 ring-offset-2 ring-slate-200 dark:ring-slate-700' : ''}`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">{t('notes_label')}</label>
                                <textarea
                                    value={newEvent.description || ''}
                                    onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-transparent dark:border-white/10 rounded-lg px-4 py-3 placeholder:text-slate-400 dark:placeholder:text-slate-600 font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-light/50 h-24 resize-none transition-colors"
                                    placeholder="..."
                                ></textarea>
                            </div>

                            <button
                                type="submit"
                                className="w-full py-4 bg-brand-dark text-white rounded-lg font-black text-lg hover:bg-opacity-90 transition-all shadow-lg mt-4"
                            >
                                {isEditMode ? t('save_event_btn') : t('add_event_btn')}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Event Detail Modal */}
            {isDetailModalOpen && selectedEvent && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[1.25rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 border border-white/10 transition-colors">
                        {selectedEvent.image_url && (
                            <img src={selectedEvent.image_url} alt="" className="w-full h-48 object-cover" />
                        )}
                        <div className="p-6 relative">
                            <button
                                onClick={() => setIsDetailModalOpen(false)}
                                className="absolute top-6 right-6 w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                                <i className="ri-close-line text-xl"></i>
                            </button>

                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: selectedEvent.color || '#3788d8' }}></div>
                                <span className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                    {selectedEvent.allDay ? t('all_day_label') : `${format(selectedEvent.start, 'HH:mm')}${selectedEvent.end ? ' - ' + format(selectedEvent.end, 'HH:mm') : ''}`}
                                </span>
                            </div>

                            <div className="flex items-center justify-between mb-6 pr-12">
                                <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100">{selectedEvent.title}</h3>
                                {selectedEvent.is_external === 1 && (
                                    <div className="flex flex-col items-end">
                                        <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-white/10">{t('external')}</span>
                                        {selectedEvent.external_name && (
                                            <span className="text-[9px] font-bold text-slate-300 dark:text-slate-600 mt-1">{selectedEvent.external_name}</span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {selectedEvent.location && (
                                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400 font-bold mb-4">
                                    <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-brand-light">
                                        <i className="ri-map-pin-line text-xl"></i>
                                    </div>
                                    <span>{selectedEvent.location}</span>
                                </div>
                            )}

                            {selectedEvent.description && (
                                <div className="flex gap-3 text-slate-600 dark:text-slate-400 mb-8">
                                    <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-brand-light shrink-0">
                                        <i className="ri-align-left text-xl"></i>
                                    </div>
                                    <p className="pt-2">{selectedEvent.description}</p>
                                </div>
                            )}

                            <div className="flex gap-3 mt-8">
                                <button
                                    onClick={() => handleEditFromInstance(selectedEvent)}
                                    className="flex-1 py-4 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 rounded-lg font-black hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                                >
                                    {t('edit_event_btn')}
                                </button>
                                <button
                                    onClick={() => handleDeleteEvent(selectedEvent.id)}
                                    className="flex-1 py-4 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-lg font-black hover:bg-red-100 dark:hover:bg-red-900/40 transition-all font-outfit"
                                >
                                    {t('delete_event_btn')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Type Selection Modal */}
            {isTypeSelectModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[1.25rem] p-6 shadow-2xl animate-in zoom-in-95 border border-white/10">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">{t('select_event_type') || 'Typ auswählen'}</h3>
                            <button onClick={() => setIsTypeSelectModalOpen(false)} className="text-slate-400"><i className="ri-close-line text-2xl"></i></button>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            <button
                                onClick={() => {
                                    setIsTypeSelectModalOpen(false);
                                    setIsEditMode(false);
                                    setNewEvent({ title: '', start: format(selectedDate, "yyyy-MM-dd'T'12:00"), end: format(selectedDate, "yyyy-MM-dd'T'13:00"), allDay: false, color: '#3788d8', description: '', location: '', image_url: '', external_uid: null, external_calendar_id: null, is_external: 0, event_type: 'normal', recurrence_pattern: 'none' });
                                    setIsAddModalOpen(true);
                                }}
                                className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 hover:bg-brand-light/10 transition-all border border-transparent hover:border-brand-light"
                            >
                                <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-xl"><i className="ri-calendar-event-line"></i></div>
                                <div className="text-left font-black text-slate-700 dark:text-slate-200">{t('normal_event') || 'Normaler Termin'}</div>
                            </button>
                            <button
                                onClick={() => {
                                    setIsTypeSelectModalOpen(false);
                                    setIsEditMode(false);
                                    setNewEvent({ title: '', start: format(selectedDate, "yyyy-MM-dd'T'12:00"), end: format(selectedDate, "yyyy-MM-dd'T'13:00"), allDay: false, color: '#fbbf24', description: '', location: '', image_url: '', external_uid: null, external_calendar_id: null, is_external: 0, event_type: 'recurring', recurrence_pattern: 'weekly' });
                                    setIsAddModalOpen(true);
                                }}
                                className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 hover:bg-brand-light/10 transition-all border border-transparent hover:border-brand-light"
                            >
                                <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center text-xl"><i className="ri-refresh-line"></i></div>
                                <div className="text-left font-black text-slate-700 dark:text-slate-200">{t('recurring_event') || 'Serientermin'}</div>
                            </button>
                            <button
                                onClick={() => {
                                    setIsTypeSelectModalOpen(false);
                                    setIsEditMode(false);
                                    setNewEvent({ title: '', start: format(selectedDate, "yyyy-MM-dd'T'00:00"), end: '', allDay: true, color: '#f87171', description: '', location: '', image_url: '', external_uid: null, external_calendar_id: null, is_external: 0, event_type: 'birthday', recurrence_pattern: 'yearly' });
                                    setIsAddModalOpen(true);
                                }}
                                className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 hover:bg-brand-light/10 transition-all border border-transparent hover:border-brand-light"
                            >
                                <div className="w-10 h-10 rounded-lg bg-pink-100 text-pink-600 flex items-center justify-center text-xl">🎂</div>
                                <div className="text-left font-black text-slate-700 dark:text-slate-200">{t('birthday') || 'Geburtstag'}</div>
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Filter Modal */}
            {isFilterModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[1.25rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10 border border-white/10">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">{t('filter')}</h3>
                            <button
                                onClick={() => setIsFilterModalOpen(false)}
                                className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                                <i className="ri-close-line text-xl"></i>
                            </button>
                        </div>
                        <div className="space-y-4 mb-6">
                            <button
                                onClick={() => { setSelectedColorFilter(''); setIsFilterModalOpen(false); }}
                                className={`w-full py-3 rounded-xl font-bold transition-all ${!selectedColorFilter ? 'bg-brand-dark text-white shadow-md' : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                            >
                                {t('shared_all')}
                            </button>
                            {['#3788d8', '#f87171', '#4ade80', '#fbbf24', '#c084fc', '#94a3b8'].map(color => (
                                <button
                                    key={color}
                                    onClick={() => { setSelectedColorFilter(color); setIsFilterModalOpen(false); }}
                                    className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-5 h-5 rounded-full shadow-sm" style={{ backgroundColor: color }}></div>
                                        <span className="font-bold text-slate-600 dark:text-slate-400">
                                            {color === '#3788d8' ? t('blue') : color === '#f87171' ? t('red') : color === '#4ade80' ? t('green') : color === '#fbbf24' ? t('yellow') : color === '#c084fc' ? t('purple') : t('gray_external')}
                                        </span>
                                    </div>
                                    {selectedColorFilter === color && <i className="ri-check-line text-brand-dark font-bold"></i>}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* External Calendar Sync Modal */}
            {isSyncModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[1.25rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10 max-h-[90vh] overflow-y-auto border border-white/10 transition-colors">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">{t('sync_label')}</h3>
                                <p className="text-sm font-bold text-slate-400 mt-1">{t('sync_description')}</p>
                            </div>
                            <button
                                onClick={() => setIsSyncModalOpen(false)}
                                className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                                <i className="ri-close-line text-xl"></i>
                            </button>
                        </div>

                        {/* Own calendar as iCal subscription (phone / Outlook / Google) */}
                        <IcalSubscription />

                        {/* List of existing external sources */}
                        <div className="space-y-3 mb-8">
                            {externalSources.length === 0 ? (
                                <p className="text-sm text-slate-400 dark:text-slate-500 font-bold text-center py-4 bg-slate-50 dark:bg-slate-900 rounded-lg transition-colors">{t('no_external_calendars')}</p>
                            ) : (
                                externalSources.map(source => (
                                    <div key={source.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-black/[0.06] dark:border-white/10 transition-colors">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-4 h-4 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: source.color || '#94a3b8' }}></div>
                                            <div className="truncate">
                                                <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{source.name}</p>
                                                <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{source.url}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => handleDeleteExternalSource(source.id)} className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/40 shrink-0 ml-2 transition-colors">
                                            <i className="ri-delete-bin-line"></i>
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Add new external source form */}
                        <div className="border-t border-slate-100 dark:border-white/10 pt-6">
                            <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest mb-4">{t('add_external_calendar_header')}</h4>
                            <form onSubmit={handleAddExternalSource} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">{t('external_name_label')}</label>
                                    <input
                                        type="text"
                                        required
                                        value={newExternalSource.name}
                                        onChange={e => setNewExternalSource({ ...newExternalSource, name: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-black/[0.06] dark:border-white/10 rounded-lg px-4 py-3 font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-light/50 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">{t('ical_url_label')}</label>
                                    <input
                                        type="url"
                                        required
                                        value={newExternalSource.url}
                                        onChange={e => setNewExternalSource({ ...newExternalSource, url: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-black/[0.06] dark:border-white/10 rounded-lg px-4 py-3 font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-light/50 transition-colors"
                                        placeholder="https://..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">{t('assign_to_label')}</label>
                                    <select
                                        value={newExternalSource.user_id || ''}
                                        onChange={e => setNewExternalSource({ ...newExternalSource, user_id: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-black/[0.06] dark:border-white/10 rounded-lg px-4 py-3 font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-light/50 transition-colors"
                                    >
                                        <option value="">{t('shared_all')}</option>
                                        {familyMembers.map(member => (
                                            <option key={member.id} value={member.id}>{member.username}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">{t('color_label')}</label>
                                    <div className="flex gap-2">
                                        {['#94a3b8', '#38bdf8', '#fb7185', '#a3e635'].map(color => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setNewExternalSource({ ...newExternalSource, color })}
                                                className={`w-10 h-10 rounded-full transition-transform border border-black/[0.06] dark:border-white/10 shadow-sm ${newExternalSource.color === color ? 'scale-110 ring-4 ring-offset-2 ring-slate-100 dark:ring-slate-700' : ''}`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    className="w-full py-4 bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-800 rounded-lg font-black hover:bg-slate-700 dark:hover:bg-white transition-all shadow-lg mt-2"
                                >
                                    {t('add_btn')}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


/** Shows the secret iCal link of the family calendar for phone/desktop calendar apps. */
const IcalSubscription = () => {
    const [url, setUrl] = React.useState('');
    const [copied, setCopied] = React.useState(false);

    const load = React.useCallback(async (regenerate = false) => {
        try {
            const res = regenerate ? await api.post('/sync/token/regenerate') : await api.get('/sync/token');
            setUrl(`${window.location.origin}/api/sync/export/${res.data.token}.ics`);
        } catch (err) { console.error('iCal token', err); }
    }, []);

    React.useEffect(() => { load(); }, [load]);

    const copy = async () => {
        try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { window.prompt('Link kopieren:', url); }
    };

    if (!url) return null;
    return (
        <div className="mb-8 p-4 rounded-lg bg-brand-light/5 dark:bg-slate-900 border border-brand-light/20 dark:border-white/10">
            <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Familienkalender abonnieren</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Diesen geheimen Link in Handy-, Outlook- oder Google-Kalender als Abo einfügen.</p>
            <div className="flex gap-2">
                <input readOnly value={url} onFocus={e => e.target.select()} className="flex-1 min-w-0 bg-white dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-slate-600 dark:text-slate-300" />
                <button type="button" onClick={copy} className="px-3 py-2 rounded-lg bg-brand-dark text-white text-xs font-black shrink-0">{copied ? '✓' : <i className="ri-file-copy-line"></i>}</button>
                <button type="button" title="Neuen Link erzeugen (alter Link wird ungültig)" onClick={() => { if (window.confirm('Neuen Link erzeugen? Der alte Link funktioniert danach nicht mehr.')) load(true); }} className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs shrink-0"><i className="ri-refresh-line"></i></button>
            </div>
        </div>
    );
};

export default Calendar;
