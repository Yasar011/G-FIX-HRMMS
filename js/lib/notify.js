/**
 * Notification center.
 *
 * Notifications live at notifications/{id} = {type, title, body, ts, readBy}.
 * Any module can emit one with `notify()`; the bell badge and drawer update in
 * realtime for every signed-in user.
 */
import { dbPush, dbUpdate, watch, getCached } from "./store.js";
import { currentUser } from "./auth.js";
import { el, timeAgo, toList } from "./utils.js";

const ICONS = {
  attendance: "🗓️", budget: "💰", vacancy: "🪑", joiner: "🎉", resignation: "👋",
  alert: "🚨", birthday: "🎂", anniversary: "🏅", ot: "⏱️", leave: "🌴",
  email: "✉️", system: "⚙️", info: "ℹ️",
};

/** Emit a notification visible to all users. */
export function notify(type, title, body = "") {
  return dbPush("notifications", {
    type, title, body, ts: Date.now(),
    by: currentUser?.name || "System",
  });
}

/** Latest notifications (newest first). */
export function notifList(obj = getCached("notifications")) {
  return toList(obj, "_key").sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

/** Number unread for the current user. */
function unreadCount(list) {
  const uid = currentUser?.uid;
  return list.filter((n) => uid && !n.readBy?.[uid]).length;
}

/** Wire the topbar bell + drawer. Called once after login. */
export function initNotifications() {
  const bell = document.getElementById("notif-bell");
  const badgeEl = document.getElementById("notif-badge");
  const drawer = document.getElementById("notif-drawer");
  const listEl = document.getElementById("notif-list");

  watch("notifications", (obj) => {
    const list = notifList(obj).slice(0, 100);
    const unread = unreadCount(list);
    badgeEl.textContent = unread > 99 ? "99+" : String(unread);
    badgeEl.classList.toggle("hidden", unread === 0);
    renderList(list);
  });

  function renderList(list) {
    const uid = currentUser?.uid;
    listEl.replaceChildren(...(list.length ? list.map((n) =>
      el("div", { class: `notif-item ${uid && !n.readBy?.[uid] ? "unread" : ""}` },
        el("h4", {}, `${ICONS[n.type] || "🔔"} ${n.title}`),
        n.body ? el("p", {}, n.body) : null,
        el("time", {}, timeAgo(n.ts)))) :
      [el("p", { class: "muted", style: { textAlign: "center", padding: "24px" } }, "No notifications yet")]));
  }

  const open = () => { drawer.classList.remove("hidden"); };
  const close = () => drawer.classList.add("hidden");
  bell.addEventListener("click", () => drawer.classList.contains("hidden") ? open() : close());
  document.getElementById("notif-close").addEventListener("click", close);
  document.getElementById("notif-clear").addEventListener("click", () => {
    const uid = currentUser?.uid;
    if (!uid) return;
    const updates = {};
    for (const n of notifList()) if (!n.readBy?.[uid]) updates[`${n._key}/readBy/${uid}`] = true;
    if (Object.keys(updates).length) dbUpdate("notifications", updates);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
}
