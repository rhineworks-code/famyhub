import React from 'react';
import api from '../services/api';
import { useTranslation } from '../i18n.jsx';

const Wishlist = ({ user }) => {
    const { t } = useTranslation();
    const [wishlists, setWishlists] = React.useState([]);
    const [activeTab, setActiveTab] = React.useState('family'); // 'my' or 'family'

    // UI State
    const [isListModalOpen, setIsListModalOpen] = React.useState(false);
    const [isItemModalOpen, setIsItemModalOpen] = React.useState(false);
    const [activeListId, setActiveListId] = React.useState(null);
    const [editItemData, setEditItemData] = React.useState(null);

    // Form State
    const [newListTitle, setNewListTitle] = React.useState('');
    const [itemFormData, setItemFormData] = React.useState({ title: '', url: '', price: '', notes: '' });

    React.useEffect(() => {
        fetchWishlists();
    }, []);

    const fetchWishlists = async () => {
        try {
            const res = await api.get('/wishlists');
            setWishlists(res.data);
        } catch (error) {
            console.error('Error fetching wishlists:', error);
        }
    };

    // --- List Operations ---
    const handleCreateList = async (e) => {
        e.preventDefault();
        try {
            await api.post('/wishlists', { title: newListTitle });
            setNewListTitle('');
            setIsListModalOpen(false);
            fetchWishlists();
        } catch (error) {
            console.error('Error creating wishlist:', error);
            alert(t('save_error'));
        }
    };

    const handleDeleteList = async (listId) => {
        if (!confirm(t('confirm_delete_list'))) return;
        try {
            await api.delete(`/wishlists/${listId}`);
            fetchWishlists();
        } catch (error) {
            console.error('Error deleting wishlist:', error);
            alert(t('save_error'));
        }
    };

    // --- Item Operations ---
    const openItemModal = (listId, item = null) => {
        setActiveListId(listId);
        if (item) {
            setEditItemData(item);
            setItemFormData({ title: item.title, url: item.url || '', price: item.price || '', notes: item.notes || '' });
        } else {
            setEditItemData(null);
            setItemFormData({ title: '', url: '', price: '', notes: '' });
        }
        setIsItemModalOpen(true);
    };

    const handleSaveItem = async (e) => {
        e.preventDefault();
        try {
            if (editItemData) {
                await api.put(`/wishlists/${activeListId}/items/${editItemData.id}`, itemFormData);
            } else {
                await api.post(`/wishlists/${activeListId}/items`, itemFormData);
            }
            setIsItemModalOpen(false);
            fetchWishlists();
        } catch (error) {
            console.error('Error saving item:', error);
            alert(t('save_error'));
        }
    };

    const handleDeleteItem = async (listId, itemId) => {
        if (!confirm(t('confirm_delete_item'))) return;
        try {
            await api.delete(`/wishlists/${listId}/items/${itemId}`);
            fetchWishlists();
        } catch (error) {
            console.error('Error deleting item:', error);
        }
    };

    // --- Reservation Operations ---
    const handleToggleReservation = async (listId, item) => {
        try {
            if (item.reserved_by === user.id) {
                await api.post(`/wishlists/${listId}/items/${item.id}/unreserve`);
            } else {
                await api.post(`/wishlists/${listId}/items/${item.id}/reserve`);
            }
            fetchWishlists();
        } catch (error) {
            console.error('Error toggling reservation:', error);
            alert(error.response?.data?.error || t('save_error'));
        }
    };

    // --- Render Helpers ---
    const myWishlists = wishlists.filter(w => w.user_id === user.id);
    const familyWishlists = wishlists.filter(w => w.user_id !== user.id);
    const activeData = activeTab === 'my' ? myWishlists : familyWishlists;

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden rounded-[1.25rem] shadow-sm border border-black/[0.06] dark:border-slate-800 transition-colors duration-500">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 px-8 pt-8 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] relative z-10 border-b dark:border-slate-800">
                <div>
                    <h1 className="text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
                        <i className="ri-gift-2-fill text-brand-dark"></i> {t('wishlist_title')}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">{t('wishlist_subtitle')}</p>
                </div>

                <button
                    onClick={() => setIsListModalOpen(true)}
                    className="bg-brand-dark text-white px-6 py-3 rounded-lg font-black shadow-lg hover:bg-slate-800 active:scale-95 transition-all flex items-center gap-2 whitespace-nowrap"
                >
                    <i className="ri-add-line text-lg"></i> {t('wishlist_new_list')}
                </button>
            </div>

            {/* Tabs */}
            <div className="px-8 flex gap-4 mt-6">
                <button
                    onClick={() => setActiveTab('family')}
                    className={`px-6 py-3 rounded-lg font-bold transition-all ${activeTab === 'family' ? 'bg-brand-dark text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-black/[0.06] dark:border-white/10'}`}
                >
                    <i className="ri-group-line mr-2"></i> {t('family_label')} ({familyWishlists.length})
                </button>
                <button
                    onClick={() => setActiveTab('my')}
                    className={`px-6 py-3 rounded-lg font-bold transition-all ${activeTab === 'my' ? 'bg-brand-dark text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-black/[0.06] dark:border-white/10'}`}
                >
                    <i className="ri-user-smile-line mr-2"></i> {t('my_label')} ({myWishlists.length})
                </button>
            </div>

            {/* Content Container */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {activeData.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-600">
                        <div className="w-24 h-24 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center mb-6 shadow-sm border dark:border-slate-800">
                            <i className="ri-gift-line text-5xl text-slate-300 dark:text-slate-600"></i>
                        </div>
                        <p className="text-xl font-black text-slate-400 dark:text-slate-500">{t('wishlist_no_items')}</p>
                        <p className="text-sm font-bold mt-2 dark:text-slate-600">{activeTab === 'my' ? t('wishlist_new_item_desc_my') : t('wishlist_new_item_desc_family')}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
                        {activeData.map(list => (
                            <div key={list.id} className="bg-white dark:bg-slate-900 rounded-[1rem] border border-slate-50 dark:border-slate-800 shadow-sm p-6">
                                {/* List Header */}
                                <div className="flex justify-between items-start mb-6 pb-4 border-b border-slate-50 dark:border-slate-800">
                                    <div>
                                        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-1">{list.title}</h2>
                                        {activeTab === 'family' && (
                                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-[10px] flex-shrink-0">
                                                    {list.owner_name?.charAt(0)}
                                                </span>
                                                {t('recipes_creator_prefix')} {list.owner_name}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        {(list.user_id === user.id || user.is_admin === 1) && (
                                            <>
                                                <button onClick={() => openItemModal(list.id)} className="w-10 h-10 flex text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-brand-dark rounded-xl transition flex items-center justify-center tooltip-parent">
                                                    <i className="ri-add-line text-xl"></i>
                                                    <span className="tooltip">{t('wishlist_new_item')}</span>
                                                </button>
                                                <button onClick={() => handleDeleteList(list.id)} className="w-10 h-10 flex text-slate-400 dark:text-slate-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 rounded-xl transition flex items-center justify-center tooltip-parent">
                                                    <i className="ri-delete-bin-line text-xl"></i>
                                                    <span className="tooltip">{t('delete')}</span>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Items */}
                                <div className="space-y-4">
                                    {list.items.length === 0 ? (
                                        <div className="text-center py-8 border border-dashed border-slate-100 dark:border-slate-800 rounded-lg">
                                            <p className="text-slate-400 dark:text-slate-600 font-bold text-sm">{t('wishlist_no_items')}</p>
                                        </div>
                                    ) : (
                                        list.items.map(item => (
                                            <div key={item.id} className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-black/[0.06] dark:border-slate-800 hover:border-brand-light/20 dark:hover:border-brand-dark/20 hover:shadow-sm bg-slate-50/50 dark:bg-slate-800/20 transition-all">

                                                <div className="flex flex-row gap-4 flex-1 min-w-0">
                                                    {/* Image Thumbnail */}
                                                    {item.image_url && (
                                                        <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-xl overflow-hidden bg-white dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 shadow-sm flex items-center justify-center p-1">
                                                            <img src={item.image_url} alt={item.title} className="object-contain w-full h-full" />
                                                        </div>
                                                    )}

                                                    {/* Details */}
                                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h3 className={`font-bold text-slate-800 dark:text-slate-200 truncate ${item.reserved_by ? 'line-through opacity-50' : ''}`}>{item.title}</h3>
                                                            {item.price && <span className="text-xs font-black text-brand-dark dark:text-brand-light bg-brand-light/10 dark:bg-brand-light/20 px-2 py-0.5 rounded-full whitespace-nowrap">{item.price} €</span>}
                                                        </div>

                                                        {item.notes && <p className="text-sm text-slate-500 mb-2 leading-relaxed">{item.notes}</p>}

                                                        {item.url && (
                                                            <a href={item.url.startsWith('http') ? item.url : `https://${item.url}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-brand-dark dark:text-brand-light hover:underline truncate max-w-full">
                                                                <i className="ri-external-link-line"></i> {new URL(item.url.startsWith('http') ? item.url : `https://${item.url}`).hostname}
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {/* Reserve Button (Only visible if you are NOT the owner) */}
                                                    {list.user_id !== user.id && (
                                                        <button
                                                            onClick={() => handleToggleReservation(list.id, item)}
                                                            disabled={item.reserved_by && item.reserved_by !== user.id}
                                                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-sm ${!item.reserved_by
                                                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/20 hover:text-emerald-600 dark:hover:text-emerald-400 border border-black/[0.06] dark:border-white/10'
                                                                    : item.reserved_by === user.id
                                                                        ? 'bg-emerald-500 text-white'
                                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 opacity-70 cursor-not-allowed border border-transparent'
                                                                }`}
                                                            title={item.reserved_by && item.reserved_by !== user.id ? `${t('wishlist_reserved_by')} ${item.reserved_by_name}` : ''}
                                                        >
                                                            {item.reserved_by === user.id ? (
                                                                <><i className="ri-checkbox-circle-fill"></i> {t('wishlist_bought_by_me')}</>
                                                            ) : item.reserved_by ? (
                                                                <><i className="ri-lock-2-line"></i> {t('wishlist_reserved')}</>
                                                            ) : (
                                                                <><i className="ri-gift-line"></i> {t('wishlist_reserve')}</>
                                                            )}
                                                        </button>
                                                    )}

                                                    {/* Owner Edit/Delete Actions */}
                                                    {list.user_id === user.id && (
                                                        <>
                                                            <button onClick={() => openItemModal(list.id, item)} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-brand-dark dark:hover:text-brand-light rounded-lg border border-black/[0.06] dark:border-white/10 shadow-sm transition opacity-0 group-hover:opacity-100">
                                                                <i className="ri-edit-2-line"></i>
                                                            </button>
                                                            <button onClick={() => handleDeleteItem(list.id, item.id)} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg border border-black/[0.06] dark:border-white/10 shadow-sm transition opacity-0 group-hover:opacity-100">
                                                                <i className="ri-delete-bin-line"></i>
                                                            </button>
                                                        </>
                                                    )}
                                                </div>

                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* List Modal */}
            {isListModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <form onSubmit={handleCreateList} className="bg-white dark:bg-slate-900 rounded-[1.25rem] p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 border border-transparent dark:border-slate-800">
                        <div className="w-16 h-16 bg-brand-light/10 dark:bg-brand-light/20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <i className="ri-list-check-2 text-3xl text-brand-dark dark:text-brand-light"></i>
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 text-center mb-6">{t('wishlist_new_list')}</h3>

                        <div className="mb-8">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('wishlist_field_title')}</label>
                            <input
                                required autoFocus type="text"
                                className="w-full mt-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg focus:ring-4 focus:ring-brand-light/10 outline-none font-bold text-center text-lg text-slate-800 dark:text-slate-100"
                                value={newListTitle} onChange={e => setNewListTitle(e.target.value)}
                            />
                        </div>

                        <div className="flex flex-col gap-3">
                            <button type="submit" className="w-full py-4 bg-brand-dark text-white font-black rounded-lg shadow-xl hover:bg-slate-800 transition-all">
                                {t('wishlist_create_btn')}
                            </button>
                            <button type="button" onClick={() => setIsListModalOpen(false)} className="w-full py-4 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition">
                                {t('cancel')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Item Modal */}
            {isItemModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <form onSubmit={handleSaveItem} className="bg-white dark:bg-slate-900 rounded-[1.25rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 overflow-y-auto max-h-[90vh] custom-scrollbar border border-transparent dark:border-slate-800">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-50 dark:border-slate-800 pb-4">
                            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <i className="ri-gift-line text-brand-light"></i> {editItemData ? t('wishlist_edit_item') : t('wishlist_new_item')}
                            </h3>
                            <button type="button" onClick={() => setIsItemModalOpen(false)} className="w-10 h-10 flex border border-black/[0.06] dark:border-white/10 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition flex items-center justify-center"><i className="ri-close-line text-xl"></i></button>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('wishlist_field_title')} *</label>
                                <input
                                    required type="text" autoFocus
                                    className="w-full mt-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg focus:ring-4 focus:ring-brand-light/10 outline-none font-bold text-slate-800 dark:text-slate-100"
                                    value={itemFormData.title} onChange={e => setItemFormData({ ...itemFormData, title: e.target.value })}
                                />
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('wishlist_link')} (Optional)</label>
                                    <input
                                        type="url" placeholder="https://"
                                        className="w-full mt-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg focus:ring-4 focus:ring-brand-light/10 outline-none font-medium text-sm text-slate-800 dark:text-slate-100"
                                        value={itemFormData.url} onChange={e => setItemFormData({ ...itemFormData, url: e.target.value })}
                                    />
                                </div>
                                <div className="w-1/3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('wishlist_price_label')}</label>
                                    <div className="relative">
                                        <input
                                            type="number" step="0.01" placeholder="0.00"
                                            className="w-full mt-1 pl-4 pr-8 py-3 bg-slate-50 border border-black/[0.06] rounded-lg focus:ring-4 focus:ring-brand-light/10 outline-none font-bold text-sm"
                                            value={itemFormData.price} onChange={e => setItemFormData({ ...itemFormData, price: e.target.value })}
                                        />
                                        <i className="ri-money-euro-box-line absolute right-3 top-1/2 -translate-y-[20%] text-slate-400"></i>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('wishlist_notes_label')} (Optional)</label>
                                <textarea
                                    className="w-full mt-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg focus:ring-4 focus:ring-brand-light/10 outline-none font-medium text-sm resize-none text-slate-800 dark:text-slate-100"
                                    rows="3"
                                    value={itemFormData.notes} onChange={e => setItemFormData({ ...itemFormData, notes: e.target.value })}
                                ></textarea>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-50 dark:border-slate-800">
                            <button type="button" onClick={() => setIsItemModalOpen(false)} className="px-6 py-3 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition">{t('cancel')}</button>
                            <button type="submit" className="px-8 py-3 bg-brand-dark text-white font-black rounded-lg shadow-xl hover:bg-slate-800 transition-all">{t('save_btn')}</button>
                        </div>
                    </form>
                </div>
            )}

            <style>{`
                .tooltip-parent { position: relative; }
                .tooltip {
                    visibility: hidden; position: absolute; bottom: 120%; left: 50%; transform: translateX(-50%);
                    background-color: #1e293b; color: #fff; text-align: center; border-radius: 8px; padding: 4px 8px; z-index: 1;
                    font-size: 10px; font-weight: 800; white-space: nowrap; opacity: 0; transition: opacity 0.2s;
                }
                .tooltip-parent:hover .tooltip { visibility: visible; opacity: 1; }
            `}</style>
        </div>
    );
};

export default Wishlist;
