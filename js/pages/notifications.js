/**
 * Notifications page — full history with filtering, plus daily birthday /
 * work-anniversary reminder generation (runs once per day per database).
 */
import { pageWatchAll, dbUpdate, getCached } from "../lib/store.js";
import { notifList, notify } from "../lib/notify.js";
import { currentUser } from "../lib/auth.js";
import { dataTable } from "../components/table.js";
import { el, timeAgo, today, daysToAnniversary, toList } from "../lib/utils.js";
import { badge } from "../lib/ui.js";
import { empList, activeEmps } from "../lib/metrics.js";

const TYPE_TONE = {
  alert: "bad", resignation: "bad", budget: "warn", ot: "warn", vacancy: "warn",
  joiner: "ok", birthday: "info", anniversary: "info", leave: "info",
  attendance: "info", email: "dim", system: "dim", info: "dim",
};

export async function render(root) {
  const host = el("div");
  root.append(el("div", { class: "page-head" }, el("h3", {}, "Notifications")), host);

  pageWatchAll(["notifications", "employees", "meta"], (data) => {
    maybeDailyReminders(data);
    const rows = notifList(data.notifications).map((n) => ({
      ...n,
      when: timeAgo(n.ts),
      read: currentUser && n.readBy?.[currentUser.uid] ? "Read" : "Unread",
    }));
    host.replaceChildren(dataTable({
      title: "All notifications",
      exportName: "notifications",
      pageSize: 15,
      columns: [
        { key: "when", label: "When", sortVal: (r) => r.ts },
        { key: "type", label: "Type", render: (r) => badge(r.type, TYPE_TONE[r.type] || "dim"), exportVal: (r) => r.type },
        { key: "title", label: "Title" },
        { key: "body", label: "Details" },
        { key: "by", label: "By" },
        { key: "read", label: "Status", render: (r) => badge(r.read, r.read === "Read" ? "dim" : "info"), exportVal: (r) => r.read },
      ],
      rows,
      empty: "No notifications yet",
    }));
  });

  /**
   * Emit birthday / anniversary reminders once per day (guarded by
   * meta/remindersDate so only the first client to open today generates them).
   */
  function maybeDailyReminders(data) {
    const meta = data.meta || {};
    if (meta.remindersDate === today() || !data.employees) return;
    dbUpdate("meta", { remindersDate: today() }); // claim first
    const active = activeEmps(empList(data.employees));
    for (const e of active) {
      if (e.dob && daysToAnniversary(e.dob) === 0)
        notify("birthday", "Birthday today 🎂", `${e.name} (${e.department || "—"})`);
      if (e.doj && daysToAnniversary(e.doj) === 0 && !e.doj.startsWith(today().slice(0, 4)))
        notify("anniversary", "Work anniversary today 🏅", `${e.name} (${e.department || "—"})`);
    }
  }
}
