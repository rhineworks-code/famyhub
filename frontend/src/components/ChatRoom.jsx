import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { useTranslation } from '../i18n.jsx';

// Scrolls only the message list itself – scrollIntoView() also scrolled the whole
// page, so the dashboard jumped down to the chat widget on every load.
const scrollListToEnd = (anchor, behavior = 'auto') => {
    let el = anchor?.parentElement;
    while (el && !/(auto|scroll)/.test(getComputedStyle(el).overflowY)) el = el.parentElement;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
};

/**
 * Brand-Matched Premium ChatRoom
 * Using Dark Blue (#2B3E6A) and Baby Blue (#00ADEF)
 */
const ChatRoom = ({ user, onClose }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const isStandalone = location.pathname === '/chat';

    // State
    const [messages, setMessages] = React.useState([]);
    const [newMessage, setNewMessage] = React.useState('');
    const [selectedImage, setSelectedImage] = React.useState(null);
    const [imagePreview, setImagePreview] = React.useState(null);
    const [family, setFamily] = React.useState(null);
    const [showEmojis, setShowEmojis] = React.useState(false);
    const [recentEmojis, setRecentEmojis] = React.useState(JSON.parse(localStorage.getItem('recent_emojis') || '["❤️", "👍", "🙌", "✨"]'));
    const [isSending, setIsSending] = React.useState(false);

    // New State for Polls & Reactions
    const [showPollModal, setShowPollModal] = React.useState(false);
    const [newPollQuestion, setNewPollQuestion] = React.useState('');
    const [newPollOptions, setNewPollOptions] = React.useState(['', '']);
    const [activeReactionMsgId, setActiveReactionMsgId] = React.useState(null);

    // Constants
    const BRAND_DARK = "#2B3E6A";
    const BRAND_LIGHT = "#00ADEF";
    const BRAND_BG = "#F8FAFC";
    const COMMON_EMOJIS = ['😀', '😂', '😍', '😎', '😭', '😱', '😴', '😋', '😇', '🤔', '🙄', '🤫', '🥳', '🥺', '❤️', '👍', '🙌', '✨', '🔥', '🚀', '✅', '❌', '🍕', '🍻', '🏠', '🚗', '📅', '💡', '💯', '🎉'];

    // Refs
    const scrollRef = React.useRef(null);
    const bottomRef = React.useRef(null);
    const fileRef = React.useRef(null);
    const lastMsgId = React.useRef(null);
    const scrollAttemptsRef = React.useRef(0);

    // Initial Load & Polling
    React.useEffect(() => {
        fetchFamily();
        fetchMessages();
        const timer = setInterval(fetchMessages, 3000);
        return () => clearInterval(timer);
    }, []);

    // Auto-Scroll: robust multi-attempt approach using bottom anchor
    React.useEffect(() => {
        if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg.id !== lastMsgId.current) {
                const isInitial = lastMsgId.current === null;
                lastMsgId.current = lastMsg.id;
                scrollAttemptsRef.current = 0;

                // scrollIntoView via RAF - retry up to 5 times to handle images/layout
                const tryScroll = () => {
                    if (bottomRef.current) {
                        scrollListToEnd(bottomRef.current, isInitial ? 'auto' : 'smooth');
                    }
                    if (scrollAttemptsRef.current < 5) {
                        scrollAttemptsRef.current++;
                        requestAnimationFrame(tryScroll);
                    }
                };
                requestAnimationFrame(tryScroll);
            }
        }
    }, [messages]);

    const fetchFamily = async () => {
        try {
            const res = await api.get('/auth/family');
            setFamily(res.data);
        } catch (e) { console.error('Family fetch error:', e); }
    };

    const fetchMessages = async () => {
        try {
            const res = await api.get('/chat');
            setMessages(res.data);
        } catch (e) { console.error('Chat fetch error:', e); }
    };

    const scrollToBottom = (behavior = 'auto') => {
        if (bottomRef.current) {
            scrollListToEnd(bottomRef.current, behavior);
        }
    };

    const sendMessage = async (e) => {
        if (e) e.preventDefault();
        const text = newMessage.trim();
        if (!text && !selectedImage && !newPollQuestion.trim()) return;
        if (isSending) return;

        setIsSending(true);
        try {
            let pollDataPayload = null;
            if (newPollQuestion.trim()) {
                const validOptions = newPollOptions.filter(o => o.trim() !== '').map(text => ({ text: text.trim(), votes: [] }));
                if (validOptions.length >= 2) {
                    pollDataPayload = JSON.stringify({ question: newPollQuestion.trim(), options: validOptions });
                }
            }

            if (selectedImage) {
                const fd = new FormData();
                if (text) fd.append('content', text);
                if (pollDataPayload) fd.append('poll_data', pollDataPayload);
                fd.append('image', selectedImage);
                await api.post('/chat', fd);
            } else {
                await api.post('/chat', { content: text, poll_data: pollDataPayload });
            }

            setNewMessage('');
            setSelectedImage(null);
            setImagePreview(null);
            setShowEmojis(false);
            setShowPollModal(false);
            setNewPollQuestion('');
            setNewPollOptions(['', '']);
            fetchMessages();
        } catch (err) {
            console.error('Send error:', err);
            alert(t('chat_send_error'));
        } finally {
            setIsSending(false);
        }
    };

    const handleReact = async (msgId, emoji) => {
        try {
            await api.post(`/chat/${msgId}/react`, { emoji });
            setActiveReactionMsgId(null);
            fetchMessages();
        } catch (err) { console.error('Reaction error', err); }
    };

    const handleVote = async (msgId, optionIndex) => {
        try {
            await api.post(`/chat/${msgId}/vote`, { optionIndex });
            fetchMessages();
        } catch (err) { console.error('Vote error', err); }
    };

    const addEmoji = (e) => {
        setNewMessage(prev => prev + e);
        const updated = [e, ...recentEmojis.filter(x => x !== e)].slice(0, 10);
        setRecentEmojis(updated);
        localStorage.setItem('recent_emojis', JSON.stringify(updated));
    };

    const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const serverUrl = api.defaults.baseURL.replace('/api', '');

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-slate-900 relative overflow-hidden font-sans transition-colors duration-500">
            {/* Header - Brand Dark Blue */}
            <div className="z-30 px-4 py-3 bg-[#2B3E6A] text-white flex items-center justify-between shrink-0 shadow-lg">
                <div className="flex items-center gap-3">
                    {isStandalone && (
                        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
                            <i className="ri-arrow-left-line text-xl"></i>
                        </button>
                    )}
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white border border-black/[0.06]/20 shadow-inner">
                        <i className="ri-chat-3-line text-xl"></i>
                    </div>
                    <div>
                        <h3 className="font-bold text-white leading-tight">{t('chat_title')}</h3>
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-100/70 text-shadow-sm">{t('chat_active')}</p>
                        </div>
                    </div>
                </div>
                {onClose && (
                    <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/80 transition-colors">
                        <i className="ri-close-line text-xl"></i>
                    </button>
                )}
            </div>

            {/* Chat Area - Clean Slate Background */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-4 relative custom-scrollbar bg-slate-50 dark:bg-slate-950/20"
            >
                <div className="flex justify-center mb-2">
                    <span className="bg-slate-200/50 dark:bg-slate-800/50 backdrop-blur-sm text-slate-500 dark:text-slate-400 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-tighter">{t('chat_secure_area')}</span>
                </div>

                {messages.map((msg, i) => {
                    const isMe = msg.user_id === user?.id;
                    const showName = i === 0 || messages[i - 1].user_id !== msg.user_id;

                    return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} w-full animate-in slide-in-from-bottom-1 duration-300`}>
                            <div className={`
                                group relative max-w-[85%] md:max-w-[70%] p-3 rounded-lg shadow-sm border
                                ${isMe ? 'bg-[#00ADEF] text-white border-cyan-400 rounded-tr-none shadow-[#00ADEF]/10' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-100 dark:border-white/10 rounded-tl-none'}
                            `}>
                                {!isMe && showName && (
                                    <span className="text-[11px] font-black text-[#2B3E6A] block mb-1 px-1">{msg.user_name}</span>
                                )}

                                {msg.image_url && (
                                    <div className="mb-1 cursor-pointer overflow-hidden rounded-lg border border-black/5" onClick={() => window.open(`${serverUrl}/uploads/${msg.image_url}`, '_blank')}>
                                        <img
                                            src={`${serverUrl}/uploads/${msg.image_url}`}
                                            className="max-h-60 md:max-h-80 w-auto hover:scale-105 transition-transform duration-500"
                                            alt="Chat"
                                            onLoad={() => scrollToBottom('smooth')}
                                        />
                                    </div>
                                )}

                                {msg.content && (
                                    <div className="px-1 text-sm leading-relaxed whitespace-pre-wrap break-words font-medium">
                                        {msg.content}
                                    </div>
                                )}

                                {/* Poll Rendering */}
                                {msg.poll_data && (() => {
                                    let poll = null;
                                    try { poll = typeof msg.poll_data === 'string' ? JSON.parse(msg.poll_data) : msg.poll_data; } catch (e) { }
                                    if (!poll || !poll.options) return null;
                                    const totalVotes = poll.options.reduce((sum, opt) => sum + (opt.votes ? opt.votes.length : 0), 0);

                                    return (
                                        <div className="mt-3 bg-white/20 dark:bg-slate-800/30 p-3 rounded-xl border border-black/[0.06]/10 dark:border-white/10/30 shadow-inner">
                                            <p className="font-bold mb-3 flex items-center gap-2">
                                                <i className="ri-bar-chart-horizontal-line"></i> {poll.question}
                                            </p>
                                            <div className="space-y-2">
                                                {poll.options.map((opt, optIdx) => {
                                                    const votes = opt.votes ? opt.votes.length : 0;
                                                    const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                                                    const iVoted = opt.votes && opt.votes.includes(user.id);
                                                    return (
                                                        <button
                                                            key={optIdx}
                                                            onClick={() => handleVote(msg.id, optIdx)}
                                                            className={`w-full relative overflow-hidden text-left p-2 rounded-lg text-sm transition-all border ${iVoted ? 'border-amber-400 dark:border-amber-500/50 font-bold bg-amber-50/10' : 'border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5'}`}
                                                        >
                                                            <div className={`absolute left-0 top-0 bottom-0 opacity-20 transition-all ${isMe ? 'bg-white dark:bg-slate-200' : 'bg-[#00ADEF]'}`} style={{ width: `${pct}%` }}></div>
                                                            <div className="relative flex justify-between z-10 px-1">
                                                                <span>{opt.text}</span>
                                                                <span className="text-xs opacity-70">{votes}</span>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <p className="text-[10px] text-right mt-2 opacity-70">{t('chat_poll_votes', { count: totalVotes })}</p>
                                        </div>
                                    );
                                })()}

                                {/* Reactions Rendering */}
                                {msg.reactions && msg.reactions !== '{}' && (() => {
                                    let reactionsObj = {};
                                    try { reactionsObj = typeof msg.reactions === 'string' ? JSON.parse(msg.reactions) : msg.reactions; } catch (e) { }
                                    const reactionEntries = Object.entries(reactionsObj);
                                    if (reactionEntries.length === 0) return null;

                                    return (
                                        <div className="flex flex-wrap gap-1 mt-1.5 -mb-2">
                                            {reactionEntries.map(([emoji, users]) => (
                                                <button
                                                    key={emoji}
                                                    onClick={() => handleReact(msg.id, emoji)}
                                                    className={`text-xs px-1.5 py-0.5 rounded-full border shadow-sm flex items-center gap-1 ${users.includes(user.id) ? 'bg-[#00ADEF]/20 border-[#00ADEF]/30' : 'bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200'}`}
                                                >
                                                    <span>{emoji}</span>
                                                    <span className="font-bold opacity-80">{users.length}</span>
                                                </button>
                                            ))}
                                        </div>
                                    );
                                })()}

                                <div className="flex justify-end items-center mt-2 gap-1.5 pr-1 relative">
                                    <span className={`text-[9px] font-bold uppercase ${isMe ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>{formatTime(msg.created_at)}</span>
                                    {isMe && <i className="ri-check-double-line text-cyan-200 text-[13px]"></i>}
                                </div>

                                {/* React Hover Button */}
                                <button
                                    onClick={() => setActiveReactionMsgId(activeReactionMsgId === msg.id ? null : msg.id)}
                                    className={`absolute ${isMe ? '-left-8' : '-right-8'} top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white dark:bg-slate-700 shadow-md flex items-center justify-center text-slate-400 dark:text-slate-300 hover:text-[#00ADEF] transition-all opacity-30 group-hover:opacity-100 ${activeReactionMsgId === msg.id ? 'opacity-100 z-10 scale-110' : ''}`}
                                >
                                    <i className="ri-emotion-add-line text-sm"></i>
                                </button>

                                {/* Emoji Picker Popover */}
                                {activeReactionMsgId === msg.id && (
                                    <div className={`absolute ${isMe ? 'right-full mr-4' : 'left-full ml-4'} bottom-0 bg-white dark:bg-slate-800 p-2 rounded-lg shadow-xl flex gap-1 z-20 border border-black/[0.06] dark:border-white/10 animate-in zoom-in-95 duration-200`}>
                                        {['👍', '❤️', '😂', '😮', '😢', '👏'].map(emoji => (
                                            <button key={emoji} onClick={() => handleReact(msg.id, emoji)} className="w-8 h-8 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-lg flex items-center justify-center hover:scale-125 transition-all">
                                                {emoji}
                                            </button>
                                        ))}
                                        <div className="w-px bg-slate-100 dark:bg-slate-700 mx-1"></div>
                                        <button onClick={() => setActiveReactionMsgId(null)} className="w-8 h-8 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-400 rounded-lg text-lg flex items-center justify-center transition-all">
                                            <i className="ri-close-line"></i>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
                {/* Invisible bottom anchor for scrollIntoView */}
                <div ref={bottomRef} style={{ height: 1 }} />
            </div>

            {/* Input Overlay for Preview */}
            {imagePreview && (
                <div className="absolute bottom-20 left-4 right-4 bg-white dark:bg-slate-800 p-3 rounded-lg shadow-2xl border border-black/[0.06] dark:border-white/10 animate-in slide-in-from-bottom-4 z-30 flex items-center gap-4 transition-colors">
                    <img src={imagePreview} className="w-16 h-16 object-cover rounded-xl shadow-inner" alt="Preview" />
                    <div className="flex-1">
                        <p className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">{t('chat_image_ready')}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">{t('chat_image_desc')}</p>
                    </div>
                    <button onClick={() => { setSelectedImage(null); setImagePreview(null); }} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-red-500"><i className="ri-close-line"></i></button>
                </div>
            )}

            {/* Emoji Panel */}
            {showEmojis && (
                <div className="absolute bottom-20 left-4 right-4 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-lg shadow-2xl border border-black/[0.06] dark:border-white/10 z-30 p-4 max-h-60 overflow-y-auto custom-scrollbar animate-in slide-in-from-bottom-2 transition-colors">
                    {recentEmojis.length > 0 && (
                        <div className="mb-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Oft genutzt</label>
                            <div className="flex flex-wrap gap-2">
                                {recentEmojis.map((e, idx) => (
                                    <button key={idx} type="button" onClick={() => addEmoji(e)} className="w-10 h-10 flex items-center justify-center text-2xl hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-transform active:scale-75">{e}</button>
                                ))}
                            </div>
                        </div>
                    )}
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">{t('chat_poll_options')}</label>
                    <div className="flex flex-wrap gap-2">
                        {COMMON_EMOJIS.map((e, idx) => (
                            <button key={idx} type="button" onClick={() => addEmoji(e)} className="w-10 h-10 flex items-center justify-center text-2xl hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-transform active:scale-75">{e}</button>
                        ))}
                    </div>
                </div>
            )}

            {/* Footer Input Area - Clean White */}
            <div className="shrink-0 bg-white dark:bg-slate-900 px-4 py-3 flex items-center gap-2 z-30 border-t border-slate-200 dark:border-slate-800 transition-colors">
                <div className="flex gap-0.5">
                    <button
                        type="button"
                        onClick={() => setShowEmojis(!showEmojis)}
                        className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${showEmojis ? 'bg-[#00ADEF] text-white rotate-12' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                        <i className={`ri-emotion-happy-line text-2xl`}></i>
                    </button>
                    <button
                        type="button"
                        onClick={() => fileRef.current.click()}
                        className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title={t('timeline_image_title')}
                    >
                        <i className="ri-image-add-line text-2xl"></i>
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowPollModal(true)}
                        className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title={t('chat_new_poll')}
                    >
                        <i className="ri-bar-chart-box-line text-2xl"></i>
                    </button>
                </div>

                <form onSubmit={sendMessage} className="flex-1 flex items-center gap-2">
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            placeholder={t('chat_placeholder')}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/10 rounded-xl py-2.5 px-4 text-[15px] text-slate-800 dark:text-slate-100 focus:border-[#00ADEF] outline-none shadow-sm placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-colors"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onFocus={() => setShowEmojis(false)}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isSending || (!newMessage.trim() && !selectedImage)}
                        className={`
                            w-11 h-11 rounded-full flex items-center justify-center text-white shadow-lg transition-all
                            ${isSending || (!newMessage.trim() && !selectedImage) ? 'bg-slate-200 text-slate-400' : 'bg-[#00ADEF] hover:bg-[#0095ce] hover:scale-105 active:scale-95 shadow-cyan-100'}
                        `}
                    >
                        {isSending ? <i className="ri-loader-4-line animate-spin text-xl"></i> : <i className="ri-send-plane-2-fill text-xl ml-1"></i>}
                    </button>
                </form>
            </div>

            {/* Hidden File Input */}
            <input
                type="file"
                ref={fileRef}
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                    const f = e.target.files[0];
                    if (f) {
                        setSelectedImage(f);
                        const r = new FileReader();
                        r.onload = (ev) => setImagePreview(ev.target.result);
                        r.readAsDataURL(f);
                    }
                }}
            />

            {/* Poll Creation Modal */}
            {showPollModal && (
                <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-center items-end sm:items-center p-4 transition-colors">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[1rem] p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-8 border dark:border-slate-800">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <i className="ri-bar-chart-2-fill text-[#00ADEF]"></i> Neue Umfrage
                            </h3>
                            <button onClick={() => setShowPollModal(false)} className="w-8 h-8 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                <i className="ri-close-line"></i>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">{t('chat_poll_question')}</label>
                                <input
                                    type="text" autoFocus placeholder="z.B. Was essen wir heute?"
                                    className="w-full mt-1 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-xl px-4 py-3 font-medium outline-none focus:border-[#00ADEF] text-slate-800 dark:text-slate-100 transition-colors"
                                    value={newPollQuestion} onChange={e => setNewPollQuestion(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1 block mb-1">{t('chat_poll_options')}</label>
                                {newPollOptions.map((opt, i) => (
                                    <div key={i} className="flex gap-2 mb-2">
                                        <input
                                            type="text" placeholder={t('chat_option_placeholder', { index: i + 1 })}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-xl px-4 py-2 text-sm font-medium text-slate-800 dark:text-slate-100 outline-none focus:border-[#00ADEF] placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-colors"
                                            value={opt} onChange={e => {
                                                const opts = [...newPollOptions];
                                                opts[i] = e.target.value;
                                                setNewPollOptions(opts);
                                            }}
                                        />
                                        {i >= 2 && (
                                            <button onClick={() => setNewPollOptions(newPollOptions.filter((_, idx) => idx !== i))} className="w-10 shrink-0 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-xl hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors">
                                                <i className="ri-delete-bin-line"></i>
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {newPollOptions.length < 5 && (
                                    <button onClick={() => setNewPollOptions([...newPollOptions, ''])} className="text-xs font-bold text-[#00ADEF] py-2 px-1 hover:underline transition-all">
                                        {t('chat_add_option')}
                                    </button>
                                )}
                            </div>
                        </div>

                        <button
                            disabled={!newPollQuestion.trim() || newPollOptions.filter(o => o.trim()).length < 2 || isSending}
                            onClick={() => sendMessage(null)}
                            className="w-full mt-6 bg-[#00ADEF] text-white font-bold py-3.5 rounded-xl hover:bg-[#0095ce] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-100 dark:shadow-none"
                        >
                            {t('chat_send_poll')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatRoom;

