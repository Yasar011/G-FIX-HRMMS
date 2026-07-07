/**
 * UI primitives shared across all pages: toasts, modals, confirm dialogs,
 * skeleton loaders, theme handling, badges.
 */
import { el, esc } from "./utils.js";

/* ---------------- Toasts ---------------- */

/**
 * Show a toast notification.
 * @param {string} msg  Message text.
 * @param {"ok"|"err"|"warn"|"info"} type  Visual style.
 */
export function toast(msg, type = "info", ms = 3600) {
  const root = document.getElementById("toast-root");
  const icons = { ok: "✅", err: "⛔", warn: "⚠️", info: "ℹ️" };
  const node = el("div", { class: `toast ${type}` }, `${icons[type] || ""} ${msg}`);
  root.append(node);
  setTimeout(() => { node.classList.add("out"); setTimeout(() => node.remove(), 260); }, ms);
  return node;
}

/**
 * Turn a raw error (often a Firebase RTDB rejection) into a message that
 * tells the user what to actually do next, instead of a raw SDK string.
 */
export function friendlyDbError(e) {
  const msg = String(e?.message || e || "");
  if (e?.code === "PERMISSION_DENIED" || /permission_denied|permission denied/i.test(msg)) {
    const path = msg.match(/at\s+(\/\S+)/)?.[1] || "";
    return `Permission denied${path ? ` writing to ${path}` : ""} — your account's role doesn't have write access here, `
      + `or the database rules haven't been published yet. Check Settings → Users & roles, and make sure `
      + `database.rules.json has been published in the Firebase console.`;
  }
  return msg || "Something went wrong.";
}

/* ---------------- Modals ---------------- */

/**
 * Open a modal dialog.
 * @param {object} opts {title, body: Node|string, actions: [{label, class, onClick}], width}
 * @returns {{close: Function, el: HTMLElement}}
 */
export function modal({ title, body, actions = [], width, onClose } = {}) {
  const root = document.getElementById("modal-root");
  const backdrop = el("div", { class: "modal-backdrop" });
  const box = el("div", { class: "modal", style: width ? { "--modal-w": width } : null });
  const close = () => { backdrop.remove(); document.removeEventListener("keydown", onKey); onClose?.(); };
  const onKey = (e) => { if (e.key === "Escape") close(); };

  box.append(
    el("div", { class: "modal-head" },
      el("h3", {}, title || ""),
      el("button", { class: "icon-btn", onclick: close, title: "Close (Esc)" }, "✕")),
    el("div", { class: "modal-body" }, body || ""),
  );
  if (actions.length) {
    box.append(el("div", { class: "modal-foot" },
      ...actions.map((a) => el("button", {
        class: `btn ${a.class || ""}`,
        onclick: async (e) => {
          let keep;
          try {
            keep = await a.onClick?.(e, close);
          } catch (err) {
            console.error(err);
            toast(friendlyDbError(err), "err", 8000);
            return; // keep the modal open so the user doesn't lose their input
          }
          if (keep !== true) close();
        },
      }, a.label))));
  }
  backdrop.append(box);
  backdrop.addEventListener("mousedown", (e) => { if (e.target === backdrop) close(); });
  document.addEventListener("keydown", onKey);
  root.append(backdrop);
  return { close, el: box };
}

/** Confirmation dialog. Resolves true when the user confirms. */
export function confirmDialog(message, { title = "Are you sure?", danger = true } = {}) {
  return new Promise((resolve) => {
    modal({
      title,
      body: el("p", {}, message),
      onClose: () => resolve(false),
      actions: [
        { label: "Cancel", class: "btn-ghost", onClick: () => resolve(false) },
        { label: "Confirm", class: danger ? "btn-danger" : "btn-primary", onClick: () => resolve(true) },
      ],
    });
  });
}

/* ---------------- Skeletons ---------------- */

/** Grid of skeleton placeholders while data loads. */
export function skeletonGrid(count = 8, height = 90) {
  const g = el("div", { class: "grid grid-kpi" });
  for (let i = 0; i < count; i++) g.append(el("div", { class: "skeleton", style: { height: `${height}px` } }));
  return g;
}

/* ---------------- Theme ---------------- */

const THEME_KEY = "b3hr-theme";

/** Apply saved (or default dark) theme; wire the toggle button. */
export function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "dark";
  setTheme(saved);
  document.getElementById("theme-toggle")?.addEventListener("click", () =>
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
}

/** Set theme and notify charts to recolor. */
export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  const btn = document.getElementById("theme-toggle");
  if (btn) btn.textContent = theme === "dark" ? "🌙" : "☀️";
  window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
}

/* ---------------- Small builders ---------------- */

/** Status badge element with automatic color. */
export function badge(text, tone = "dim") {
  return el("span", { class: `badge badge-${tone}` }, text);
}

/** Map common HR statuses to a badge tone. */
export function statusTone(status) {
  const s = String(status || "").toLowerCase();
  if (["active", "present", "p", "approved", "hired", "offer accepted", "wfh", "completed"].includes(s)) return "ok";
  if (["notice", "pending", "late", "lt", "half day", "hd", "interview", "on hold", "early out", "eo"].includes(s)) return "warn";
  if (["resigned", "absent", "a", "rejected", "terminated", "inactive", "exceeded"].includes(s)) return "bad";
  if (["leave", "l", "holiday", "h", "offer released"].includes(s)) return "info";
  return "dim";
}

/** Progress bar with green/yellow/red coloring by thresholds. */
export function progressBar(pct, { warnAt = 75, badAt = 95, invert = false } = {}) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  let tone = "ok";
  if (invert) tone = p < warnAt ? "bad" : p < badAt ? "warn" : "ok";
  else tone = p >= badAt ? "bad" : p >= warnAt ? "warn" : "ok";
  const bar = el("div", { class: "progress", title: `${p.toFixed(1)}%` },
    el("i", { class: tone, style: { width: "0%" } }));
  requestAnimationFrame(() => { bar.firstChild.style.width = `${p}%`; });
  return bar;
}

/** Empty-state block. */
export function emptyState(icon, title, sub = "") {
  return el("div", { class: "empty-state" },
    el("div", { class: "big" }, icon),
    el("h4", {}, title),
    sub ? el("p", { html: esc(sub) }) : null);
}
