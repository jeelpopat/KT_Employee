# Browser push notifications

The web app uses Firebase Cloud Messaging (FCM) and a service worker to display
notifications while the page is in the background or closed. The backend must use
the same Firebase project and have its existing Firebase Admin credentials set.

1. In Firebase Console, add a Web App to the backend's Firebase project.
2. Enable Cloud Messaging and create a Web Push certificate key pair.
3. Copy `.env.example` to `.env` and set the Firebase Web App values plus the
   **public** VAPID key as `VITE_FIREBASE_VAPID_KEY`.
4. Rebuild and deploy the frontend over HTTPS. The user must click **Enable
   Desktop Notifications** once and allow the browser permission.

The Firebase Web App config and VAPID public key are public client values. Never
put Firebase Admin private keys in the frontend. The browser or operating system
can still suppress notifications if its lock-screen notification settings do
not allow them. On iOS, users must install the site to the Home Screen and use a
supported iOS version for Web Push.
