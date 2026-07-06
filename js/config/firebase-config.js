/**
 * Firebase project configuration.
 *
 * ⚠️ REPLACE the placeholder values below with your own Firebase web-app
 * config (Firebase console → Project settings → General → Your apps →
 * SDK setup and configuration → Config).
 *
 * The web API key is safe to ship to the browser — access control is
 * enforced by the security rules in `database.rules.json` / `storage.rules`.
 */
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID",
};

/** True when the config above has not been filled in yet. */
export const isConfigPlaceholder = firebaseConfig.apiKey === "YOUR_API_KEY";
