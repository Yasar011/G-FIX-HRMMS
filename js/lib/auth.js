/**
 * Authentication + role-based access control.
 *
 * Roles (stored at users/{uid}/role in Realtime Database):
 *   hr_admin      — full access, manages users, settings, budgets
 *   hr_executive  — day-to-day HR ops: attendance, employees, leaves, reports
 *   dept_manager  — sees own department, approves its leaves
 *   management    — read-only analytics + reports across the plant
 *
 * The FIRST account ever registered automatically becomes hr_admin; everyone
 * after that starts as `management` (read-only) until an admin promotes them
 * from Settings → User Management.
 */
import {
  auth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, track,
} from "./firebase.js";
import { read, dbSet, dbUpdate, watch } from "./store.js";

export const ROLES = {
  hr_admin: "HR Admin",
  hr_executive: "HR Executive",
  dept_manager: "Department Manager",
  management: "Management",
};

/**
 * Capability matrix. `can(action)` checks the current user against this.
 * Keep additions here — never hard-code role names inside pages.
 */
const CAPABILITIES = {
  view_dashboard: ["hr_admin", "hr_executive", "dept_manager", "management"],
  upload_attendance: ["hr_admin", "hr_executive"],
  manage_employees: ["hr_admin", "hr_executive"],
  manage_budget: ["hr_admin"],
  manage_recruitment: ["hr_admin", "hr_executive"],
  approve_leaves: ["hr_admin", "hr_executive", "dept_manager"],
  manage_attrition: ["hr_admin", "hr_executive"],
  view_reports: ["hr_admin", "hr_executive", "dept_manager", "management"],
  send_email: ["hr_admin", "hr_executive"],
  manage_settings: ["hr_admin"],
  manage_users: ["hr_admin"],
  seed_data: ["hr_admin"],
  manage_hr_requests: ["hr_admin", "hr_executive"],
};

/**
 * Legacy / alternate role names mapped to canonical roles, so accounts created
 * under the old scheme (superadmin/editor/viewer) keep working.
 */
const LEGACY_ROLES = {
  superadmin: "hr_admin", super_admin: "hr_admin", admin: "hr_admin",
  editor: "hr_executive", executive: "hr_executive",
  viewer: "management", user: "management",
  manager: "dept_manager",
};

/** Resolve any stored role string to one of the four canonical roles. */
export function canonicalRole(role) { return LEGACY_ROLES[role] || role; }

/** Human label for any role (canonical or legacy). */
export function roleLabel(role) { return ROLES[canonicalRole(role)] || role || "—"; }

/** Current signed-in user: { uid, email, name, role, department, photo }. */
export let currentUser = null;

let profileUnsub = null;

/**
 * Start listening to Firebase auth state.
 * @param {Function} onUser  called with the merged profile (or null) whenever
 *                           auth state OR the user's DB profile changes.
 */
export function initAuth(onUser) {
  onAuthStateChanged(auth, async (fbUser) => {
    profileUnsub?.();
    profileUnsub = null;

    if (!fbUser) { currentUser = null; onUser(null); return; }

    // Ensure a profile record exists (first login after register).
    const path = `users/${fbUser.uid}`;
    let profile = await read(path);
    if (!profile) {
      const allUsers = await read("users");
      const isFirst = !allUsers || Object.keys(allUsers).length === 0;
      profile = {
        email: fbUser.email,
        name: fbUser.displayName || fbUser.email.split("@")[0],
        role: isFirst ? "hr_admin" : "management",
        department: "",
        createdAt: Date.now(),
      };
      await dbSet(path, profile);
    }

    // Keep currentUser live — role changes apply without re-login.
    profileUnsub = watch(path, (p) => {
      if (!p) return;
      currentUser = { uid: fbUser.uid, ...p };
      onUser(currentUser);
    });
    track("login", { role: profile.role });
  });
}

/** Sign in with email/password. Throws a friendly Error on failure. */
export async function login(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) { throw new Error(friendlyAuthError(e)); }
}

/** Register a new account (role assigned by initAuth on first login). */
export async function register(email, password) {
  try {
    await createUserWithEmailAndPassword(auth, email, password);
  } catch (e) { throw new Error(friendlyAuthError(e)); }
}

/** Sign the current user out. */
export function logout() { return signOut(auth); }

/** Whether the current user can perform `action` (see CAPABILITIES). */
export function can(action) {
  if (!currentUser) return false;
  return (CAPABILITIES[action] || []).includes(canonicalRole(currentUser.role));
}

/** True when the user is scoped to a single department (dept managers). */
export function deptScope() {
  return canonicalRole(currentUser?.role) === "dept_manager" && currentUser.department
    ? currentUser.department : null;
}

/** Update fields on any user's profile (admin) or own profile. */
export function updateUserProfile(uid, fields) { return dbUpdate(`users/${uid}`, fields); }

/** Translate Firebase auth error codes into readable messages. */
function friendlyAuthError(e) {
  const code = e?.code || "";
  const map = {
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/user-not-found": "No account exists for that email.",
    "auth/wrong-password": "Incorrect email or password.",
    "auth/invalid-email": "That email address is not valid.",
    "auth/email-already-in-use": "An account already exists for that email — sign in instead.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/too-many-requests": "Too many attempts — try again in a few minutes.",
    "auth/network-request-failed": "Network error — check your connection.",
    "auth/configuration-not-found": "Firebase Authentication is not enabled for this project (enable Email/Password sign-in in the Firebase console).",
    "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "Firebase config is missing — fill in js/config/firebase-config.js.",
  };
  return map[code] || e?.message || "Sign-in failed.";
}
