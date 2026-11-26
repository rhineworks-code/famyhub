import api from './api';

/**
 * The VAPID public key is fetched from the server at runtime. The old build
 * baked a demo key into the bundle as fallback – if the build argument was
 * missing, subscriptions were created with the wrong key and pushes never arrived.
 */
let cachedKey = null;
const getPublicKey = async () => {
    if (cachedKey) return cachedKey;
    const { data } = await api.get('/push/vapid-public-key');
    if (!data?.publicKey) throw new Error('Push ist auf dem Server nicht eingerichtet.');
    cachedKey = data.publicKey;
    return cachedKey;
};

const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    return Uint8Array.from(raw, c => c.charCodeAt(0));
};

export const isPushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export async function subscribeUser() {
    if (!isPushSupported()) return false;
    try {
        const registration = await navigator.serviceWorker.ready;
        const key = await getPublicKey();
        let subscription = await registration.pushManager.getSubscription();
        // An old subscription created with a different key has to be replaced.
        if (subscription) {
            const current = subscription.options?.applicationServerKey;
            const expected = urlBase64ToUint8Array(key);
            const same = current && new Uint8Array(current).every((b, i) => b === expected[i]);
            if (!same) { await subscription.unsubscribe(); subscription = null; }
        }
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
        }
        await api.post('/push/subscribe', subscription.toJSON());
        return true;
    } catch (error) {
        console.error('Push-Abo fehlgeschlagen', error);
        alert(error.response?.data?.error || error.message || 'Push konnte nicht aktiviert werden');
        return false;
    }
}

export async function unsubscribeUser() {
    if (!isPushSupported()) return false;
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) return true;
        const { endpoint } = subscription;
        await subscription.unsubscribe();
        await api.delete('/push/subscribe', { data: { endpoint } });
        return true;
    } catch (error) {
        console.error('Push-Abmeldung fehlgeschlagen', error);
        return false;
    }
}
