import React from 'react';
import api from '../services/api';
import { useTranslation } from '../i18n.jsx';
// The emoji picker is large (~300 kB) – load it only when it is opened.
const EmojiPicker = React.lazy(() => import('emoji-picker-react'));

const FamilyStatus = ({ currentUser }) => {
    const { t } = useTranslation();
    const [members, setMembers] = React.useState([]);
    const [isMoodPickerOpen, setIsMoodPickerOpen] = React.useState(false);
    const [moodEmoji, setMoodEmoji] = React.useState(currentUser?.mood_emoji || '😊');
    const [moodText, setMoodText] = React.useState(currentUser?.mood_text || '');
    const [showFullEmojiPicker, setShowFullEmojiPicker] = React.useState(false);

    const quickEmojis = ['😊', '😎', '😴', '🏠', '🚗', '🍕', '🎉', '💪'];

    React.useEffect(() => {
        fetchMembers();
        const interval = setInterval(fetchMembers, 30000); // Update every 30s
        return () => clearInterval(interval);
    }, []);

    const fetchMembers = async () => {
        try {
            const res = await api.get('/auth/family/members');
            setMembers(res.data);
        } catch (err) {
            console.error('Error fetching family members:', err);
        }
    };

    const handleUpdateMood = async () => {
        try {
            await api.post('/auth/profile/mood', { mood_emoji: moodEmoji, mood_text: moodText });
            setIsMoodPickerOpen(false);
            fetchMembers();
        } catch (err) {
            console.error('Error updating mood:', err);
        }
    };

    const getStatusInfo = (lastActive) => {
        if (!lastActive) return { label: 'Inaktiv', color: 'bg-slate-300' };
        const now = new Date();
        const active = new Date(lastActive);
        const diffInMinutes = Math.floor((now - active) / 60000);

        if (diffInMinutes < 5) return { label: t('online_now'), color: 'bg-emerald-500' };
        if (diffInMinutes < 60) return { label: t('minutes_ago', { count: diffInMinutes }), color: 'bg-amber-400' };
        if (diffInMinutes < 1440) return { label: t('hours_ago', { count: Math.floor(diffInMinutes / 60) }), color: 'bg-slate-400' };
        return { label: t('days_ago', { count: Math.floor(diffInMinutes / 1440) }), color: 'bg-slate-300' };
    };

    return (
        <div className="relative">
            {/* Status Bar */}
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-[2rem] p-4 border border-black/[0.06] dark:border-slate-800 shadow-sm flex items-center gap-6 overflow-x-auto no-scrollbar min-h-[100px]">
                {/* Family Members Status List */}
                <div className="flex gap-8 items-center">
                    {members.map(member => {
                        const status = getStatusInfo(member.last_active);
                        const isMe = member.id === currentUser?.id;

                        return (
                            <div 
                                key={member.id} 
                                className={`flex items-center gap-3 shrink-0 animate-in fade-in slide-in-from-left-4 ${isMe ? 'cursor-pointer group/me' : ''}`}
                                onClick={isMe ? () => setIsMoodPickerOpen(true) : undefined}
                            >
                                <div className="relative">
                                    {member.profile_picture ? (
                                        <img 
                                            src={member.profile_picture.startsWith('http') ? member.profile_picture : `${window.location.origin}/${member.profile_picture.replace(/^\//, '')}`} 
                                            alt={member.username}
                                            className={`w-12 h-12 rounded-full border ${isMe ? 'border-brand-dark' : 'border-black/[0.06]'} object-cover group-hover/me:scale-110 transition-transform`}
                                        />
                                    ) : (
                                        <div className={`w-12 h-12 rounded-full ${isMe ? 'bg-brand-dark text-white' : 'bg-brand-light/10 text-brand-dark'} flex items-center justify-center font-black text-lg border ${isMe ? 'border-brand-dark' : 'border-black/[0.06]'} group-hover/me:scale-110 transition-transform`}>
                                            {member.username.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${status.color} rounded-full border border-white dark:border-slate-900 shadow-sm`}></div>
                                    
                                    {/* Mood Emoji Overlay */}
                                    <div className={`absolute -top-1 -right-1 bg-white dark:bg-slate-800 rounded-full w-6 h-6 flex items-center justify-center text-sm shadow-sm border ${isMe ? 'border-brand-dark' : 'border-slate-100 dark:border-white/10'}`}>
                                        {member.mood_emoji || (isMe ? '👋' : '😊')}
                                    </div>

                                    {isMe && (
                                        <div className="absolute -top-1 -left-1 bg-brand-dark text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px] border border-white">
                                            <i className="ri-edit-line"></i>
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-sm font-black text-slate-800 dark:text-slate-100 leading-none">
                                            {member.username}
                                        </span>
                                        {isMe && <span className="text-[9px] font-black bg-brand-dark text-white px-1.5 py-0.5 rounded-md uppercase tracking-tighter">{t('you_label') || 'Ich'}</span>}
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex flex-col mt-0.5">
                                        {member.mood_text && (
                                            <span className="text-slate-600 dark:text-slate-300 normal-case italic line-clamp-1">"{member.mood_text}"</span>
                                        )}
                                        <span className="opacity-70">{member.display_role ? `${member.display_role} • ` : ''}{status.label}</span>
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Mood Picker Modal */}
            {isMoodPickerOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setIsMoodPickerOpen(false)}>
                    <div 
                        className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl animate-in zoom-in-95 border border-black/[0.06]"
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-6">{t('how_are_you')}</h3>
                        
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-wrap justify-center gap-3">
                                {quickEmojis.map(e => (
                                    <button
                                        key={e}
                                        onClick={() => {
                                            setMoodEmoji(e);
                                            setShowFullEmojiPicker(false);
                                        }}
                                        className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl transition-all ${moodEmoji === e && !showFullEmojiPicker ? 'bg-brand-dark text-white shadow-lg scale-110' : 'bg-slate-50 dark:bg-slate-900 hover:bg-slate-100'}`}
                                    >
                                        {e}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setShowFullEmojiPicker(!showFullEmojiPicker)}
                                    className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl transition-all ${showFullEmojiPicker ? 'bg-brand-dark text-white' : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200'}`}
                                >
                                    <i className={showFullEmojiPicker ? 'ri-close-line' : 'ri-add-line'}></i>
                                </button>
                            </div>

                            {showFullEmojiPicker && (
                                <div className="emoji-picker-container rounded-2xl overflow-hidden shadow-xl border border-brand-light/30 h-80">
                                    <React.Suspense fallback={<div className="h-full flex items-center justify-center text-slate-400"><i className="ri-loader-4-line animate-spin text-2xl"></i></div>}>
                                    <EmojiPicker
                                        onEmojiClick={(emojiData) => {
                                            setMoodEmoji(emojiData.emoji);
                                            setShowFullEmojiPicker(false);
                                        }}
                                        width="100%"
                                        height="100%"
                                        theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
                                        searchPlaceholder="Emoji suchen..."
                                        previewConfig={{ showPreview: false }}
                                        skinTonesDisabled
                                    />
                                    </React.Suspense>
                                </div>
                            )}

                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl">
                                    {moodEmoji}
                                </div>
                                <input 
                                    type="text"
                                    placeholder={t('mood_placeholder')}
                                    value={moodText}
                                    onChange={e => setMoodText(e.target.value)}
                                    maxLength={30}
                                    className="w-full h-14 pl-14 pr-6 bg-slate-50 dark:bg-slate-900 border border-black/[0.06] focus:border-brand-light rounded-xl font-bold outline-none dark:text-slate-100"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setIsMoodPickerOpen(false)}
                                    className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-black hover:bg-slate-200 transition-all"
                                >
                                    {t('cancel')}
                                </button>
                                <button 
                                    onClick={handleUpdateMood}
                                    className="flex-1 py-4 bg-brand-dark text-white rounded-xl font-black shadow-lg hover:bg-slate-800 transition-all"
                                >
                                    {t('save')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FamilyStatus;
