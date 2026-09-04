/*
 * CNG-Connect service worker — push & notification interaction handlers.
 *
 * Precaching, app-shell routing and runtime caching are handled by the Workbox
 * runtime that importScripts() this file (see vite.config.ts -> workbox.importScripts).
 * Keep this file limited to notification behaviour so the two never diverge.
 */

// Show a notification when a real Web Push message arrives (requires a push
// subscription + backend; harmless no-op until that exists).
self.addEventListener('push', (event) => {
  let payload;
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_e) {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'CNG-Connect';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: payload.tag || 'cng-connect',
    renotify: true,
    data: { url: payload.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Focus (or open) the app and route to the station deep link when a
// notification is tapped — covers both push and page-dispatched notifications.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of clientList) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) {
            try {
              await client.navigate(targetUrl);
            } catch (_e) {
              /* navigation not permitted for this client — ignore */
            }
          }
          return;
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});
