/**
 * Firebase bootstrap.
 *
 * Initializes the Firebase app once and re-exports the SDK helpers the rest
 * of the codebase needs, so every other module imports Firebase from here
 * (single point to upgrade the SDK version).
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  updateProfile,
  updatePassword,
  sendPasswordResetEmail,
  sendEmailVerification,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  push,
  remove,
  onValue,
  off,
  query,
  orderByChild,
  limitToLast,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";
import {
  getStorage,
  ref as sRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";
import { firebaseConfig, isConfigPlaceholder } from "../config/firebase-config.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);
export { isConfigPlaceholder };

/**
 * A lazily-created SECOND Firebase app + auth, used only to create login
 * accounts for other people (guest / staff invites) from an admin session.
 * createUserWithEmailAndPassword() signs in the *calling* auth instance as the
 * new user — doing that on this separate instance leaves the admin's primary
 * session (`auth`) completely untouched.
 */
let _secondaryAuth = null;
export function secondaryAuth() {
  if (!_secondaryAuth) _secondaryAuth = getAuth(initializeApp(firebaseConfig, "account-creator"));
  return _secondaryAuth;
}

/** Firebase Analytics is optional — it fails on unsupported origins (e.g. file://). */
export let analytics = null;
try {
  const { getAnalytics, isSupported, logEvent } =
    await import("https://www.gstatic.com/firebasejs/12.4.0/firebase-analytics.js");
  if (!isConfigPlaceholder && (await isSupported())) {
    analytics = getAnalytics(app);
    analytics._logEvent = (name, params) => logEvent(analytics, name, params);
  }
} catch { /* analytics unavailable — non-fatal */ }

/** Log an analytics event if analytics is available. */
export function track(eventName, params = {}) {
  try { analytics?._logEvent?.(eventName, params); } catch { /* no-op */ }
}

// Re-export SDK helpers
export {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously,
  signOut, updateProfile, updatePassword, sendPasswordResetEmail, sendEmailVerification,
  ref, get, set, update, push, remove, onValue, off,
  query, orderByChild, limitToLast, serverTimestamp,
  sRef, uploadBytes, getDownloadURL, deleteObject,
};
