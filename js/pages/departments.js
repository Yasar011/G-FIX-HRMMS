/**
 * Departments module.
 *
 * Route: #/departments          → overview cards (one per department)
 *        #/departments/{name}   → department detail page with KPIs + charts
 */
import { pageWatchAll } from "../lib/store.js";
import { el, esc, ym, fmtPct, fmtNum, groupBy, toList, lastMonths, fmtMonth, sum } from "../lib/utils.js";
import { kpiGrid } from "../components/kpi.js";
import { chartCard } from "../lib/charts.js";
import { dataTable } from "../components/table.js";
import { emptyState, progressBar } from "../lib/ui.js";
import {
  empList, activeEmps, employeeAttendance, monthDates, groupAttendance,
  budgetStats, dailyTrend, dayStats,
} from "../lib/metrics.js";
import { deptScope } from "../lib/auth.js";

const C = { ok: "#34d399", warn: "#fbbf24", bad: "#f87171", info: "#38bdf8", brand: "#6366f1", violet: "#a78bfa" };

export async function render(root, params = []) {
  const dept = params[0] ? decodeURIComponent(params[0]) : null;
  const scope = deptScope();
  if (scope && dept !== scope) { location.hash = `#/departments/${encodeURIComponent(scope)}`; return; }
  if (dept) return renderDetail(root, dept);
  return renderOverview(root);
}

/* ================= Overview ================= */

function renderOverview(root) {
  const month = ym();
  const host = el("div", { class: "grid grid-3" });
  root.append(el("div", { class: "page-head" }, el("h3", {}, "Departments")), host);

  pageWatchAll(["employees", "attendance", `budget/${month}`, "attrition"], (data) => {
    const employees = empList(data.employees);
    const attendance = data.attendance || {};
    const dates = monthDates(attendance, month);
    const budget = budgetStats(data[`budget/${month}`], employees);
    const attrition = toList(data.attrition, "_key");
    const groups = groupBy(activeEmps(employees), (e) => e.department || "—");

    if (!groups.size) {
      host.replaceChildren(emptyState("🏭", "No departments yet", "Add employees with a department to see them here."));
      return;
    }

    host.replaceChildren(...[...groups.entries()].sort((a, b) => b[1].length - a[1].length).map(([name, members]) => {
      let present = 0, marked = 0, late = 0, ot = 0;
      for (const e of members) {
        const a = employeeAttendance(e.id, attendance, dates);
        present += a.present; marked += a.marked; late += a.late; ot += a.otHours;
      }
      const attPct = marked ? (present / marked) * 100 : 0;
      const b = budget.find((x) => x.department === name);
      const left = attrition.filter((a) => a.department === name && a.lastDay?.startsWith(month)).length;

      return el("div", {
        class: "card", style: { cursor: "pointer" },
        onclick: () => { location.hash = `#/departments/${encodeURIComponent(name)}`; },
      },
        el("div", { class: "card-head" },
          el("h4", {}, `🏭 ${name}`),
          el("div", { class: "spacer" }),
          el("span", { class: "chip" }, `${members.length} emp`)),
        el("div", { class: "stat-row" }, el("span", { class: "muted" }, "Attendance (MTD)"),
          el("strong", { class: attPct >= 95 ? "text-ok" : attPct >= 85 ? "text-warn" : "text-bad" }, fmtPct(attPct))),
        progressBar(attPct, { invert: true, warnAt: 85, badAt: 95 }),
        el("div", { class: "stat-row", style: { marginTop: "8px" } }, el("span", { class: "muted" }, "Budget"),
          el("strong", {}, b ? `${b.actual} / ${b.budget}` : "—")),
        el("div", { class: "stat-row" }, el("span", { class: "muted" }, "Late (MTD)"), el("strong", {}, String(late))),
        el("div", { class: "stat-row" }, el("span", { class: "muted" }, "OT hours (MTD)"), el("strong", {}, fmtNum(ot, 1))),
        el("div", { class: "stat-row" }, el("span", { class: "muted" }, "Left this month"), el("strong", { class: left ? "text-bad" : "" }, String(left))));
    }));
  });
}

/* ================= Detail ================= */

function renderDetail(root, dept) {
  const month = ym();

  const kpis = kpiGrid([
    { id: "headcount", label: "Current Headcount", icon: "👥", color: C.brand },
    { id: "budget", label: "Budget", icon: "🎯", color: C.violet },
    { id: "vacancies", label: "Vacancies", icon: "🪑", color: C.warn },
    { id: "attPct", label: "Attendance %", icon: "📊", color: C.ok, dp: 1, suffix: "%" },
    { id: "latePct", label: "Late %", icon: "⏰", color: C.warn, dp: 1, suffix: "%" },
    { id: "ot", label: "OT Hours (MTD)", icon: "⏱️", color: C.warn, dp: 1 },
    { id: "leaves", label: "Leaves (MTD)", icon: "🌴", color: C.info },
    { id: "joined", label: "Joined (MTD)", icon: "🎉", color: C.ok },
    { id: "left", label: "Resigned (MTD)", icon: "👋", color: C.bad },
    { id: "workHrs", label: "Avg Work Hrs/Day", icon: "🕒", color: C.brand, dp: 1 },
    { id: "efficiency", label: "Efficiency Score", icon: "🚀", color: C.ok, dp: 0, suffix: "%" },
  ]);

  const trendChart = chartCard({ title: "Daily Attendance (30 days)", type: "line", datasets: [] });
  const secChart = chartCard({ title: "Section Attendance %", type: "bar", options: { indexAxis: "y", scales: { x: { max: 100, beginAtZero: true } } }, datasets: [] });
  const tableHost = el("div");

  root.append(
    el("div", { class: "page-head" },
      el("button", { class: "btn btn-ghost", onclick: () => { location.hash = "#/departments"; } }, "← All departments"),
      el("h3", {}, `🏭 ${dept}`)),
    kpis,
    el("div", { class: "grid grid-2" }, trendChart, secChart),
    tableHost);

  pageWatchAll(["employees", "attendance", `budget/${month}`, "attrition", "leaves"], (data) => {
    const all = empList(data.employees);
    const members = activeEmps(all).filter((e) => e.department === dept);
    const attendance = data.attendance || {};
    const dates = monthDates(attendance, month);

    let present = 0, marked = 0, late = 0, ot = 0, leave = 0, workMin = 0, workDays = 0;
    const perEmp = members.map((e) => {
      const a = employeeAttendance(e.id, attendance, dates);
      present += a.present; marked += a.marked; late += a.late;
      ot += a.otHours; leave += a.leave; workMin += a.workMin; workDays += a.present;
      return { ...e, ...a };
    });
    const attPct = marked ? (present / marked) * 100 : 0;
    const latePct = marked ? (late / marked) * 100 : 0;
    const b = budgetStats(data[`budget/${month}`], all).find((x) => x.department === dept);
    const joined = all.filter((e) => e.department === dept && e.doj?.startsWith(month)).length;
    const left = toList(data.attrition, "_key").filter((a) => a.department === dept && a.lastDay?.startsWith(month)).length;
    // Simple composite score: attendance minus late penalty
    const efficiency = Math.max(0, Math.min(100, attPct - latePct * 0.5));

    kpis._update({
      headcount: members.length,
      budget: b?.budget ?? 0,
      vacancies: b?.vacancies ?? 0,
      attPct: attPct, latePct: latePct, ot: ot, leaves: leave,
      joined, left,
      workHrs: workDays ? (workMin / 60) / workDays : 0,
      efficiency,
    });

    // Daily trend scoped to this department
    const scoped = members;
    const daily = dailyTrend(attendance, scoped, 30).map((d) => {
      // Recompute presence for members only
      const dayObj = attendance[d.date] || {};
      const ids = new Set(scoped.map((e) => e.id));
      const recs = Object.entries(dayObj).filter(([id]) => ids.has(id)).map(([, r]) => r);
      return { date: d.date, ...dayStats(Object.fromEntries(recs.map((r, i) => [i, r])), scoped) };
    });
    trendChart._update(daily.map((d) => d.date.slice(5)), [
      { label: "Present", data: daily.map((d) => d.present), color: C.ok, fill: true },
      { label: "Absent", data: daily.map((d) => d.absent), color: C.bad },
    ]);

    const bySection = groupAttendance(attendance, members, dates, "section");
    secChart._update(bySection.map((s) => s.name), [
      { label: "Attendance %", data: bySection.map((s) => Number(s.attendancePct.toFixed(1))), perBarColor: true },
    ]);

    tableHost.replaceChildren(dataTable({
      title: `Team — ${dept}`,
      exportName: `department_${dept}`,
      pageSize: 15,
      onRowClick: (r) => { location.hash = `#/employees/${encodeURIComponent(r.id)}`; },
      columns: [
        { key: "id", label: "ID" },
        { key: "name", label: "Name" },
        { key: "section", label: "Section" },
        { key: "designation", label: "Designation" },
        { key: "present", label: "Present", align: "right" },
        { key: "absent", label: "Absent", align: "right" },
        { key: "late", label: "Late", align: "right" },
        { key: "otHours", label: "OT", align: "right", render: (r) => fmtNum(r.otHours, 1), exportVal: (r) => r.otHours.toFixed(1) },
        {
          key: "attendancePct", label: "Att %", align: "right",
          render: (r) => el("strong", { class: r.attendancePct >= 95 ? "text-ok" : r.attendancePct >= 85 ? "text-warn" : "text-bad" }, fmtPct(r.attendancePct)),
          exportVal: (r) => r.attendancePct.toFixed(1),
        },
      ],
      rows: perEmp,
    }));
  });
}
