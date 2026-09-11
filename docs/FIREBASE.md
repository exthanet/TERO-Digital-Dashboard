# Firebase data setup

`lib/firebase.ts` targets project `entertainment-dashboard-733e5`. Firestore uses one document per dashboard row in `masterData`; the dashboard falls back to the existing JSON while migration is incomplete.

Keep the service-account key outside Git. Install `firebase-admin`, set `FIREBASE_SERVICE_ACCOUNT_JSON` to its path, and run `npm run migrate:firebase`.

## Firebase Hosting Deployment

1. Run `npm run deploy:firebase` to build the static dashboard into `dist/firebase` and deploy to Firebase Hosting.
2. The deployed site URL is `https://entertainment-dashboard-733e5.web.app` (or `https://entertainment-dashboard-733e5.firebaseapp.com`).
3. To deploy rules only: `firebase deploy --only firestore:rules`.
