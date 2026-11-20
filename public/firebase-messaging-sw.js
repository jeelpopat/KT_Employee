importScripts('https://www.gstatic.com/firebasejs/13.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/13.4.0/firebase-messaging-compat.js');

const config = new URL(self.location.href).searchParams;
const firebaseConfig = {
  apiKey: config.get('apiKey'),
  authDomain: config.get('authDomain'),
  projectId: config.get('projectId'),
  messagingSenderId: config.get('messagingSenderId'),
  appId: config.get('appId'),
};

firebase.initializeApp(firebaseConfig, 'kevalon-web-push');

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Kevalon Hub';
  const notificationData = payload.data || {};

  return self.registration.showNotification(title, {
    body: payload.notification?.body || 'You have a new update.',
    icon: '/kevalon-logo.png',
    badge: '/favicon-32x32.png',
    data: notificationData,
    tag: notificationData.notificationId || undefined,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL('/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => client.url.startsWith(self.location.origin));
      if (existingClient) {
        return existingClient.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
