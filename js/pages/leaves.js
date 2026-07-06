/**
 * Leaves module — apply, approve/reject (role-gated), leave analysis chart,
 * automatic attendance marking for approved leave days.
 */
import { pageWatchAll, dbPush, dbUpdate, dbRemove } from "../lib/store.js";
import { can, deptScope, currentUser } from "../lib/auth.js";
import { toast, modal, confirmDialog, badge } from "../lib/ui.js";
import { dataTable } from "../components/table.js";
import { kpiGrid } from "../components/kpi.js";
import { chartCard } from "../lib/charts.js";
import { notify } from "../lib/notify.js";
import { el, fmtDate, today, toList, dateRange, ym, fmtMonth, lastMonths, groupBy } from "../lib/utils.js";
import { empList, activeEmps } from "../lib/metrics.js";

const C = { ok: "#34d399", warn: "#fbbf24", bad: "#f87171", info: "#38bdf8", brand: "#6366f1" };
const TYPES = ["Annual", "Casual", "Medical", "Maternity", "No-pay", "Other"];

export async function render(root) {
  const approver = can("approve_leaves");
  const scope = deptScope();
  let employees = [];

  const kpis = kpiGrid([
    { id: "pending", label: "Pending Approval", icon: "⏳", color: C.warn },
    { id: "approvedMtd", label: "Approved (MTD)", icon: "✅", color: C.ok },
    { id: "daysMtd", label: "Leave Days (MTD)", icon: "🌴", color: C.info },
    { id: "onLeaveToday", label: "On Leave Today", icon: "🏖️", color: C.brand },
  ]);
  const typeChart = chartCard({ title: "Leave Analysis by Type", type: "doughnut", datasets: [] });
  const trendChart = chartCard({ title: "Leave Days Trend (12 months)", type: "bar", datasets: [] });
  const tableHost = el("div");

  root.append(
    el("div", { class: "page-head" },
      el("h3", {}, "Leave Management"),
      scope ? el("span", { class: "chip" }, `Scope: ${scope}`) : null,
      el("div", { class: "spacer" }),
      el("button", { class: "btn btn-primary", onclick: () => applyLeave() }, "＋ Apply leave")),
    kpis,
    el("div", { class: "grid grid-2" }, typeChart, trendChart),
    tableHost);

  pageWatchAll(["employees", "leaves"], (data) => {
    employees = empList(data.employees);
    let leaves = toList(data.leaves, "_key");
    if (scope) leaves = leaves.filter((l) => l.department === scope);
    const month = ym();
    const approved = leaves.filter((l) => l.status === "approved");

    kpis._update({
      pending: leaves.filter((l) => l.status === "pending").length,
      approvedMtd: approved.filter((l) => l.from?.startsWith(month) || l.to?.startsWith(month)).length,
      daysMtd: approved.filter((l) => l.from?.startsWith(month)).reduce((s, l) => s + (Number(l.days) || 0), 0),
      onLeaveToday: approved.filter((l) => l.from <= today() && l.to >= today()).length,
    });

    const byType = [...groupBy(approved, (l) => l.type || "Other")];
    typeChart._update(byType.map(([t]) => t), [{ data: byType.map(([, items]) => items.reduce((s, l) => s + (Number(l.days) || 0), 0)) }]);

    const months = lastMonths(12);
    trendChart._update(months.map(fmtMonth), [{
      label: "Leave days",
      data: months.map((m) => approved.filter((l) => l.from?.startsWith(m)).reduce((s, l) => s + (Number(l.days) || 0), 0)),
      color: C.info,
    }]);

    tableHost.replaceChildren(dataTable({
      title: "Leave Requests",
      exportName: "leaves",
      pageSize: 15,
      columns: [
        { key: "empId", label: "ID" },
        { key: "name", label: "Name" },
        { key: "department", label: "Department" },
        { key: "type", label: "Type" },
        { key: "from", label: "From", render: (r) => fmtDate(r.from), exportVal: (r) => r.from },
        { key: "to", label: "To", render: (r) => fmtDate(r.to), exportVal: (r) => r.to },
        { key: "days", label: "Days", align: "right" },
        { key: "reason", label: "Reason" },
        { key: "status", label: "Status", render: (r) => badge(r.status, r.status === "approved" ? "ok" : r.status === "rejected" ? "bad" : "warn"), exportVal: (r) => r.status },
        {
          key: "_act", label: "Action",
          render: (r) => r.status === "pending" && approver
            ? el("div", { style: { display: "flex", gap: "6px" } },
                el("button", { class: "btn btn-sm btn-primary", onclick: (e) => { e.stopPropagation(); decide(r, "approved"); } }, "Approve"),
                el("button", { class: "btn btn-sm btn-danger", onclick: (e) => { e.stopPropagation(); decide(r, "rejected"); } }, "Reject"))
            : (r.approvedBy ? el("small", { class: "muted" }, `by ${r.approvedBy}`) : "—"),
          exportVal: (r) => r.approvedBy || "",
        },
      ],
      rows: leaves.sort((a, b) => (b.appliedAt || 0) - (a.appliedAt || 0)),
      empty: "No leave requests",
    }));
  });

  /** Approve/reject and (on approve) mark attendance L for the range. */
  async function decide(leave, status) {
    if (!(await confirmDialog(`${status === "approved" ? "Approve" : "Reject"} ${leave.name}'s ${leave.type} leave (${fmtDate(leave.from)} → ${fmtDate(leave.to)})?`, { danger: status === "rejected" }))) return;
    await dbUpdate(`leaves/${leave._key}`, { status, approvedBy: currentUser?.name || "—", decidedAt: Date.now() });
    if (status === "approved") {
      const updates = {};
      for (const d of dateRange(leave.from, leave.to)) updates[`${d}/${leave.empId}`] = { status: "L" };
      await dbUpdate("attendance", updates);
      notify("leave", "Leave approved", `${leave.name}: ${leave.type}, ${fmtDate(leave.from)} → ${fmtDate(leave.to)}`);
    }
    toast(`Leave ${status}`, status === "approved" ? "ok" : "warn");
  }

  function applyLeave() {
    const active = activeEmps(employees).filter((e) => !scope || e.department === scope);
    const empSel = el("select", {}, ...active.map((e) => el("option", { value: e.id }, `${e.name} (${e.id})`)));
    const typeSel = el("select", {}, ...TYPES.map((t) => el("option", { value: t }, t)));
    const fromInput = el("input", { type: "date", value: today() });
    const toInput = el("input", { type: "date", value: today() });
    const reason = el("input", { type: "text", placeholder: "Optional" });

    modal({
      title: "Apply for leave",
      width: "600px",
      body: el("div", { class: "form-grid" },
        el("label", { class: "field" }, el("span", {}, "Employee"), empSel),
        el("label", { class: "field" }, el("span", {}, "Type"), typeSel),
        el("label", { class: "field" }, el("span", {}, "From"), fromInput),
        el("label", { class: "field" }, el("span", {}, "To"), toInput),
        el("label", { class: "field" }, el("span", {}, "Reason"), reason)),
      actions: [
        { label: "Cancel", class: "btn-ghost", onClick: () => {} },
        {
          label: "Submit", class: "btn-primary",
          onClick: async (e, close) => {
            const emp = active.find((x) => x.id === empSel.value);
            if (!emp || !fromInput.value || !toInput.value || toInput.value < fromInput.value) {
              toast("Check the employee and date range", "warn"); return true;
            }
            await dbPush("leaves", {
              empId: emp.id, name: emp.name, department: emp.department || "—",
              type: typeSel.value, from: fromInput.value, to: toInput.value,
              days: dateRange(fromInput.value, toInput.value).length,
              reason: reason.value.trim(), status: "pending", appliedAt: Date.now(),
            });
            toast("Leave request submitted", "ok");
            close();
          },
        },
      ],
    });
  }
}
