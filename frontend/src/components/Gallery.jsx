import React from 'react';
import api from '../services/api';
import { useTranslation } from '../i18n.jsx';

const Gallery = ({ user }) => {
    const { t } = useTranslation();
    const [albums, setAlbums] = React.useState([]);
    const [selectedAlbum, setSelectedAlbum] = React.useState(null);
    const [photos, setPhotos] = React.useState([]);
    const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
    const [newAlbumName, setNewAlbumName] = React.useState('');
    const [isUploadModalOpen, setIsUploadModalOpen] = React.useState(false);
    const [uploadFiles, setUploadFiles] = React.useState([]);
    const [isUploading, setIsUploading] = React.useState(false);
    const [familyMembers, setFamilyMembers] = React.useState([]);
    const [isAccessModalOpen, setIsAccessModalOpen] = React.useState(false);
    const [viewPhoto, setViewPhoto] = React.useState(null); // Lightbox state
    const [touchStart, setTouchStart] = React.useState(null);
    const [touchEnd, setTouchEnd] = React.useState(null);

    const minSwipeDistance = 50;

    const onTouchStart = (e) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;
        if (isLeftSwipe) handleNext();
        if (isRightSwipe) handlePrev();
    };

    const handleNext = (e) => {
        if (e) e.stopPropagation();
        if (!viewPhoto || photos.length <= 1) return;
        const currentIndex = photos.findIndex(p => p.id === viewPhoto.id);
        const nextIndex = (currentIndex + 1) % photos.length;
        setViewPhoto(photos[nextIndex]);
    };

    const handlePrev = (e) => {
        if (e) e.stopPropagation();
        if (!viewPhoto || photos.length <= 1) return;
        const currentIndex = photos.findIndex(p => p.id === viewPhoto.id);
        const prevIndex = (currentIndex - 1 + photos.length) % photos.length;
        setViewPhoto(photos[prevIndex]);
    };

    // Keyboard support
    React.useEffect(() => {
        const handleKeyDown = (e) => {
            if (!viewPhoto) return;
            if (e.key === 'ArrowRight') handleNext();
            if (e.key === 'ArrowLeft') handlePrev();
            if (e.key === 'Escape') setViewPhoto(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [viewPhoto, photos]);

    const serverUrl = api.defaults.baseURL.replace('/api', '');

    React.useEffect(() => {
        fetchAlbums();
    }, []);

    const fetchAlbums = async () => {
        try {
            const response = await api.get('/gallery/albums');
            setAlbums(response.data);
        } catch (error) {
            console.error('Error fetching albums:', error);
        }
    };

    const fetchPhotos = async (albumId) => {
        try {
            const response = await api.get(`/gallery/albums/${albumId}`);
            setPhotos(response.data.photos);
            setSelectedAlbum(response.data.album);
        } catch (error) {
            console.error('Error fetching photos:', error);
        }
    };

    const handleCreateAlbum = async (e) => {
        e.preventDefault();
        try {
            await api.post('/gallery/albums', { name: newAlbumName });
            setNewAlbumName('');
            setIsCreateModalOpen(false);
            fetchAlbums();
        } catch (error) {
            console.error('Error creating album:', error);
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (uploadFiles.length === 0 || !selectedAlbum) return;

        setIsUploading(true);
        const formData = new FormData();
        Array.from(uploadFiles).forEach(file => {
            formData.append('photos', file);
        });

        try {
            const response = await api.post(`/gallery/albums/${selectedAlbum.id}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setPhotos([...response.data, ...photos]);
            setIsUploadModalOpen(false);
            setUploadFiles([]);
            fetchAlbums();
        } catch (error) {
            console.error('Error uploading photos:', error);
            alert(t('save_error'));
        } finally {
            setIsUploading(false);
        }
    };

    const fetchFamilyMembers = async () => {
        try {
            const response = await api.get('/auth/family/members');
            setFamilyMembers(response.data.filter(m => m.id !== user.id));
        } catch (error) {
            console.error(error);
        }
    };

    const openAccessModal = () => {
        if (!selectedAlbum) return;
        setIsAccessModalOpen(true);
        fetchFamilyMembers();
    };

    const grantAccess = async (userId) => {
        try {
            await api.post(`/gallery/albums/${selectedAlbum.id}/access`, { user_id: userId });
            alert(t('gallery_grant_access_success'));
        } catch (error) {
            console.error(error);
            alert(t('gallery_grant_access_error'));
        }
    };

    const handleDeletePhoto = async (photoId) => {
        if (!confirm(t('gallery_delete_photo_confirm'))) return;
        try {
            await api.delete(`/gallery/photos/${photoId}`);
            setPhotos(photos.filter(p => p.id !== photoId));
            fetchAlbums(); // Update cover
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="h-full flex flex-col bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-black/[0.06] dark:border-slate-800 overflow-hidden relative">
            <div className="p-6 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
                    {selectedAlbum ? (
                        <>
                            <button onClick={() => setSelectedAlbum(null)} className="flex items-center hover:text-brand-dark dark:hover:text-brand-light gap-2 transition">
                                <i className="ri-arrow-left-line"></i>
                            </button>
                            {selectedAlbum.name}
                        </>
                    ) : t('gallery_title')}
                </h2>
                <div className="flex gap-2">
                    {selectedAlbum ? (
                        <>
                            {selectedAlbum.created_by === user.id && (
                                <button
                                    onClick={openAccessModal}
                                    className="px-4 py-2 bg-brand-light/20 text-brand-dark rounded-lg hover:bg-brand-light/30 transition"
                                    title={t('permissions')}
                                >
                                    <i className="ri-lock-line"></i>
                                </button>
                            )}
                            <button
                                onClick={() => setIsUploadModalOpen(true)}
                                className="px-4 py-2 bg-brand-dark text-white rounded-lg hover:bg-slate-800 transition flex items-center gap-2"
                            >
                                <i className="ri-upload-cloud-line"></i> {t('gallery_upload')}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="px-4 py-2 bg-brand-dark text-white rounded-lg hover:bg-slate-800 transition flex items-center gap-2"
                        >
                            <i className="ri-add-line"></i> {t('gallery_new_album')}
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {!selectedAlbum ? (
                    // Albums Grid
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {albums.map(album => (
                            <div
                                key={album.id}
                                onClick={() => fetchPhotos(album.id)}
                                className="group cursor-pointer"
                            >
                                <div className="aspect-square bg-brand-light/10 border border-brand-light/20 rounded-lg flex items-center justify-center text-brand-light group-hover:bg-brand-light/20 group-hover:border-brand-light/40 transition mb-3 relative overflow-hidden shadow-sm">
                                    {album.cover_photo ? (
                                        <img
                                            src={`${serverUrl}/uploads/${album.cover_photo}`}
                                            className="w-full h-full object-cover transition transform group-hover:scale-110 duration-500"
                                            alt={album.name}
                                        />
                                    ) : (
                                        <i className={`${album.name === t('chat_images') ? 'ri-chat-upload-line' : 'ri-image-2-line'} text-5xl opacity-50`}></i>
                                    )}

                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8 text-white text-xs text-center opacity-0 group-hover:opacity-100 transition duration-300">
                                        {album.photo_count} {t('gallery_photo_count')}
                                    </div>
                                </div>
                                <h3 className="font-bold text-gray-800 dark:text-slate-100 truncate group-hover:text-brand-dark dark:group-hover:text-brand-light transition">{album.name}</h3>
                                <p className="text-xs text-gray-400 dark:text-slate-500">{t('gallery_by')} {album.creator_name}</p>
                            </div>
                        ))}
                        {albums.length === 0 && (
                            <div className="col-span-full py-12 text-center text-gray-400 dark:text-slate-600">
                                <i className="ri-folder-add-line text-4xl mb-2 block"></i>
                                <p>{t('gallery_no_albums')}</p>
                            </div>
                        )}
                    </div>
                ) : (
                    // Photos Grid
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {photos.map(photo => (
                            <div
                                key={photo.id}
                                className="relative group aspect-square bg-gray-100 dark:bg-slate-800 rounded-xl overflow-hidden border border-black/[0.06] dark:border-white/10 cursor-zoom-in"
                                onClick={() => setViewPhoto(photo)}
                            >
                                <img
                                    src={`${serverUrl}/uploads/${photo.filename}`}
                                    className="w-full h-full object-cover transition transform group-hover:scale-105 duration-300"
                                    loading="lazy"
                                    alt={photo.original_name}
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setViewPhoto(photo); }}
                                        className="p-2 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/40 transition"
                                        title={t('details')}
                                    >
                                        <i className="ri-eye-line font-bold"></i>
                                    </button>
                                    <a
                                        href={`${serverUrl}/uploads/${photo.filename}`}
                                        download={photo.original_name}
                                        target="_blank" rel="noreferrer"
                                        className="p-2 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/40 transition"
                                        title={t('download')}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <i className="ri-download-line font-bold"></i>
                                    </a>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo.id); }}
                                        className="p-2 bg-white/20 backdrop-blur-sm rounded-full text-red-400 hover:bg-red-500 hover:text-white transition"
                                        title={t('delete')}
                                    >
                                        <i className="ri-delete-bin-line font-bold"></i>
                                    </button>
                                </div>
                            </div>
                        ))}
                        {photos.length === 0 && (
                            <div className="col-span-full py-12 text-center text-gray-400 dark:text-slate-600">
                                <i className="ri-image-add-line text-4xl mb-2 block"></i>
                                <p>{t('gallery_no_photos_desc')}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Lightbox / View Photo Modal */}
            {viewPhoto && (
                <div
                    className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-0 md:p-4 backdrop-blur-md animate-in fade-in duration-300"
                    onClick={() => { setViewPhoto(null); setTouchStart(null); setTouchEnd(null); }}
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                >
                    {/* Header Controls */}
                    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/50 to-transparent">
                        <div className="text-white/90 text-sm font-black bg-black/40 px-4 py-1.5 rounded-full backdrop-blur-md border border-white/10 uppercase tracking-widest">
                            {photos.findIndex(p => p.id === viewPhoto.id) + 1} / {photos.length}
                        </div>
                        <div className="flex gap-2">
                            <a
                                href={`${serverUrl}/uploads/${viewPhoto.filename}`}
                                download={viewPhoto.original_name}
                                target="_blank" rel="noreferrer"
                                className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-sm transition-all shadow-sm"
                                title={t('download')}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <i className="ri-download-line text-xl font-bold"></i>
                            </a>
                            <button
                                className="w-10 h-10 flex items-center justify-center text-white/50 hover:text-white bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-sm transition-all shadow-sm"
                                onClick={() => setViewPhoto(null)}
                            >
                                <i className="ri-close-line text-2xl font-bold"></i>
                            </button>
                        </div>
                    </div>

                    {/* Navigation Arrows - Desktop Only */}
                    <button
                        onClick={(e) => handlePrev(e)}
                        className="hidden md:flex absolute left-6 w-14 h-14 items-center justify-center text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-all group z-10"
                    >
                        <i className="ri-arrow-left-s-line text-5xl transition-transform group-hover:-translate-x-1"></i>
                    </button>

                    <button
                        onClick={(e) => handleNext(e)}
                        className="hidden md:flex absolute right-6 w-14 h-14 items-center justify-center text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-all group z-10"
                    >
                        <i className="ri-arrow-right-s-line text-5xl transition-transform group-hover:translate-x-1"></i>
                    </button>

                    {/* Image Container with swipe animation classes maybe? */}
                    <div className="relative w-full h-full flex items-center justify-center select-none overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <img
                            key={viewPhoto.id}
                            src={`${serverUrl}/uploads/${viewPhoto.filename}`}
                            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 fade-in duration-500 will-change-transform"
                            alt={viewPhoto.original_name}
                            draggable="false"
                        />

                        {/* Swipe Hint for Mobile */}
                        <div className="md:hidden absolute bottom-20 left-0 right-0 flex justify-center opacity-20 pointer-events-none">
                            <div className="flex gap-4">
                                <i className="ri-arrow-left-line"></i>
                                <span className="text-[10px] font-black uppercase tracking-widest">Swipe</span>
                                <i className="ri-arrow-right-line"></i>
                            </div>
                        </div>
                    </div>

                    {/* Metadata Footer */}
                    <div className="absolute bottom-0 left-0 right-0 p-6 pt-10 text-center bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
                        <div className="text-white font-black text-sm tracking-tight mb-0.5">{viewPhoto.original_name}</div>
                        <div className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em]">{selectedAlbum?.name}</div>
                    </div>
                </div>
            )}

            {/* Create Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <form onSubmit={handleCreateAlbum} className="bg-white dark:bg-slate-900 rounded-[1.25rem] p-6 w-full max-w-sm shadow-2xl border dark:border-slate-800">
                        <h3 className="font-black text-xl mb-4 text-slate-800 dark:text-slate-100">{t('gallery_new_album')}</h3>
                        <input
                            autoFocus
                            type="text"
                            placeholder={t('gallery_album_name_placeholder')}
                            className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-xl mb-4 focus:ring-4 focus:ring-brand-light/10 outline-none font-bold dark:text-slate-100"
                            value={newAlbumName}
                            onChange={e => setNewAlbumName(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-5 py-2.5 font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition">{t('cancel')}</button>
                            <button type="submit" className="px-6 py-2.5 bg-brand-dark text-white rounded-lg font-black shadow-lg hover:bg-slate-800 transition">{t('create')}</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Upload Modal */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <form onSubmit={handleUpload} className="bg-white dark:bg-slate-900 rounded-[1.25rem] p-6 w-full max-w-sm shadow-2xl border dark:border-slate-800">
                        <h3 className="font-black text-xl mb-4 text-slate-800 dark:text-slate-100">{t('gallery_upload_title')}</h3>
                        <div className="border border-dashed border-slate-200 dark:border-white/10 rounded-xl p-8 text-center mb-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer relative">
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={e => setUploadFiles(e.target.files)}
                            />
                            {uploadFiles.length > 0 ? (
                                <div className="space-y-1">
                                    <p className="text-brand-dark font-black">{uploadFiles.length} {t('gallery_upload_selected')}</p>
                                    <p className="text-xs text-slate-400 truncate">
                                        {Array.from(uploadFiles).map(f => f.name).join(', ')}
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <i className="ri-upload-cloud-line text-4xl text-slate-300 dark:text-slate-600 mb-2 block"></i>
                                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('gallery_upload_drop')}</p>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">{t('gallery_upload_multiple')}</p>
                                </>
                            )}
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => { setIsUploadModalOpen(false); setUploadFiles([]); }}
                                className="px-5 py-2.5 font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition"
                                disabled={isUploading}
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="submit"
                                disabled={uploadFiles.length === 0 || isUploading}
                                className="px-6 py-2.5 bg-brand-dark text-white rounded-lg font-black shadow-lg hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2"
                            >
                                {isUploading ? (
                                    <>
                                        <i className="ri-loader-4-line animate-spin"></i>
                                        {t('gallery_waiting')}
                                    </>
                                ) : (
                                    t('gallery_upload')
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Access Modal */}
            {isAccessModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-[1.25rem] p-6 w-full max-w-sm shadow-2xl border dark:border-slate-800 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-black text-xl text-slate-800 dark:text-slate-100">{t('gallery_manage_access')}</h3>
                            <button onClick={() => setIsAccessModalOpen(false)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors"><i className="ri-close-line text-2xl"></i></button>
                        </div>
                        <p className="text-sm font-bold text-slate-400 dark:text-slate-500 mb-6">{t('gallery_manage_access_desc')}</p>

                        <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                            {familyMembers.length === 0 ? (
                                <div className="text-center py-8">
                                    <i className="ri-user-search-line text-3xl text-slate-200 dark:text-slate-800 mb-2 block"></i>
                                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500">{t('gallery_no_members_found')}</p>
                                </div>
                            ) : (
                                familyMembers.map(member => (
                                    <div key={member.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-transparent hover:border-black/[0.06] dark:hover:border-slate-700 transition">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-brand-light/10 flex items-center justify-center text-brand-dark font-black text-sm">
                                                {member.name.charAt(0)}
                                            </div>
                                            <span className="font-bold text-slate-700 dark:text-slate-200">{member.name}</span>
                                        </div>
                                        <button
                                            onClick={() => grantAccess(member.id)}
                                            className="text-[10px] font-black uppercase tracking-widest px-4 py-2 bg-brand-light/20 text-brand-dark rounded-full hover:bg-brand-light/30 transition flex items-center gap-1"
                                        >
                                            <i className="ri-add-line"></i> {t('gallery_access_btn')}
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Gallery;
