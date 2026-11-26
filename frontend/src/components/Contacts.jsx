import React from 'react';
import api from '../services/api';
import { useTranslation } from '../i18n.jsx';

const Contacts = ({ user }) => {
    const { t } = useTranslation();
    const [contacts, setContacts] = React.useState([]);
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [editingContact, setEditingContact] = React.useState(null);
    const [formData, setFormData] = React.useState({
        name: '',
        relationship: '',
        phone: '',
        email: '',
        address: '',
        notes: '',
        is_emergency: false,
        is_favorite: false
    });

    React.useEffect(() => {
        fetchContacts();
    }, []);

    const fetchContacts = async () => {
        try {
            const response = await api.get('/contacts');
            setContacts(response.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleOpenModal = (contact = null) => {
        if (contact) {
            setEditingContact(contact);
            setFormData({
                name: contact.name,
                relationship: contact.relationship || '',
                phone: contact.phone || '',
                email: contact.email || '',
                address: contact.address || '',
                notes: contact.notes || '',
                is_emergency: !!contact.is_emergency,
                is_favorite: !!contact.is_favorite
            });
        } else {
            setEditingContact(null);
            setFormData({
                name: '',
                relationship: '',
                phone: '',
                email: '',
                address: '',
                notes: '',
                is_emergency: false,
                is_favorite: false
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingContact) {
                await api.put(`/contacts/${editingContact.id}`, formData);
            } else {
                await api.post('/contacts', formData);
            }
            setIsModalOpen(false);
            fetchContacts();
        } catch (err) {
            console.error(err);
            alert(t('save_error'));
        }
    };

    const handleDelete = async (id) => {
        if (!confirm(t('confirm_delete_contact'))) return;
        try {
            await api.delete(`/contacts/${id}`);
            fetchContacts();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
                        <i className="ri-contacts-book-line text-brand-dark"></i>
                        {t('contacts_title')}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">{t('contacts_subtitle')}</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-brand-dark text-white h-14 px-8 rounded-lg font-black shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                >
                    <i className="ri-add-line text-xl"></i>
                    {t('contact_new')}
                </button>
            </header>

            <div className="bg-white dark:bg-slate-900 rounded-[1.25rem] shadow-sm border border-black/[0.06] dark:border-slate-800 overflow-hidden transition-colors duration-500">
                <div className="divide-y divide-slate-50 dark:divide-slate-800">
                    {contacts.length === 0 ? (
                        <div className="p-12 text-center">
                            <i className="ri-contacts-line text-5xl text-slate-200 dark:text-slate-800 mb-4 block"></i>
                            <p className="text-slate-400 dark:text-slate-600 font-bold">{t('contact_no_contacts')}</p>
                        </div>
                    ) : (
                        contacts.sort((a, b) => b.is_emergency - a.is_emergency).map(contact => (
                            <ContactItem
                                key={contact.id}
                                contact={contact}
                                onEdit={handleOpenModal}
                                onDelete={handleDelete}
                                t={t}
                            />
                        ))
                    )}
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-[1.25rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 border dark:border-slate-800">
                        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">{editingContact ? t('contact_edit') : t('contact_new')}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-brand-dark transition-colors">
                                <i className="ri-close-line text-2xl"></i>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('contact_name')} *</label>
                                    <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-brand-light rounded-xl font-bold outline-none text-slate-800 dark:text-slate-100" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('contact_relationship')}</label>
                                    <input type="text" value={formData.relationship} onChange={e => setFormData({ ...formData, relationship: e.target.value })} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-brand-light rounded-xl font-bold outline-none text-slate-800 dark:text-slate-100" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('contact_phone')}</label>
                                    <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-brand-light rounded-xl font-bold outline-none text-slate-800 dark:text-slate-100" />
                                </div>
                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('contact_email')}</label>
                                    <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-brand-light rounded-xl font-bold outline-none text-slate-800 dark:text-slate-100" />
                                </div>
                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('contact_address')}</label>
                                    <input type="text" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-brand-light rounded-xl font-bold outline-none text-slate-800 dark:text-slate-100" />
                                </div>
                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('contact_notes')}</label>
                                    <textarea rows="2" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-brand-light rounded-xl font-bold outline-none resize-none text-slate-800 dark:text-slate-100" />
                                </div>
                                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <label className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border border-transparent has-[:checked]:border-red-100 dark:has-[:checked]:border-red-900/30 has-[:checked]:bg-red-50/30 dark:has-[:checked]:bg-red-500/10">
                                        <input type="checkbox" checked={formData.is_emergency} onChange={e => setFormData({ ...formData, is_emergency: e.target.checked })} className="w-6 h-6 rounded-lg text-red-500 focus:ring-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10" />
                                        <div className="flex flex-col">
                                            <span className="font-black text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-widest">{t('contact_emergency_mark')}</span>
                                            <span className="text-[9px] text-slate-400 font-bold">{t('contact_emergency_hint')}</span>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border border-transparent has-[:checked]:border-amber-100 dark:has-[:checked]:border-amber-900/30 has-[:checked]:bg-amber-50/30 dark:has-[:checked]:bg-amber-500/10">
                                        <input type="checkbox" checked={formData.is_favorite} onChange={e => setFormData({ ...formData, is_favorite: e.target.checked })} className="w-6 h-6 rounded-lg text-amber-500 focus:ring-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10" />
                                        <div className="flex flex-col">
                                            <span className="font-black text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-widest">{t('contact_favorite_mark')}</span>
                                            <span className="text-[9px] text-slate-400 font-bold">{t('contact_favorite_hint')}</span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                            <button type="submit" className="w-full py-5 bg-brand-dark text-white rounded-[1rem] font-black shadow-xl hover:bg-slate-800 transition-all">{t('save_btn')}</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const ContactItem = ({ contact, onEdit, onDelete, t }) => {
    const [isExpanded, setIsExpanded] = React.useState(false);

    return (
        <div className={`transition-all ${isExpanded ? 'bg-slate-50/50 dark:bg-slate-800/20' : 'hover:bg-slate-50/30 dark:hover:bg-slate-800/10'}`}>
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between p-5 cursor-pointer"
            >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${contact.is_emergency ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 shadow-sm' : 'bg-brand-light/10 dark:bg-brand-light/20 text-brand-dark dark:text-brand-light'}`}>
                        {contact.is_emergency ? <i className="ri-error-warning-fill"></i> : <i className="ri-user-3-line"></i>}
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-black text-slate-800 dark:text-slate-100 truncate leading-tight flex items-center gap-2">
                            {contact.name}
                            {contact.is_favorite && <i className="ri-star-fill text-amber-400 text-xs"></i>}
                            {contact.relationship && <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md hidden sm:inline">{contact.relationship}</span>}
                        </h3>
                        <p className="text-xs font-bold text-slate-400 truncate">{contact.phone || contact.email || t('no_details')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {contact.phone && (
                        <a href={`tel:${contact.phone}`} onClick={e => e.stopPropagation()} className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center hover:bg-green-100 dark:hover:bg-green-500/20 transition-colors hidden sm:flex">
                            <i className="ri-phone-fill text-lg"></i>
                        </a>
                    )}
                    <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                        <i className="ri-arrow-down-s-line text-2xl text-slate-300"></i>
                    </div>
                </div>
            </div>

            {isExpanded && (
                <div className="px-5 pb-6 pt-2 animate-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 bg-white dark:bg-slate-900 rounded-xl border border-black/[0.06] dark:border-slate-800 shadow-sm transition-colors duration-500">
                        {contact.relationship && (
                            <div className="sm:hidden">
                                <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">{t('contact_relationship')}</span>
                                <span className="font-bold text-slate-800 dark:text-slate-100">{contact.relationship}</span>
                            </div>
                        )}
                        {contact.phone && (
                            <div>
                                <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">{t('contact_phone')}</span>
                                <a href={`tel:${contact.phone}`} className="font-black text-brand-dark dark:text-brand-light hover:underline">{contact.phone}</a>
                            </div>
                        )}
                        {contact.email && (
                            <div>
                                <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">{t('contact_email')}</span>
                                <a href={`mailto:${contact.email}`} className="font-black text-brand-dark dark:text-brand-light hover:underline">{contact.email}</a>
                            </div>
                        )}
                        {contact.address && (
                            <div className="sm:col-span-2">
                                <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">{t('contact_address')}</span>
                                <p className="font-bold text-slate-700 dark:text-slate-300">{contact.address}</p>
                            </div>
                        )}
                        {contact.notes && (
                            <div className="sm:col-span-2">
                                <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">{t('contact_notes')}</span>
                                <p className="text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-black/[0.06] dark:border-slate-800 font-medium">{contact.notes}</p>
                            </div>
                        )}
                        <div className="col-span-1 sm:col-span-2 flex justify-end gap-3 pt-4 border-t border-slate-50 dark:border-slate-800">
                            <button onClick={() => onDelete(contact.id)} className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors uppercase">{t('delete')}</button>
                            <button onClick={() => onEdit(contact)} className="px-5 py-2.5 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors uppercase">{t('edit')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Contacts;
