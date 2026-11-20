import { getApps, initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const getConfiguredFirebaseApp = () => {
  const missingConfig = Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingConfig.length) {
    throw new Error(`Missing Firebase web configuration: ${missingConfig.join(', ')}`);
  }

  const existingApp = getApps().find((app) => app.name === 'kevalon-web-push');
  return existingApp || initializeApp(firebaseConfig, 'kevalon-web-push');
};

export const getWebPushToken = async () => {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('Notification' in window)
  ) {
    throw new Error('This browser does not support web push notifications.');
  }

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    throw new Error('Missing Firebase web push VAPID key.');
  }

  if (!await isSupported()) {
    throw new Error('Firebase web push is not supported by this browser.');
  }

  const app = getConfiguredFirebaseApp();
  const serviceWorkerConfig = new URLSearchParams(
    Object.entries(firebaseConfig).filter(([, value]) => Boolean(value))
  );
  const serviceWorkerUrl = `/firebase-messaging-sw.js?${serviceWorkerConfig.toString()}`;
  const serviceWorkerRegistration = await navigator.serviceWorker.register(
    serviceWorkerUrl,
    { scope: '/' }
  );
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration,
  });

  if (!token) {
    throw new Error('Firebase did not return a web push token.');
  }

  return token;
};
