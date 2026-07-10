/**
 * Overtime module — OT hours & cost across a chosen date range, with
 * breakdowns by shift, department, category and grade, plus a per-employee
 * table. Everything (KPIs, breakdowns, table, download) respects the
 * From → To date range picker.
 */
import { pageWatchAll } from "../lib/store.js";
import { kpiGrid } from "../components/kpi.js";
import { chartCard } from "../lib/charts.js";
import { dataTable } from "../components/table.js";
import { filterBar, allOptions } from "../components/filters.js";
import { exportPDF, exportXLSX } from "../lib/export.js";
import { toast } from "../lib/ui.js";
import { el, ym, today, ymd, fmtNum, fmtMoney, fmtDate, uniq, sum, dateRange } from "../lib/utils.js";
import { empList, activeEmps, otTrend, otByDimension, employeeAttendance } from "../lib/metrics.js";
import { deptScope } from "../lib/auth.js";

const C = { ok: "#34d399", warn: "#fbbf24", bad: "#f87171", brand: "#6366f1", orange: "#fb923c", violet: "#a78bfa" };

/** First day of the current month as a YYYY-MM-DD key. */
function monthStart() { return `${ym()}-01`; }

export async function render(root) {
  const scope = deptScope();
  const view = { from: monthStart(), to: today(), dept: scope || "" };

  const kpis = kpiGrid([
    { id: "totalHrs", label: "Total OT Hours", icon: "⏱️", color: C.warn, dp: 1 },
    { id: "totalCost", label: "Total OT Cost", icon: "💰", color: C.bad },
    { id: "otEmps", label: "Employees with OT", icon: "👥", color: C.brand },
    { id: "avgPerEmp", label: "Avg OT / Employee", icon: "👤", color: C.brand, dp: 1 },
    { id: "avgPerDay", label: "Avg OT / Day", icon: "📅", color: C.violet, dp: 1 },
    { id: "otDays", label: "Days in Range", icon: "🗓️", color: C.info || C.brand },
  ]);

  const filters = filterBar([
    { id: "from", label: "From", type: "date", value: view.from },
    { id: "to", label: "To", type: "date", value: view.to },
    { id: "dept", label: "Department", type: "select", options: allOptions([]) },
  ], (v) => { Object.assign(view, v); if (scope) view.dept = scope; refresh(); },
    el("button", { class: "btn btn-sm", onclick: () => downloadReport() }, "⬇ Download OT report"));

  const trendChart = chartCard({ title: "OT Hours (daily, in range)", type: "line", datasets: [] });
  const breakdownHost = el("div", { class: "grid grid-2" });
  const tableHost = el("div");

  root.append(
    el("div", { class: "page-head" },
      el("h3", {}, "Overtime"),
      scope ? el("span", { class: "chip" }, `Scope: ${scope}`) : null),
    kpis, filters,
    trendChart,
    el("div", { class: "section-label" }, "Breakdowns"),
    breakdownHost,
    el("div", { class: "section-label" }, "Employee Overtime"),
    tableHost);

  let cache = null;
  pageWatchAll(["employees", "attendance", "settings"], (data) => { cache = data; refresh(); });

  /** Members + dates + rate for the current range/scope. */
  function scoped() {
    let employees = empList(cache.employees);
    if (scope) employees = employees.filter((e) => e.department === scope);
    const all = employees;
    if (view.dept) employees = employees.filter((e) => e.department === view.dept);
    const attendance = cache.attendance || {};
    const settings = cache.settings || {};
    const from = view.from <= view.to ? view.from : view.to;
    const to = view.from <= view.to ? view.to : view.from;
    const dates = dateRange(from, to);
    return { employees: activeEmps(employees), all: activeEmps(all), attendance, settings, dates, from, to,
      otRate: Number(settings.otRate) || 0, currency: settings.currency || "LKR" };
  }

  function refresh() {
    if (!cache) return;
    const s = scoped();
    filters._setOptions("dept", allOptions(uniq(s.all, (e) => e.department)));

    const trend = otTrend(s.attendance, s.dates, s.employees, s.otRate);
    const totalHrs = sum(trend, (t) => t.hours);
    const totalCost = sum(trend, (t) => t.cost);
    const otEmpIds = new Set();
    for (const d of s.dates) for (const [id, r] of Object.entries(s.attendance[d] || {})) if ((r.otHours || 0) > 0) otEmpIds.add(id);
    const rangeDays = s.dates.length;

    kpis._update({
      totalHrs: { value: totalHrs, sub: `${fmtDate(s.from)} → ${fmtDate(s.to)}` },
      totalCost: fmtMoney(totalCost, s.currency),
      otEmps: otEmpIds.size,
      avgPerEmp: { value: otEmpIds.size ? totalHrs / otEmpIds.size : 0, sub: "per OT employee" },
      avgPerDay: { value: rangeDays ? totalHrs / rangeDays : 0, sub: "per calendar day" },
      otDays: rangeDays,
    });

    trendChart._update(trend.map((t) => t.date.slice(5)), [
      { label: "OT Hours", data: trend.map((t) => Number(t.hours.toFixed(1))), color: C.warn, fill: true },
    ]);

    breakdownHost.replaceChildren(
      breakdownCard("By Shift", "🕒", "shift", s),
      breakdownCard("By Department", "🏭", "department", s),
      breakdownCard("By Category", "🏷️", "category", s),
      breakdownCard("By Grade (Direct/Indirect)", "🧑‍🏭", "grade", s));

    tableHost.replaceChildren(dataTable({
      title: `Employee OT — ${fmtDate(s.from)} → ${fmtDate(s.to)}`,
      exportName: `overtime_${s.from}_${s.to}`,
      pageSize: 15,
      onRowClick: (r) => { location.hash = `#/employees/${encodeURIComponent(r.empId)}`; },
      columns: [
        { key: "empId", label: "ID" },
        { key: "name", label: "Name" },
        { key: "department", label: "Department" },
        { key: "shift", label: "Shift" },
        { key: "category", label: "Category" },
        { key: "grade", label: "Grade" },
        { key: "otHours", label: "OT Hours", align: "right" },
        { key: "otDays", label: "OT Days", align: "right" },
        { key: "cost", label: `Cost (${s.currency})`, align: "right", render: (r) => fmtNum(r.cost), exportVal: (r) => r.cost },
      ],
      rows: employeeRows(s),
      empty: "No overtime in this date range",
    }));
  }

  /** A compact breakdown table for one dimension. */
  function breakdownCard(title, icon, dim, s) {
    const rows = otByDimension(s.attendance, s.dates, s.employees, dim, s.otRate);
    return el("div", { class: "card" },
      el("div", { class: "card-head" }, el("h4", {}, `${icon} ${title}`)),
      rows.length
        ? el("div", {},
            el("div", { class: "stat-row", style: { fontSize: "11px" } },
              el("span", { class: "muted" }, dim === "shift" ? "Shift" : dim[0].toUpperCase() + dim.slice(1)),
              el("span", { class: "muted", style: { display: "flex", gap: "16px" } }, el("span", {}, "OT Hrs"), el("span", {}, "Emps"))),
            ...rows.map((r) => el("div", { class: "stat-row" },
              el("span", {}, r.name),
              el("span", { style: { display: "flex", gap: "16px", minWidth: "90px", justifyContent: "flex-end" } },
                el("strong", {}, fmtNum(r.hours, 1)), el("span", { class: "muted" }, String(r.employees))))))
        : el("p", { class: "muted", style: { fontSize: "12.5px" } }, "No overtime in this range."));
  }

  /** Per-employee OT rows for the range. */
  function employeeRows(s) {
    return s.employees.map((e) => {
      const a = employeeAttendance(e.id, s.attendance, s.dates);
      const rate = Number(e.otRate) || s.otRate;
      return {
        empId: e.id, name: e.name, department: e.department || "—",
        shift: firstShift(e.id, s) || "—", category: e.category || "—", grade: e.grade || "—",
        otHours: Number(a.otHours.toFixed(1)),
        otDays: a.records.filter((r) => (r.otHours || 0) > 0).length,
        cost: Math.round(a.otHours * rate),
      };
    }).filter((r) => r.otHours > 0).sort((a, b) => b.otHours - a.otHours);
  }

  /** The employee's shift as seen in their attendance records for the range. */
  function firstShift(id, s) {
    for (const d of s.dates) { const r = s.attendance[d]?.[id]; if (r?.shift) return r.shift; }
    return "";
  }

  /** Download the OT report (PDF) — summary strip + full per-worker detail. */
  function downloadReport() {
    if (!cache) { toast("Still loading…", "warn"); return; }
    const s = scoped();
    const rows = employeeRows(s);
    if (!rows.length) { toast("No overtime to download for this range", "warn"); return; }
    const totalHrs = sum(rows, (r) => r.otHours);
    const totalCost = sum(rows, (r) => r.cost);
    const columns = [
      { key: "empId", label: "ID" }, { key: "name", label: "Name" }, { key: "department", label: "Department" },
      { key: "shift", label: "Shift" }, { key: "category", label: "Category" }, { key: "grade", label: "Grade" },
      { key: "otHours", label: "OT Hours" }, { key: "otDays", label: "OT Days" }, { key: "cost", label: `Cost (${s.currency})` },
    ];
    exportPDF(rows, `overtime_${s.from}_${s.to}`, columns, {
      title: "Overtime Report", subtitle: `${fmtDate(s.from)} → ${fmtDate(s.to)}${view.dept ? " · " + view.dept : ""}`,
      summary: [
        { label: "Workers with OT", value: rows.length },
        { label: "Total OT Hours", value: Number(totalHrs.toFixed(1)) },
        { label: `Total Cost (${s.currency})`, value: fmtNum(totalCost) },
        { label: "Avg OT/Worker", value: Number((totalHrs / rows.length).toFixed(1)) },
      ],
    });
    toast("OT report downloaded", "ok");
  }
}
