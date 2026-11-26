import api from './api';

const toKey = (b64) => {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, c => c.charCodeAt(0));
};

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const pushStatus = async () => {
    if (!pushSupported()) return false;
    const reg = await navigator.serviceWorker.ready;
    return !!(await reg.pushManager.getSubscription());
};

export const enablePush = async () => {
    if (!pushSupported()) throw new Error('Dieses Gerät unterstützt keine Push-Benachrichtigungen. Auf dem iPhone: App zum Home-Bildschirm hinzufügen.');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('Benachrichtigungen wurden nicht erlaubt.');
    const { data } = await api.get('/push/vapid-public-key');
    if (!data?.publicKey) throw new Error('Push ist auf dem Server nicht eingerichtet (VAPID-Schlüssel fehlen).');
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(data.publicKey) });
    await api.post('/push/subscribe', sub.toJSON());
};

export const disablePush = async () => {
    if (!pushSupported()) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const { endpoint } = sub;
    await sub.unsubscribe();
    await api.delete('/push/subscribe', { data: { endpoint } }).catch(() => {});
};
