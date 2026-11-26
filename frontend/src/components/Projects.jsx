import React from 'react';
import api from '../services/api';
import { useTranslation } from '../i18n.jsx';
import { applyOffset } from '../utils/time';

const Projects = ({ user }) => {
    const { t } = useTranslation();
    const [projects, setProjects] = React.useState([]);
    const [members, setMembers] = React.useState([]);
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [editingProject, setEditingProject] = React.useState(null);
    const [formData, setFormData] = React.useState({
        title: '',
        description: '',
        deadline: '',
        recurring_interval: '',
        assigned_to: [] // Array of strings: 'user:ID' or 'ext:Name'
    });
    const [newTodo, setNewTodo] = React.useState('');
    const [newTodoUrgency, setNewTodoUrgency] = React.useState('normal'); // 'normal' | 'urgent'
    const [editingTodo, setEditingTodo] = React.useState(null);

    const [newMilestoneTitle, setNewMilestoneTitle] = React.useState('');
    const [newMilestoneDate, setNewMilestoneDate] = React.useState('');
    const [editingMilestone, setEditingMilestone] = React.useState(null);

    const [activeProjectId, setActiveProjectId] = React.useState(null);
    const [isCompleting, setIsCompleting] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState('me'); // 'me' or 'shared'
    const [externalInput, setExternalInput] = React.useState('');

    const fetchProjects = async () => {
        try {
            const response = await api.get('/projects');
            setProjects(response.data);
            // Auto-select first project in current tab if none selected
            if (response.data.length > 0 && !activeProjectId && window.innerWidth >= 1024) {
                const filtered = getFilteredProjects(response.data, activeTab, user.id);
                if (filtered.length > 0) setActiveProjectId(filtered[0].id);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchMembers = async () => {
        try {
            const response = await api.get('/auth/family/members');
            setMembers(response.data);
        } catch (err) {
            console.error(err);
        }
    };

    React.useEffect(() => {
        fetchProjects();
        fetchMembers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const getAssignmentDisplay = (assignedTo) => {
        if (!assignedTo || assignedTo.length === 0) return t('projects_unassigned');

        const displays = assignedTo.map(item => {
            if (item.startsWith('user:')) {
                const userId = parseInt(item.split(':')[1]);
                const member = members.find(m => m.id === userId);
                return member ? (member.username || member.name) : t('projects_unknown');
            }
            if (item.startsWith('ext:')) {
                return item.split(':')[1] + ` (${t('projects_ext')})`;
            }
            return item;
        });

        if (displays.length > 2) {
            return `${displays[0]}, ${displays[1]} +${displays.length - 2}`;
        }
        return displays.join(', ');
    };

    const handleOpenModal = (project = null) => {
        if (project) {
            setEditingProject(project);
            setFormData({
                title: project.title,
                description: project.description || '',
                deadline: project.deadline || '',
                recurring_interval: project.recurring_interval || '',
                assigned_to: Array.isArray(project.assigned_to) ? project.assigned_to : []
            });
        } else {
            setEditingProject(null);
            setFormData({
                title: '',
                description: '',
                deadline: '',
                recurring_interval: '',
                assigned_to: [`user:${user.id}`]
            });
        }
        setExternalInput('');
        setIsModalOpen(true);
    };

    const toggleMember = (memberId) => {
        const key = `user:${memberId}`;
        const current = [...formData.assigned_to];
        const index = current.indexOf(key);
        if (index > -1) {
            current.splice(index, 1);
        } else {
            current.push(key);
        }
        setFormData({ ...formData, assigned_to: current });
    };

    const addExternal = () => {
        if (!externalInput.trim()) return;
        const key = `ext:${externalInput.trim()}`;
        if (!formData.assigned_to.includes(key)) {
            setFormData({
                ...formData,
                assigned_to: [...formData.assigned_to, key]
            });
        }
        setExternalInput('');
    };

    const removeParticipant = (key) => {
        setFormData({
            ...formData,
            assigned_to: formData.assigned_to.filter(k => k !== key)
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingProject) {
                await api.put(`/projects/${editingProject.id}`, formData);
            } else {
                const response = await api.post('/projects', formData);
                setActiveProjectId(response.data.id);
            }
            setIsModalOpen(false);
            fetchProjects();
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteProject = async (id) => {
        if (!confirm(t('projects_delete_confirm'))) return;
        try {
            await api.delete(`/projects/${id}`);
            if (activeProjectId === id) setActiveProjectId(null);
            fetchProjects();
        } catch (err) {
            console.error(err);
        }
    };

    const handleAddTodo = async (e) => {
        e.preventDefault();
        if (!newTodo.trim() || !activeProjectId) return;
        try {
            await api.post(`/projects/${activeProjectId}/todos`, { task: newTodo, urgency: newTodoUrgency });
            setNewTodo('');
            setNewTodoUrgency('normal');
            fetchProjects();
        } catch (err) {
            console.error(err);
        }
    };

    const handleSaveTodoEdit = async (todoId) => {
        if (!editingTodo.task.trim()) return;
        try {
            await api.put(`/projects/${activeProjectId}/todos/${todoId}`, { task: editingTodo.task, urgency: editingTodo.urgency });
            setEditingTodo(null);
            fetchProjects();
        } catch (err) { console.error(err); }
    };

    const handleToggleTodo = async (projectId, todoId, currentCompleted) => {
        try {
            await api.put(`/projects/${projectId}/todos/${todoId}`, { completed: !currentCompleted });
            fetchProjects();
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteTodo = async (projectId, todoId) => {
        try {
            await api.delete(`/projects/${projectId}/todos/${todoId}`);
            fetchProjects();
        } catch (err) {
            console.error(err);
        }
    };

    const handleAddMilestone = async (e) => {
        e.preventDefault();
        if (!newMilestoneTitle.trim() || !activeProjectId) return;
        try {
            await api.post(`/projects/${activeProjectId}/milestones`, { title: newMilestoneTitle, due_date: newMilestoneDate });
            setNewMilestoneTitle('');
            setNewMilestoneDate('');
            fetchProjects();
        } catch(e) { console.error(e); }
    };

    const handleToggleMilestone = async (projectId, milestoneId, currentCompleted) => {
        try {
            await api.put(`/projects/${projectId}/milestones/${milestoneId}`, { completed: !currentCompleted });
            fetchProjects();
        } catch(e) { console.error(e); }
    };

    const handleSaveMilestoneEdit = async (milestoneId) => {
        if (!editingMilestone.title.trim()) return;
        try {
            await api.put(`/projects/${activeProjectId}/milestones/${milestoneId}`, { title: editingMilestone.title, due_date: editingMilestone.due_date });
            setEditingMilestone(null);
            fetchProjects();
        } catch(e) { console.error(e); }
    };

    const handleDeleteMilestone = async (projectId, milestoneId) => {
        try {
            await api.delete(`/projects/${projectId}/milestones/${milestoneId}`);
            fetchProjects();
        } catch(e) { console.error(e); }
    };

    const handleCompleteProject = async (id) => {
        if (!confirm(t('projects_complete_confirm'))) return;
        setIsCompleting(true);
        try {
            await api.post(`/projects/${id}/complete`);
            await fetchProjects();
        } catch (err) {
            console.error(err);
            alert(t('projects_error_complete'));
        } finally {
            setIsCompleting(false);
        }
    };

    const getFilteredProjects = (allProjects, tab, userId) => {
        const myKey = `user:${userId}`;
        if (tab === 'me') {
            return allProjects.filter(p =>
                p.assigned_to && p.assigned_to.length === 1 && p.assigned_to[0] === myKey
            );
        } else {
            return allProjects.filter(p =>
                !p.assigned_to ||
                p.assigned_to.length !== 1 ||
                p.assigned_to[0] !== myKey
            );
        }
    };

    const filteredProjects = getFilteredProjects(projects, activeTab, user.id);
    const activeProject = projects.find(p => p.id === activeProjectId);

    return (
        <div className="h-full flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
                        <i className="ri-hammer-line text-brand-dark"></i>
                        {t('projects_title')}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">{t('projects_subtitle')}</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-brand-dark text-white px-8 py-4 rounded-lg font-black shadow-xl hover:bg-slate-800 active:translate-y-0 transition-all flex items-center justify-center gap-2"
                >
                    <i className="ri-add-line text-xl"></i>
                    {t('projects_new')}
                </button>
            </header>

            {/* View Tabs */}
            <div className="flex gap-2 p-1 bg-slate-100/50 dark:bg-slate-800/20 w-fit rounded-lg border border-black/[0.06] dark:border-slate-800">
                <button
                    onClick={() => {
                        setActiveTab('me');
                        const filtered = getFilteredProjects(projects, 'me', user.id);
                        if (filtered.length > 0) setActiveProjectId(filtered[0].id);
                        else setActiveProjectId(null);
                    }}
                    className={`px-6 py-2 rounded-xl font-black text-sm transition-all ${activeTab === 'me' ? 'bg-white dark:bg-slate-800 text-brand-dark dark:text-brand-light shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                >
                    {t('projects_my')}
                </button>
                <button
                    onClick={() => {
                        setActiveTab('shared');
                        const filtered = getFilteredProjects(projects, 'shared', user.id);
                        if (filtered.length > 0) setActiveProjectId(filtered[0].id);
                        else setActiveProjectId(null);
                    }}
                    className={`px-6 py-2 rounded-xl font-black text-sm transition-all ${activeTab === 'shared' ? 'bg-white dark:bg-slate-800 text-brand-dark dark:text-brand-light shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                >
                    {t('projects_shared')}
                </button>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row gap-8 overflow-hidden min-h-0">
                {/* Project List Sidebar */}
                <div className="w-full lg:w-80 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
                    {filteredProjects.length === 0 ? (
                        <div className="bg-white dark:bg-slate-900 rounded-[1rem] border border-dashed border-slate-100 dark:border-slate-800 p-8 text-center text-slate-400 dark:text-slate-600">
                            <i className="ri-hammer-line text-4xl mb-2 block opacity-20"></i>
                            <p className="font-bold text-sm">{t('projects_no_projects')}</p>
                        </div>
                    ) : (
                        filteredProjects.map(project => {
                            const total = project.todos.length;
                            const completed = project.todos.filter(t => t.completed).length;
                            const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

                            return (
                                <button
                                    key={project.id}
                                    onClick={() => setActiveProjectId(project.id)}
                                    className={`text-left p-6 rounded-[1rem] border transition-all ${activeProjectId === project.id
                                        ? 'bg-white dark:bg-slate-800 border-brand-dark shadow-xl'
                                        : 'bg-white/50 dark:bg-slate-900/50 border-slate-50 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'}`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-black text-slate-800 dark:text-slate-100 truncate flex-1">{project.title}</h3>
                                        <span className="bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter shrink-0 border border-black/[0.06] dark:border-white/10">
                                            {getAssignmentDisplay(project.assigned_to)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 mb-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                        <i className="ri-calendar-event-line text-brand-dark"></i>
                                        {project.deadline ? new Date(applyOffset(project.deadline, user)).toLocaleDateString('de-DE') : t('projects_no_deadline')}
                                    </div>
                                    <div className="space-y-2">
                                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-500 ${progress === 100 ? 'bg-emerald-500' : 'bg-brand-dark '}`}
                                                style={{ width: `${progress}%` }}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">
                                            <span>{progress}% {t('projects_completed_label')}</span>
                                            <span>{completed}/{total} {t('projects_todos_label')}</span>
                                        </div>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Project Detail View */}
                <div className={`
                    flex flex-col min-h-0 bg-white dark:bg-slate-900
                    ${activeProject
                        ? 'fixed inset-0 z-50 animate-in slide-in-from-bottom-4 duration-300 lg:static lg:flex-1 lg:rounded-[1.25rem] lg:border lg:border-slate-100 dark:lg:border-slate-800 lg:shadow-sm lg:overflow-hidden lg:animate-none'
                        : 'hidden lg:flex lg:flex-1 lg:rounded-[1.25rem] lg:border lg:border-slate-100 dark:lg:border-slate-800 lg:shadow-sm lg:overflow-hidden'}
                `}>
                    {activeProject ? (
                        <>
                            <div className="p-8 sm:p-10 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                                <div className="flex justify-between items-start gap-4 mb-6">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setActiveProjectId(null)}
                                            className="lg:hidden w-10 h-10 -ml-2 flex items-center justify-center rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                                        >
                                            <i className="ri-arrow-left-line text-xl"></i>
                                        </button>
                                        <div>
                                            <h2 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight mb-2 leading-tight">{activeProject.title}</h2>
                                            <div className="flex flex-wrap gap-4 text-sm font-bold text-slate-400 dark:text-slate-500">
                                                <div className="flex items-center gap-2">
                                                    <i className="ri-user-line text-brand-dark"></i>
                                                    {t('projects_participants')}: {getAssignmentDisplay(activeProject.assigned_to)}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <i className="ri-calendar-line text-brand-dark"></i>
                                                    {t('projects_deadline_label')}: {activeProject.deadline ? new Date(applyOffset(activeProject.deadline, user)).toLocaleDateString('de-DE') : t('projects_not_set')}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        {activeProject.recurring_interval && (
                                            <button
                                                onClick={() => handleCompleteProject(activeProject.id)}
                                                disabled={isCompleting}
                                                className="h-12 px-6 bg-emerald-500 text-white rounded-lg font-black shadow-lg hover:bg-emerald-600 transition-all flex items-center gap-2 disabled:opacity-50"
                                                title={t('projects_complete_btn')}
                                            >
                                                <i className={`ri-${isCompleting ? 'loader-4-line animate-spin' : 'checkbox-circle-line'} text-xl`}></i>
                                                <span className="hidden sm:inline">{t('projects_complete_btn')}</span>
                                            </button>
                                        )}
                                        <button onClick={() => handleOpenModal(activeProject)} className="w-12 h-12 bg-white dark:bg-slate-800 rounded-lg border border-black/[0.06] dark:border-white/10 text-slate-400 dark:text-slate-500 hover:text-brand-dark dark:hover:text-brand-light hover:border-brand-light/30 transition-all shadow-sm flex items-center justify-center"><i className="ri-pencil-line text-xl"></i></button>
                                        <button onClick={() => handleDeleteProject(activeProject.id)} className="w-12 h-12 bg-white dark:bg-slate-800 rounded-lg border border-black/[0.06] dark:border-white/10 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:border-red-100 transition-all shadow-sm flex items-center justify-center"><i className="ri-delete-bin-line text-xl"></i></button>
                                    </div>
                                </div>
                                {activeProject.description && (
                                    <div className="bg-white/80 dark:bg-slate-800/80 rounded-lg p-6 border border-black/[0.06] dark:border-white/10 text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                                        {activeProject.description}
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 sm:p-10 custom-scrollbar dark:bg-slate-900">
                                {/* MILESTONES */}
                                <div className="mb-10">
                                    <h4 className="flex items-center gap-2 text-[10px] font-black text-brand-light uppercase tracking-[0.2em] mb-6">
                                        <i className="ri-flag-2-fill text-lg"></i> {t('projects_milestones')}
                                    </h4>
                                    
                                    <form onSubmit={handleAddMilestone} className="flex flex-col sm:flex-row gap-3 mb-6 bg-brand-light/5 dark:bg-brand-light/10 p-4 rounded-lg border border-brand-light/20 dark:border-brand-light/30">
                                        <input type="text" value={newMilestoneTitle} onChange={e => setNewMilestoneTitle(e.target.value)} placeholder={t('projects_new_milestone')} className="flex-1 bg-white dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-brand-light font-bold text-sm dark:text-slate-100" />
                                        <input type="date" value={newMilestoneDate} onChange={e => setNewMilestoneDate(e.target.value)} className="bg-white dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-brand-light font-bold text-sm text-slate-500 dark:text-slate-400" />
                                        <button className="bg-brand-dark text-white px-6 py-3 rounded-xl font-black shadow-md hover:bg-slate-800 transition-all text-sm shrink-0">{t('projects_add')}</button>
                                    </form>

                                    <div className="space-y-3">
                                        {!activeProject.milestones || activeProject.milestones.length === 0 ? (
                                            <p className="text-sm font-bold text-slate-300 dark:text-slate-600 italic px-4">{t('projects_no_milestones')}</p>
                                        ) : (
                                            activeProject.milestones.map(m => (
                                                <div key={m.id} className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border transition-all ${m.completed ? 'bg-emerald-50/30 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 opacity-70' : 'bg-white dark:bg-slate-900 border-brand-light/20 dark:border-slate-800 shadow-sm'}`}>
                                                    {editingMilestone?.id === m.id ? (
                                                        <div className="flex-1 flex flex-col sm:flex-row gap-2 w-full">
                                                            <input type="text" value={editingMilestone.title} onChange={e => setEditingMilestone({...editingMilestone, title: e.target.value})} className="flex-1 bg-white dark:bg-slate-800 border dark:border-white/10 px-3 py-2 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-brand-light dark:text-slate-100" />
                                                            <input type="date" value={editingMilestone.due_date || ''} onChange={e => setEditingMilestone({...editingMilestone, due_date: e.target.value})} className="bg-white dark:bg-slate-800 border dark:border-white/10 px-3 py-2 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-brand-light dark:text-slate-100" />
                                                            <button onClick={() => handleSaveMilestoneEdit(m.id)} className="bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold text-sm">{t('ok')}</button>
                                                            <button onClick={() => setEditingMilestone(null)} className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-lg font-bold text-sm">{t('cancel')}</button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <button onClick={() => handleToggleMilestone(activeProject.id, m.id, m.completed)} className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all ${m.completed ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:border-brand-light border border-black/[0.06] dark:border-white/10'}`}>
                                                                {m.completed && <i className="ri-check-line font-black"></i>}
                                                            </button>
                                                            <div className="flex-1 flex flex-col min-w-0">
                                                                <span className={`font-black truncate ${m.completed ? 'text-emerald-800 dark:text-emerald-500 line-through' : 'text-slate-800 dark:text-slate-100'}`}>{m.title}</span>
                                                                {m.due_date && <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5"><i className="ri-calendar-line"></i> {new Date(applyOffset(m.due_date, user)).toLocaleDateString('de-DE')}</span>}
                                                            </div>
                                                            <div className="flex items-center gap-1 shrink-0 mt-2 sm:mt-0">
                                                                <button onClick={() => setEditingMilestone({ id: m.id, title: m.title, due_date: m.due_date })} className="w-8 h-8 text-slate-400 dark:text-slate-500 hover:text-brand-dark dark:hover:text-brand-light hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"><i className="ri-pencil-line"></i></button>
                                                                <button onClick={() => handleDeleteMilestone(activeProject.id, m.id)} className="w-8 h-8 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"><i className="ri-delete-bin-line"></i></button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* TODOS */}
                                <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-6">{t('projects_todos_label')}</h4>

                                <form onSubmit={handleAddTodo} className="flex flex-col sm:flex-row gap-3 mb-8 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-black/[0.06] dark:border-slate-800">
                                    <input
                                        type="text"
                                        value={newTodo}
                                        onChange={e => setNewTodo(e.target.value)}
                                        placeholder={t('projects_todo_placeholder')}
                                        className="flex-1 bg-white dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 px-5 py-3.5 rounded-xl outline-none focus:ring-2 focus:ring-brand-light font-bold transition-all text-sm dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600"
                                    />
                                    <select 
                                        value={newTodoUrgency} 
                                        onChange={e => setNewTodoUrgency(e.target.value)} 
                                        className="bg-white dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 px-4 py-3.5 rounded-xl outline-none focus:ring-2 focus:ring-brand-light text-sm font-bold text-slate-600 dark:text-slate-400 appearance-none"
                                    >
                                        <option value="normal">{t('projects_urgency_normal')}</option>
                                        <option value="urgent">{t('projects_urgency_urgent')}</option>
                                    </select>
                                    <button className="bg-slate-800 dark:bg-brand-dark text-white px-6 py-3.5 rounded-xl font-black shadow-md hover:bg-slate-900 transition-all text-sm shrink-0">
                                        {t('projects_add')}
                                    </button>
                                </form>
 drum

                                <div className="space-y-3">
                                    {!activeProject.todos || activeProject.todos.length === 0 ? (
                                        <p className="text-center py-10 text-slate-300 dark:text-slate-600 font-bold">{t('projects_no_todos')}</p>
                                    ) : (
                                        activeProject.todos.map(todo => (
                                            <div
                                                key={todo.id}
                                                className={`flex items-center gap-3 sm:gap-4 p-4 rounded-lg border transition-all ${todo.completed ? 'bg-emerald-50/30 dark:bg-emerald-900/10 border-emerald-50 dark:border-emerald-900/30 opacity-60' : todo.urgency === 'urgent' ? 'bg-red-50/20 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-50 dark:border-slate-800 shadow-sm'}`}
                                            >
                                                {editingTodo?.id === todo.id ? (
                                                    <div className="flex-1 flex flex-col sm:flex-row gap-2 w-full">
                                                        <input type="text" value={editingTodo.task} onChange={e => setEditingTodo({...editingTodo, task: e.target.value})} className="flex-1 bg-white dark:bg-slate-800 border dark:border-white/10 px-3 py-2 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-brand-light dark:text-slate-100" />
                                                        <select value={editingTodo.urgency} onChange={e => setEditingTodo({...editingTodo, urgency: e.target.value})} className="bg-white dark:bg-slate-800 border dark:border-white/10 px-3 py-2 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-400">
                                                            <option value="normal">{t('projects_urgency_normal')}</option>
                                                            <option value="urgent">{t('projects_urgency_urgent')}</option>
                                                        </select>
                                                        <button onClick={() => handleSaveTodoEdit(todo.id)} className="bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold text-sm">{t('ok')}</button>
                                                        <button onClick={() => setEditingTodo(null)} className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-lg font-bold text-sm">{t('cancel')}</button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => handleToggleTodo(activeProject.id, todo.id, todo.completed)}
                                                            className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center transition-all ${todo.completed ? 'bg-emerald-500 text-white scale-110' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-black/[0.06] dark:border-white/10 hover:border-brand-light'}`}
                                                        >
                                                            {todo.completed && <i className="ri-check-line font-black"></i>}
                                                        </button>
                                                        <div className="flex-1 flex items-center gap-2 min-w-0">
                                                            {todo.urgency === 'urgent' && !todo.completed && (
                                                                <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" title={t('projects_urgency_urgent')}></div>
                                                            )}
                                                            {todo.urgency === 'normal' && !todo.completed && (
                                                                <div className="w-2 h-2 rounded-full bg-brand-light shrink-0" title={t('projects_urgency_normal')}></div>
                                                            )}
                                                            <span className={`font-bold truncate ${todo.completed ? 'text-emerald-800 dark:text-emerald-500 line-through' : todo.urgency === 'urgent' ? 'text-red-900 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                                                {todo.task}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button
                                                                onClick={() => setEditingTodo({ id: todo.id, task: todo.task, urgency: todo.urgency || 'normal' })}
                                                                className="w-8 h-8 text-slate-400 dark:text-slate-500 hover:text-brand-dark dark:hover:text-brand-light hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                                            >
                                                                <i className="ri-pencil-line"></i>
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteTodo(activeProject.id, todo.id)}
                                                                className="w-8 h-8 text-slate-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                            >
                                                                <i className="ri-delete-bin-line"></i>
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                            <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-[1rem] flex items-center justify-center text-5xl text-slate-200 dark:text-slate-700 mb-6 font-bold shadow-inner">
                                <i className="ri-tools-line"></i>
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">{t('projects_select_project')}</h3>
                            <p className="text-slate-400 dark:text-slate-500 font-medium max-w-xs">{t('projects_select_desc')}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Project Entry Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-[1.25rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 border dark:border-slate-800">
                        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
                            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">{editingProject ? t('projects_edit_title') : t('projects_new_title')}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors">
                                <i className="ri-close-line text-2xl"></i>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('projects_field_title')}</label>
                                        <input
                                            type="text" required
                                            value={formData.title}
                                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                                            className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg focus:ring-4 focus:ring-brand-light/10 outline-none font-bold dark:text-slate-100"
                                            placeholder="z.B. Küche neu streichen"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('projects_field_description')}</label>
                                        <textarea
                                            value={formData.description}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            rows="4"
                                            className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg focus:ring-4 focus:ring-brand-light/10 outline-none font-bold resize-none font-medium dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600"
                                            placeholder={t('projects_field_description_placeholder')}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('projects_field_interval')}</label>
                                            <select
                                                value={formData.recurring_interval}
                                                onChange={e => setFormData({ ...formData, recurring_interval: e.target.value })}
                                                className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg focus:ring-4 focus:ring-brand-light/10 outline-none font-bold appearance-none text-sm dark:text-slate-100"
                                            >
                                                <option value="">{t('projects_non_recurring')}</option>
                                                <option value="7_days">{t('projects_7_days')}</option>
                                                <option value="14_days">{t('projects_14_days')}</option>
                                                <option value="1_month">{t('projects_1_month')}</option>
                                                <option value="2_months">{t('projects_2_months')}</option>
                                                <option value="3_months">{t('projects_3_months')}</option>
                                                <option value="6_months">{t('projects_6_months')}</option>
                                                <option value="9_months">{t('projects_9_months')}</option>
                                                <option value="12_months">{t('projects_12_months')}</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('projects_field_deadline')}</label>
                                            <input
                                                type="date"
                                                value={formData.deadline}
                                                onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                                                className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg focus:ring-4 focus:ring-brand-light/10 outline-none font-bold text-sm dark:text-slate-100"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('projects_members_label')}</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {members.map(m => {
                                                const isSelected = formData.assigned_to.includes(`user:${m.id}`);
                                                return (
                                                    <button
                                                        key={m.id}
                                                        type="button"
                                                        onClick={() => toggleMember(m.id)}
                                                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${isSelected ? 'bg-brand-dark border-brand-dark text-white shadow-lg' : 'bg-white dark:bg-slate-800 border-slate-50 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-slate-200 dark:hover:border-slate-600'}`}
                                                    >
                                                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${isSelected ? 'bg-white/20 border-white/40' : 'bg-slate-50 border-slate-200'}`}>
                                                            {isSelected && <i className="ri-check-line font-black text-xs"></i>}
                                                        </div>
                                                        <span className="font-bold text-xs truncate">{m.username}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{t('projects_ext_label')}</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={externalInput}
                                                onChange={e => setExternalInput(e.target.value)}
                                                onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addExternal())}
                                                className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-xl outline-none font-bold text-xs dark:text-slate-100"
                                                placeholder={t('projects_ext_placeholder')}
                                            />
                                            <button
                                                type="button"
                                                onClick={addExternal}
                                                className="bg-slate-800 text-white px-4 rounded-xl font-black text-xs hover:bg-slate-900 transition-all"
                                            > + </button>
                                        </div>

                                        <div className="flex flex-wrap gap-2 min-h-[40px]">
                                            {formData.assigned_to.filter(k => k.startsWith('ext:')).map(key => (
                                                <div key={key} className="bg-slate-100 text-slate-600 pl-3 pr-2 py-1.5 rounded-lg flex items-center gap-2 text-[10px] font-black uppercase ring-1 ring-slate-200">
                                                    {key.split(':')[1]}
                                                    <button type="button" onClick={() => removeParticipant(key)} className="hover:text-red-500 transition-colors">
                                                        <i className="ri-close-line text-lg"></i>
                                                    </button>
                                                </div>
                                            ))}
                                            {formData.assigned_to.length === 0 && (
                                                <p className="text-[10px] font-bold text-slate-300 dark:text-slate-600 italic">{t('projects_none_assigned')}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4">
                                <button type="submit" className="w-full py-5 bg-brand-dark text-white rounded-[1rem] font-black shadow-xl hover:bg-slate-800 transition-all uppercase tracking-widest">
                                    {editingProject ? t('projects_save_changes') : t('projects_create_project')}
                                </button>
                            </div>
 Drum
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Projects;
