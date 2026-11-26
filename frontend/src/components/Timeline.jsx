import React from 'react';
import api from '../services/api';
import { useTranslation } from '../i18n.jsx';
import { applyOffset } from '../utils/time';

const Timeline = ({ user, isWidget = false }) => {
    const { t } = useTranslation();
    const [posts, setPosts] = React.useState([]);
    const [newPostContent, setNewPostContent] = React.useState('');
    const [isPoll, setIsPoll] = React.useState(false);
    const [pollOptions, setPollOptions] = React.useState(['', '']);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [error, setError] = React.useState('');
    
    // Image State
    const [selectedImage, setSelectedImage] = React.useState(null);
    const [imagePreview, setImagePreview] = React.useState(null);
    const fileInputRef = React.useRef(null);

    // Comments State
    const [activeCommentsPostId, setActiveCommentsPostId] = React.useState(null);
    const [postComments, setPostComments] = React.useState({}); // postId -> comments[]
    const [newCommentContent, setNewCommentContent] = React.useState('');
    const [isCommenting, setIsCommenting] = React.useState(false);

    React.useEffect(() => {
        fetchPosts();
    }, []);

    const fetchPosts = async () => {
        try {
            const res = await api.get('/timeline');
            setPosts(res.data);
        } catch (err) {
            console.error('Fetch timeline error:', err);
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCreatePost = async (e) => {
        e.preventDefault();
        if (!newPostContent.trim() && !isPoll && !selectedImage) return;
        
        setIsSubmitting(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('content', newPostContent);
            formData.append('type', isPoll ? 'poll' : 'post');
            
            if (isPoll) {
                formData.append('poll_data', JSON.stringify({
                    options: pollOptions.filter(o => o.trim()).map((o, idx) => ({ id: idx, text: o, votes: [] }))
                }));
            }

            if (selectedImage) {
                formData.append('image', selectedImage);
            }

            await api.post('/timeline', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setNewPostContent('');
            setIsPoll(false);
            setPollOptions(['', '']);
            setSelectedImage(null);
            setImagePreview(null);
            fetchPosts();
        } catch (err) {
            setError(t('timeline_post_error'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleComments = async (postId) => {
        if (activeCommentsPostId === postId) {
            setActiveCommentsPostId(null);
            return;
        }

        setActiveCommentsPostId(postId);
        if (!postComments[postId]) {
            try {
                const res = await api.get(`/timeline/${postId}/comments`);
                setPostComments(prev => ({ ...prev, [postId]: res.data }));
            } catch (err) { console.error(err); }
        }
    };

    const handleAddComment = async (postId) => {
        if (!newCommentContent.trim() || isCommenting) return;
        setIsCommenting(true);
        try {
            await api.post(`/timeline/${postId}/comments`, { content: newCommentContent });
            setNewCommentContent('');
            // Refresh comments
            const res = await api.get(`/timeline/${postId}/comments`);
            setPostComments(prev => ({ ...prev, [postId]: res.data }));
            fetchPosts(); // Refresh post list to update comment count
        } catch (err) { console.error(err); }
        finally { setIsCommenting(false); }
    };

    const handleReact = async (postId, reaction) => {
        try {
            await api.post(`/timeline/${postId}/react`, { reaction });
            fetchPosts();
        } catch (err) { console.error(err); }
    };

    const handleVote = async (postId, optionId) => {
        try {
            await api.post(`/timeline/${postId}/vote`, { optionId });
            fetchPosts();
        } catch (err) { console.error(err); }
    };

    const handleDeletePost = async (postId) => {
        if (!window.confirm(t('timeline_delete_confirm'))) return;
        try {
            await api.delete(`/timeline/${postId}`);
            fetchPosts();
        } catch (err) { console.error(err); }
    };

    const renderPoll = (post) => {
        const totalVotes = post.poll_data.options.reduce((sum, opt) => sum + opt.votes.length, 0);
        return (
            <div className="space-y-3 mt-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-black/[0.06] dark:border-slate-800">
                {post.poll_data.options.map((opt) => {
                    const percentage = totalVotes > 0 ? (opt.votes.length / totalVotes) * 100 : 0;
                    const hasVoted = opt.votes.includes(user.id);
                    return (
                        <button
                            key={opt.id}
                            onClick={() => handleVote(post.id, opt.id)}
                            className="w-full text-left relative overflow-hidden h-10 rounded-xl border border-black/[0.06] dark:border-white/10 bg-white dark:bg-slate-800 hover:border-brand-light dark:hover:border-brand-dark transition-all group"
                        >
                            <div 
                                className="absolute inset-y-0 left-0 bg-brand-light/10 transition-all duration-500" 
                                style={{ width: `${percentage}%` }}
                            ></div>
                            <div className="relative z-10 px-4 flex justify-between items-center h-full">
                                <span className={`font-bold text-sm ${hasVoted ? 'text-brand-dark' : 'text-slate-600 dark:text-slate-300'}`}>
                                    {opt.text} {hasVoted && <i className="ri-checkbox-circle-fill ml-1"></i>}
                                </span>
                                <span className="text-[10px] font-black text-slate-400">{Math.round(percentage)}%</span>
                            </div>
                        </button>
                    );
                })}
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">{totalVotes} {t('timeline_votes')}</p>
            </div>
        );
    };

    return (
        <div className={`flex flex-col gap-6 ${isWidget ? 'h-full overflow-hidden' : ''}`}>
            {!isWidget && (
                <div className="bg-white dark:bg-slate-900 rounded-[1.25rem] p-6 shadow-sm border border-black/[0.06] dark:border-slate-800 animate-in slide-in-from-top-4">
                    <form onSubmit={handleCreatePost} className="space-y-4">
                        <div className="flex gap-4">
                            <div className="w-12 h-12 rounded-lg bg-brand-light/10 flex items-center justify-center shrink-0">
                                {user.profile_picture ? (
                                    <img src={user.profile_picture} alt="" className="w-full h-full rounded-lg object-cover" />
                                ) : (
                                    <i className="ri-user-smile-line text-brand-dark text-xl"></i>
                                )}
                            </div>
                            <div className="flex-1 space-y-4">
                                <textarea
                                    value={newPostContent}
                                    onChange={(e) => setNewPostContent(e.target.value)}
                                    placeholder={t('timeline_whats_new')}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-4 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-brand-light/20 resize-none h-24 transition-all"
                                ></textarea>
                                
                                {imagePreview && (
                                    <div className="relative w-full max-h-60 rounded-lg overflow-hidden border border-black/[0.06] dark:border-slate-800 group">
                                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                        <button 
                                            type="button"
                                            onClick={() => { setSelectedImage(null); setImagePreview(null); }}
                                            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                                        >
                                            <i className="ri-close-line"></i>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {isPoll && (
                            <div className="pl-16 space-y-2 animate-in fade-in slide-in-from-top-2">
                                {pollOptions.map((opt, idx) => (
                                    <input
                                        key={idx}
                                        value={opt}
                                        onChange={(e) => {
                                            const newOpts = [...pollOptions];
                                            newOpts[idx] = e.target.value;
                                            setPollOptions(newOpts);
                                        }}
                                        placeholder={`${t('timeline_poll_option_placeholder')} ${idx + 1}`}
                                        className="w-full bg-white dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-xl px-4 py-2 text-sm focus:border-brand-light outline-none dark:text-slate-100"
                                    />
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setPollOptions([...pollOptions, ''])}
                                    className="text-xs font-bold text-brand-light hover:text-brand-dark"
                                >
                                    {t('timeline_add_option')}
                                </button>
                            </div>
                        )}

                        <div className="flex items-center justify-between pl-16">
                            <div className="flex gap-2">
                                <button 
                                    type="button" 
                                    onClick={() => setIsPoll(!isPoll)}
                                    className={`p-2 rounded-xl transition-colors ${isPoll ? 'bg-brand-light text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400'}`}
                                    title={t('timeline_poll_title')}
                                >
                                    <i className="ri-bar-chart-2-line text-xl"></i>
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => fileInputRef.current.click()}
                                    className={`p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors ${selectedImage ? 'text-brand-dark dark:text-brand-light bg-brand-light/10 dark:bg-brand-light/20' : 'text-slate-400'}`} 
                                    title={t('timeline_image_title')}
                                >
                                    <i className="ri-image-add-line text-xl"></i>
                                </button>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handleFileSelect} 
                                    className="hidden" 
                                    accept="image/*" 
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isSubmitting || (!newPostContent.trim() && !isPoll && !selectedImage)}
                                className="bg-brand-dark text-white px-8 py-2.5 rounded-lg font-black text-sm shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                            >
                                {isSubmitting ? t('timeline_posting_btn') : t('timeline_post_btn')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className={`space-y-6 ${isWidget ? 'overflow-y-auto px-4 pb-8 h-full custom-scrollbar' : ''}`}>
                {posts.map((post) => (
                    <div key={post.id} className="bg-white dark:bg-slate-900 rounded-[1.25rem] p-6 shadow-sm border border-black/[0.06] dark:border-slate-800 animate-in fade-in slide-in-from-bottom-4 group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex gap-4">
                                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 border border-black/[0.06]">
                                    {post.profile_picture ? (
                                        <img src={post.profile_picture} alt="" className="w-full h-full rounded-xl object-cover" />
                                    ) : (
                                        <i className="ri-user-heart-line text-slate-400"></i>
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <h4 className="font-black text-slate-800 dark:text-slate-100 leading-tight truncate">{post.username}</h4>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                        {applyOffset(new Date(post.created_at), user).toLocaleString(t('locale') || 'de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                            {post.user_id === user.id && !isWidget && (
                                <button 
                                    onClick={() => handleDeletePost(post.id)}
                                    className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <i className="ri-delete-bin-line"></i>
                                </button>
                            )}
                        </div>

                        <div className={isWidget ? 'pl-0' : 'pl-14'}>
                            <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{post.content}</p>
                            
                            {post.type === 'poll' && post.poll_data && renderPoll(post)}
                            
                            {post.media_url && (
                                <div className="mt-4 rounded-xl overflow-hidden border border-black/[0.06] dark:border-slate-800 shadow-sm">
                                    <img src={post.media_url} alt="" className="w-full h-auto max-h-[400px] object-cover" />
                                </div>
                            )}

                            <div className="flex items-center gap-6 mt-6 pt-4 border-t border-slate-50">
                                <button 
                                    onClick={() => handleReact(post.id, 'like')}
                                    className={`flex items-center gap-2 font-black text-xs transition-colors ${post.reactions && post.reactions.some(r => r.user_id === user.id) ? 'text-red-500' : 'text-slate-400 hover:text-red-500'}`}
                                >
                                    <i className={post.reactions && post.reactions.some(r => r.user_id === user.id) ? "ri-heart-3-fill" : "ri-heart-3-line"}></i>
                                    {post.reactions ? post.reactions.length : 0} {t('timeline_like')}
                                </button>
                                <button 
                                    onClick={() => toggleComments(post.id)}
                                    className={`flex items-center gap-2 font-black text-xs transition-colors ${activeCommentsPostId === post.id ? 'text-brand-dark dark:text-brand-light' : 'text-slate-400 dark:text-slate-500 hover:text-brand-dark'}`}
                                >
                                    <i className="ri-chat-3-line"></i> {post.comment_count || 0} {t('timeline_comments_count')}
                                </button>
                                {isWidget && (
                                    <button 
                                        className="ml-auto text-[10px] font-black uppercase tracking-widest text-brand-light dark:text-brand-light/80 hover:text-brand-dark dark:hover:text-white transition-colors"
                                        onClick={() => window.location.href = '/timeline'}
                                    >
                                        {t('timeline_fullscreen')}
                                    </button>
                                )}
                            </div>

                            {/* Comments Section */}
                            {activeCommentsPostId === post.id && (
                                <div className="mt-6 space-y-4 animate-in slide-in-from-top-2">
                                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-4">
                                        {postComments[post.id]?.map((comment) => (
                                            <div key={comment.id} className="flex gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center shrink-0 border border-black/[0.06] dark:border-slate-600 mt-0.5">
                                                    {comment.profile_picture ? (
                                                        <img src={comment.profile_picture} alt="" className="w-full h-full rounded-lg object-cover" />
                                                    ) : (
                                                        <i className="ri-user-smile-line text-slate-300 dark:text-slate-500 text-xs"></i>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{comment.username}</span>
                                                        <span className="text-[9px] text-slate-400">{applyOffset(new Date(comment.created_at), user).toLocaleTimeString(t('locale') || 'de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">{comment.content}</p>
                                                </div>
                                            </div>
                                        ))}

                                        <div className="flex gap-3 pt-2">
                                            <div className="w-8 h-8 rounded-lg bg-brand-light/10 flex items-center justify-center shrink-0">
                                                <i className="ri-chat-smile-line text-brand-dark text-xs"></i>
                                            </div>
                                            <div className="flex-1 flex gap-2">
                                                <input 
                                                    value={newCommentContent}
                                                    onChange={(e) => setNewCommentContent(e.target.value)}
                                                    placeholder={t('timeline_write_comment')}
                                                    className="flex-1 bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-brand-light dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                                    onKeyPress={(e) => { if(e.key === 'Enter') handleAddComment(post.id); }}
                                                />
                                                <button 
                                                    onClick={() => handleAddComment(post.id)}
                                                    disabled={!newCommentContent.trim() || isCommenting}
                                                    className="bg-brand-dark text-white p-2 rounded-xl disabled:opacity-50"
                                                >
                                                    <i className="ri-send-plane-2-fill"></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {posts.length === 0 && (
                    <div className="text-center py-12 text-slate-400 dark:text-slate-600 italic">{t('timeline_no_posts')}</div>
                )}
            </div>
        </div>
    );
};

export default Timeline;
