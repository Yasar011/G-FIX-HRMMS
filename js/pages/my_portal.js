/**
 * My Portal — Self-service area for employees.
 * Shows their own attendance, leaves, and basic profile.
 */
import { currentUser } from "../lib/auth.js";
import { pageWatchAll } from "../lib/store.js";
import { el, ym, today, fmtDate } from "../lib/utils.js";
import { employeeAttendance, ATT_STATUS, monthDates } from "../lib/metrics.js";
import { kpiGrid } from "../components/kpi.js";
import { dataTable } from "../components/table.js";
import { badge, emptyState, statusTone } from "../lib/ui.js";

const C = { ok: "#34d399", warn: "#fbbf24", bad: "#f87171", brand: "#6366f1", violet: "#a78bfa" };

export async function render(root) {
  try {
    let cache = null;
    let month = ym();

    if (!currentUser?.empId) {
      root.append(emptyState("🔗", "No Employee ID Linked", "Your account hasn't been linked to an Employee ID. Please ask HR to update your profile with your Employee ID."));
      return;
    }

    const monthInput = el("input", { type: "month", value: month, onchange: (e) => { month = e.target.value; refresh(); } });

    const kpis = kpiGrid([
      { id: "present", label: "Days Present", icon: "✅", color: C.ok },
      { id: "absent", label: "Days Absent", icon: "❌", color: C.bad },
      { id: "late", label: "Late Marks", icon: "⏰", color: C.warn },
      { id: "ot", label: "OT Hours", icon: "⏱️", color: C.brand },
    ]);

    const attHost = el("div");
    const leaveHost = el("div");

    root.append(
      el("div", { class: "page-head" },
        el("h3", {}, `Welcome, ${currentUser.name || "Employee"}`),
        el("div", { class: "spacer" }),
        el("label", { class: "field", style: { margin: 0 } }, el("span", {}, "Month"), monthInput)
      ),
      kpis,
      el("div", { class: "grid grid-2" },
        el("div", { class: "card" }, el("div", { class: "card-head" }, el("h4", {}, "📅 My Attendance")), attHost),
        el("div", { class: "card" }, el("div", { class: "card-head" }, el("h4", {}, "🌴 My Leaves")), leaveHost)
      )
    );

    pageWatchAll(["employees", "attendance", "leaves"], (data) => { 
      try {
        cache = data; 
        refresh(); 
      } catch (err) {
        console.error("Portal watch error:", err);
      }
    });

    function refresh() {
      if (!cache) return;
      const emp = cache.employees?.[currentUser.empId];
      if (!emp) {
        attHost.replaceChildren(el("p", { class: "muted" }, "Employee record not found."));
        return;
      }

      const dates = monthDates(cache.attendance, month);
      const att = employeeAttendance(currentUser.empId, cache.attendance, dates);

      kpis._update({
        present: att.present || 0,
        absent: att.absent || 0,
        late: att.late || 0,
        ot: (att.otHours || 0).toFixed(1)
      });

      // Attendance Table
      const attRows = (att.records || []).map(r => ({
        date: r.date,
        status: r.status,
        in: r.in || "—",
        out: r.out || "—",
        ot: r.otHours || 0,
        late: r.late ? "Yes" : ""
      })).sort((a, b) => b.date.localeCompare(a.date));

      attHost.replaceChildren(dataTable({
        columns: [
          { key: "date", label: "Date", render: r => fmtDate(r.date) },
          { key: "status", label: "Status", render: r => badge(ATT_STATUS[r.status] || r.status || "Unknown", statusTone(r.status)) },
          { key: "in", label: "In" },
          { key: "out", label: "Out" },
          { key: "late", label: "Late", render: r => r.late ? badge("Late", "warn") : "" },
          { key: "ot", label: "OT Hrs", align: "right" }
        ],
        rows: attRows,
        empty: "No attendance data for this month.",
        pageSize: 10
      }));

      // Leaves Table
      const leaves = Object.values(cache.leaves || {})
        .filter(l => l.empId === currentUser.empId)
        .sort((a, b) => b.createdAt - a.createdAt);

      leaveHost.replaceChildren(dataTable({
        columns: [
          { key: "date", label: "Date", render: r => fmtDate(r.date) },
          { key: "type", label: "Type", render: r => r.type || "Leave" },
          { key: "status", label: "Status", render: r => r.status === "Approved" ? badge("Approved", "ok") : r.status === "Rejected" ? badge("Rejected", "bad") : badge("Pending", "warn") },
          { key: "reason", label: "Reason" }
        ],
        rows: leaves,
        empty: "No leaves requested.",
        pageSize: 5
      }));
    }
  } catch (e) {
    console.error("Portal render error", e);
    root.append(emptyState("⚠️", "Portal Error", "An error occurred while rendering your portal."));
  }
}
