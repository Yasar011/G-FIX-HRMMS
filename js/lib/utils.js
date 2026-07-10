/**
 * Generic utilities: dates, numbers, DOM helpers, misc.
 * No Firebase or UI dependencies — safe to import anywhere.
 */

/* ---------------- Date helpers ---------------- */

/** Format a Date (or parseable value) as "YYYY-MM-DD". */
export function ymd(d = new Date()) {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

/** Format a Date as "YYYY-MM" (month key used across the database). */
export function ym(d = new Date()) { return ymd(d).slice(0, 7); }

/** Today's date key. */
export function today() { return ymd(new Date()); }

/** Parse "YYYY-MM-DD" into a local Date at midnight. */
export function parseYmd(s) {
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** True when a "YYYY-MM-DD" key falls on a Sunday. */
export function isSunday(dateKey) { return parseYmd(dateKey).getDay() === 0; }

/** Add `n` days to a "YYYY-MM-DD" key and return the new key. */
export function addDays(dateKey, n) {
  const d = parseYmd(dateKey);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

/** Inclusive list of date keys between two "YYYY-MM-DD" keys. */
export function dateRange(from, to) {
  const out = [];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard++ < 1000) { out.push(cur); cur = addDays(cur, 1); }
  return out;
}

/** List of the last `n` month keys ("YYYY-MM"), oldest first, ending this month. */
export function lastMonths(n) {
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(ym(x));
  }
  return out;
}

/** Human-friendly date ("06 Jul 2026"). */
export function fmtDate(dateKey) {
  if (!dateKey) return "—";
  const d = parseYmd(dateKey);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Human-friendly month ("Jul 2026") from "YYYY-MM". */
export function fmtMonth(monthKey) {
  if (!monthKey) return "—";
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

/** Relative time ("3h ago") from a millisecond timestamp. */
export function timeAgo(ts) {
  if (!ts) return "";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Full years between a "YYYY-MM-DD" date and now (age / tenure). */
export function yearsSince(dateKey) {
  if (!dateKey) return 0;
  const d = parseYmd(dateKey);
  return Math.max(0, (Date.now() - d.getTime()) / (365.25 * 86400e3));
}

/** Days until the next occurrence of a "YYYY-MM-DD" anniversary (0 = today). */
export function daysToAnniversary(dateKey) {
  if (!dateKey) return Infinity;
  const now = new Date();
  const d = parseYmd(dateKey);
  let next = new Date(now.getFullYear(), d.getMonth(), d.getDate());
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (next < startToday) next = new Date(now.getFullYear() + 1, d.getMonth(), d.getDate());
  return Math.round((next - startToday) / 86400e3);
}

/* ---------------- Number helpers ---------------- */

/** Format a number with thousands separators; decimals optional. */
export function fmtNum(n, dp = 0) {
  if (n == null || isNaN(n)) return "—";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

/** Percentage string with one decimal ("93.4%"). */
export function fmtPct(n, dp = 1) {
  if (n == null || isNaN(n)) return "—";
  return `${Number(n).toFixed(dp)}%`;
}

/** Currency (LKR by default, configurable via settings later). */
export function fmtMoney(n, currency = "LKR") {
  if (n == null || isNaN(n)) return "—";
  return `${currency} ${fmtNum(n, 0)}`;
}

/** Clamp a number between min and max. */
export function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

/** Sum an array (optionally by selector). */
export function sum(arr, sel = (x) => x) { return arr.reduce((a, b) => a + (Number(sel(b)) || 0), 0); }

/** Average of an array (0 when empty). */
export function avg(arr, sel = (x) => x) { return arr.length ? sum(arr, sel) / arr.length : 0; }

/* ---------------- Time-string helpers ---------------- */

/** "HH:MM" → minutes since midnight (NaN-safe: returns null when unparseable). */
export function hmToMin(s) {
  if (s == null || s === "") return null;
  if (typeof s === "number") return Math.round(s * 24 * 60) % (24 * 60); // Excel fraction of day
  const m = String(s).trim().match(/^(\d{1,2})[:.](\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Minutes → "Xh Ym" display. */
export function minToHm(min) {
  if (min == null || isNaN(min)) return "—";
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/* ---------------- DOM helpers ---------------- */

/** Create an element with attrs + children. `el("div", {class:"x"}, child…)` */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

/** Escape a string for safe innerHTML interpolation. */
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Debounce a function. */
export function debounce(fn, ms = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/** Animate a numeric counter inside `node` from 0 → value. */
export function animateCount(node, value, { dp = 0, suffix = "", duration = 800 } = {}) {
  const target = Number(value) || 0;
  const start = performance.now();
  function frame(now) {
    const p = clamp((now - start) / duration, 0, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    node.textContent = fmtNum(target * eased, dp) + suffix;
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ---------------- Misc ---------------- */

/** Group array items into a Map keyed by selector. */
export function groupBy(arr, sel) {
  const map = new Map();
  for (const item of arr) {
    const k = sel(item) ?? "—";
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

/** Unique sorted values of a selector across an array. */
export function uniq(arr, sel = (x) => x) {
  return [...new Set(arr.map(sel).filter((v) => v != null && v !== ""))].sort();
}

/**
 * Make free text safe to use as a Realtime Database key. Firebase forbids
 * ".", "#", "$", "/", "[", "]" in keys — real-world department/designation
 * names ("Sr. Manager", "QC/QA Officer") routinely contain them.
 */
export function sanitizeKey(s) {
  const clean = String(s ?? "").trim().replace(/[.#$/[\]]/g, "-");
  return clean || "—";
}

/** Object → array of {key, ...value} entries (Firebase node → list). */
export function toList(obj, keyName = "_key") {
  if (!obj) return [];
  return Object.entries(obj).map(([k, v]) => ({ [keyName]: k, ...(typeof v === "object" && v ? v : { value: v }) }));
}

/**
 * Flatten a two-level Firebase node — {outerKey: {innerKey: value}} — into a
 * flat array of rows. Used for data keyed by owner (e.g. leaves/{empId}/{key},
 * hrRequests/{empId}/{key}) so a public/anonymous session can be scoped to
 * read only its own outerKey subtree via security rules, while admin pages
 * still get a flat list to render as a table.
 */
export function flattenNested(obj, outerKeyName, keyName = "_key") {
  const rows = [];
  for (const [outerKey, inner] of Object.entries(obj || {})) {
    for (const [key, v] of Object.entries(inner || {})) rows.push({ [outerKeyName]: outerKey, [keyName]: key, ...v });
  }
  return rows;
}

/** Initials from a name ("Kasun Perera" → "KP"). */
export function initials(name) {
  return String(name || "?").split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";
}

/** Slug-safe ID from free text. */
export function slug(s) {
  return String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Random pastel-ish color derived from a string (stable per input). */
export function colorFor(s) {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h}, 62%, 58%)`;
}

/** Download raw content as a file. */
export function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
