/**
 * Realtime data layer.
 *
 * Wraps Firebase Realtime Database `onValue` listeners with:
 *  - a per-path cache (`getCached`) so pages render instantly on revisit,
 *  - refcounted subscriptions (many widgets can watch the same path),
 *  - page-scoped cleanup: `pageWatch` subscriptions are auto-disposed when
 *    the router unloads the page, preventing listener leaks.
 */
import { db, ref, onValue, get, set, update, push, remove } from "./firebase.js";

const cache = new Map();      // path -> last value
const watchers = new Map();   // path -> { unsub, count, callbacks:Set }
let pageSubs = [];            // unsubscribe fns owned by the current page

/**
 * Watch a database path. Callback fires immediately with cached data (if any)
 * and then on every change. Returns an unsubscribe function.
 */
export function watch(path, cb) {
  let entry = watchers.get(path);
  if (!entry) {
    entry = { count: 0, callbacks: new Set(), unsub: null };
    entry.unsub = onValue(ref(db, path), (snap) => {
      const val = snap.val();
      cache.set(path, val);
      entry.callbacks.forEach((fn) => { try { fn(val); } catch (e) { console.error(`watch(${path})`, e); } });
    }, (err) => console.error(`watch(${path})`, err));
    watchers.set(path, entry);
  }
  entry.count++;
  entry.callbacks.add(cb);
  if (cache.has(path)) { try { cb(cache.get(path)); } catch (e) { console.error(e); } }

  return () => {
    entry.callbacks.delete(cb);
    entry.count--;
    if (entry.count <= 0) { entry.unsub(); watchers.delete(path); }
  };
}

/**
 * Watch a path for the lifetime of the current page. The router calls
 * `disposePage()` on navigation, which tears these down automatically.
 */
export function pageWatch(path, cb) {
  const unsub = watch(path, cb);
  pageSubs.push(unsub);
  return unsub;
}

/** Register an arbitrary cleanup function tied to the current page. */
export function onPageDispose(fn) { pageSubs.push(fn); }

/** Tear down all page-scoped subscriptions (called by the router). */
export function disposePage() {
  pageSubs.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
  pageSubs = [];
}

/** Last cached value for a path (undefined if never loaded). */
export function getCached(path) { return cache.get(path); }

/** One-shot read. */
export async function read(path) {
  const snap = await get(ref(db, path));
  const val = snap.val();
  cache.set(path, val);
  return val;
}

/** Write helpers (thin wrappers so pages never import firebase directly). */
export function dbSet(path, value) { return set(ref(db, path), value); }
export function dbUpdate(path, value) { return update(ref(db, path), value); }
export function dbRemove(path) { return remove(ref(db, path)); }
export function dbPush(path, value) { return push(ref(db, path), value); }

/**
 * Fan-in helper: watch several paths and call `render` with a map of the
 * latest values once ALL paths have reported at least once.
 * Page-scoped (auto-disposed on navigation).
 */
export function pageWatchAll(paths, render) {
  const values = {};
  const seen = new Set();
  for (const p of paths) {
    pageWatch(p, (val) => {
      values[p] = val;
      seen.add(p);
      if (seen.size === paths.length) render(values);
    });
  }
}
