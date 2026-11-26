import React from 'react';
import api from '../services/api';
import { useTranslation } from '../i18n.jsx';

const ShoppingList = () => {
    const { t } = useTranslation();
    const [lists, setLists] = React.useState([]);
    const [activeListId, setActiveListId] = React.useState(null);
    const [items, setItems] = React.useState([]);
    const [newItem, setNewItem] = React.useState('');
    const [category, setCategory] = React.useState({ name: 'Allgemein', icon: 'ri-shopping-basket-2-line', color: 'bg-gray-100 text-gray-600' });
    const [isAddingList, setIsAddingList] = React.useState(false);
    const [newListName, setNewListName] = React.useState('');
    const [deleteConfirm, setDeleteConfirm] = React.useState(null); // id of list to confirm deletion
    const newListInputRef = React.useRef(null);

    const categories = [
        { name: 'Allgemein', displayName: t('category_general'), icon: 'ri-shopping-basket-2-line', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
        { name: 'Lebensmittel', displayName: t('category_food'), icon: 'ri-restaurant-line', color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' },
        { name: 'Haushalt', displayName: t('category_household'), icon: 'ri-home-line', color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
        { name: 'Persönlich', displayName: t('category_personal'), icon: 'ri-user-line', color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
    ];

    // Load lists on mount
    React.useEffect(() => {
        fetchLists();
    }, []);

    // Load items when active list changes
    React.useEffect(() => {
        if (activeListId) fetchItems(activeListId);
    }, [activeListId]);

    // Focus new list input when it appears
    React.useEffect(() => {
        if (isAddingList && newListInputRef.current) {
            newListInputRef.current.focus();
        }
    }, [isAddingList]);

    const fetchLists = async () => {
        try {
            const res = await api.get('/shopping/lists');
            setLists(res.data);
            if (res.data.length > 0) {
                setActiveListId(prev => prev ?? res.data[0].id);
            }
        } catch (err) {
            console.error('Error fetching lists:', err);
        }
    };

    const fetchItems = async (listId) => {
        try {
            const res = await api.get(`/shopping?list_id=${listId}`);
            setItems(res.data);
        } catch (err) {
            console.error('Error fetching items:', err);
        }
    };

    const createList = async () => {
        const name = newListName.trim();
        if (!name) return;
        try {
            const res = await api.post('/shopping/lists', { name });
            setLists(prev => [...prev, res.data]);
            setActiveListId(res.data.id);
            setNewListName('');
            setIsAddingList(false);
        } catch (err) {
            console.error('Error creating list:', err);
        }
    };

    const handleCreateListKey = (e) => {
        if (e.key === 'Enter') createList();
        if (e.key === 'Escape') { setIsAddingList(false); setNewListName(''); }
    };

    const deleteList = async (id) => {
        try {
            await api.delete(`/shopping/lists/${id}`);
            const updated = lists.filter(l => l.id !== id);
            setLists(updated);
            if (activeListId === id) {
                setActiveListId(updated.length > 0 ? updated[0].id : null);
                setItems([]);
            }
            setDeleteConfirm(null);
        } catch (err) {
            console.error('Error deleting list:', err);
        }
    };

    const addItem = async (e) => {
        e.preventDefault();
        if (!newItem.trim() || !activeListId) return;
        try {
            const res = await api.post('/shopping', {
                name: newItem,
                category: category.name,
                list_id: activeListId
            });
            setItems(prev => [...prev, res.data]);
            setNewItem('');
        } catch (err) {
            console.error('Error adding item:', err);
        }
    };

    const toggleComplete = async (item) => {
        try {
            const updated = { ...item, completed: !item.completed };
            await api.put(`/shopping/${item.id}`, { completed: updated.completed ? 1 : 0 });
            setItems(prev => prev.map(i => i.id === item.id ? updated : i));
        } catch (err) {
            console.error('Error updating item:', err);
        }
    };

    const deleteItem = async (id) => {
        try {
            await api.delete(`/shopping/${id}`);
            setItems(prev => prev.filter(i => i.id !== id));
        } catch (err) {
            console.error('Error deleting item:', err);
        }
    };

    const getCategoryStyle = (catName) =>
        categories.find(c => c.name === catName) || categories[0];

    const activeList = lists.find(l => l.id === activeListId);

    return (
        <div className="max-w-4xl mx-auto space-y-4">

            {/* List Tabs */}
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-black/[0.06] dark:border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mr-2 hidden sm:block">{t('lists')}</h2>

                    {lists.map(list => (
                        <div key={list.id} className="relative group flex items-center">
                            <button
                                onClick={() => setActiveListId(list.id)}
                                className={`h-9 px-4 rounded-xl font-bold text-sm transition-all ${activeListId === list.id
                                        ? 'bg-brand-dark text-white shadow-lg'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                            >
                                {list.name}
                            </button>
                            {/* Delete button for this list */}
                            {deleteConfirm === list.id ? (
                                <div className="absolute top-0 left-0 flex items-center gap-1 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900 rounded-xl shadow-lg px-2 py-1 z-10 whitespace-nowrap">
                                    <span className="text-xs font-bold text-red-600">{t('delete_confirm_short')}</span>
                                    <button
                                        onClick={() => deleteList(list.id)}
                                        className="text-xs font-black text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded-lg transition"
                                    >{t('yes')}</button>
                                    <button
                                        onClick={() => setDeleteConfirm(null)}
                                        className="text-xs font-black text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 px-2 py-0.5 rounded-lg transition"
                                    >{t('no')}</button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setDeleteConfirm(list.id)}
                                    title={t('delete_list')}
                                    className={`ml-1 w-5 h-5 rounded-full flex items-center justify-center text-xs transition-all ${activeListId === list.id
                                            ? 'text-white/60 hover:text-white hover:bg-white/20 opacity-100'
                                            : 'text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100'
                                        }`}
                                >
                                    <i className="ri-close-line"></i>
                                </button>
                            )}
                        </div>
                    ))}

                    {/* New List Input or Button */}
                    {isAddingList ? (
                        <div className="flex items-center gap-2">
                            <input
                                ref={newListInputRef}
                                type="text"
                                className="h-9 px-3 rounded-xl border border-brand-light focus:border-brand-dark outline-none font-bold text-sm w-36 transition-all dark:bg-slate-800 dark:text-slate-100"
                                placeholder={t('list_name_placeholder')}
                                value={newListName}
                                onChange={e => setNewListName(e.target.value)}
                                onKeyDown={handleCreateListKey}
                                onBlur={() => { if (!newListName.trim()) { setIsAddingList(false); } }}
                            />
                            <button
                                onClick={createList}
                                className="h-9 px-3 bg-brand-dark text-white rounded-xl font-black text-sm hover:scale-105 transition-all"
                            >
                                <i className="ri-check-line"></i>
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsAddingList(true)}
                            className="h-9 px-3 rounded-xl border border-dashed border-slate-200 dark:border-white/10 text-slate-400 font-bold text-sm flex items-center gap-1 hover:border-brand-light hover:text-brand-dark transition-all"
                        >
                            <i className="ri-add-line"></i> {t('shopping_new_list')}
                        </button>
                    )}
                </div>

                {/* Add Item Form */}
                <div className="p-6 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20">
                    <form onSubmit={addItem} className="space-y-3">
                        <input
                            type="text"
                            placeholder={activeList ? `${t('add_to')} "${activeList.name}"...` : t('create_list_first')}
                            disabled={!activeListId}
                            className="w-full px-6 py-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 focus:border-brand-light outline-none transition-all font-black text-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed dark:text-slate-100"
                            value={newItem}
                            onChange={e => setNewItem(e.target.value)}
                        />
                        <div className="flex gap-3">
                            <select
                                className="flex-1 h-14 px-6 rounded-lg border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-brand-light outline-none cursor-pointer font-bold text-slate-600 dark:text-slate-300 appearance-none transition-all"
                                value={category.name}
                                onChange={e => {
                                    const sel = categories.find(c => c.name === e.target.value);
                                    setCategory(sel);
                                }}
                            >
                                {categories.map(cat => (
                                    <option key={cat.name} value={cat.name}>{cat.displayName}</option>
                                ))}
                            </select>
                            <button
                                type="submit"
                                disabled={!activeListId}
                                className="px-10 h-14 bg-brand-dark text-white rounded-lg font-black shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {t('shopping_add')}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Items */}
                <div className="divide-y divide-gray-100 dark:divide-slate-800">
                    {!activeListId ? (
                        <div className="p-12 text-center text-gray-400 dark:text-slate-500">
                            <i className="ri-list-add text-4xl mb-2 block"></i>
                            <p className="font-bold">{t('create_list_first')}</p>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="p-12 text-center text-gray-400 dark:text-slate-500">
                            <i className="ri-shopping-cart-line text-4xl mb-2 block"></i>
                            <p>{t('shopping_empty_desc')}</p>
                        </div>
                    ) : (
                        <>
                            {/* Active Items */}
                            {items.filter(i => !i.completed).map((item) => {
                                const catStyle = getCategoryStyle(item.category);
                                return (
                                    <div key={item.id} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-slate-800/30 transition group">
                                        <div className="flex items-center gap-4 flex-1">
                                            <button
                                                onClick={() => toggleComplete(item)}
                                                className="w-6 h-6 rounded-full border border-gray-300 dark:border-white/10 text-transparent hover:border-green-500 flex items-center justify-center transition-all"
                                            >
                                                <i className="ri-check-line text-sm"></i>
                                            </button>
                                            <div>
                                                <span className="block text-lg text-gray-800 dark:text-slate-100">{item.name}</span>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${catStyle.color}`}>
                                                        <i className={catStyle.icon}></i> {catStyle.displayName}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => deleteItem(item.id)}
                                            className="p-2 text-gray-400 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition opacity-0 group-hover:opacity-100"
                                        >
                                            <i className="ri-delete-bin-line text-xl"></i>
                                        </button>
                                    </div>
                                );
                            })}

                            {/* Completed Items Accordion */}
                            {items.filter(i => i.completed).length > 0 && (
                                <details className="group mt-4 border-t border-gray-100 dark:border-slate-800">
                                    <summary className="flex items-center justify-between p-4 cursor-pointer text-gray-500 dark:text-slate-400 font-medium hover:bg-gray-50 dark:hover:bg-slate-800/30 transition list-none">
                                        <div className="flex items-center gap-2">
                                            <i className="ri-check-double-line text-green-500"></i>
                                            {t('completed_items')} ({items.filter(i => i.completed).length})
                                        </div>
                                        <i className="ri-arrow-down-s-line text-xl transition-transform group-open:rotate-180"></i>
                                    </summary>
                                    <div className="divide-y divide-gray-100 dark:divide-slate-800 bg-gray-50/30 dark:bg-slate-800/10">
                                        {items.filter(i => i.completed).map((item) => {
                                            const catStyle = getCategoryStyle(item.category);
                                            return (
                                                <div key={item.id} className="flex items-center justify-between p-4 transition group opacity-60 hover:opacity-100">
                                                    <div className="flex items-center gap-4 flex-1">
                                                        <button
                                                            onClick={() => toggleComplete(item)}
                                                            className="w-6 h-6 rounded-full border bg-green-500 border-green-500 text-white flex items-center justify-center transition-all"
                                                        >
                                                            <i className="ri-check-line text-sm"></i>
                                                        </button>
                                                        <div>
                                                            <span className="block text-lg text-gray-500 dark:text-slate-400 line-through">{item.name}</span>
                                                            <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${catStyle.color}`}>
                                                                <i className={catStyle.icon}></i> {catStyle.displayName}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => deleteItem(item.id)}
                                                        className="p-2 text-gray-400 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                                    >
                                                        <i className="ri-delete-bin-line text-xl"></i>
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </details>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ShoppingList;
