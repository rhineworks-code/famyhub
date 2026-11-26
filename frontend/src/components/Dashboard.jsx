import React from 'react';
import api from '../services/api';
import { Link } from 'react-router-dom';
import { getAppTime } from '../utils/time';
import ChatRoom from './ChatRoom';
import TimelineWidget from './TimelineWidget';
import FamilyStatus from './FamilyStatus';
import { useTranslation } from '../i18n.jsx';
import { Responsive, WidthProvider } from 'react-grid-layout';

const ResponsiveGridLayout = WidthProvider(Responsive);

// --- Widget Components ---

const MealWidget = ({ todayMeal }) => {
    const { t } = useTranslation();
    return (
        <Link to="/meals" className="bg-white dark:bg-slate-800 rounded-[1.25rem] p-5 flex flex-col justify-between min-h-[150px] h-full active:scale-[0.99] transition-transform">
            <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-[9px] bg-amber-500 text-white inline-flex items-center justify-center"><i className="ri-restaurant-2-fill"></i></span>
                <span className="text-[13px] font-semibold text-slate-500">{t('today_on_plan')}</span>
            </div>
            {todayMeal ? (
                <div>
                    <h3 className="text-[22px] font-bold leading-tight text-black dark:text-white">{todayMeal.recipe_name || todayMeal.meal_name}</h3>
                    <p className="text-[14px] text-slate-500 capitalize">{todayMeal.meal_type}</p>
                </div>
            ) : (
                <h3 className="text-[17px] font-semibold text-slate-400">{t('nothing_planned')}</h3>
            )}
        </Link>
    );
};

const ClockWidget = ({ user, widgetId, bgId = 1, onUpdateSettings }) => {
    const { t, language } = useTranslation();
    const [time, setTime] = React.useState(getAppTime(user));

    const backgrounds = {
        1: 'bg-brand-dark',
        2: 'bg-gradient-to-b from-[#3BA3E8] to-[#2B3E6A]',
        3: 'bg-slate-800',
        4: 'bg-emerald-600',
        5: 'bg-white/10 backdrop-blur-xl border border-white/20'
    };

    React.useEffect(() => {
        const timer = setInterval(() => setTime(getAppTime(user)), 1000);
        return () => clearInterval(timer);
    }, [user]);

    const handleNextBg = () => {
        const next = (bgId % 5) + 1;
        if (onUpdateSettings) onUpdateSettings(widgetId, { bgId: next });
    };

    return (
        <div className={`${backgrounds[bgId] || backgrounds[1]} rounded-[1.25rem] p-5 text-white flex flex-col h-full justify-between relative overflow-hidden group transition-all duration-500`}>
            <div className="absolute -top-6 -right-6 p-4 opacity-10 group-hover:opacity-20 transition-all rotate-12">
                <i className="ri-time-line text-9xl"></i>
            </div>
            
            <button 
                onClick={handleNextBg}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-20"
                title={t('clock_settings')}
            >
                <i className="ri-palette-line"></i>
            </button>

            <div className="relative z-10">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-2 block">{t('current_time')}</span>
                <h3 className="text-4xl font-mono font-black tracking-tighter leading-none mb-1">
                    {time.toLocaleTimeString(language === 'de' ? 'de-DE' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                    <span className="text-xl ml-1 opacity-50">{time.getSeconds().toString().padStart(2, '0')}</span>
                </h3>
            </div>
            <div className="relative z-10">
                <p className="text-xs font-bold text-white/80 uppercase tracking-widest">
                    {time.toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', { weekday: 'long', day: '2-digit', month: 'long' })}
                </p>
            </div>
        </div>
    );
};

const EventsWidget = ({ nextEvents }) => {
    const { t, language } = useTranslation();
    return (
        <div className="bg-white dark:bg-slate-800 rounded-[1.25rem] p-8 shadow-sm border border-black/[0.06] dark:border-white/10 flex-1 flex flex-col h-full transition-colors duration-500">
            <div className="flex items-center justify-between mb-8">
                <h3 className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-900/30 text-orange-500 dark:text-orange-400 flex items-center justify-center">
                        <i className="ri-calendar-event-line"></i>
                    </div>
                    {t('appointments')}
                </h3>
                <Link to="/calendar" className="text-[10px] font-black uppercase tracking-widest text-brand-light dark:text-brand-light hover:text-brand-dark dark:hover:text-white transition-colors">{t('view_all')}</Link>
            </div>
            <div className="space-y-6 flex-1">
                {nextEvents.length === 0 ? (
                    <p className="text-slate-400 dark:text-slate-500 text-sm font-bold text-center py-6 italic">{t('no_appointments')}</p>
                ) : (
                    nextEvents.map((ev, i) => (
                        <div key={i} className="flex gap-4 items-center animate-in slide-in-from-bottom-2">
                            <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 shrink-0 font-black border border-black/[0.06] dark:border-white/10 shadow-sm transition-colors">
                                <span className="text-[10px] uppercase leading-none mb-0.5">{ev.start.toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', { month: 'short' })}</span>
                                <span className="text-lg leading-none">{ev.start.getDate()}</span>
                            </div>
                            <div className="min-w-0">
                                <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate leading-tight">{ev.title}</h4>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-wider mt-0.5">
                                    {ev.allDay ? t('all_day') : ev.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + t('clock')}
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const WeatherWidget = ({ widgetId, zip, country = 'DE', days = 1, onUpdateSettings, user }) => {
    const [weather, setWeather] = React.useState(null);
    const [forecast, setForecast] = React.useState(null);
    const [isEditing, setIsEditing] = React.useState(false);
    const [locationInput, setLocationInput] = React.useState(zip || '10115');
    const [countryInput, setCountryInput] = React.useState(country);
    const [daysInput, setDaysInput] = React.useState(days);
    const [locationName, setLocationName] = React.useState('Berlin');

    const { t, language } = useTranslation();

    React.useEffect(() => {
        const fetchWeather = async () => {
            try {
                const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationInput)}&count=10&language=${language}`);
                const geoData = await geoRes.json();

                if (geoData.results && geoData.results.length > 0) {
                    let loc = geoData.results[0];
                    if (countryInput) {
                        const matchedLoc = geoData.results.find(r => r.country_code?.toUpperCase() === countryInput.toUpperCase());
                        if (matchedLoc) loc = matchedLoc;
                    }
                    setLocationName(loc.name);

                    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`;
                    const weatherRes = await fetch(url);
                    const data = await weatherRes.json();

                    setWeather(data.current_weather);
                    if (data.daily) {
                        const daysData = [];
                        const count = Math.min(data.daily.time.length, 3);
                        for (let i = 0; i < count; i++) {
                            daysData.push({
                                date: data.daily.time[i],
                                code: data.daily.weathercode[i],
                                max: data.daily.temperature_2m_max[i],
                                min: data.daily.temperature_2m_min[i]
                            });
                        }
                        setForecast(daysData);
                    }
                }
            } catch (e) { console.error('Weather error:', e); }
        };
        fetchWeather();
    }, [locationInput, countryInput, language]);

    const handleSave = (e) => {
        e.preventDefault();
        setIsEditing(false);
        if (onUpdateSettings) onUpdateSettings(widgetId, { zip: locationInput, country: countryInput, days: daysInput });
    };

    const getWeatherIcon = (code) => {
        if (code <= 3) return 'ri-sun-cloudy-line text-amber-300';
        if (code <= 67) return 'ri-rainy-line text-blue-200';
        if (code <= 79) return 'ri-snowy-line text-white';
        return 'ri-thunderstorms-line text-indigo-200';
    };

    const formatDay = (dateStr) => {
        const d = new Date(dateStr);
        const today = getAppTime(user);
        if (d.toDateString() === today.toDateString()) return t('today');
        return d.toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', { weekday: 'short' });
    };

    return (
        <div className="bg-gradient-to-b from-[#3BA3E8] to-[#2B3E6A] rounded-[1.25rem] p-5 text-white transition-all h-full flex flex-col justify-between relative overflow-hidden group border border-white/20">
            {/* Glass Background Elements */}
            
            
            <div className="flex justify-between items-start relative z-10">
                <span className="text-[10px] font-black uppercase tracking-widest text-white block bg-white/20 backdrop-blur-sm px-2 py-1 rounded-lg">
                    {days === 3 ? t('three_day_forecast') : t('weather')}
                </span>
                <button onClick={() => setIsEditing(!isEditing)} className="text-white/70 hover:text-white transition-colors bg-white/10 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm"><i className="ri-settings-4-line"></i></button>
            </div>

            {isEditing ? (
                <form onSubmit={handleSave} className="flex flex-col gap-2 mt-4 relative z-10 animate-in fade-in zoom-in-95 duration-200">
                    <div className="grid grid-cols-3 gap-2">
                        <input
                            type="text"
                            value={locationInput}
                            onChange={e => setLocationInput(e.target.value)}
                            className="col-span-2 bg-white/20 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-white/50 outline-none focus:bg-white/30"
                        />
                        <input
                            type="text"
                            value={countryInput}
                            onChange={e => setCountryInput(e.target.value.toUpperCase())}
                            className="bg-white/20 border border-white/20 rounded-xl px-3 py-2 text-xs text-white text-center outline-none focus:bg-white/30 uppercase"
                        />
                    </div>
                    <button type="submit" className="w-full bg-white text-purple-600 font-black py-2 rounded-xl shadow-lg hover:bg-purple-50 transition-colors text-xs uppercase tracking-wider">{t('save_btn')}</button>
                </form>
            ) : (
                <div className="flex-1 flex flex-col justify-center relative z-10">
                    {days === 3 && forecast ? (
                        <div className="grid grid-cols-3 gap-2 mt-2">
                            {forecast.map((f, i) => (
                                <div key={i} className="flex flex-col items-center bg-white/10 rounded-2xl p-3 backdrop-blur-sm border border-white/10 hover:bg-white/20 transition-colors">
                                    <span className="text-[9px] font-black uppercase text-white/70 mb-1">{formatDay(f.date)}</span>
                                    <i className={`${getWeatherIcon(f.code)} text-2xl mb-1`}></i>
                                    <span className="text-sm font-black">{Math.round(f.max)}°</span>
                                </div>
                            ))}
                        </div>
                    ) : weather ? (
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-5xl font-black mb-1 drop-shadow-lg">{Math.round(weather.temperature)}°</h3>
                                <p className="text-white font-bold text-sm uppercase tracking-widest flex items-center gap-1">
                                    <i className="ri-map-pin-2-line opacity-50"></i> {locationName}
                                </p>
                            </div>
                            <div className="relative">
                                <i className={`${getWeatherIcon(weather.weathercode)} text-7xl `}></i>
                                <div className="absolute inset-0 bg-white/20 rounded-full blur-3xl -z-10 overflow-hidden"></div>
                            </div>
                        </div>
                    ) : (
                        <div className="animate-pulse flex items-center justify-between">
                            <div className="h-12 w-20 bg-white/20 rounded-xl"></div>
                            <div className="h-16 w-16 bg-white/20 rounded-full"></div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const ShoppingWidget = () => {
    const [items, setItems] = React.useState([]);
    const { t } = useTranslation();

    React.useEffect(() => {
        const fetchItems = async () => {
            try {
                const res = await api.get('/shopping');
                setItems(res.data.filter(i => !i.bought).slice(0, 5));
            } catch (e) { console.error(e); }
        };
        fetchItems();
    }, []);

    return (
        <div className="bg-white dark:bg-slate-800 rounded-[1.25rem] p-6 shadow-sm border border-black/[0.06] dark:border-white/10 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <i className="ri-shopping-basket-line text-brand-light"></i> {t('shopping_widget')}
                </h3>
                <Link to="/shopping" className="text-[10px] font-black uppercase text-brand-light hover:text-brand-dark transition-colors">{t('view_all')}</Link>
            </div>
            <div className="space-y-2 flex-1 overflow-hidden">
                {items.length === 0 ? (
                    <div className="h-full flex items-center justify-center italic text-slate-400 text-[10px] font-bold">{t('no_items')}</div>
                ) : (
                    items.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-white/10/50 animate-in slide-in-from-left-2">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{item.name}</span>
                            <span className="text-[9px] font-black bg-brand-light/10 text-brand-dark px-1.5 py-0.5 rounded uppercase">{item.quantity}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const EmergencyContactsWidget = () => {
    const { t } = useTranslation();
    const [contacts, setContacts] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchEmergency = async () => {
            try {
                const res = await api.get('/contacts');
                setContacts(res.data.filter(c => c.is_emergency));
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchEmergency();
    }, []);

    return (
        <div className="bg-white dark:bg-slate-800 rounded-[1.25rem] p-6 shadow-sm border border-red-500/20 dark:border-red-900/30 h-full flex flex-col">
            <h3 className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
                <i className="ri-alarm-warning-line text-red-500"></i> {t('emergency_widget')}
            </h3>
            <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar pr-1">
                {loading ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="w-6 h-6 border border-red-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : contacts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50 text-center p-4">
                        <i className="ri-shield-user-line text-3xl mb-2"></i>
                        <p className="text-[10px] font-bold uppercase tracking-widest leading-tight">{t('no_emergency_contacts') || 'Keine Notfallkontakte'}</p>
                    </div>
                ) : (
                    contacts.map(c => (
                        <a key={c.id} href={`tel:${c.phone}`} className="flex items-center justify-between p-3 bg-red-500 text-white rounded-xl shadow-lg active:scale-95 transition-all group">
                            <div className="flex items-center gap-3">
                                <i className="ri-phone-fill text-xl group-hover:rotate-12 transition-transform"></i>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-tight leading-none mb-0.5">{c.name}</span>
                                    <span className="text-[9px] opacity-80 font-bold">{c.relationship || t('emergency')}</span>
                                </div>
                            </div>
                            <span className="text-lg font-black font-mono tracking-tighter">{c.phone}</span>
                        </a>
                    ))
                )}
            </div>
        </div>
    );
};

const FavoriteContactsWidget = ({ onUpdateSettings }) => {
    const { t } = useTranslation();
    const [favorites, setFavorites] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchFavorites = async () => {
            try {
                const res = await api.get('/contacts');
                setFavorites(res.data.filter(c => c.is_favorite));
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchFavorites();
    }, []);

    return (
        <div className="h-full flex flex-col p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <i className="ri-star-fill text-amber-500"></i>
                    {t('widget_family_favorites')}
                </h3>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                {loading ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="w-6 h-6 border border-brand-light border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : favorites.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50 text-center p-4">
                        <i className="ri-user-star-line text-3xl mb-2"></i>
                        <p className="text-[10px] font-bold uppercase tracking-widest leading-tight">{t('favorites_no_contacts')}</p>
                    </div>
                ) : (
                    favorites.map(contact => (
                        <div key={contact.id} className="group p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-brand-light/30 transition-all shadow-sm">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-lg bg-brand-light/10 dark:bg-brand-light/20 text-brand-dark dark:text-brand-light flex items-center justify-center text-lg font-black shrink-0">
                                        {contact.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-black text-slate-800 dark:text-slate-200 truncate leading-tight text-xs">{contact.name}</div>
                                        <div className="text-[10px] font-bold text-slate-400 truncate">{contact.relationship}</div>
                                    </div>
                                </div>
                                {contact.phone && (
                                    <a href={`tel:${contact.phone}`} className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center hover:bg-green-100 transition-colors shrink-0">
                                        <i className="ri-phone-fill text-sm"></i>
                                    </a>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const ChatWidget = ({ user }) => (
    <div className="bg-white dark:bg-slate-800 rounded-[1.25rem] border border-black/[0.06] dark:border-white/10 shadow-sm flex flex-col overflow-hidden relative min-h-[400px] h-full transition-colors duration-500">
        <ChatRoom user={user} />
    </div>
);


// --- Main Dashboard Component ---

const DEFAULT_WIDGETS = [
    { i: 'clock', type: 'clock', x: 0, y: 0, w: 2, h: 2, bgId: 1 },
    { i: 'meal', type: 'meal', x: 2, y: 0, w: 2, h: 2 },
    { i: 'weather', type: 'weather', x: 4, y: 0, w: 2, h: 2 },
    { i: 'shopping', type: 'shopping', x: 6, y: 0, w: 2, h: 3 },
    { i: 'events', type: 'events', x: 4, y: 2, w: 4, h: 4 },
    { i: 'chat', type: 'chat', x: 0, y: 2, w: 4, h: 6 }
];

const AVAILABLE_WIDGETS = (t) => [
    { type: 'clock', name: t('time_widget'), icon: 'ri-time-line' },
    { type: 'timeline', name: t('timeline'), icon: 'ri-history-line' },
    { type: 'meal', name: t('meals'), icon: 'ri-restaurant-line' },
    { type: 'weather', name: t('weather'), icon: 'ri-sun-cloudy-line' },
    { type: 'events', name: t('appointments'), icon: 'ri-calendar-event-line' },
    { type: 'chat', name: t('chat'), icon: 'ri-chat-3-line' },
    { type: 'shopping', name: t('shopping_widget'), icon: 'ri-shopping-basket-line' },
    { type: 'emergency', name: t('emergency_widget'), icon: 'ri-alarm-warning-line' },
    { type: 'family_favorites', name: t('widget_family_favorites'), icon: 'ri-star-fill' }
];

const Dashboard = ({ user }) => {
    const { t } = useTranslation();
    const [family, setFamily] = React.useState(null);
    const [todayMeal, setTodayMeal] = React.useState(null);
    const [nextEvents, setNextEvents] = React.useState([]);

    // Layout State
    const [widgets, setWidgets] = React.useState([]);
    const [editMode, setEditMode] = React.useState(false);

    React.useEffect(() => {
        const fetchWidgets = async () => {
            try {
                // Fetch the freshest data from the server, avoiding browser cache
                const res = await api.get(`/auth/me?_t=${Date.now()}`);
                if (res.data.dashboard_widgets) {
                    setWidgets(res.data.dashboard_widgets);
                } else {
                    setWidgets(DEFAULT_WIDGETS);
                }
            } catch (e) {
                console.error('Error fetching layout', e);
                setWidgets(DEFAULT_WIDGETS);
            }
        };

        const loadDashboardData = async () => {
            await Promise.all([fetchFamily(), fetchTodayMeal(), fetchUpcomingEvents(), fetchWidgets()]);
        };
        loadDashboardData();
    }, []);

    const fetchFamily = async () => {
        try {
            const res = await api.get('/auth/family');
            setFamily(res.data);
        } catch (e) { console.error(e); }
    };

    const fetchTodayMeal = async () => {
        try {
            const today = getAppTime(user).toLocaleDateString('en-CA');
            const res = await api.get(`/meals?start=${today}&end=${today}`);
            if (res.data?.length > 0) setTodayMeal(res.data[0]);
        } catch (e) { console.error(e); }
    };

    const fetchUpcomingEvents = async () => {
        try {
            const res = await api.get('/calendar');
            const now = getAppTime(user);
            const upcoming = res.data
                .map(e => ({ ...e, start: new Date(e.start) }))
                .filter(e => e.start >= now)
                .sort((a, b) => a.start - b.start)
                .slice(0, 3);
            setNextEvents(upcoming);
        } catch (e) { console.error(e); }
    };

    const saveLayout = async (newWidgets) => {
        try {
            await api.put('/auth/profile/dashboard', { widgets: newWidgets });
        } catch (err) {
            console.error('Error saving dashboard:', err);
        }
    };

    const handleRemoveWidget = (idToRemove) => {
        const newWidgets = widgets.filter(w => w.i !== idToRemove);
        setWidgets(newWidgets);
        saveLayout(newWidgets);
    };

    const handleAddWidget = (type) => {
        // Find default size (8-col grid units)
        let w = 2, h = 2;
        if (type === 'events') { w = 4; h = 4; }
        if (type === 'chat') { w = 4; h = 6; }
        if (type === 'shopping') { w = 2; h = 3; }
        if (type === 'emergency') { w = 2; h = 2; }
        if (type === 'family_favorites') { w = 2; h = 3; }

        const newWidget = { 
            i: `${type}_${Date.now()}`, 
            type, 
            x: 0, y: Infinity, 
            w, h, 
            zip: type === 'weather' ? '10115' : undefined, 
            country: type === 'weather' ? 'DE' : undefined, 
            days: type === 'weather' ? 1 : undefined,
            bgId: type === 'clock' ? 1 : undefined
        };
        const newWidgets = [...widgets, newWidget];
        setWidgets(newWidgets);
        saveLayout(newWidgets);
    };

    const handleLayoutChange = (currentLayout) => {
        if (!editMode) return;
        
        const updatedWidgets = widgets.map(w => {
            const layoutItem = currentLayout.find(li => li.i === w.i);
            if (layoutItem) {
                return { ...w, x: layoutItem.x, y: layoutItem.y, w: layoutItem.w, h: layoutItem.h };
            }
            return w;
        });
        
        setWidgets(updatedWidgets);
        saveLayout(updatedWidgets);
    };

    const handleUpdateWeatherSettings = (id, settings) => {
        const newWidgets = widgets.map(w => w.i === id ? { ...w, ...settings } : w);
        setWidgets(newWidgets);
        saveLayout(newWidgets);
    };

    const renderWidgetContent = (widget) => {
        switch (widget.type) {
            case 'clock': return (
                <ClockWidget 
                    user={user} 
                    widgetId={widget.id} 
                    bgId={widget.bgId} 
                    onUpdateSettings={handleUpdateWeatherSettings} 
                />
            );
            case 'meal': return <MealWidget todayMeal={todayMeal} />;
            case 'events': return <EventsWidget nextEvents={nextEvents} />;
            case 'weather': return (
                <WeatherWidget
                    widgetId={widget.id}
                    zip={widget.zip}
                    country={widget.country}
                    days={widget.days}
                    onUpdateSettings={handleUpdateWeatherSettings}
                    user={user}
                />
            );
            case 'chat': return <ChatWidget user={user} />;
            case 'timeline': return <TimelineWidget user={user} />;
            case 'shopping': return <ShoppingWidget />;
            case 'emergency': return <EmergencyContactsWidget />;
            case 'family_favorites': return <FavoriteContactsWidget onUpdateSettings={handleUpdateWeatherSettings} />;
            default: return <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl h-full flex items-center justify-center font-bold text-slate-400 dark:text-slate-500">{t('unknown_widget')}</div>;
        }
    };

    const layouts = React.useMemo(() => {
        const mobileWidgets = widgets.map(w => ({ ...w, w: Math.min(w.w, 1) }));
        return {
            lg: widgets,
            md: widgets,
            sm: widgets,
            xs: mobileWidgets,
            xxs: mobileWidgets
        };
    }, [widgets]);

    return (
        <div className="flex flex-col gap-8 h-full overflow-y-auto custom-scrollbar">
            {/* Header */}
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-2 shrink-0">
                <div>
                    <h1 className="text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3 transition-colors">
                        <i className="ri-layout-masonry-line text-brand-dark dark:text-brand-light"></i>
                        {t('overview')}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">{t('welcome_back')}, {user.username || user.name}</p>
                </div>
                <div className="flex gap-3">
                    {family && (
                        <div className="bg-brand-light/10 dark:bg-brand-light/20 text-brand-dark dark:text-brand-light px-6 py-3 rounded-lg font-black text-sm border border-brand-light/20 dark:border-brand-light/30 shadow-sm flex items-center gap-2 transition-colors">
                            <i className="ri-home-heart-fill"></i>
                            <span className="hidden sm:inline">{t('family_label')}</span> {family.name}
                        </div>
                    )}
                    <button
                        onClick={() => setEditMode(!editMode)}
                        className={`px-4 py-3 rounded-lg font-black text-sm shadow-sm flex items-center gap-2 transition-all ${editMode ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-black/[0.06] dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                    >
                        <i className={editMode ? "ri-check-line" : "ri-settings-4-line"}></i>
                         <span className="hidden sm:inline">{editMode ? t('done_btn') : t('edit_btn')}</span>
                    </button>
                </div>
            </header>

            {/* Family Status Bar */}
            <FamilyStatus currentUser={user} />

            {/* Edit Mode Toolbox */}
            {editMode && (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-[1.25rem] border border-amber-400 dark:border-amber-500 border-dashed shadow-lg animate-in slide-in-from-top-4 shrink-0 transition-colors">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <i className="ri-add-circle-fill text-amber-500"></i> {t('add_widget')}
                    </h3>
                    <div className="flex flex-wrap gap-3">
                        {AVAILABLE_WIDGETS(t).map(aw => (
                            <button
                                key={aw.type}
                                onClick={() => handleAddWidget(aw.type)}
                                className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-black/[0.06] dark:border-white/10 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:border-amber-400 dark:hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-500 transition-colors flex items-center gap-2"
                            >
                                <i className={aw.icon}></i> {aw.name}
                            </button>
                        ))}
                        <button onClick={() => { setWidgets(DEFAULT_WIDGETS); saveLayout(DEFAULT_WIDGETS); }} className="px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 rounded-xl font-bold hover:bg-red-100 dark:hover:bg-red-900/50 ml-auto transition-colors">
                            <i className="ri-refresh-line"></i> {t('reset_layout')}
                        </button>
                    </div>
                </div>
            )}

            {/* Dynamic Grid */}
            <div className="pb-8">
                {widgets.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 dark:text-slate-500 font-bold bg-white dark:bg-slate-800 rounded-[1.25rem] border border-dashed border-slate-100 dark:border-white/10 transition-colors">
                        {t('no_widgets_msg')}
                    </div>
                ) : (
                    <ResponsiveGridLayout
                        className="layout"
                        layouts={layouts}
                        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                        cols={{ lg: 8, md: 6, sm: 4, xs: 2, xxs: 1 }}
                        rowHeight={80}
                        draggableHandle=".drag-handle"
                        isDraggable={editMode}
                        isResizable={editMode}
                        onLayoutChange={handleLayoutChange}
                        margin={[24, 24]}
                    >
                        {widgets.map(w => (
                            <div key={w.i} className="relative group h-full">
                                {editMode && (
                                    <>
                                        <div className="drag-handle absolute top-4 left-4 w-10 h-10 bg-white/90 dark:bg-slate-800/90 backdrop-blur rounded-xl shadow-lg border border-black/[0.06] dark:border-white/10 flex items-center justify-center cursor-move z-[60] hover:bg-white dark:hover:bg-slate-700 transition-colors">
                                            <i className="ri-drag-move-2-line text-slate-600 dark:text-slate-300"></i>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveWidget(w.i)}
                                            className="absolute top-4 right-4 w-10 h-10 bg-red-500 text-white rounded-xl shadow-lg flex items-center justify-center hover:bg-red-600 transition-transform hover:scale-110 active:scale-95 z-[60]"
                                        >
                                            <i className="ri-delete-bin-line"></i>
                                        </button>
                                        <div className="absolute inset-0 border border-brand-light/30 border-dashed rounded-[1.25rem] pointer-events-none z-50"></div>
                                    </>
                                )}
                                {renderWidgetContent({ ...w, id: w.i })}
                            </div>
                        ))}
                    </ResponsiveGridLayout>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
