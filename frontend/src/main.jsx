import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/inter';
import 'remixicon/fonts/remixicon.css';
import './index.css';
import App from './App';
import { AuthProvider } from './lib/auth';
import { FeedbackProvider } from './ui';

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <FeedbackProvider>
                <AuthProvider>
                    <App />
                </AuthProvider>
            </FeedbackProvider>
        </BrowserRouter>
    </React.StrictMode>,
);
