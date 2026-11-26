import React from 'react';
import { Spinner } from '../ui';

/**
 * Renders a PDF with PDF.js onto canvases. Browsers on phones (Android Chrome,
 * iOS Safari) cannot show PDFs inside an <iframe>, which is why documents
 * appeared blank there.
 */
let pdfjsPromise = null;
const loadPdfjs = () => {
    if (!pdfjsPromise) {
        pdfjsPromise = Promise.all([
            import('pdfjs-dist/legacy/build/pdf.min.mjs'),
            import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
        ]).then(([lib, worker]) => {
            lib.GlobalWorkerOptions.workerSrc = worker.default;
            return lib;
        });
    }
    return pdfjsPromise;
};

const MAX_PAGES = 50;

export default function PdfView({ url, className = '' }) {
    const ref = React.useRef(null);
    const [state, setState] = React.useState({ loading: true, error: null, pages: 0 });

    React.useEffect(() => {
        let cancelled = false;
        let doc = null;
        const container = ref.current;
        container.innerHTML = '';
        setState({ loading: true, error: null, pages: 0 });
        (async () => {
            try {
                const pdfjs = await loadPdfjs();
                doc = await pdfjs.getDocument({ url, withCredentials: true }).promise;
                if (cancelled) return;
                setState({ loading: false, error: null, pages: doc.numPages });
                const width = container.clientWidth || 600;
                const dpr = Math.min(window.devicePixelRatio || 1, 2);
                for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n += 1) {
                    if (cancelled) return;
                    const page = await doc.getPage(n);
                    const base = page.getViewport({ scale: 1 });
                    const viewport = page.getViewport({ scale: (width / base.width) * dpr });
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.floor(viewport.width);
                    canvas.height = Math.floor(viewport.height);
                    canvas.style.width = '100%';
                    canvas.className = 'mb-2 block rounded-md bg-white shadow-soft last:mb-0';
                    container.appendChild(canvas);
                    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
                }
            } catch (err) {
                if (!cancelled) setState({ loading: false, error: err?.status === 404 || /404/.test(err?.message) ? 'Die Datei wurde nicht gefunden.' : 'Die PDF-Datei konnte nicht angezeigt werden.', pages: 0 });
            }
        })();
        return () => { cancelled = true; doc?.destroy().catch(() => {}); };
    }, [url]);

    return (
        <div className={className}>
            {state.loading && <div className="flex h-48 items-center justify-center text-label3"><Spinner /></div>}
            {state.error && <div className="flex h-48 flex-col items-center justify-center gap-2 px-6 text-center text-sub text-label2"><i className="ri-file-warning-line text-4xl text-label3"></i>{state.error}</div>}
            <div ref={ref} />
            {state.pages > MAX_PAGES && <p className="py-2 text-center text-footnote text-label2">Es werden die ersten {MAX_PAGES} von {state.pages} Seiten angezeigt.</p>}
        </div>
    );
}
