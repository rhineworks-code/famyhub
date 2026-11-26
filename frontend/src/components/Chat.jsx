import React from 'react';
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
 * Brand-Matched Premium Chat (Dashboard Widget Version)
 * Using Dark Blue (#2B3E6A) and Baby Blue (#00ADEF)
 */
const Chat = ({ user }) => {
    const { t } = useTranslation();
    // State
    const [messages, setMessages] = React.useState([]);
    const [newMessage, setNewMessage] = React.useState('');
    const [selectedImage, setSelectedImage] = React.useState(null);
    const [imagePreview, setImagePreview] = React.useState(null);
    const [showEmojis, setShowEmojis] = React.useState(false);
    const [recentEmojis, setRecentEmojis] = React.useState(JSON.parse(localStorage.getItem('recent_emojis') || '["❤️", "👍", "🙌", "✨"]'));
    const [isSending, setIsSending] = React.useState(false);

    // Constants
    const COMMON_EMOJIS = ['😀', '😂', '😍', '😎', '😭', '😱', '😴', '😋', '😇', '🤔', '🙄', '🤫', '🥳', '🥺', '❤️', '👍', '🙌', '✨', '🔥', '🚀', '✅', '❌', '🍕', '🍻', '🏠', '🚗', '📅', '💡', '💯', '🎉'];

    // Refs
    const scrollRef = React.useRef(null);
    const bottomRef = React.useRef(null);
    const fileRef = React.useRef(null);
    const lastMsgId = React.useRef(null);
    const scrollAttemptsRef = React.useRef(0);

    // Initial Load & Polling
    React.useEffect(() => {
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
        e.preventDefault();
        const text = newMessage.trim();
        if (!text && !selectedImage) return;
        if (isSending) return;

        setIsSending(true);
        try {
            if (selectedImage) {
                const fd = new FormData();
                if (text) fd.append('content', text);
                fd.append('image', selectedImage);
                await api.post('/chat', fd);
            } else {
                await api.post('/chat', { content: text });
            }

            setNewMessage('');
            setSelectedImage(null);
            setImagePreview(null);
            setShowEmojis(false);
            fetchMessages();
        } catch (err) {
            console.error('Send error:', err);
        } finally {
            setIsSending(false);
        }
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
        <div className="flex flex-col h-[500px] md:h-[600px] bg-slate-50 dark:bg-slate-900 relative overflow-hidden font-sans rounded-lg shadow-xl border border-black/[0.06] dark:border-slate-800 transition-colors duration-500">
            {/* Header - Brand Dark Blue */}
            <div className="z-30 px-4 py-3 bg-[#2B3E6A] text-white flex items-center justify-between shrink-0 shadow-md">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white border border-black/[0.06]/10 shadow-inner">
                        <i className="ri-chat-3-line text-lg"></i>
                    </div>
                    <div>
                        <h3 className="font-bold text-white leading-tight text-sm">{t('chat_title')}</h3>
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-cyan-50">{t('chat_active')}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Chat Area - Neutral Clean Background */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-3 py-4 space-y-4 relative custom-scrollbar bg-slate-100/50 dark:bg-slate-950/20 transition-colors"
            >
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 text-slate-400">
                        <i className="ri-chat-4-line text-4xl mb-2"></i>
                        <p className="text-[10px] font-black uppercase tracking-widest">{t('chat_no_messages')}</p>
                    </div>
                )}

                {messages.map((msg, i) => {
                    const isMe = msg.user_id === user?.id;
                    const showName = i === 0 || messages[i - 1].user_id !== msg.user_id;

                    return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} w-full`}>
                            <div className={`
                                relative max-w-[85%] p-2.5 rounded-lg shadow-sm border
                                ${isMe ? 'bg-[#00ADEF] text-white border-cyan-400 rounded-tr-none shadow-[#00ADEF]/10' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-100 dark:border-white/10 rounded-tl-none'}
                            `}>
                                {!isMe && showName && (
                                    <span className={`text-[10px] font-black block mb-0.5 px-0.5 ${isMe ? 'text-white' : 'text-[#2B3E6A] dark:text-cyan-400'}`}>{msg.user_name}</span>
                                )}

                                {msg.image_url && (
                                    <div className="mb-1 cursor-pointer overflow-hidden rounded-lg border border-black/5" onClick={() => window.open(`${serverUrl}/uploads/${msg.image_url}`, '_blank')}>
                                        <img
                                            src={`${serverUrl}/uploads/${msg.image_url}`}
                                            className="max-h-48 w-auto hover:scale-105 transition-transform"
                                            alt="Chat"
                                            onLoad={() => scrollToBottom('smooth')}
                                        />
                                    </div>
                                )}

                                {msg.content && (
                                    <div className="px-0.5 text-[13px] leading-relaxed whitespace-pre-wrap break-words font-medium">
                                        {msg.content}
                                    </div>
                                )}

                                <div className="flex justify-end items-center mt-1 gap-1 pr-0.5">
                                    <span className={`text-[8px] font-bold uppercase ${isMe ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>{formatTime(msg.created_at)}</span>
                                    {isMe && <i className="ri-check-double-line text-cyan-200 text-[11px]"></i>}
                                </div>
                            </div>
                        </div>
                    );
                })}
                {/* Invisible bottom anchor for scrollIntoView */}
                <div ref={bottomRef} style={{ height: 1 }} />
            </div>

            {/* Emoji Panel */}
            {showEmojis && (
                <div className="absolute bottom-16 left-2 right-2 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-lg shadow-2xl border border-black/[0.06] dark:border-white/10 z-30 p-3 max-h-40 overflow-y-auto custom-scrollbar transition-colors">
                    <div className="flex flex-wrap gap-1.5 justify-center">
                        {[...recentEmojis, ...COMMON_EMOJIS].filter((v, i, a) => a.indexOf(v) === i).map((e, idx) => (
                            <button key={idx} type="button" onClick={() => addEmoji(e)} className="w-9 h-9 flex items-center justify-center text-xl hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-transform active:scale-75">{e}</button>
                        ))}
                    </div>
                </div>
            )}

            {/* Footer Input Area */}
            <div className="shrink-0 bg-white dark:bg-slate-900 px-3 py-2 flex items-center gap-2 z-30 border-t border-slate-200 dark:border-slate-800 transition-colors">
                <div className="flex gap-0.5">
                    <button
                        type="button"
                        onClick={() => setShowEmojis(!showEmojis)}
                        className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${showEmojis ? 'bg-[#00ADEF] text-white' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                        <i className={`ri-emotion-happy-line text-xl`}></i>
                    </button>
                    <button
                        type="button"
                        onClick={() => fileRef.current.click()}
                        className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        <i className="ri-add-line text-xl"></i>
                    </button>
                </div>

                <form onSubmit={sendMessage} className="flex-1 flex items-center gap-2">
                    <input
                        type="text"
                        placeholder={t('chat_placeholder')}
                        className="flex-1 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-xl py-2 px-3 text-[13px] outline-none shadow-inner focus:border-[#00ADEF] transition-colors text-slate-800 dark:text-slate-100"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onFocus={() => setShowEmojis(false)}
                    />

                    <button
                        type="submit"
                        disabled={isSending || (!newMessage.trim() && !selectedImage)}
                        className={`
                            w-10 h-10 rounded-full flex items-center justify-center text-white shadow-md transition-all
                            ${isSending || (!newMessage.trim() && !selectedImage) ? 'bg-slate-200' : 'bg-[#00ADEF] hover:bg-[#0095ce] hover:scale-105 active:scale-95'}
                        `}
                    >
                        {isSending ? <i className="ri-loader-4-line animate-spin text-lg"></i> : <i className="ri-send-plane-2-fill text-lg ml-0.5"></i>}
                    </button>
                </form>
            </div>

            <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={(e) => {
                const f = e.target.files[0];
                if (f) {
                    setSelectedImage(f);
                    const r = new FileReader();
                    r.onload = (ev) => setImagePreview(ev.target.result);
                    r.readAsDataURL(f);
                }
            }} />
        </div>
    );
};

export default Chat;
