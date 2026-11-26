import React from 'react';
import api from '../services/api';

const PushEditor = () => {
    const [templates, setTemplates] = React.useState([]);
    const [selectedType, setSelectedType] = React.useState('calendar');
    const [config, setConfig] = React.useState({
        title_template: '',
        body_template: '',
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png'
    });
    const [isSaving, setIsSaving] = React.useState(false);
    const [testResult, setTestResult] = React.useState(null);

    const types = [
        { id: 'calendar', label: 'Kalender-Erinnerung', icon: 'ri-calendar-line', description: 'Erinnerung an Termine 15 Min. vorher.', vars: ['event_title', 'start_time'] },
        { id: 'chat', label: 'Chat-Nachricht', icon: 'ri-chat-3-line', description: 'Benachrichtigung bei neuen Nachrichten.', vars: ['sender', 'content'] },
        { id: 'gallery', label: 'Galerie-Upload', icon: 'ri-image-line', description: 'Benachrichtigung bei neuen Fotos.', vars: ['sender'] },
        { id: 'test', label: 'Test-Push', icon: 'ri-test-tube-line', description: 'Wird beim Klicken auf "Test" gesendet.', vars: [] },
    ];

    React.useEffect(() => {
        fetchTemplates();
    }, []);

    React.useEffect(() => {
        const found = templates.find(t => t.type === selectedType);
        if (found) {
            setConfig({
                title_template: found.title_template || '',
                body_template: found.body_template || '',
                icon: found.icon || '/icon-192x192.png',
                badge: found.badge || '/icon-192x192.png'
            });
        } else {
            // Default fallbacks based on type
            const defaults = {
                calendar: { title: 'Erinnerung: {event_title}', body: 'Beginnt um {start_time} Uhr.' },
                chat: { title: 'Nachricht von {sender}', body: '{content}' },
                gallery: { title: 'Neues Foto', body: '{sender} hat ein Foto geteilt.' },
                test: { title: 'Test-Push', body: 'Hallo von FamyHub!' }
            };
            setConfig({
                title_template: defaults[selectedType]?.title || '',
                body_template: defaults[selectedType]?.body || '',
                icon: '/icon-192x192.png',
                badge: '/icon-192x192.png'
            });
        }
    }, [selectedType, templates]);

    const fetchTemplates = async () => {
        try {
            const res = await api.get('/push-admin/templates');
            setTemplates(res.data);
        } catch (err) { console.error("Failed to fetch templates:", err); }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await api.post('/push-admin/templates', { ...config, type: selectedType });
            await fetchTemplates();
            alert("Vorgabe gespeichert!");
        } catch (err) { alert("Speichern fehlgeschlagen"); }
        finally { setIsSaving(false); }
    };

    const handleTest = async () => {
        setTestResult('Sende...');
        try {
            // We use the custom test endpoint and replace placeholders locally for the preview/test
            let title = config.title_template;
            let body = config.body_template;
            
            const demoVars = {
                event_title: 'Zahnarzttermin',
                start_time: '14:30',
                sender: 'Alex',
                content: 'Hallo, das ist eine Testnachricht!'
            };

            Object.keys(demoVars).forEach(key => {
                const regex = new RegExp(`{${key}}`, 'g');
                title = title.replace(regex, demoVars[key]);
                body = body.replace(regex, demoVars[key]);
            });

            await api.post('/push-admin/test-custom', { title, body, icon: config.icon, badge: config.badge });
            setTestResult('Gesendet!');
            setTimeout(() => setTestResult(null), 3000);
        } catch (err) { 
            const errorMsg = err.response?.data?.error || 'Fehler!';
            setTestResult(errorMsg);
            setTimeout(() => setTestResult(null), 5000); // Show for longer if it's a specific message
        }
    };

    const activeTypeInfo = types.find(t => t.id === selectedType);

    return (
        <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
            <div className="flex flex-col lg:flex-row gap-12">
                
                {/* Left side: Editor */}
                <div className="flex-1 space-y-8">
                    <section>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 px-1">Typ auswählen</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {types.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setSelectedType(t.id)}
                                    className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all gap-2 ${selectedType === t.id ? 'bg-brand-dark text-white border-brand-dark shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                                >
                                    <i className={`${t.icon} text-2xl`}></i>
                                    <span className="text-[10px] font-black uppercase tracking-widest">{t.id}</span>
                                </button>
                            ))}
                        </div>
                    </section>

                    <hr className="border-slate-100" />

                    <section className="bg-slate-50/50 p-8 rounded-[1.5rem] border border-slate-100 space-y-6">
                        <div>
                            <h4 className="font-black text-slate-800 flex items-center gap-2 mb-1">
                                <i className={`${activeTypeInfo.icon} text-brand-dark`}></i>
                                {activeTypeInfo.label}
                            </h4>
                            <p className="text-xs text-slate-400 font-bold">{activeTypeInfo.description}</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Titel-Vorlage</label>
                                <input
                                    type="text"
                                    className="w-full h-12 px-4 bg-white border border-transparent focus:border-brand-dark rounded-lg font-bold outline-none shadow-sm"
                                    value={config.title_template}
                                    onChange={(e) => setConfig({ ...config, title_template: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Inhalt-Vorlage</label>
                                <textarea
                                    className="w-full h-24 p-4 bg-white border border-transparent focus:border-brand-dark rounded-lg font-bold outline-none shadow-sm resize-none"
                                    value={config.body_template}
                                    onChange={(e) => setConfig({ ...config, body_template: e.target.value })}
                                />
                            </div>
                            
                            {activeTypeInfo.vars.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-2">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-2 py-1">Platzhalter:</span>
                                    {activeTypeInfo.vars.map(v => (
                                        <button 
                                            key={v}
                                            onClick={() => setConfig({ ...config, body_template: config.body_template + `{${v}}` })}
                                            className="px-2 py-1 bg-slate-200 text-slate-600 rounded text-[10px] font-bold hover:bg-slate-300 transition-colors"
                                        >
                                            {`{${v}}`}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4 pt-4">
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex-1 py-4 bg-brand-dark text-white rounded-xl font-black shadow-lg active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isSaving ? 'Speichere...' : 'Vorgabe speichern'}
                            </button>
                            <button
                                onClick={handleTest}
                                className={`flex-1 py-4 rounded-xl font-black shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 ${testResult === 'Fehler!' ? 'bg-red-500 text-white' : testResult === 'Gesendet!' ? 'bg-green-500 text-white' : 'bg-white border border-slate-100 text-slate-600'}`}
                            >
                                <i className="ri-send-plane-fill"></i>
                                {testResult || 'Test-Push'}
                            </button>
                        </div>
                    </section>
                </div>

                {/* Right side: Mockup / Preview */}
                <div className="w-full lg:w-96">
                    <div className="sticky top-8 space-y-6">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Vorschau (Smartphone)</h3>
                        
                        {/* iOS / Android Style Notification Mockup */}
                        <div className="bg-slate-900 aspect-[9/19] rounded-[3rem] p-4 border-[6px] border-slate-800 shadow-2xl relative overflow-hidden flex flex-col items-center">
                            {/* Speaker/Camera hole */}
                            <div className="w-24 h-6 bg-slate-800 rounded-full mt-2 mb-8"></div>
                            
                            {/* Notification Banner */}
                            <div className="w-full bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-2xl shadow-xl animate-in fade-in zoom-in duration-700">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center overflow-hidden">
                                        <img src={config.icon} className="w-full h-full object-cover" onError={(e) => e.target.src = '/vite.svg'} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-[10px] font-black text-white leading-none uppercase tracking-widest">FamyHub</div>
                                        <div className="text-[8px] font-bold text-white/50">jetzt</div>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-sm font-black text-white leading-tight">
                                        {config.title_template ? (
                                            activeTypeInfo.vars.reduce((str, v) => str.replace(new RegExp(`{${v}}`, 'g'), 
                                                v === 'event_title' ? 'Termin' : v === 'sender' ? 'Alex' : v === 'start_time' ? '12:00' : '...'
                                            ), config.title_template)
                                        ) : 'Vorschau Titel'}
                                    </div>
                                    <div className="text-xs font-medium text-white/80 leading-tight">
                                        {config.body_template ? (
                                            activeTypeInfo.vars.reduce((str, v) => str.replace(new RegExp(`{${v}}`, 'g'), 
                                                v === 'sender' ? 'Alex' : v === 'content' ? 'Hallo Welt!' : v === 'start_time' ? '12:00' : '...'
                                            ), config.body_template)
                                        ) : 'Deine Nachricht wird hier erscheinen...'}
                                    </div>
                                </div>
                            </div>

                            {/* Background decoration */}
                            <div className="absolute inset-0 z-[-1] bg-gradient-to-br from-indigo-900 via-slate-900 to-black opacity-50"></div>
                            <div className="mt-auto mb-4 w-1/2 h-1 bg-white/20 rounded-full"></div>
                        </div>
                        
                        <p className="text-[10px] text-center text-slate-400 font-bold px-8 leading-relaxed">
                            Platzhalter wie <code className="text-brand-dark bg-slate-100 px-1 rounded">{"{sender}"}</code> werden automatisch durch echte Daten ersetzt.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PushEditor;
