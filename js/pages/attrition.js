/**
 * Attrition module — resignations & terminations, notice periods, reasons,
 * monthly/yearly attrition %, average tenure, replacement tracking.
 */
import { pageWatchAll, dbPush, dbUpdate, dbRemove } from "../lib/store.js";
import { can } from "../lib/auth.js";
import { toast, modal, confirmDialog, badge, statusTone } from "../lib/ui.js";
import { dataTable } from "../components/table.js";
import { kpiGrid } from "../components/kpi.js";
import { chartCard } from "../lib/charts.js";
import { notify } from "../lib/notify.js";
import { el, fmtDate, fmtNum, fmtMonth, lastMonths, uniq, yearsSince, today } from "../lib/utils.js";
import { empList, attritionStats, movementTrend } from "../lib/metrics.js";

const C = { ok: "#34d399", warn: "#fbbf24", bad: "#f87171", brand: "#6366f1" };
const REASONS = ["Better opportunity", "Salary", "Personal / family", "Relocation", "Health", "Higher studies", "Performance", "Disciplinary", "Contract ended", "Other"];

export async function render(root) {
  const canManage = can("manage_attrition");
  let employees = [];
  let attritionObj = null;

  const kpis = kpiGrid([
    { id: "monthly", label: "Attrition (This Month)", icon: "📉", color: C.bad },
    { id: "monthlyPct", label: "Monthly Attrition %", icon: "📊", color: C.bad, dp: 2, suffix: "%" },
    { id: "yearly", label: "Attrition (This Year)", icon: "🗓️", color: C.warn },
    { id: "yearlyPct", label: "Yearly Attrition %", icon: "📈", color: C.warn, dp: 1, suffix: "%" },
    { id: "avgTenure", label: "Avg Tenure at Exit (yrs)", icon: "⌛", color: C.brand, dp: 1 },
    { id: "pending", label: "Replacement Pending", icon: "🪑", color: C.warn },
  ]);

  const trendChart = chartCard({ title: "Attrition Trend (12 months)", type: "bar", datasets: [] });
  const deptChart = chartCard({ title: "Attrition by Department", type: "doughnut", datasets: [] });
  const reasonChart = chartCard({ title: "Reasons for Leaving", type: "bar", options: { indexAxis: "y" }, datasets: [] });
  const joinLeaveChart = chartCard({ title: "Joining vs Resignation Trend", type: "line", datasets: [] });
  const tableHost = el("div");

  root.append(
    el("div", { class: "page-head" },
      el("h3", {}, "Attrition"),
      el("div", { class: "spacer" }),
      canManage ? el("button", { class: "btn btn-primary", onclick: () => editRecord() }, "＋ Record exit") : null),
    kpis,
    el("div", { class: "grid grid-2" }, trendChart, joinLeaveChart),
    el("div", { class: "grid grid-2" }, deptChart, reasonChart),
    tableHost);

  pageWatchAll(["employees", "attrition"], (data) => {
    employees = empList(data.employees);
    attritionObj = data.attrition;
    const s = attritionStats(attritionObj, employees);

    kpis._update({
      monthly: s.monthly, monthlyPct: s.monthlyPct, yearly: s.yearly,
      yearlyPct: s.yearlyPct, avgTenure: s.avgTenure, pending: s.replacementPending,
    });

    const months = lastMonths(12);
    trendChart._update(months.map(fmtMonth), [
      { label: "Exits", data: months.map((m) => s.list.filter((a) => a.lastDay?.startsWith(m)).length), color: C.bad },
    ]);

    const mv = movementTrend(employees, attritionObj, 12);
    joinLeaveChart._update(mv.map((m) => fmtMonth(m.month)), [
      { label: "Joined", data: mv.map((m) => m.joined), color: C.ok, fill: true },
      { label: "Left", data: mv.map((m) => m.left), color: C.bad },
    ]);

    deptChart._update(s.byDept.map((d) => d.department), [{ data: s.byDept.map((d) => d.count) }]);
    reasonChart._update(s.byReason.map((r) => r.reason), [{ label: "Exits", data: s.byReason.map((r) => r.count), perBarColor: true }]);

    tableHost.replaceChildren(dataTable({
      title: "Exit Register",
      exportName: "attrition",
      pageSize: 15,
      onRowClick: canManage ? (r) => editRecord(r) : null,
      columns: [
        { key: "empId", label: "ID" },
        { key: "name", label: "Name" },
        { key: "department", label: "Department" },
        { key: "type", label: "Type", render: (r) => badge(r.type, r.type === "Terminated" ? "bad" : "warn"), exportVal: (r) => r.type },
        { key: "noticeDate", label: "Notice Date", render: (r) => fmtDate(r.noticeDate), exportVal: (r) => r.noticeDate || "" },
        { key: "lastDay", label: "Last Working Day", render: (r) => fmtDate(r.lastDay), exportVal: (r) => r.lastDay || "" },
        { key: "tenureYears", label: "Tenure (y)", align: "right" },
        { key: "reason", label: "Reason" },
        { key: "replacement", label: "Replacement", render: (r) => badge(r.replacement || "—", r.replacement === "Hired" ? "ok" : r.replacement === "Pending" ? "warn" : "dim"), exportVal: (r) => r.replacement || "" },
      ],
      rows: s.list.sort((a, b) => (b.lastDay || "").localeCompare(a.lastDay || "")),
      empty: "No exits recorded",
    }));
  });

  /* ---------- add / edit ---------- */
  function editRecord(rec = null) {
    const active = employees.filter((e) => e.status !== "resigned");
    const empSel = el("select", {},
      ...(rec ? [el("option", { value: rec.empId }, `${rec.name} (${rec.empId})`)]
        : active.map((e) => el("option", { value: e.id }, `${e.name} (${e.id})`))));
    if (rec) empSel.disabled = true;
    const typeSel = el("select", {}, ...["Resigned", "Terminated"].map((t) => el("option", { value: t }, t)));
    typeSel.value = rec?.type || "Resigned";
    const noticeInput = el("input", { type: "date", value: rec?.noticeDate || today() });
    const lastDayInput = el("input", { type: "date", value: rec?.lastDay || "" });
    const reasonSel = el("select", {}, ...REASONS.map((r) => el("option", { value: r }, r)));
    reasonSel.value = rec?.reason || REASONS[0];
    const replSel = el("select", {}, ...["Pending", "Hired", "Not needed"].map((r) => el("option", { value: r }, r)));
    replSel.value = rec?.replacement || "Pending";

    modal({
      title: rec ? `Edit exit — ${rec.name}` : "Record employee exit",
      width: "600px",
      body: el("div", { class: "form-grid" },
        el("label", { class: "field" }, el("span", {}, "Employee"), empSel),
        el("label", { class: "field" }, el("span", {}, "Exit type"), typeSel),
        el("label", { class: "field" }, el("span", {}, "Notice date"), noticeInput),
        el("label", { class: "field" }, el("span", {}, "Last working day"), lastDayInput),
        el("label", { class: "field" }, el("span", {}, "Reason"), reasonSel),
        el("label", { class: "field" }, el("span", {}, "Replacement"), replSel)),
      actions: [
        rec ? {
          label: "Delete", class: "btn-danger",
          onClick: async (e, close) => {
            if (!(await confirmDialog("Delete this exit record?"))) return true;
            await dbRemove(`attrition/${rec._key}`);
            toast("Record deleted", "ok");
            close();
          },
        } : null,
        { label: "Cancel", class: "btn-ghost", onClick: () => {} },
        {
          label: "Save", class: "btn-primary",
          onClick: async (e, close) => {
            const empId = empSel.value;
            const emp = employees.find(($) => $.id === empId);
            if (!empId || !lastDayInput.value) { toast("Pick an employee and last working day", "warn"); return true; }
            const data = {
              empId, name: rec?.name || emp?.name || empId,
              department: rec?.department || emp?.department || "—",
              type: typeSel.value, noticeDate: noticeInput.value, lastDay: lastDayInput.value,
              reason: reasonSel.value, replacement: replSel.value,
              tenureYears: Number(((emp?.doj || rec?.doj) ? yearsSince(emp?.doj || rec?.doj) : 0).toFixed(1)),
            };
            if (rec) await dbUpdate(`attrition/${rec._key}`, data);
            else {
              await dbPush("attrition", data);
              // Flip employee status: notice until last day passes, then resigned
              const status = data.lastDay <= today() ? "resigned" : "notice";
              await dbUpdate(`employees/${empId}`, { status, resignDate: data.lastDay });
              notify("resignation", `Employee ${data.type.toLowerCase()}`, `${data.name} — last day ${fmtDate(data.lastDay)}`);
            }
            toast("Exit recorded", "ok");
            close();
          },
        },
      ].filter(Boolean),
    });
  }
}
