/**
 * Firebase project configuration — Brandix Unit 3 (hr-brandxunit-3).
 *
 * The Firebase web API key is safe to ship in client code; access is enforced
 * by the security rules in `database.rules.json` / `storage.rules` and by the
 * Authorized Domains list in the Firebase console. Keep those locked down.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyBWCV5hf-Bm6X14o4O-_pNlKUYYVRVtFIM",
  authDomain: "hr-brandxunit-3.firebaseapp.com",
  databaseURL: "https://hr-brandxunit-3-default-rtdb.firebaseio.com",
  projectId: "hr-brandxunit-3",
  storageBucket: "hr-brandxunit-3.firebasestorage.app",
  messagingSenderId: "140480501128",
  appId: "1:140480501128:web:b98c36a45778342426163d",
  measurementId: "G-M5F5D4NLDY",
};

/** True when the config above has not been filled in yet. */
export const isConfigPlaceholder = firebaseConfig.apiKey === "YOUR_API_KEY";
