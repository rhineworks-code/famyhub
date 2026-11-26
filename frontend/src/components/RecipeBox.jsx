import React from 'react';
import api from '../services/api';
import { useTranslation } from '../i18n.jsx';

const RecipeBox = ({ user }) => {
    const { t } = useTranslation();
    // --- Data State ---
    const [recipes, setRecipes] = React.useState([]);
    const [folders, setFolders] = React.useState([]);
    const [activeFolderId, setActiveFolderId] = React.useState(null); // null = All Recipes
    const [searchTerm, setSearchTerm] = React.useState('');

    // --- Recipe Modal State ---
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [selectedRecipe, setSelectedRecipe] = React.useState(null);
    const [formData, setFormData] = React.useState({ title: '', ingredients: [], instructions: '', folder_id: '' });

    // --- Folder Box State ---
    const [isAddingFolder, setIsAddingFolder] = React.useState(false);
    const [newFolderName, setNewFolderName] = React.useState('');
    const [deleteFolderConfirm, setDeleteFolderConfirm] = React.useState(null);
    const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
    const newFolderInputRef = React.useRef(null);
    const dropdownRef = React.useRef(null);

    // Close dropdown when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
                setIsAddingFolder(false); // also reset add mode if clicked outside
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // --- Shopping Sync State ---
    const [isSyncModalOpen, setIsSyncModalOpen] = React.useState(false);
    const [shoppingLists, setShoppingLists] = React.useState([]);
    const [targetListId, setTargetListId] = React.useState('');
    const [syncItems, setSyncItems] = React.useState([]);

    React.useEffect(() => {
        fetchData();
        fetchShoppingLists();
    }, []);

    React.useEffect(() => {
        if (isAddingFolder && newFolderInputRef.current) {
            newFolderInputRef.current.focus();
        }
    }, [isAddingFolder]);

    const fetchData = async () => {
        try {
            const [recipesRes, foldersRes] = await Promise.all([
                api.get('/recipes'),
                api.get('/recipes/folders')
            ]);
            setRecipes(recipesRes.data);
            setFolders(foldersRes.data);
        } catch (error) {
            console.error('Error fetching recipe data:', error);
        }
    };

    const fetchShoppingLists = async () => {
        try {
            const response = await api.get('/shopping/lists');
            setShoppingLists(response.data);
            if (response.data.length > 0) setTargetListId(response.data[0].id);
        } catch (error) {
            console.error('Error fetching shopping lists:', error);
        }
    };

    // --- Folder CRUD ---
    const createFolder = async () => {
        const name = newFolderName.trim();
        if (!name) return;
        try {
            const res = await api.post('/recipes/folders', { name });
            setFolders(prev => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
            setActiveFolderId(res.data.id);
            setNewFolderName('');
            setIsAddingFolder(false);
            setIsDropdownOpen(false); // Close dropdown after creation
        } catch (err) {
            console.error('Error creating recipe folder:', err);
        }
    };

    const deleteFolder = async (id) => {
        try {
            await api.delete(`/recipes/folders/${id}`);
            setFolders(prev => prev.filter(f => f.id !== id));
            if (activeFolderId === id) setActiveFolderId(null);
            setDeleteFolderConfirm(null);
            fetchData(); // Refresh recipes as their folder_id is now subset to NULL
        } catch (err) {
            console.error('Error deleting recipe folder:', err);
        }
    };

    // --- Recipe CRUD & Utils ---
    const parseIngredients = (ingredients) => {
        if (!ingredients) return [];
        try {
            const parsed = JSON.parse(ingredients);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return ingredients.split('\n').filter(line => line.trim()).map(line => ({ name: line.trim(), amount: '' }));
        }
    };

    const handleSaveRecipe = async (e) => {
        e.preventDefault();
        try {
            const dataToSave = {
                ...formData,
                ingredients: JSON.stringify(formData.ingredients),
                folder_id: formData.folder_id || null
            };
            if (formData.id) {
                await api.put(`/recipes/${formData.id}`, dataToSave);
            } else {
                await api.post('/recipes', dataToSave);
            }
            setIsModalOpen(false);
            setFormData({ title: '', ingredients: [], instructions: '', folder_id: '' });
            fetchData();
        } catch (error) {
            console.error('Error saving recipe:', error);
        }
    };

    const openEditRecipe = (recipe) => {
        setFormData({
            ...recipe,
            ingredients: parseIngredients(recipe.ingredients),
            folder_id: recipe.folder_id || ''
        });
        setIsModalOpen(true);
    };

    const openNewRecipe = () => {
        setFormData({ title: '', ingredients: [], instructions: '', folder_id: activeFolderId || '' });
        setIsModalOpen(true);
    };

    const handleDeleteRecipe = async (id) => {
        if (!confirm(t('recipes_delete_confirm'))) return;
        try {
            await api.delete(`/recipes/${id}`);
            fetchData();
            if (selectedRecipe?.id === id) setSelectedRecipe(null);
        } catch (error) {
            console.error('Error deleting recipe:', error);
        }
    };

    const addIngredientRow = () => {
        setFormData({ ...formData, ingredients: [...formData.ingredients, { name: '', amount: '' }] });
    };

    const updateIngredient = (index, field, value) => {
        const newIngs = [...formData.ingredients];
        newIngs[index][field] = value;
        setFormData({ ...formData, ingredients: newIngs });
    };

    const removeIngredient = (index) => {
        setFormData({ ...formData, ingredients: formData.ingredients.filter((_, i) => i !== index) });
    };

    // --- Shopping Sync ---
    const openSync = () => {
        const items = parseIngredients(selectedRecipe.ingredients).map(ing => ({ ...ing, selected: true }));
        setSyncItems(items);
        setIsSyncModalOpen(true);
    };

    const toggleSyncItem = (index) => {
        setSyncItems(items => items.map((item, i) => (i === index ? { ...item, selected: !item.selected } : item)));
    };

    const handleSync = async () => {
        const selectedToSync = syncItems.filter(i => i.selected);
        if (selectedToSync.length === 0) return;

        try {
            await api.post('/shopping/bulk', {
                list_id: targetListId,
                items: selectedToSync.map(i => `${i.amount ? i.amount + ' ' : ''}${i.name}`)
            });
            setIsSyncModalOpen(false);
            alert(t('recipes_sync_success'));
        } catch (error) {
            console.error('Error syncing ingredients:', error);
            alert(t('recipes_sync_error'));
        }
    };

    // --- Filtering ---
    const filteredRecipes = recipes.filter(r => {
        const matchesFolder = activeFolderId === null || r.folder_id === activeFolderId;
        const matchesSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.ingredients && r.ingredients.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesFolder && matchesSearch;
    });

    return (
        <div className="h-full flex flex-col bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-black/[0.06] dark:border-slate-800 overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
                    <i className="ri-book-read-line text-brand-dark"></i>
                    {t('recipes_title')}
                </h2>
                <div className="flex flex-col xs:flex-row gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-initial">
                        <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500"></i>
                        <input
                            type="text" placeholder={t('recipes_search_placeholder')}
                            className="pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-brand-light/20 outline-none w-full sm:w-48 transition-all sm:focus:w-64 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600"
                            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={openNewRecipe}
                        className="px-4 py-2 bg-brand-dark text-white rounded-xl hover:bg-slate-800 transition flex items-center justify-center gap-2 shadow-sm whitespace-nowrap"
                    >
                        <i className="ri-add-line"></i> <span className="sm:inline">{t('recipes_new_recipe')}</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 flex bg-gray-50/30 dark:bg-slate-900/50">
                
                {/* Recipes List column (hidden on mobile if a recipe is selected) */}
                <div className={`w-full lg:w-1/3 flex-shrink-0 border-r border-gray-100 dark:border-slate-800 flex flex-col bg-white/50 dark:bg-slate-900/50 h-full ${selectedRecipe ? 'hidden lg:flex' : 'flex'}`}>
                    
                    {/* Category Dropdown (Header of List) */}
                    <div className="p-4 border-b border-gray-100 dark:border-slate-800 shrink-0 relative" ref={dropdownRef}>
                        <button 
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="w-full flex items-center justify-between bg-white dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 px-4 py-3 rounded-lg shadow-sm hover:border-brand-light transition text-sm font-bold text-slate-700 dark:text-slate-300"
                        >
                            <span className="flex items-center gap-2">
                                <i className="ri-folder-2-line text-brand-dark"></i>
                                {activeFolderId === null ? t('recipes_all') : (folders.find(f => f.id === activeFolderId)?.name || t('recipes_category'))}
                            </span>
                            <i className={`ri-arrow-down-s-line transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}></i>
                        </button>

                        {isDropdownOpen && (
                            <div className="absolute top-full left-4 right-4 mt-2 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-black/[0.06] dark:border-white/10 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                                <div className="max-h-60 overflow-y-auto no-scrollbar">
                                    <button
                                        onClick={() => { setActiveFolderId(null); setIsDropdownOpen(false); }}
                                        className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors ${activeFolderId === null ? 'bg-brand-light/10 dark:bg-brand-light/20 text-brand-dark dark:text-brand-light' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                    >
                                        <i className="ri-restaurant-2-line mr-2"></i> {t('recipes_all')}
                                    </button>
                                    {folders.map(folder => (
                                        <div key={folder.id} className="relative group flex items-center">
                                            <button
                                                onClick={() => { setActiveFolderId(folder.id); setIsDropdownOpen(false); }}
                                                className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors ${activeFolderId === folder.id ? 'bg-brand-light/10 dark:bg-brand-light/20 text-brand-dark dark:text-brand-light' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                            >
                                                <i className="ri-folder-2-line mr-2"></i> {folder.name}
                                            </button>
                                            {deleteFolderConfirm === folder.id ? (
                                                <div className="absolute right-2 h-full flex items-center gap-1 bg-white dark:bg-slate-800 px-2">
                                                    <button onClick={(e) => { e.stopPropagation(); deleteFolder(folder.id); }} className="text-[10px] font-black w-6 h-6 bg-red-500 text-white rounded hover:bg-red-600">{t('recipes_delete_folder_confirm')}</button>
                                                    <button onClick={(e) => { e.stopPropagation(); setDeleteFolderConfirm(null); }} className="text-[10px] font-black w-6 h-6 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-300 dark:hover:bg-slate-500">{t('recipes_delete_folder_cancel')}</button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setDeleteFolderConfirm(folder.id); }}
                                                    className="absolute right-4 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition"
                                                    title={t('recipes_delete_category')}
                                                >
                                                    <i className="ri-delete-bin-line"></i>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
                                    {isAddingFolder ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                ref={newFolderInputRef} type="text"
                                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-brand-light focus:border-brand-dark outline-none rounded-xl text-xs font-bold shadow-sm dark:text-slate-100"
                                                placeholder={t('recipes_category_placeholder')} value={newFolderName}
                                                onChange={e => setNewFolderName(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && createFolder()}
                                            />
                                            <button onClick={createFolder} className="bg-brand-dark text-white p-2 rounded-lg hover:scale-105 transition shrink-0"><i className="ri-check-line"></i></button>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setIsAddingFolder(true); }}
                                            className="w-full text-left px-2 py-1.5 text-xs font-bold text-brand-dark dark:text-brand-light hover:text-brand-light dark:hover:text-white flex items-center gap-2 transition-colors"
                                        >
                                            <i className="ri-add-line"></i> {t('recipes_category_new')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {filteredRecipes.length === 0 ? (
                            <div className="text-center p-8 text-slate-400 dark:text-slate-600">
                                <i className="ri-search-eye-line text-3xl mb-2 block opacity-20"></i>
                                <p className="text-sm font-bold">{t('recipes_no_recipes')}</p>
                            </div>
                        ) : (
                            filteredRecipes.map(recipe => (
                                <div
                                    key={recipe.id}
                                    onClick={() => setSelectedRecipe(recipe)}
                                    className={`p-4 rounded-lg cursor-pointer transition border ${selectedRecipe?.id === recipe.id ? 'bg-white dark:bg-slate-800 border-brand-light dark:border-brand-dark shadow-md ring-2 ring-brand-light/10 dark:ring-brand-light/5' : 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 hover:border-brand-light/40 hover:shadow-sm'}`}
                                >
                                    <h3 className="font-bold text-gray-800 dark:text-slate-100 truncate">{recipe.title}</h3>
                                    <div className="flex items-center gap-2 mt-2">
                                        <p className="text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1">
                                            <i className="ri-user-smile-line"></i> {recipe.creator_name}
                                        </p>
                                        {activeFolderId === null && recipe.folder_id && (
                                            <span className="text-[10px] font-bold text-brand-dark dark:text-brand-light bg-brand-light/10 dark:bg-brand-light/20 px-2 py-0.5 rounded-full ml-auto">
                                                {folders.find(f => f.id === recipe.folder_id)?.name || t('recipes_category')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Recipe Detail Content (hidden on mobile if no recipe is selected) */}
                <div className={`flex-1 overflow-y-auto bg-white dark:bg-slate-900 selection:bg-brand-light/20 dark:selection:bg-brand-light/10 ${!selectedRecipe ? 'hidden lg:block' : 'block'}`}>
                    {selectedRecipe ? (
                        <div className="max-w-3xl mx-auto p-4 sm:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            
                            {/* Mobile Back Button */}
                            <button 
                                onClick={() => setSelectedRecipe(null)}
                                className="lg:hidden mb-6 flex items-center gap-2 text-slate-500 dark:text-slate-400 font-bold hover:text-brand-dark dark:hover:text-brand-light transition bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl"
                            >
                                <i className="ri-arrow-left-line"></i> {t('recipes_back')}
                            </button>

                            <div className="flex flex-col sm:flex-row justify-between items-start mb-8 gap-4 border-b border-gray-100 dark:border-slate-800 pb-6">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        {selectedRecipe.folder_id && (
                                            <span className="text-xs font-black text-brand-dark dark:text-brand-light bg-brand-light/10 dark:bg-brand-light/20 px-3 py-1 rounded-full uppercase tracking-wider">
                                                {folders.find(f => f.id === selectedRecipe.folder_id)?.name || t('recipes_category')}
                                            </span>
                                        )}
                                    </div>
                                    <h2 className="text-3xl sm:text-4xl font-black text-slate-800 dark:text-slate-100 leading-tight">{selectedRecipe.title}</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 flex items-center gap-2 font-medium">
                                        <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold flex-shrink-0">
                                            {selectedRecipe.creator_name?.charAt(0)}
                                        </span>
                                        <span>{t('recipes_creator_prefix')} <span className="font-bold text-slate-700 dark:text-slate-200">{selectedRecipe.creator_name}</span> {t('recipes_creator_suffix')}</span>
                                    </p>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 hide-scrollbar shrink-0">
                                    <button onClick={openSync} className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-brand-light/10 dark:bg-brand-light/20 text-brand-dark dark:text-brand-light rounded-xl hover:bg-brand-light/20 dark:hover:bg-brand-light/30 transition text-sm font-bold shadow-sm whitespace-nowrap">
                                        <i className="ri-shopping-basket-2-line"></i> {t('recipes_sync_btn')}
                                    </button>
                                    <button onClick={() => openEditRecipe(selectedRecipe)} className="w-10 flex-[0_0_2.5rem] sm:flex-initial h-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-brand-dark dark:hover:text-brand-light hover:bg-slate-100 dark:hover:bg-slate-700 transition shadow-sm"><i className="ri-edit-line text-lg"></i></button>
                                    <button onClick={() => handleDeleteRecipe(selectedRecipe.id)} className="w-10 flex-[0_0_2.5rem] sm:flex-initial h-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition shadow-sm"><i className="ri-delete-bin-line text-lg"></i></button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-1">
                                    <h4 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <i className="ri-list-check-2 text-brand-light"></i> {t('recipes_ingredients')}
                                    </h4>
                                    <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-xl p-6 border border-black/[0.06] dark:border-slate-800">
                                        <ul className="space-y-4">
                                            {parseIngredients(selectedRecipe.ingredients).map((ing, i) => (
                                                <li key={i} className="flex flex-col border-b border-slate-100/50 dark:border-white/10/50 pb-3 last:border-0 last:pb-0">
                                                    <span className="font-black text-brand-dark dark:text-brand-light text-lg leading-none mb-1">{ing.amount || '—'}</span>
                                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{ing.name}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                                <div className="lg:col-span-2">
                                    <h4 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <i className="ri-restaurant-line text-brand-light"></i> {t('recipes_preparation')}
                                    </h4>
                                    <div className="prose prose-slate dark:prose-invert prose-p:font-medium prose-p:leading-relaxed text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 p-6 rounded-xl border border-black/[0.06]/50 shadow-sm">
                                        <p className="whitespace-pre-wrap">{selectedRecipe.instructions}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 p-8">
                            <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                                <i className="ri-restaurant-2-line text-5xl text-slate-300 dark:text-slate-700"></i>
                            </div>
                            <p className="text-xl font-black text-slate-400 dark:text-slate-500 text-center">{t('recipes_select_recipe')}</p>
                            <p className="text-sm font-bold text-slate-400 dark:text-slate-600 mt-2 text-center">{t('recipes_create_desc')}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <form onSubmit={handleSaveRecipe} className="bg-white dark:bg-slate-900 rounded-[1.25rem] p-8 w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar animate-in zoom-in-95 duration-200 border dark:border-slate-800">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">{formData.id ? t('recipes_edit_title') : t('recipes_new_recipe_title')}</h3>
                            <button type="button" onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-full transition"><i className="ri-close-line text-2xl"></i></button>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('recipes_field_title')}</label>
                                    <input
                                        required type="text"
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg focus:ring-4 focus:ring-brand-light/10 outline-none font-bold text-slate-800 dark:text-slate-100 mt-1"
                                        value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('recipes_field_category')}</label>
                                    <select
                                        value={formData.folder_id}
                                        onChange={e => setFormData({ ...formData, folder_id: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg focus:ring-4 focus:ring-brand-light/10 outline-none font-bold text-slate-700 dark:text-slate-300 mt-1 appearance-none cursor-pointer"
                                    >
                                        <option value="">{t('recipes_no_category')}</option>
                        {folders.map(f => (
                                            <option key={f.id} value={f.id}>{f.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="bg-slate-50/50 dark:bg-slate-800/30 p-6 rounded-xl border border-black/[0.06] dark:border-slate-800">
                                <div className="flex justify-between items-center mb-4">
                                    <label className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">{t('recipes_ingredients')}</label>
                                    <button type="button" onClick={addIngredientRow} className="text-sm text-brand-dark dark:text-brand-light bg-brand-light/10 dark:bg-brand-light/20 px-3 py-1.5 rounded-xl font-bold hover:bg-brand-light/20 dark:hover:bg-brand-light/30 transition flex items-center gap-1">
                                        <i className="ri-add-line"></i> {t('recipes_add_ingredient')}
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {formData.ingredients.map((ing, i) => (
                                        <div key={i} className="flex gap-2">
                                            <input
                                                placeholder={t('recipes_ingredient_amount_placeholder')}
                                                className="w-1/3 px-4 py-3 bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/10 rounded-xl outline-none font-bold text-sm focus:border-brand-light shadow-sm dark:text-slate-100"
                                                value={ing.amount} onChange={e => updateIngredient(i, 'amount', e.target.value)}
                                            />
                                            <input
                                                required placeholder={t('recipes_ingredient_name_placeholder')}
                                                className="flex-1 px-4 py-3 bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/10 rounded-xl outline-none font-bold text-sm focus:border-brand-light shadow-sm dark:text-slate-100"
                                                value={ing.name} onChange={e => updateIngredient(i, 'name', e.target.value)}
                                            />
                                            <button type="button" onClick={() => removeIngredient(i)} className="w-11 flex justify-center items-center rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"><i className="ri-delete-bin-fill"></i></button>
                                        </div>
                                    ))}
                                    {formData.ingredients.length === 0 && (
                                        <div className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900/50">
                                            <p className="text-slate-400 dark:text-slate-600 font-bold text-sm">{t('recipes_empty_ingredients')}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('recipes_field_instructions')}</label>
                                <textarea
                                    rows="8"
                                    className="w-full mt-1 px-4 py-4 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-xl focus:ring-4 focus:ring-brand-light/10 outline-none font-medium text-slate-700 dark:text-slate-300 resize-none leading-relaxed"
                                    value={formData.instructions}
                                    onChange={e => setFormData({ ...formData, instructions: e.target.value })}
                                ></textarea>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition">{t('cancel')}</button>
                            <button type="submit" className="px-8 py-3 bg-brand-dark text-white font-black rounded-lg shadow-xl hover:bg-slate-800 active:scale-95 transition-all">{t('recipes_save')}</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Sync Modal */}
            {isSyncModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-[1.25rem] p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 border dark:border-slate-800">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <i className="ri-shopping-basket-2-line text-brand-dark"></i>
                                {t('recipes_sync_title')}
                            </h3>
                            <button onClick={() => setIsSyncModalOpen(false)} className="w-10 h-10 flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-full transition"><i className="ri-close-line text-2xl"></i></button>
                        </div>

                        <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-6">{t('recipes_sync_desc')}</p>
                        
                        <div className="mb-6">
                            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">{t('recipes_sync_target')}</label>
                            <select
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-xl outline-none font-bold text-sm cursor-pointer appearance-none text-slate-800 dark:text-slate-100"
                                value={targetListId}
                                onChange={e => setTargetListId(e.target.value)}
                            >
                                {shoppingLists.map(list => (
                                    <option key={list.id} value={list.id}>{list.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar mb-8">
                            {syncItems.map((ing, i) => (
                                <label key={i} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition border border-transparent hover:border-brand-light/30">
                                    <input
                                        type="checkbox"
                                        checked={!!ing.selected}
                                        onChange={() => toggleSyncItem(i)}
                                        className="w-5 h-5 rounded border border-brand-dark/30 text-brand-dark focus:ring-brand-light/20 bg-white dark:bg-slate-700"
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black text-brand-dark dark:text-brand-light uppercase">{ing.amount || t('recipes_amount_none')}</span>
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{ing.name}</span>
                                    </div>
                                </label>
                            ))}
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <button onClick={() => setIsSyncModalOpen(false)} className="px-5 py-2 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition">{t('cancel')}</button>
                            <button onClick={handleSync} className="px-6 py-2 bg-brand-dark text-white font-black rounded-xl shadow-lg hover:bg-slate-800 transition">
                                {t('recipes_sync_confirm')} ({syncItems.filter(i => i.selected).length})
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RecipeBox;
