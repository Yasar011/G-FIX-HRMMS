/**
 * Overtime module — daily/weekly/monthly OT hours & cost, department and
 * employee breakdowns, OT-exceeded alerting.
 */
import { pageWatchAll } from "../lib/store.js";
import { kpiGrid } from "../components/kpi.js";
import { chartCard } from "../lib/charts.js";
import { dataTable } from "../components/table.js";
import { filterBar, allOptions } from "../components/filters.js";
import { el, ym, today, ymd, fmtNum, fmtMoney, uniq, sum, dateRange, addDays } from "../lib/utils.js";
import { empList, activeEmps, monthDates, otTrend, employeeAttendance, groupAttendance } from "../lib/metrics.js";

const C = { ok: "#34d399", warn: "#fbbf24", bad: "#f87171", brand: "#6366f1", orange: "#fb923c" };

export async function render(root) {
  let view = { month: ym(), dept: "" };

  const kpis = kpiGrid([
    { id: "todayHrs", label: "Today's OT Hours", icon: "⏱️", color: C.warn, dp: 1 },
    { id: "todayCost", label: "Today's OT Cost", icon: "💸", color: C.orange },
    { id: "weekHrs", label: "This Week (hrs)", icon: "📅", color: C.warn, dp: 1 },
    { id: "monthHrs", label: "This Month (hrs)", icon: "🗓️", color: C.bad, dp: 1 },
    { id: "monthCost", label: "Monthly OT Cost", icon: "💰", color: C.bad },
    { id: "avgOt", label: "Avg OT / Employee", icon: "👤", color: C.brand, dp: 1 },
  ]);

  const filters = filterBar([
    { id: "month", label: "Month", type: "month", value: view.month },
    { id: "dept", label: "Department", type: "select", options: allOptions([]) },
  ], (v) => { Object.assign(view, v); refresh(); });

  const trendChart = chartCard({ title: "OT Trend (Daily)", type: "line", datasets: [] });
  const deptChart = chartCard({ title: "OT Hours by Department", type: "bar", datasets: [] });
  const tableHost = el("div");

  root.append(
    el("div", { class: "page-head" }, el("h3", {}, "Overtime")),
    kpis, filters,
    el("div", { class: "grid grid-2" }, trendChart, deptChart),
    tableHost);

  let cache = null;
  pageWatchAll(["employees", "attendance", "settings"], (data) => { cache = data; refresh(); });

  function refresh() {
    if (!cache) return;
    let employees = empList(cache.employees);
    const attendance = cache.attendance || {};
    const settings = cache.settings || {};
    const otRate = Number(settings.otRate) || 0;
    const currency = settings.currency || "LKR";

    filters._setOptions("dept", allOptions(uniq(activeEmps(employees), (e) => e.department)));
    if (view.dept) employees = employees.filter((e) => e.department === view.dept);

    const dates = monthDates(attendance, view.month);
    const trend = otTrend(attendance, dates, employees, otRate);
    const weekStart = ymd(new Date(Date.now() - 6 * 86400e3));
    const weekTrend = otTrend(attendance, dateRange(weekStart, today()), employees, otRate);
    const todayRow = trend.find((t) => t.date === today());

    const active = activeEmps(employees);
    const monthHrs = sum(trend, (t) => t.hours);

    kpis._update({
      todayHrs: todayRow?.hours || 0,
      todayCost: fmtMoney(todayRow?.cost || 0, currency),
      weekHrs: sum(weekTrend, (t) => t.hours),
      monthHrs,
      monthCost: fmtMoney(sum(trend, (t) => t.cost), currency),
      avgOt: active.length ? monthHrs / active.length : 0,
    });

    trendChart._update(trend.map((t) => t.date.slice(8)), [
      { label: "OT Hours", data: trend.map((t) => Number(t.hours.toFixed(1))), color: C.warn, fill: true },
    ]);

    const byDept = groupAttendance(attendance, employees, dates, "department");
    deptChart._update(byDept.map((d) => d.name), [
      { label: "OT Hours", data: byDept.map((d) => Number(d.otHours.toFixed(1))), perBarColor: true },
    ]);

    const rows = active.map((e) => {
      const a = employeeAttendance(e.id, attendance, dates);
      const rate = Number(e.otRate) || otRate;
      return {
        empId: e.id, name: e.name, department: e.department || "—", section: e.section || "—",
        otHours: Number(a.otHours.toFixed(1)),
        otDays: a.records.filter((r) => (r.otHours || 0) > 0).length,
        avgPerDay: a.present ? Number((a.otHours / a.present).toFixed(2)) : 0,
        cost: Math.round(a.otHours * rate),
      };
    }).filter((r) => r.otHours > 0).sort((a, b) => b.otHours - a.otHours);

    tableHost.replaceChildren(dataTable({
      title: `Employee OT — ${view.month}`,
      exportName: `overtime_${view.month}`,
      pageSize: 15,
      onRowClick: (r) => { location.hash = `#/employees/${encodeURIComponent(r.empId)}`; },
      columns: [
        { key: "empId", label: "ID" },
        { key: "name", label: "Name" },
        { key: "department", label: "Department" },
        { key: "section", label: "Section" },
        { key: "otHours", label: "OT Hours", align: "right" },
        { key: "otDays", label: "OT Days", align: "right" },
        { key: "avgPerDay", label: "Avg/Day", align: "right" },
        { key: "cost", label: `Cost (${currency})`, align: "right", render: (r) => fmtNum(r.cost), exportVal: (r) => r.cost },
      ],
      rows,
      empty: "No overtime recorded this month",
    }));
  }
}
