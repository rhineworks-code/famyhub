import Timeline from './Timeline';
import { Link } from 'react-router-dom';
import { useTranslation } from '../i18n.jsx';

const TimelineWidget = ({ user }) => {
    const { t } = useTranslation();
    return (
        <div className="bg-white dark:bg-slate-800 rounded-[1.25rem] border border-black/[0.06] dark:border-white/10 shadow-sm flex flex-col overflow-hidden relative h-full transition-colors duration-500">
            <div className="p-6 border-b border-slate-50 dark:border-white/10 flex items-center justify-between shrink-0">
                <h3 className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-brand-light/10 dark:bg-brand-light/20 text-brand-dark dark:text-brand-light flex items-center justify-center">
                        <i className="ri-history-line"></i>
                    </div>
                    {t('timeline')}
                </h3>
                <Link to="/timeline" className="text-[10px] font-black uppercase tracking-widest text-brand-light dark:text-brand-light hover:text-brand-dark dark:hover:text-white transition-colors">{t('view_all')}</Link>
            </div>
            <div className="flex-1 overflow-hidden p-2 bg-slate-50/50 dark:bg-slate-900/50">
                <Timeline user={user} isWidget={true} />
            </div>
        </div>
    );
};

export default TimelineWidget;
