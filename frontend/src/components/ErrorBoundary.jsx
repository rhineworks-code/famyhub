import React from 'react';

/**
 * Catches render errors of a single page so that one broken module no longer
 * turns the whole app into a white screen.
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('Seitenfehler:', error, info?.componentStack);
    }

    render() {
        if (!this.state.error) return this.props.children;
        const chunkError = /Loading chunk|dynamically imported module|Failed to fetch/i.test(String(this.state.error?.message));
        return (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
                <i className="ri-error-warning-line text-5xl text-amber-500"></i>
                <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">
                    {chunkError ? 'Neue Version verfügbar' : 'Hier ist etwas schiefgelaufen'}
                </h2>
                <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
                    {chunkError ? 'Die App wurde aktualisiert. Bitte lade die Seite neu.' : String(this.state.error?.message || this.state.error)}
                </p>
                <button
                    onClick={() => window.location.reload()}
                    className="rounded-lg bg-brand-dark px-5 py-2 font-bold text-white"
                >
                    Neu laden
                </button>
            </div>
        );
    }
}

export default ErrorBoundary;
