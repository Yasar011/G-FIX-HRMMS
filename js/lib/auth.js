/**
 * Authentication + role-based access control.
 *
 * Roles (stored at users/{uid}/role in Realtime Database):
 *   hr_admin      — full access, manages users, settings, budgets
 *   hr_executive  — day-to-day HR ops: attendance, employees, leaves, reports
 *   dept_manager  — sees own department, approves its leaves
 *   management    — read-only analytics + reports across the plant
 *   pending       — just registered, no capabilities yet (see below)
 *
 * The FIRST account ever registered automatically becomes hr_admin; everyone
 * after that starts as `pending` — no dashboard access at all — until an
 * HR Admin reviews the request in Settings → Users & Roles and assigns a
 * real role. New accounts must also verify their email before the app will
 * even show them the "pending approval" screen.
 */
import {
  auth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, updateProfile,
  sendEmailVerification, secondaryAuth, track,
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

/** Current signed-in user: { uid, email, name, role, department, empId, emailVerified, photo }. */
export let currentUser = null;

let profileUnsub = null;

// Extra registration-form fields (name/department/empId), stashed by register()
// and consumed by initAuth's profile-creation fallback below — this keeps
// profile creation to a single code path with no race between the two.
let pendingRegistration = null;

/**
 * Start listening to Firebase auth state.
 * @param {Function} onUser  called with (profile|null, errorMessage?) whenever
 *                           auth state OR the user's DB profile changes.
 *                           errorMessage is only set when sign-in succeeded
 *                           but the user's profile couldn't be loaded/created
 *                           (e.g. database rules not published) — the caller
 *                           should show it rather than hang silently.
 */
export function initAuth(onUser) {
  onAuthStateChanged(auth, async (fbUser) => {
    profileUnsub?.();
    profileUnsub = null;

    if (!fbUser) { currentUser = null; onUser(null); return; }

    try {
      // Ensure a profile record exists — covers first login after register,
      // AND a Firebase Auth user created directly in the console (which has
      // no users/{uid} record at all until this runs).
      const path = `users/${fbUser.uid}`;
      let profile = await read(path);
      if (!profile) {
        const allUsers = await read("users");
        const isFirst = !allUsers || Object.keys(allUsers).length === 0;
        const extra = pendingRegistration || {};
        pendingRegistration = null;
        profile = {
          email: fbUser.email,
          name: extra.name || fbUser.displayName || fbUser.email.split("@")[0],
          role: isFirst ? "hr_admin" : "pending",
          department: extra.department || "",
          empId: extra.empId || "",
          createdAt: Date.now(),
        };
        await dbSet(path, profile);
      }

      // Keep currentUser live — role changes apply without re-login.
      profileUnsub = watch(path, async (p) => {
        if (!p) return;
        // Temporary guest accounts expire — deny access past their date.
        if (p.expiresAt && Date.now() > Number(p.expiresAt)) {
          currentUser = null;
          await signOut(auth).catch(() => {});
          onUser(null, "This guest access has expired. Ask an HR Admin for a new invite.");
          return;
        }
        currentUser = { uid: fbUser.uid, emailVerified: fbUser.emailVerified, ...p };
        onUser(currentUser);
      });
      track("login", { role: profile.role });
    } catch (e) {
      // Signed in with Firebase Auth, but the database rejected reading or
      // creating the profile record — most commonly stale/unpublished
      // database rules. Sign back out so the app isn't stuck half-logged-in,
      // and surface the real error instead of hanging on "Please wait…".
      console.error("Failed to load/create user profile after sign-in", e);
      currentUser = null;
      await signOut(auth).catch(() => {});
      onUser(null, `Signed in, but couldn't load your account — ${e?.message || "database permission error"}. Ask an admin to check the database rules are published.`);
    }
  });
}

/** Sign in with email/password. Throws a friendly Error on failure. */
export async function login(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) { throw new Error(friendlyAuthError(e)); }
}

/**
 * Register a new account and send a verification email. The profile record
 * (role/department/empId) is created by initAuth's fallback, which picks up
 * `name`/`department`/`empId` queued here — see `pendingRegistration` above.
 */
export async function register(email, password, { name = "", department = "", empId = "" } = {}) {
  try {
    pendingRegistration = { name, department, empId };
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name) await updateProfile(cred.user, { displayName: name }).catch(() => {});
    await sendEmailVerification(cred.user);
  } catch (e) {
    pendingRegistration = null;
    throw new Error(friendlyAuthError(e));
  }
}

/**
 * Admin-only: create a login for someone else (guest / staff invite) with a
 * role assigned up front — no email-verification or approval wait. Uses a
 * SECONDARY Firebase app so the admin's own session is never disturbed. The
 * admin's session then writes the profile with the chosen role (permitted by
 * the users/{uid} child rules for hr_admin).
 * @param {object} o {email, password, name, role, department, expiresAt?}
 * @returns {string} the new user's uid
 */
export async function createGuestAccount({ email, password, name = "", role = "management", department = "", expiresAt = null }) {
  let cred;
  try {
    cred = await createUserWithEmailAndPassword(secondaryAuth(), email, password);
    if (name) await updateProfile(cred.user, { displayName: name }).catch(() => {});
  } catch (e) { throw new Error(friendlyAuthError(e)); }

  const uid = cred.user.uid;
  const profile = {
    email, name: name || email.split("@")[0], role, department,
    empId: "", createdAt: Date.now(), adminCreated: true,
  };
  if (expiresAt) profile.expiresAt = Number(expiresAt);
  // Written from the admin's primary session (child-level rules allow hr_admin).
  await dbUpdate(`users/${uid}`, profile);
  await signOut(secondaryAuth()).catch(() => {});
  return uid;
}

/** Re-check whether the signed-in user has clicked their email verification link yet. */
export async function recheckVerification() {
  if (!auth.currentUser) return false;
  await auth.currentUser.reload();
  return auth.currentUser.emailVerified;
}

/** Resend the verification email to the signed-in (not-yet-verified) user. */
export async function resendVerification() {
  if (auth.currentUser) await sendEmailVerification(auth.currentUser);
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
