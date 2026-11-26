// FamyHub service worker – push notifications only (no offline caching, so updates are visible immediately).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', function(event) {
    if (event.data) {
        try {
            const data = event.data.json();
            const options = {
                body: data.body,
                icon: data.icon || '/icon-192x192.png',
                badge: data.badge || '/icon-192x192.png',
                vibrate: [100, 50, 100],
                data: data.data || {}
            };
            event.waitUntil(
                self.registration.showNotification(data.title || 'FamyHub', options)
            );
        } catch(e) {
            console.error('Push notification data is not JSON', e);
        }
    }
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    
    // This looks to see if the current is already open and focuses if it is
    event.waitUntil(clients.matchAll({
        type: "window"
    }).then(function(clientList) {
        const urlToOpen = new URL(event.notification.data?.url || '/', self.location.origin).href;
        
        for (var i = 0; i < clientList.length; i++) {
            var client = clientList[i];
            if (client.url === urlToOpen && 'focus' in client)
                return client.focus();
        }
        if (clients.openWindow)
            return clients.openWindow(urlToOpen);
    }));
});
