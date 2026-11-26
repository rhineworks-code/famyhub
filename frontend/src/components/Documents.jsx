import React from 'react';
import api, { documentUrl } from '../services/api';
import { useTranslation } from '../i18n.jsx';

const Documents = ({ user }) => {
    const { t } = useTranslation();
    const [documents, setDocuments] = React.useState([]);
    const [categories, setCategories] = React.useState([]);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [selectedCategory, setSelectedCategory] = React.useState('');
    const [showArchived, setShowArchived] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState('all'); // all | private | shared
    const [selectedIds, setSelectedIds] = React.useState(new Set());
    const [isBulkMoveOpen, setIsBulkMoveOpen] = React.useState(false);
    const [isBulkTagOpen, setIsBulkTagOpen] = React.useState(false);
    const [viewMode, setViewMode] = React.useState('grid'); // grid | list
    const [tags, setTags] = React.useState([]);
    const [selectedTagIds, setSelectedTagIds] = React.useState(new Set()); // for filtering

    // Modals
    const [isUploadModalOpen, setIsUploadModalOpen] = React.useState(false);
    const [isDocModalOpen, setIsDocModalOpen] = React.useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = React.useState(false);
    const [confirmDelete, setConfirmDelete] = React.useState({ type: null, id: null, title: '' }); // type: 'doc' | 'category'

    const [selectedDoc, setSelectedDoc] = React.useState(null);
    const [uploadFiles, setUploadFiles] = React.useState([]); // Array instead of single file
    const [uploadTitle, setUploadTitle] = React.useState('');
    const [uploadCategoryId, setUploadCategoryId] = React.useState('');
    const [uploadIsShared, setUploadIsShared] = React.useState(false);
    const [isUploading, setIsUploading] = React.useState(false);
    const [uploadProgress, setUploadProgress] = React.useState({ current: 0, total: 0 });

    // OCR state
    const [ocrProgress, setOcrProgress] = React.useState(0); // 0-100
    const [ocrStatus, setOcrStatus] = React.useState(''); // text status
    const [ocrText, setOcrText] = React.useState(''); // extracted text

    const [isReextracting, setIsReextracting] = React.useState(false);

    const [newCategoryName, setNewCategoryName] = React.useState('');
    const [newCategoryColor, setNewCategoryColor] = React.useState('#6366f1');

    const [newTagName, setNewTagName] = React.useState('');
    const [newTagColor, setNewTagColor] = React.useState('#6366f1');
    const [activeUploadSuggestions, setActiveUploadSuggestions] = React.useState(null);

    const [draggedDocId, setDraggedDocId] = React.useState(null);
    const [isDraggingOverFolder, setIsDraggingOverFolder] = React.useState(null); // folderId
    const [sortBy, setSortBy] = React.useState('date-desc'); // date-desc, date-asc, name-asc, name-desc, type, tags

    const fileInputRef = React.useRef(null);

    React.useEffect(() => {
        fetchCategories();
        fetchTags();
        fetchDocuments();
    }, [showArchived]);

    const fetchDocuments = async () => {
        try {
            const res = await api.get(`/documents?archived=${showArchived}`);
            setDocuments(res.data);
        } catch (err) { console.error('Error fetching documents:', err); }
    };

    const fetchCategories = async () => {
        try {
            const res = await api.get('/documents/categories');
            setCategories(res.data);
        } catch (err) { console.error('Error fetching categories:', err); }
    };

    const fetchTags = async () => {
        try {
            const res = await api.get('/documents/tags');
            setTags(res.data);
        } catch (err) { console.error('Error fetching tags:', err); }
    };

    // ─── Browser OCR: Maximum Results ─────────────────────────────────────────
    const loadTesseract = () => new Promise((resolve, reject) => {
        if (window.Tesseract) return resolve(window.Tesseract);
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        script.onload = () => resolve(window.Tesseract);
        script.onerror = () => reject(new Error('Tesseract CDN load failed'));
        document.head.appendChild(script);
    });

    const loadPdfJs = () => new Promise((resolve, reject) => {
        if (window.pdfjsLib) return resolve(window.pdfjsLib);
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve(window.pdfjsLib);
        };
        script.onerror = () => reject(new Error('PDF.js CDN load failed'));
        document.head.appendChild(script);
    });

    const preprocessImage = (imageElement) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const w = imageElement.naturalWidth || imageElement.width;
        const h = imageElement.naturalHeight || imageElement.height;
        
        // Use a slightly larger canvas for better resolution
        canvas.width = w;
        canvas.height = h;

        // Apply filters: Grayscale + Sharp Contrast
        // We avoid full binarization to keep anti-aliasing for the OCR engine
        ctx.filter = 'grayscale(100%) contrast(200%) brightness(100%)';
        ctx.drawImage(imageElement, 0, 0);

        return canvas;
    };

    const runBrowserOCR = async (source) => {
        setOcrText('');
        setOcrProgress(0);
        setOcrStatus(t('optimizing_doc'));
        try {
            const Tesseract = await loadTesseract();
            let processedCanvas;

            if (source instanceof HTMLCanvasElement) {
                processedCanvas = source; // Already a canvas from PDF rendering
            } else if (source instanceof File || source instanceof Blob || source instanceof Image) {
                const img = (source instanceof Image) ? source : new Image();
                if (!(source instanceof Image)) {
                    img.src = URL.createObjectURL(source);
                    await new Promise(r => img.onload = r);
                }
                processedCanvas = preprocessImage(img);
                if (!(source instanceof Image)) URL.revokeObjectURL(img.src);
            }

            const worker = await Tesseract.createWorker(['deu', 'eng'], 1, {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        setOcrProgress(Math.round(m.progress * 100));
                        setOcrStatus(`${t('recognizing_text')}: ${Math.round(m.progress * 100)}%`);
                    }
                }
            });

            // Remove whitelist to allow the full German model to guess better
            await worker.setParameters({
                tessedit_pageseg_mode: '1', // Auto
            });

            const { data: ocrResult } = await worker.recognize(processedCanvas);
            await worker.terminate();

            const text = (ocrResult.text || '').trim();
            setOcrText(text);
            setOcrProgress(100);
            setOcrStatus(text ? `✅ ${text.length} ${t('characters_extracted')}` : '⚠️ ' + t('no_text_found'));
            return text;
        } catch (err) {
            console.error('[OCR Error]', err);
            setOcrStatus('❌ ' + (t('error') || 'Fehler') + ': ' + err.message);
            return '';
        }
    };

    // Advanced PDF OCR: Page by Page
    const runPdfOCR = async (blob) => {
        setOcrProgress(0);
        setOcrStatus(t('loading_pdf'));
        try {
            const pdfjs = await loadPdfJs();
            const arrayBuffer = await new Promise((res, rej) => {
                const reader = new FileReader();
                reader.onload = () => res(reader.result);
                reader.onerror = rej;
                reader.readAsArrayBuffer(blob);
            });
            const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
            
            let fullText = "";
            const totalPages = Math.min(pdf.numPages, 5); // Limit to first 5 pages for performance

            for (let i = 1; i <= totalPages; i++) {
                setOcrStatus(`${t('rendering_page')} ${i}/${totalPages}...`);
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 3.0 }); // High res for OCR
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                await page.render({ canvasContext: ctx, viewport }).promise;
                
                // Preprocess the rendered page
                const imgData = preprocessImage(canvas);
                
                // OCR this page
                setOcrStatus(`${t('reading_page') || 'Lese Seite'} ${i}/${totalPages}...`);
                const pageText = await runBrowserOCR(imgData);
                fullText += `--- ${t('page_label')} ${i} ---\n${pageText}\n\n`;
            }

            setOcrText(fullText.trim());
            setOcrStatus(`✅ ${pdf.numPages} Seiten analysiert`);
            return fullText.trim();
        } catch (err) {
            console.error('[PDF OCR Error]', err);
            setOcrStatus('❌ ' + t('pdf_analysis_failed'));
            return '';
        }
    };

    // ─── File selection ───────────────────────────────────────────────────────
    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        setUploadFiles(prev => [...prev, ...files]);
        if (!uploadTitle && files.length === 1) setUploadTitle(files[0].name.replace(/\.[^/.]+$/, ''));

        if (files.length === 1) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                await runBrowserOCR(file);
            } else if (file.type === 'application/pdf') {
                setOcrStatus(t('pdf_detected'));
                await runPdfOCR(file);
            }
        }
    };

    const removeUploadFile = (index) => {
        setUploadFiles(prev => prev.filter((_, i) => i !== index));
    };

    // ─── Drag & Drop ──────────────────────────────────────────────────────────
    const onDragStart = (e, docId) => {
        setDraggedDocId(docId);
        e.dataTransfer.setData('docId', docId);
        e.dataTransfer.effectAllowed = 'move';
        // Add a ghost image or styling
        e.target.classList.add('opacity-50', 'scale-95');
    };

    const onDragEnd = (e) => {
        e.target.classList.remove('opacity-50', 'scale-95');
        setIsDraggingOverFolder(null);
    };

    const onDropOnFolder = async (e, folderId) => {
        e.preventDefault();
        const docId = e.dataTransfer.getData('docId') || draggedDocId;
        if (!docId) return;

        setIsDraggingOverFolder(null);
        try {
            await handleUpdateDocument(docId, { category_id: folderId });
            // Show toast or subtle success
        } catch (err) { console.error('Move failed', err); }
    };

    // ─── Bulk Upload ─────────────────────────────────────────────────────────
    const handleUpload = async (e) => {
        e.preventDefault();
        if (uploadFiles.length === 0) return;
        setIsUploading(true);
        setUploadProgress({ current: 0, total: uploadFiles.length });

        try {
            for (let i = 0; i < uploadFiles.length; i++) {
                const file = uploadFiles[i];
                setUploadProgress({ current: i + 1, total: uploadFiles.length });
                
                const formData = new FormData();
                formData.append('file', file);
                // Title: use uploadTitle for the first file, or just filename (ext stripped) for others
                formData.append('title', i === 0 && uploadTitle ? uploadTitle : file.name.replace(/\.[^/.]+$/, ''));
                formData.append('is_shared', uploadIsShared ? '1' : '0');
                if (uploadCategoryId) formData.append('category_id', uploadCategoryId);
                
                // If it's a single file and we have OCR text from the preview, send it
                if (uploadFiles.length === 1 && ocrText) {
                    formData.append('content_text', ocrText);
                }

                const res = await api.post('/documents', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                if (res.data.suggestions) {
                    setActiveUploadSuggestions(res.data.suggestions);
                }
            }

            setIsUploadModalOpen(false);
            resetUpload();
            fetchDocuments();
        } catch (err) {
            console.error('Upload failed', err);
            alert(t('upload_error'));
        } finally {
            setIsUploading(false);
            setUploadProgress({ current: 0, total: 0 });
        }
    };

    const resetUpload = () => {
        setUploadFiles([]);
        setUploadTitle('');
        setUploadCategoryId('');
        setUploadIsShared(false);
        setOcrText('');
        setOcrStatus('');
        setOcrProgress(0);
    };

    // ─── Category CRUD ────────────────────────────────────────────────────────
    const handleCreateCategory = async (e) => {
        e.preventDefault();
        try {
            await api.post('/documents/categories', { name: newCategoryName, color: newCategoryColor });
            setNewCategoryName('');
            setNewCategoryColor('#6366f1');
            fetchCategories();
            setIsCategoryModalOpen(false);
        } catch (err) { console.error('Failed to create category', err); }
    };

    const handleDeleteCategory = async (id) => {
        try {
            await api.delete(`/documents/categories/${id}`);
            fetchCategories();
            fetchDocuments();
            setConfirmDelete({ type: null, id: null, title: '' });
        } catch (err) { 
            console.error('Failed to delete category', err); 
            alert((t('delete_failed') || 'Löschen fehlgeschlagen: ') + err.message);
        }
    };

    const handleCreateTag = async (e) => {
        e.preventDefault();
        try {
            await api.post('/documents/tags', { name: newTagName, color: newTagColor });
            setNewTagName('');
            setNewTagColor('#6366f1');
            fetchTags();
        } catch (err) { console.error('Failed to create tag', err); }
    };

    const handleDeleteTag = async (id) => {
        try {
            await api.delete(`/documents/tags/${id}`);
            fetchTags();
            fetchDocuments();
            setConfirmDelete({ type: null, id: null, title: '' });
        } catch (err) { 
            console.error('Failed to delete tag', err); 
            alert((t('delete_failed') || 'Löschen fehlgeschlagen: ') + err.message);
        }
    };

    // ─── Document CRUD ────────────────────────────────────────────────────────
    const handleUpdateDocument = async (id, data) => {
        try {
            await api.put(`/documents/${id}`, data);
            fetchDocuments();
            if (selectedDoc && selectedDoc.id === id) {
                setSelectedDoc({ ...selectedDoc, ...data });
                if (data.is_archived !== undefined) setIsDocModalOpen(false);
            }
        } catch (err) { console.error('Failed to update document', err); }
    };

    const handleDeleteDocument = async (id) => {
        try {
            await api.delete(`/documents/${id}`);
            fetchDocuments();
            setIsDocModalOpen(false);
            setConfirmDelete({ type: null, id: null, title: '' });
        } catch (err) { 
            console.error('Failed to delete document', err);
            alert((t('delete_failed') || 'Löschen fehlgeschlagen: ') + err.message);
        }
    };

    const openDocument = (doc) => { setSelectedDoc(doc); setIsDocModalOpen(true); };

    // ─── Print ────────────────────────────────────────────────────────────────
    const handlePrint = (doc) => {
        const url = `${documentUrl(doc.filename)}`;
        const win = window.open(url, '_blank');
        if (win) {
            win.addEventListener('load', () => {
                setTimeout(() => { win.print(); }, 500);
            }, { once: true });
        }
    };

    // ─── Re-extract Text ──────────────────────────────────────────────────────
    const handleReextract = async (doc) => {
        setIsReextracting(true);
        setOcrStatus(t('connecting_to_server'));
        setOcrProgress(0);
        try {
            let text = '';
            const ext = doc.filename.split('.').pop().toLowerCase();
            
            // USE ABSOLUTE URL TO BYPASS AXIOS BASEURL CONFUSION
            const fileUrl = `${documentUrl(doc.filename)}`;
            const response = await fetch(fileUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const blob = await response.blob();

            if (ext === 'pdf') {
                text = await runPdfOCR(blob);
            } else {
                text = await runBrowserOCR(blob);
            }

            if (text) {
                setOcrText(text);
                setOcrProgress(100);
                await api.put(`/documents/${doc.id}`, { content_text: text });
                const docRes = await api.get(`/documents?archived=${showArchived}`);
                setDocuments(docRes.data);
                const updated = docRes.data.find(d => d.id === doc.id);
                if (updated) setSelectedDoc(updated);
            }
        } catch (err) {
            console.error('Re-extraction failed', err);
            try { await api.post(`/documents/${doc.id}/reextract`); } catch(_) {}
            alert((t('extraction_failed') || 'Extraktion fehlgeschlagen: ') + err.message);
        } finally {
            setIsReextracting(false);
            setOcrStatus('');
        }
    };

    // ─── Bulk Actions (Frontend Logic) ────────────────────────────────────────
    const toggleSelect = (id) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedIds(newSelected);
    };

    const handleSelectAll = (filtered) => {
        if (selectedIds.size === filtered.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(filtered.map(d => d.id)));
    };

    const handleBulkDelete = async () => {
        if (!confirm(`${selectedIds.size} Dokumente wirklich unwiderruflich löschen?`)) return;
        try {
            await api.post('/documents/bulk-delete', { ids: Array.from(selectedIds) });
            setSelectedIds(new Set());
            fetchDocuments();
        } catch (err) { alert((t('bulk_delete_error') || 'Fehler bei Massenlöschung: ') + err.message); }
    };

    const handleBulkMove = async (categoryId) => {
        try {
            await api.post('/documents/bulk-update', { 
                ids: Array.from(selectedIds), 
                updates: { category_id: categoryId || null } 
            });
            setSelectedIds(new Set());
            setIsBulkMoveOpen(false);
            fetchDocuments();
        } catch (err) { alert((t('move_error') || 'Fehler beim Verschieben: ') + err.message); }
    };

    const handleBulkArchive = async (archive = true) => {
        try {
            await api.post('/documents/bulk-update', { 
                ids: Array.from(selectedIds), 
                updates: { is_archived: archive } 
            });
            setSelectedIds(new Set());
            fetchDocuments();
        } catch (err) { alert((t('archive_error') || 'Fehler beim Archivieren: ') + err.message); }
    };

    const handleBulkTag = async (tagId) => {
        try {
            await api.post('/documents/bulk-update', { 
                ids: Array.from(selectedIds), 
                tagIdsToAdd: [tagId] 
            });
            setSelectedIds(new Set());
            setIsBulkTagOpen(false);
            fetchDocuments();
        } catch (err) { alert((t('tag_error') || 'Fehler beim Zuweisen des Tags: ') + err.message); }
    };

    const toggleTagFilter = (tagId) => {
        const newSelected = new Set(selectedTagIds);
        if (newSelected.has(tagId)) newSelected.delete(tagId);
        else newSelected.add(tagId);
        setSelectedTagIds(newSelected);
    };

    // ─── Filter ───────────────────────────────────────────────────────────────
    const filteredDocuments = documents.filter(doc => {
        const matchesCategory = selectedCategory ? doc.category_id === parseInt(selectedCategory) : true;
        
        // Tag filter: MUST match ALL selected tags (if any)
        const matchesTags = selectedTagIds.size === 0 || 
            (doc.tags && Array.from(selectedTagIds).every(tId => doc.tags.some(t => t.id === tId)));

        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = doc.title.toLowerCase().includes(searchLower) ||
            (doc.content_text && doc.content_text.toLowerCase().includes(searchLower)) ||
            (doc.tags && doc.tags.some(t => t.name.toLowerCase().includes(searchLower.replace('#', ''))));

        const matchesTab = activeTab === 'all' || (activeTab === 'shared' && doc.is_shared) || (activeTab === 'private' && !doc.is_shared);
        
        return matchesCategory && matchesTags && matchesSearch && matchesTab;
    }).sort((a, b) => {
        if (sortBy === 'name-asc') return a.title.localeCompare(b.title);
        if (sortBy === 'name-desc') return b.title.localeCompare(a.title);
        if (sortBy === 'date-desc') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        if (sortBy === 'date-asc') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        if (sortBy === 'type') {
            const extA = a.filename?.split('.').pop().toLowerCase() || '';
            const extB = b.filename?.split('.').pop().toLowerCase() || '';
            return extA.localeCompare(extB);
        }
        if (sortBy === 'tags') {
            const tagsA = (a.tags || []).map(t => t.name).sort().join(',') || '';
            const tagsB = (b.tags || []).map(t => t.name).sort().join(',') || '';
            return tagsA.localeCompare(tagsB);
        }
        return 0;
    });

    const isPDF = (doc) => doc.filename?.toLowerCase().endsWith('.pdf');

    return (
        <div className="pb-24 lg:pb-8 relative">
            <div>
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
                            <i className="ri-folder-open-line text-brand-dark"></i>
                            {t('documents_title')}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-bold ml-1 mt-1">{t('documents_subtitle')}</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsCategoryModalOpen(true)} className="p-3 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl border border-black/[0.06] dark:border-white/10 hover:border-brand-dark/20 transition-all font-bold flex items-center gap-2">
                            <i className="ri-price-tag-3-line"></i>
                            <span className="hidden sm:inline">{t('categories')}</span>
                        </button>
                        <button onClick={() => { resetUpload(); setIsUploadModalOpen(true); }} className="px-6 py-3 bg-brand-dark text-white rounded-xl shadow-lg hover:bg-slate-800 transition-all font-black uppercase tracking-widest text-sm flex items-center gap-2">
                            <i className="ri-add-line text-lg"></i>
                            {t('new_upload')}
                        </button>
                    </div>
                </div>

                {/* Quick Folder Navigation */}
                <div className="flex items-center gap-4 mb-8 overflow-x-auto pb-4 custom-scrollbar">
                    <button
                        onClick={() => setSelectedCategory('')}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => onDropOnFolder(e, null)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all border shrink-0 w-28 group ${!selectedCategory ? 'bg-brand-dark border-brand-dark text-white shadow-lg' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-white/10 text-slate-400 hover:border-brand-light/30'}`}
                    >
                        <i className={`ri-folder-paper-line text-3xl group-hover:scale-110 transition-transform ${!selectedCategory ? 'text-white' : 'text-slate-300 dark:text-slate-600'}`}></i>
                        <span className="text-xs font-black uppercase tracking-widest text-center truncate w-full">{t('all')}</span>
                    </button>

                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id.toString())}
                            onDragOver={(e) => { e.preventDefault(); setIsDraggingOverFolder(cat.id); }}
                            onDragLeave={() => setIsDraggingOverFolder(null)}
                            onDrop={(e) => onDropOnFolder(e, cat.id)}
                            className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all border shrink-0 w-28 group relative ${selectedCategory === cat.id.toString() ? 'bg-white dark:bg-slate-800 border-dashed shadow-md' : 'bg-white dark:bg-slate-800 border-black/[0.06] dark:border-white/10 hover:border-black/[0.06]'} ${isDraggingOverFolder === cat.id ? 'bg-brand-light/10 border-brand-dark border-solid scale-105' : ''}`}
                            style={selectedCategory === cat.id.toString() ? { borderColor: cat.color } : {}}
                        >
                            <i className="ri-folder-6-fill text-3xl transition-transform group-hover:scale-110" style={{ color: cat.color }}></i>
                            <span className="text-xs font-black uppercase tracking-widest text-center truncate w-full" style={selectedCategory === cat.id.toString() ? { color: cat.color } : { color: '#64748b' }}>
                                {cat.name}
                            </span>
                        </button>
                    ))}

                    <button
                        onClick={() => setIsCategoryModalOpen(true)}
                        className="flex flex-col items-center gap-2 p-4 rounded-2xl transition-all border border-dashed border-black/[0.06] dark:border-white/10 text-slate-300 dark:text-slate-600 hover:border-brand-dark/20 hover:text-brand-dark shrink-0 w-28 group"
                    >
                        <i className="ri-add-circle-line text-3xl group-hover:rotate-90 transition-transform"></i>
                        <span className="text-xs font-black uppercase tracking-widest">{t('new')}</span>
                    </button>
                </div>

                {/* Filter & Search */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-white dark:bg-slate-800 p-4 rounded-[1.25rem] border border-black/[0.06] dark:border-white/10 shadow-sm transition-colors">
                    {/* Tabs / Filter Buttons */}
                    <div className="flex bg-slate-50 dark:bg-slate-900 p-1.5 rounded-xl gap-1">
                        {['all', 'private', 'shared'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white dark:bg-slate-800 text-brand-dark dark:text-brand-light shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
                            >
                                {t(tab)}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-4 flex-1 max-w-2xl ml-auto">
                        <div className="flex bg-white dark:bg-slate-800 rounded-xl border border-black/[0.06] dark:border-white/10 p-1 items-center gap-1">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${viewMode === 'grid' ? 'bg-brand-dark text-white shadow-md' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                title={t('grid_view')}
                            >
                                <i className="ri-layout-grid-line text-lg"></i>
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${viewMode === 'list' ? 'bg-brand-dark text-white shadow-md' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                title={t('list_view')}
                            >
                                <i className="ri-list-check-2 text-lg"></i>
                            </button>
                        </div>
                        {filteredDocuments.length > 0 && (
                            <button
                                onClick={() => handleSelectAll(filteredDocuments)}
                                className={`px-4 py-2.5 rounded-xl border transition-all font-bold text-xs uppercase tracking-widest flex items-center gap-2 ${selectedIds.size === filteredDocuments.length && filteredDocuments.length > 0 ? 'bg-brand-dark border-brand-dark text-white shadow-md' : 'bg-white dark:bg-slate-800 border-black/[0.06] dark:border-white/10 text-slate-400 dark:text-slate-500 hover:border-black/[0.06] dark:hover:border-slate-600'}`}
                            >
                                <i className={selectedIds.size === filteredDocuments.length ? 'ri-checkbox-fill' : 'ri-checkbox-blank-line'}></i>
                                {selectedIds.size === filteredDocuments.length ? t('deselect_all') : t('select_all')}
                            </button>
                        )}

                        <div className="relative group shrink-0">
                            <select 
                                value={sortBy} 
                                onChange={(e) => setSortBy(e.target.value)}
                                className="pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-black/[0.06] dark:border-white/10 rounded-xl outline-none focus:border-brand-light dark:focus:border-brand-dark font-bold text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-all appearance-none cursor-pointer hover:bg-white dark:hover:bg-slate-800"
                            >
                                <option value="date-desc">{t('newest')}</option>
                                <option value="date-asc">{t('oldest')}</option>
                                <option value="name-asc">{t('name_az')}</option>
                                <option value="name-desc">{t('name_za')}</option>
                                <option value="type">{t('type')}</option>
                                <option value="tags">{t('tags')}</option>
                            </select>
                            <i className="ri-sort-desc absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"></i>
                        </div>

                        <div className="relative flex-1">
                            <i className="ri-search-2-line absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-lg"></i>
                            <div className="absolute left-12 top-1/2 -translate-y-1/2 flex gap-1 items-center max-w-[40%] overflow-hidden pointer-events-none">
                                {Array.from(selectedTagIds).map(tId => {
                                    const tag = tags.find(t => t.id === tId);
                                    if (!tag) return null;
                                    return (
                                        <span key={tag.id} className="px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest text-white shadow-sm pointer-events-auto" style={{ backgroundColor: tag.color }}>
                                            {tag.name}
                                            <button onClick={(e) => { e.stopPropagation(); toggleTagFilter(tag.id); }} className="ml-1 hover:text-black transition-colors"><i className="ri-close-circle-fill"></i></button>
                                        </span>
                                    );
                                })}
                            </div>

                            <input
                                type="text"
                                placeholder={selectedTagIds.size > 0 ? "" : t('search_placeholder')}
                                className={`w-full ${selectedTagIds.size > 0 ? 'pl-48' : 'pl-12'} pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-black/[0.06] dark:border-white/10 rounded-xl outline-none focus:border-brand-light dark:focus:border-brand-dark font-bold text-slate-800 dark:text-slate-100 transition-all shadow-inner placeholder:text-slate-400 dark:placeholder:text-slate-600`}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={() => setShowArchived(!showArchived)}
                            className={`p-3 rounded-xl border transition-all flex items-center justify-center ${showArchived ? 'bg-brand-dark border-brand-dark text-white' : 'bg-white dark:bg-slate-800 border-black/[0.06] dark:border-white/10 text-slate-400 dark:text-slate-500 hover:border-black/[0.06] dark:hover:border-slate-600'}`}
                            title={showArchived ? t('archive_hide') : t('archive_show')}
                        >
                            <i className="ri-archive-2-line text-xl"></i>
                        </button>
                    </div>
                </div>

                {/* List Headers (only for list view) */}
                {viewMode === 'list' && filteredDocuments.length > 0 && (
                    <div className="hidden md:flex items-center gap-4 px-6 py-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400 border border-slate-100 dark:border-slate-800">
                        <div className="w-6 h-6"></div>
                        <div className="w-12 h-12"></div>
                        <div className="flex-1">{t('name_label') || 'Name'}</div>
                        <div className="w-[120px] text-right pr-4">{t('type_label')} / {t('date_label')}</div>
                        <div className="w-10"></div>
                    </div>
                )}

                {/* Documents List */}
                <div className={viewMode === 'grid' ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6" : "flex flex-col gap-3"}>
                    {filteredDocuments.length === 0 ? (
                        <div className="col-span-full py-20 text-center bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-[2rem] border-2 border-dashed border-slate-100 dark:border-white/10 w-full transition-colors">
                            <i className="ri-ghost-smile-line text-6xl text-slate-200 dark:text-slate-700 mb-4 inline-block"></i>
                            <p className="text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest">{t('no_docs_found')}</p>
                        </div>
                    ) : (
                        filteredDocuments.map(doc => (
                            viewMode === 'grid' ? (
                                <div
                                    key={doc.id}
                                    draggable="true"
                                    onDragStart={(e) => onDragStart(e, doc.id)}
                                    onDragEnd={onDragEnd}
                                    className={`group bg-white dark:bg-slate-800 rounded-[1.5rem] border p-4 shadow-sm hover:shadow-xl transition-all duration-300 relative cursor-pointer active:scale-95 ${selectedIds.has(doc.id) ? 'border-brand-dark ring-4 ring-brand-light/20 bg-brand-light/5 dark:bg-brand-dark/10' : 'border-black/[0.06] dark:border-white/10'}`}
                                >
                                    <div
                                        className={`absolute top-3 left-3 z-20 w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${selectedIds.has(doc.id) ? 'bg-brand-dark border-brand-dark text-white scale-110' : 'bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-600 opacity-0 group-hover:opacity-100'}`}
                                        onClick={(e) => { e.stopPropagation(); toggleSelect(doc.id); }}
                                    >
                                        {selectedIds.has(doc.id) && <i className="ri-check-line font-bold"></i>}
                                    </div>
                                    <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="w-8 h-8 bg-brand-dark text-white rounded-full flex items-center justify-center shadow-lg">
                                            <i className="ri-drag-move-2-line"></i>
                                        </div>
                                    </div>
                                    <div onClick={() => openDocument(doc)} className="w-full aspect-square bg-slate-50 dark:bg-slate-900 rounded-2xl mb-4 overflow-hidden flex items-center justify-center relative bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:10px_10px] transition-colors">
                                        {isPDF(doc) ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-12 h-12 bg-white dark:bg-slate-800 shadow-sm border border-red-50 dark:border-red-900/20 text-red-400 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110">
                                                    <i className="ri-file-pdf-2-fill text-2xl"></i>
                                                </div>
                                                <span className="text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">{t('pdf_content_label')}</span>
                                            </div>
                                        ) : (
                                            <img
                                                src={`${documentUrl(doc.filename)}`}
                                                alt={doc.title}
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                            />
                                        )}
                                        {doc.is_shared && (
                                            <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-emerald-500 text-white rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm">
                                                {t('shared_label')}
                                            </div>
                                        )}
                                    </div>
                                    <div onClick={() => openDocument(doc)}>
                                        <h3 className="text-xs font-black text-slate-700 dark:text-slate-200 truncate mb-1 group-hover:text-brand-dark transition-colors">{doc.title}</h3>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: doc.category_color || '#cbd5e1' }}></div>
                                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{doc.category_name || t('general_category')}</p>
                                            </div>
                                        </div>
                                        {doc.tags && doc.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {doc.tags.map(tag => (
                                                    <span key={tag.id} className="px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest text-white shadow-sm" style={{ backgroundColor: tag.color }}>
                                                        {tag.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div
                                    key={doc.id}
                                    draggable="true"
                                    onDragStart={(e) => onDragStart(e, doc.id)}
                                    onDragEnd={onDragEnd}
                                    onClick={() => openDocument(doc)}
                                    className={`group flex items-center gap-4 bg-white dark:bg-slate-800 p-3 rounded-2xl border transition-all hover:shadow-lg cursor-pointer ${selectedIds.has(doc.id) ? 'border-brand-dark bg-brand-light/5 dark:bg-brand-dark/10' : 'border-black/[0.06] dark:border-white/10 hover:border-brand-dark/20'}`}
                                >
                                    <div 
                                        className={`w-6 h-6 rounded-lg border flex items-center justify-center flex-shrink-0 transition-all ${selectedIds.has(doc.id) ? 'bg-brand-dark border-brand-dark text-white' : 'border-slate-200 dark:border-slate-600 text-transparent hover:border-brand-dark/30'}`}
                                        onClick={(e) => { e.stopPropagation(); toggleSelect(doc.id); }}
                                    >
                                        <i className="ri-check-line font-bold"></i>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-900 flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-100 dark:border-white/10 transition-colors">
                                        {isPDF(doc) ? (
                                            <i className="ri-file-pdf-2-fill text-red-400 text-xl"></i>
                                        ) : (
                                            <img
                                                src={`${documentUrl(doc.filename)}`}
                                                alt={doc.title}
                                                className="w-full h-full object-cover"
                                            />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 truncate">{doc.title}</h3>
                                        <p className="text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-widest leading-none mt-0.5">
                                            {new Date(doc.created_at).toLocaleDateString(t('locale') === 'de' ? 'de-DE' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                        </p>
                                    </div>
                                    <div className="hidden md:flex flex-col items-end gap-1.5 px-4 min-w-[120px]">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: doc.category_color || '#cbd5e1' }}></div>
                                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">{doc.category_name || t('general_category')}</p>
                                        </div>
                                        {doc.tags && doc.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 justify-end max-w-[200px]">
                                                {doc.tags.map(tag => (
                                                    <span key={tag.id} className="px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest text-white shadow-sm" style={{ backgroundColor: tag.color }}>
                                                        {tag.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {doc.is_shared && (
                                            <span className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.2em]">{t('shared_label')}</span>
                                        )}
                                    </div>
                                    <div className="w-10 h-10 flex items-center justify-center text-slate-300 group-hover:text-brand-dark transition-colors">
                                        <i className="ri-drag-move-2-line text-xl"></i>
                                    </div>
                                </div>
                            )
                        ))
                    )}
                </div>

                {/* ─── Document Details Split-View ─────────────────────────────────── */}
                {isDocModalOpen && selectedDoc && (
                    <div className="fixed inset-0 z-[60] flex animate-in fade-in duration-300">
                        {/* Left: Large Preview Area */}
                        <div 
                            className="hidden md:flex flex-1 bg-slate-900/60 backdrop-blur-md items-center justify-center p-8 lg:p-12 cursor-pointer relative group"
                            onClick={() => setIsDocModalOpen(false)}
                        >
                            <div 
                                className="w-full h-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden relative"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {isPDF(selectedDoc) ? (
                                <iframe 
                                    src={`${documentUrl(selectedDoc.filename)}#toolbar=0`} 
                                    className="w-full h-full border-0"
                                    title={selectedDoc.title}
                                    onError={(e) => {
                                        console.error('Iframe error', e);
                                        setOcrStatus('❌ ' + t('error_loading_pdf'));
                                    }}
                                />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors">
                                        <img 
                                            src={`${documentUrl(selectedDoc.filename)}`} 
                                            alt={selectedDoc.title}
                                            className="max-w-full max-h-full object-contain"
                                        />
                                    </div>
                                )}
                                
                                <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md text-white px-3 py-1 rounded-lg text-xs font-bold pointer-events-none">
                                    {isPDF(selectedDoc) ? t('preview_mode') : t('fullscreen_preview')}
                                </div>
                            </div>

                            <div className="absolute top-8 right-8 text-white/50 group-hover:text-white transition-colors">
                                <i className="ri-close-circle-line text-4xl"></i>
                            </div>
                        </div>

                        {/* Right: Metadata Sidebar */}
                        <div className="bg-white dark:bg-slate-800 w-full max-w-lg h-[100dvh] shadow-2xl flex flex-col border-l border-slate-200 dark:border-white/10 animate-in slide-in-from-right duration-500 transition-colors">
                            <div className="p-6 border-b border-slate-100 dark:border-white/10 flex items-center justify-between shrink-0">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t('doc_details')}</h2>
                                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">{t('metadata_actions')}</p>
                                </div>
                                <button onClick={() => setIsDocModalOpen(false)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition">
                                    <i className="ri-close-line text-xl"></i>
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                                <div className="md:hidden relative group mb-6">
                                    <div className="w-full h-48 bg-slate-50 dark:bg-slate-900 border border-black/[0.06] dark:border-white/10 rounded-xl overflow-hidden flex items-center justify-center transition-colors">
                                        {isPDF(selectedDoc) ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-14 h-14 bg-white dark:bg-slate-800 shadow-sm border border-red-100 dark:border-red-900/20 text-red-500 rounded-xl flex items-center justify-center">
                                                    <i className="ri-file-pdf-2-line text-3xl"></i>
                                                </div>
                                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('pdf_content')}</p>
                                            </div>
                                        ) : (
                                            <img 
                                                src={`${documentUrl(selectedDoc.filename)}`} 
                                                alt={selectedDoc.title}
                                                className="w-full h-full object-contain cursor-zoom-in"
                                                onClick={() => window.open(`${documentUrl(selectedDoc.filename)}`, '_blank')}
                                            />
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">{t('doc_title_label')}</label>
                                    <input type="text"
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-black/[0.06] dark:border-white/10 rounded-xl outline-none focus:border-brand-light dark:focus:border-brand-dark font-bold text-slate-700 dark:text-slate-200 transition-all"
                                        value={selectedDoc.title}
                                        onChange={(e) => setSelectedDoc({ ...selectedDoc, title: e.target.value })}
                                        onBlur={(e) => handleUpdateDocument(selectedDoc.id, { title: e.target.value })}
                                    />
                                </div>

                                <div className="flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 border border-black/[0.06] dark:border-white/10 rounded-xl px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                                    <div>
                                        <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">{selectedDoc.is_shared ? t('shared_doc_label') : t('private_doc_label')}</p>
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">{selectedDoc.is_shared ? t('visible_to_all') : t('visible_to_you')}</p>
                                    </div>
                                    <button type="button" onClick={() => {
                                        const newVal = !selectedDoc.is_shared;
                                        setSelectedDoc({ ...selectedDoc, is_shared: newVal });
                                        handleUpdateDocument(selectedDoc.id, { is_shared: newVal ? 1 : 0 });
                                    }} className={`relative w-12 h-6 rounded-full transition-all duration-300 ${selectedDoc.is_shared ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-slate-100 rounded-full shadow transform transition-transform ${selectedDoc.is_shared ? 'translate-x-6' : ''}`}></span>
                                    </button>
                                </div>

                                <div>
                                    <select className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-black/[0.06] dark:border-white/10 rounded-xl outline-none focus:border-brand-light dark:focus:border-brand-dark font-bold text-slate-700 dark:text-slate-200 transition-colors"
                                        value={selectedDoc.category_id || ''}
                                        onChange={(e) => {
                                            const newVal = e.target.value ? parseInt(e.target.value) : null;
                                            setSelectedDoc({ ...selectedDoc, category_id: newVal });
                                            handleUpdateDocument(selectedDoc.id, { category_id: newVal });
                                        }}>
                                        <option value="">{t('no_category')}</option>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">{t('tags')}</label>
                                    <div className="flex flex-wrap gap-2">
                                        {tags.length === 0 && <p className="text-[10px] text-slate-300 dark:text-slate-600 font-bold italic">{t('no_tags_available')}</p>}
                                        {tags.map(tag => {
                                            const isSelected = selectedDoc.tags?.some(t => t.id === tag.id);
                                            return (
                                                <button
                                                    key={tag.id}
                                                    onClick={() => {
                                                        const newTags = isSelected 
                                                            ? selectedDoc.tags.filter(t => t.id !== tag.id) 
                                                            : [...(selectedDoc.tags || []), tag];
                                                        setSelectedDoc({ ...selectedDoc, tags: newTags });
                                                        handleUpdateDocument(selectedDoc.id, { tagIds: newTags.map(t => t.id) });
                                                    }}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isSelected ? 'shadow-md scale-105' : 'bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-white/10 opacity-60 hover:opacity-100 grayscale'}`}
                                                    style={isSelected ? { backgroundColor: tag.color, color: 'white' } : {}}
                                                >
                                                    <i className={isSelected ? 'ri-price-tag-3-fill' : 'ri-price-tag-3-line'}></i> {tag.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <a href={`${documentUrl(selectedDoc.filename)}`}
                                        target="_blank" rel="noopener noreferrer"
                                        className="py-3.5 bg-brand-dark text-white font-bold rounded-xl text-center hover:bg-slate-800 transition shadow-sm text-sm flex items-center justify-center gap-2">
                                        <i className="ri-external-link-line"></i> {t('open')}
                                    </a>
                                    <button onClick={() => handlePrint(selectedDoc)}
                                        className="py-3.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-center hover:bg-slate-200 dark:hover:bg-slate-600 transition text-sm flex items-center justify-center gap-2">
                                        <i className="ri-printer-line"></i> {t('print')}
                                    </button>
                                </div>

                                <div className="pt-2">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex flex-col">
                                            <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('ocr_recognized_text')}</label>
                                            {ocrStatus && (
                                                <span className="text-[10px] font-bold text-brand-dark animate-pulse">{ocrStatus}</span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleReextract(selectedDoc)}
                                            disabled={isReextracting}
                                            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-[10px] font-black transition uppercase tracking-widest ${isReextracting ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500' : 'bg-brand-light/10 dark:bg-brand-dark/20 text-brand-dark dark:text-brand-light hover:bg-brand-light/20'}`}>
                                            <i className={`${isReextracting ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'}`}></i>
                                            {isReextracting ? t('extracting') : t('re_read')}
                                        </button>
                                    </div>
                                    
                                    {isReextracting && ocrProgress > 0 && (
                                        <div className="w-full bg-slate-100 h-1.5 rounded-full mb-3 overflow-hidden">
                                            <div 
                                                className="bg-brand-dark h-full transition-all duration-300"
                                                style={{ width: `${ocrProgress}%` }}
                                            />
                                        </div>
                                    )}

                                    <div className="bg-slate-50 dark:bg-slate-900 border border-black/[0.06] dark:border-white/10 rounded-xl p-4 text-xs text-slate-600 dark:text-slate-400 font-mono h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed custom-scrollbar border-dashed relative transition-colors">
                                        {selectedDoc.content_text && selectedDoc.content_text !== '[Kein Text erkannt]'
                                            ? selectedDoc.content_text
                                            : ocrText || <span className="text-slate-300 dark:text-slate-700 italic font-sans uppercase tracking-[0.2em] text-[10px] flex items-center justify-center h-full text-center">{t('no_text_extracted')}</span>}
                                        
                                        {isReextracting && (
                                            <div className="absolute inset-0 bg-white/60 dark:bg-slate-800/60 backdrop-blur-[2px] flex items-center justify-center">
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-8 h-8 border-2 border-brand-dark border-t-transparent rounded-full animate-spin"></div>
                                                    <span className="text-[10px] font-black text-brand-dark dark:text-brand-light uppercase tracking-widest">{ocrStatus || t('processing')}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-4 flex flex-col gap-2">
                                    <button onClick={() => handleUpdateDocument(selectedDoc.id, { is_archived: !selectedDoc.is_archived })}
                                        className={`w-full py-3 font-bold rounded-xl transition text-sm flex items-center justify-center gap-2 ${selectedDoc.is_archived ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100'}`}>
                                        <i className="ri-archive-drawer-line"></i>
                                        {selectedDoc.is_archived ? t('deselect') : t('archive')}
                                    </button>
                                    <button onClick={() => setConfirmDelete({ type: 'doc', id: selectedDoc.id, title: selectedDoc.title })}
                                        className="w-full py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition text-sm flex items-center justify-center gap-2">
                                        <i className="ri-delete-bin-line"></i> {t('delete')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Upload Modal */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-[1.25rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-white/10 transition-colors">
                        <div className="p-6 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
                            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">{t('upload_doc')}</h2>
                            <button onClick={() => { setIsUploadModalOpen(false); resetUpload(); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                <i className="ri-close-line text-2xl"></i>
                            </button>
                        </div>
                        <form onSubmit={handleUpload} className="p-6 space-y-5">
                            <div className="border border-dashed border-brand-light/30 dark:border-brand-dark/30 bg-brand-light/5 dark:bg-brand-dark/5 rounded-xl p-6 text-center cursor-pointer hover:bg-brand-light/10 dark:hover:bg-brand-dark/10 transition-all relative group"
                                onClick={() => fileInputRef.current?.click()}>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf"
                                    multiple onChange={handleFileChange} />
                                
                                <div className="w-14 h-14 bg-white dark:bg-slate-900 shadow-sm border border-brand-light/20 dark:border-brand-dark/20 text-brand-dark dark:text-brand-light rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform duration-300">
                                    <i className="ri-upload-cloud-2-line text-2xl"></i>
                                </div>
                                <p className="font-black text-slate-800 dark:text-slate-100 mb-1">{t('select_files')}</p>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">{t('pdf_or_images')}</p>
                            </div>

                            {uploadFiles.length > 0 && (
                                <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{t('queue')} ({uploadFiles.length})</p>
                                    {uploadFiles.map((file, idx) => (
                                        <div key={idx} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-xl px-3 py-2.5 animate-in slide-in-from-left-2 duration-200 transition-colors" style={{ animationDelay: `${idx * 50}ms` }}>
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-8 h-8 rounded-lg bg-brand-light/10 dark:bg-brand-dark/20 text-brand-dark dark:text-brand-light flex items-center justify-center shrink-0">
                                                    <i className={file.type === 'application/pdf' ? 'ri-file-pdf-line' : 'ri-image-line'}></i>
                                                </div>
                                                <div className="truncate min-w-0">
                                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{file.name}</p>
                                                    <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                                </div>
                                            </div>
                                            <button type="button" onClick={(e) => { e.stopPropagation(); removeUploadFile(idx); }} 
                                                className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-white/10 text-slate-300 dark:text-slate-600 hover:text-red-500 hover:border-red-100 dark:hover:border-red-900/40 transition shadow-sm flex items-center justify-center">
                                                <i className="ri-delete-bin-line"></i>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {(ocrStatus || (isUploading && uploadProgress.total > 0)) && (
                                <div className="space-y-1.5 bg-brand-dark/[0.03] dark:bg-brand-dark/10 p-3 rounded-xl border border-brand-dark/5 dark:border-brand-dark/20 transition-colors">
                                    <div className="flex items-center justify-between text-[10px] font-black text-brand-dark dark:text-brand-light/60 uppercase tracking-widest">
                                        <span>{isUploading ? `${t('uploading')}: ${uploadProgress.current} ${t('of_label')} ${uploadProgress.total}` : ocrStatus}</span>
                                        {(isUploading || (ocrProgress > 0 && ocrProgress < 100)) && (
                                            <span>{isUploading ? Math.round((uploadProgress.current / uploadProgress.total) * 100) : ocrProgress}%</span>
                                        )}
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden shadow-inner transition-colors">
                                        <div className="h-full bg-brand-dark rounded-full transition-all duration-300" 
                                            style={{ width: `${isUploading ? (uploadProgress.current / uploadProgress.total) * 100 : ocrProgress}%` }}>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {uploadFiles.length === 1 && (
                                <input type="text" placeholder={t('upload_title_placeholder')}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-black/[0.06] dark:border-white/10 rounded-xl outline-none focus:border-brand-light dark:focus:border-brand-dark font-bold text-slate-700 dark:text-slate-200 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                    value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} />
                            )}

                            {uploadFiles.length > 0 && (
                                <>
                                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 border border-black/[0.06] dark:border-white/10 rounded-xl px-4 py-3.5 transition-colors">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">{t('visibility')}</span>
                                            <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">{uploadIsShared ? t('shared_label') : t('private')}</span>
                                        </div>
                                        <button type="button" onClick={() => setUploadIsShared(v => !v)}
                                            className={`relative w-11 h-5.5 rounded-full transition-all duration-300 ${uploadIsShared ? 'bg-brand-dark' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                            <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white dark:bg-slate-100 rounded-full shadow transform transition-transform ${uploadIsShared ? 'translate-x-5.5' : ''}`}></span>
                                        </button>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('target_folder')}</label>
                                        <select className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-black/[0.06] dark:border-white/10 rounded-xl outline-none focus:border-brand-light dark:focus:border-brand-dark font-bold text-slate-700 dark:text-slate-200 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                            value={uploadCategoryId} onChange={(e) => setUploadCategoryId(e.target.value)}>
                                            <option value="">{t('no_category')}</option>
                                            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                        </select>
                                    </div>

                                    {activeUploadSuggestions && (
                                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/40 rounded-xl p-4 animate-in slide-in-from-bottom-2 duration-300 transition-colors">
                                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
                                                <i className="ri-magic-line text-lg"></i>
                                                <span className="text-[10px] font-black uppercase tracking-widest">{t('suggestions_recognized')}</span>
                                            </div>
                                            <div className="space-y-3">
                                                {activeUploadSuggestions.category && (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">{t('folder')}:</span>
                                                        <button type="button" onClick={() => setUploadCategoryId(activeUploadSuggestions.category.id.toString())} className="px-3 py-1 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-50 dark:hover:bg-emerald-900/40 transition-colors">
                                                            {activeUploadSuggestions.category.name} <i className="ri-check-line"></i>
                                                        </button>
                                                    </div>
                                                )}
                                                {activeUploadSuggestions.tags?.length > 0 && (
                                                    <div className="flex flex-col gap-1.5">
                                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">{t('found_tags')}:</span>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {activeUploadSuggestions.tags.map(tag => (
                                                                <span key={tag.id} className="px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest text-white shadow-sm" style={{ backgroundColor: tag.color }}>
                                                                    {tag.name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            <button type="submit" disabled={uploadFiles.length === 0 || isUploading}
                                className={`w-full py-4 text-white font-black uppercase tracking-[0.2em] rounded-xl shadow-lg transition-all duration-300 flex items-center justify-center gap-2 text-xs ${uploadFiles.length === 0 || isUploading ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed' : 'bg-brand-dark hover:bg-slate-800 dark:hover:bg-slate-600 hover:shadow-xl active:scale-95'}`}>
                                {isUploading ? (
                                    <>
                                        <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>{t('uploading')}</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="ri-save-line text-base"></i>
                                        <span>{t('save_all')}</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Categories Modal */}
            {isCategoryModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-[1.25rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-white/10 transition-colors">
                        <div className="p-6 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
                            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">{t('folders_tags')}</h2>
                            <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                <i className="ri-close-line text-2xl"></i>
                            </button>
                        </div>
                        <div className="p-6 pt-2">
                            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl mb-6 transition-colors">
                                <button onClick={() => setIsCategoryModalOpen('folders')} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${isCategoryModalOpen !== 'tags' ? 'bg-white dark:bg-slate-800 text-brand-dark dark:text-brand-light shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}>{t('folders')}</button>
                                <button onClick={() => setIsCategoryModalOpen('tags')} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${isCategoryModalOpen === 'tags' ? 'bg-white dark:bg-slate-800 text-brand-dark dark:text-brand-light shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}>{t('tags')}</button>
                            </div>

                            {isCategoryModalOpen !== 'tags' ? (
                                <>
                                    <form onSubmit={handleCreateCategory} className="flex gap-2 mb-6">
                                        <input type="color" className="w-12 h-12 rounded-lg cursor-pointer border-0 p-0 shadow-sm bg-transparent"
                                            value={newCategoryColor} onChange={(e) => setNewCategoryColor(e.target.value)} />
                                        <input type="text" placeholder={t('new_folder_placeholder')} required
                                            className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-black/[0.06] dark:border-white/10 rounded-lg outline-none font-bold text-slate-700 dark:text-slate-200 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                            value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} />
                                        <button type="submit" className="w-12 h-12 bg-brand-dark hover:bg-slate-800 dark:hover:bg-slate-600 text-white rounded-lg flex items-center justify-center transition-all">
                                            <i className="ri-add-line text-xl"></i>
                                        </button>
                                    </form>
                                    <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                                        {categories.length === 0 && <p className="text-center text-slate-400 dark:text-slate-600 py-8 font-bold italic">{t('no_folders_created')}</p>}
                                        {categories.map(cat => (
                                            <div key={cat.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg shadow-sm transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }}></div>
                                                    <span className="font-bold text-slate-700 dark:text-slate-200">{cat.name}</span>
                                                </div>
                                                <button onClick={() => setConfirmDelete({ type: 'category', id: cat.id, title: cat.name })}
                                                    className="text-red-400 hover:text-red-500 p-2 transition-colors">
                                                    <i className="ri-delete-bin-line"></i>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <form onSubmit={handleCreateTag} className="flex gap-2 mb-6">
                                        <input type="color" className="w-12 h-12 rounded-lg cursor-pointer border-0 p-0 shadow-sm bg-transparent"
                                            value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} />
                                        <input type="text" placeholder={t('new_tag_placeholder')} required
                                            className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-black/[0.06] dark:border-white/10 rounded-lg outline-none font-bold text-slate-700 dark:text-slate-200 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                            value={newTagName} onChange={e => setNewTagName(e.target.value)} />
                                        <button type="submit" className="w-12 h-12 bg-brand-dark hover:bg-slate-800 dark:hover:bg-slate-600 text-white rounded-lg flex items-center justify-center transition-all">
                                            <i className="ri-add-line text-xl"></i>
                                        </button>
                                    </form>
                                    <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                                        {tags.length === 0 && <p className="text-center text-slate-400 dark:text-slate-600 py-8 font-bold italic">{t('no_tags_created')}</p>}
                                        {tags.map(tag => (
                                            <div key={tag.id} className="flex items-center justify-between p-2 pl-3 bg-white dark:bg-slate-800 border border-black/[0.06] dark:border-white/10 rounded-lg shadow-sm transition-colors">
                                                <div className="flex items-center gap-2">
                                                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-sm" style={{ backgroundColor: tag.color }}>
                                                        {tag.name}
                                                    </span>
                                                </div>
                                                <button onClick={() => setConfirmDelete({ type: 'tag', id: tag.id, title: tag.name })}
                                                    className="text-red-400 hover:text-red-500 p-2 transition-colors">
                                                    <i className="ri-delete-bin-line"></i>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Confirmation Modal */}
            {confirmDelete.type && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-[1.5rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-red-100 dark:border-red-900/40 transition-colors">
                        <div className="p-8 text-center">
                            <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
                                <i className="ri-delete-bin-7-line"></i>
                            </div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">{t('really_delete')}</h3>
                            <p className="text-slate-500 dark:text-slate-400 font-bold text-sm mb-8 leading-relaxed">
                                {t('delete_confirm_text', { title: confirmDelete.title })}
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setConfirmDelete({ type: null, id: null, title: '' })}
                                    className="py-4 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-black rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition uppercase tracking-widest text-xs"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    onClick={() => {
                                        if (confirmDelete.type === 'doc') handleDeleteDocument(confirmDelete.id);
                                        else if (confirmDelete.type === 'category') handleDeleteCategory(confirmDelete.id);
                                        else if (confirmDelete.type === 'tag') handleDeleteTag(confirmDelete.id);
                                    }}
                                    className="py-4 bg-red-500 text-white font-black rounded-xl hover:bg-red-600 transition shadow-lg dark:shadow-none uppercase tracking-widest text-xs"
                                >
                                    {t('delete')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Action Bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] md:bottom-8 left-1/2 -translate-x-1/2 z-[100] w-full max-w-2xl px-4 animate-in slide-in-from-bottom-8 duration-500">
                    <div className="bg-slate-900 border border-white/10 text-white rounded-[2rem] p-4 shadow-2xl flex items-center justify-between gap-4 backdrop-blur-xl bg-opacity-90 dark:bg-slate-950 transition-colors">
                        <div className="flex items-center gap-4 px-2">
                            <div className="w-10 h-10 bg-brand-light/20 text-brand-light rounded-full flex items-center justify-center font-black">
                                {selectedIds.size}
                            </div>
                            <div className="hidden sm:block">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{t('marked')}</p>
                                <p className="text-[10px] font-bold text-brand-light dark:text-brand-dark">{t('docs_ready')}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <button
                                    onClick={() => setIsBulkMoveOpen(!isBulkMoveOpen)}
                                    className="px-4 py-2.5 bg-slate-800 dark:bg-slate-900 hover:bg-slate-700 dark:hover:bg-slate-800 rounded-xl transition-all font-bold text-xs flex items-center gap-2 border border-white/5"
                                >
                                    <i className="ri-folder-shared-line"></i> {t('move')}
                                </button>
                                {isBulkMoveOpen && (
                                    <div className="absolute bottom-full right-0 mb-4 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-2 border border-slate-100 dark:border-white/10 animate-in slide-in-from-bottom-2 duration-200 transition-colors">
                                        <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-3 py-2 border-b border-slate-50 dark:border-white/10 mb-1">{t('choose_category')}</p>
                                        <button onClick={() => handleBulkMove(null)} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2 transition-colors">
                                            <i className="ri-folder-line text-slate-300 dark:text-slate-600"></i> {t('none_general')}
                                        </button>
                                        {categories.map(cat => (
                                            <button key={cat.id} onClick={() => handleBulkMove(cat.id)} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2 transition-colors">
                                                <i className="ri-folder-6-fill" style={{ color: cat.color }}></i> {cat.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => handleBulkArchive(!showArchived)}
                                className={`px-4 py-2.5 rounded-xl transition-all font-bold text-xs flex items-center gap-2 border border-white/5 ${showArchived ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-slate-800 dark:bg-slate-900 hover:bg-slate-700 dark:hover:bg-slate-800 text-white'}`}
                            >
                                <i className="ri-archive-2-line"></i> {showArchived ? t('deselect') : t('archive')}
                            </button>

                            <div className="relative">
                                <button
                                    onClick={() => setIsBulkTagOpen(!isBulkTagOpen)}
                                    className="px-4 py-2.5 bg-slate-800 dark:bg-slate-900 hover:bg-slate-700 dark:hover:bg-slate-800 rounded-xl transition-all font-bold text-xs flex items-center gap-2 border border-white/5 text-white"
                                >
                                    <i className="ri-price-tag-3-line"></i> {t('tags')}
                                </button>
                                {isBulkTagOpen && (
                                    <div className="absolute bottom-full right-0 mb-4 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-2 border border-slate-100 dark:border-white/10 animate-in slide-in-from-bottom-2 duration-200 transition-colors z-[110]">
                                        <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-3 py-2 border-b border-slate-50 dark:border-white/10 mb-1">{t('choose_tag')}</p>
                                        {tags.map(tag => (
                                            <button key={tag.id} onClick={() => handleBulkTag(tag.id)} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2 transition-colors">
                                                <i className="ri-price-tag-3-fill" style={{ color: tag.color }}></i> {tag.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleBulkDelete}
                                className="px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all font-bold text-xs flex items-center gap-2 shadow-lg dark:shadow-none"
                            >
                                <i className="ri-delete-bin-line"></i> {t('delete')}
                            </button>

                            <div className="w-[1px] h-8 bg-white/10 dark:bg-white/5 mx-2"></div>

                            <button
                                onClick={() => setSelectedIds(new Set())}
                                className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center transition-colors"
                                title={t('deselect_all') || 'Auswahl aufheben'}
                            >
                                <i className="ri-close-line text-xl"></i>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Documents;
