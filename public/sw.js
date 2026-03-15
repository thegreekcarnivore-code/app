// Service Worker for The Greek Carnivore PWA

const CACHE_NAME = 'tgc-v1';

// Install event
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Push notification event
self.addEventListener('push', (event) => {
  let data = { title: 'The Greek Carnivore', body: 'You have a new notification', link: '/home' };
  
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {
    console.error('Push data parse error:', e);
  }

  const options = {
    body: data.body,
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: data.tag || 'tgc-notification',
    renotify: true,
    data: { link: data.link || '/home' },
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const link = event.notification.data?.link || '/home';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing window if available
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.navigate(link);
          return client.focus();
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(link);
    })
  );
});
