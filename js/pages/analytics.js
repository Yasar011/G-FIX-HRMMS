/**
 * Analytics page — the full chart gallery: yearly trends, every dimension
 * breakdown (section/buyer/module), distributions and movement analysis.
 */
import { pageWatchAll } from "../lib/store.js";
import { chartCard } from "../lib/charts.js";
import { filterBar } from "../components/filters.js";
import { el, ym, fmtMonth, lastMonths, flattenNested, groupBy, yearsSince, sum } from "../lib/utils.js";
import {
  empList, activeEmps, monthlyTrend, monthDates, groupAttendance, headcountTrend,
  movementTrend, attritionStats, budgetStats, distribution, AGE_BANDS, EXP_BANDS,
} from "../lib/metrics.js";
import { exportElementPNG } from "../lib/export.js";

const C = { ok: "#34d399", warn: "#fbbf24", bad: "#f87171", info: "#38bdf8", brand: "#6366f1", violet: "#a78bfa", pink: "#f472b6" };

export async function render(root) {
  let view = { month: ym() };

  const filters = filterBar([
    { id: "month", label: "Analysis month", type: "month", value: view.month },
  ], (v) => { Object.assign(view, v); refresh(); },
    el("button", { class: "btn btn-sm", onclick: () => exportElementPNG(root, "analytics") }, "📷 Snapshot"));

  const charts = {
    yearly: chartCard({ title: "Yearly Attendance Trend (24 months)", type: "line", datasets: [] }),
    section: chartCard({ title: "Section Attendance %", type: "bar", options: { indexAxis: "y", scales: { x: { max: 100, beginAtZero: true } } }, datasets: [] }),
    buyer: chartCard({ title: "Buyer Attendance %", type: "bar", options: { indexAxis: "y", scales: { x: { max: 100, beginAtZero: true } } }, datasets: [] }),
    module: chartCard({ title: "Module Attendance %", type: "bar", options: { indexAxis: "y", scales: { x: { max: 100, beginAtZero: true } } }, datasets: [] }),
    leave: chartCard({ title: "Leave Analysis (12 months)", type: "bar", datasets: [] }),
    attrition: chartCard({ title: "Attrition Trend", type: "bar", datasets: [] }),
    movement: chartCard({ title: "Joining vs Resignation", type: "line", datasets: [] }),
    headcount: chartCard({ title: "Headcount Trend", type: "line", datasets: [] }),
    budgetUtil: chartCard({ title: "Budget Utilization %", type: "bar", datasets: [] }),
    exp: chartCard({ title: "Experience Distribution", type: "bar", datasets: [] }),
    age: chartCard({ title: "Age Distribution", type: "bar", datasets: [] }),
    category: chartCard({ title: "Employee Category Distribution", type: "doughnut", datasets: [] }),
  };

  root.append(
    el("div", { class: "page-head" }, el("h3", {}, "Advanced Analytics")),
    filters,
    el("div", { class: "grid grid-2" }, charts.yearly, charts.headcount),
    el("div", { class: "grid grid-3" }, charts.section, charts.buyer, charts.module),
    el("div", { class: "grid grid-2" }, charts.leave, charts.attrition),
    el("div", { class: "grid grid-2" }, charts.movement, charts.budgetUtil),
    el("div", { class: "grid grid-3" }, charts.exp, charts.age, charts.category));

  let cache = null;
  pageWatchAll(["employees", "attendance", "leaves", "attrition", "budget"], (data) => { cache = data; refresh(); });

  function refresh() {
    if (!cache) return;
    const employees = empList(cache.employees);
    const active = activeEmps(employees);
    const attendance = cache.attendance || {};
    const dates = monthDates(attendance, view.month);

    const yearly = monthlyTrend(attendance, employees, 24).filter((m) => m.days > 0);
    charts.yearly._update(yearly.map((m) => fmtMonth(m.month)), [
      { label: "Attendance %", data: yearly.map((m) => Number(m.attendancePct.toFixed(1))), color: C.brand, fill: true },
    ]);

    for (const [key, dim] of [["section", "section"], ["buyer", "buyer"], ["module", "module"]]) {
      const g = groupAttendance(attendance, employees, dates, dim).filter((x) => x.name !== "—");
      charts[key]._update(g.map((x) => x.name), [
        { label: "Attendance %", data: g.map((x) => Number(x.attendancePct.toFixed(1))), perBarColor: true },
      ]);
    }

    const months = lastMonths(12);
    const approvedLeaves = flattenNested(cache.leaves, "empId").filter((l) => l.status === "approved");
    const types = [...new Set(approvedLeaves.map((l) => l.type || "Other"))];
    charts.leave._update(months.map(fmtMonth), types.map((t, i) => ({
      label: t,
      data: months.map((m) => approvedLeaves.filter((l) => l.type === t && l.from?.startsWith(m)).reduce((s, l) => s + (Number(l.days) || 0), 0)),
    })));

    const att = attritionStats(cache.attrition, employees);
    charts.attrition._update(months.map(fmtMonth), [
      { label: "Exits", data: months.map((m) => att.list.filter((a) => a.lastDay?.startsWith(m)).length), color: C.bad },
    ]);

    const mv = movementTrend(employees, cache.attrition, 12);
    charts.movement._update(mv.map((m) => fmtMonth(m.month)), [
      { label: "Joined", data: mv.map((m) => m.joined), color: C.ok, fill: true },
      { label: "Left", data: mv.map((m) => m.left), color: C.bad },
    ]);

    const hc = headcountTrend(employees, 12);
    charts.headcount._update(hc.map((h) => fmtMonth(h.month)), [
      { label: "Headcount", data: hc.map((h) => h.count), color: C.violet, fill: true },
    ]);

    const bu = budgetStats(cache.budget?.[view.month], employees).filter((b) => b.budget > 0);
    charts.budgetUtil._update(bu.map((b) => b.department), [{
      label: "Utilization %",
      data: bu.map((b) => Number(Math.min(b.utilization, 150).toFixed(1))),
      backgroundColor: bu.map((b) => b.utilization > 100 ? C.bad : b.utilization >= 90 ? C.ok : C.warn),
    }]);

    const exp = distribution(active, (e) => e.doj ? yearsSince(e.doj) : null, EXP_BANDS);
    charts.exp._update(exp.map((x) => x.label), [{ label: "Employees", data: exp.map((x) => x.count), color: C.info }]);

    const ages = distribution(active, (e) => e.dob ? yearsSince(e.dob) : null, AGE_BANDS);
    charts.age._update(ages.map((x) => x.label), [{ label: "Employees", data: ages.map((x) => x.count), color: C.pink }]);

    const cats = [...groupBy(active, (e) => e.category || "—")];
    charts.category._update(cats.map(([c]) => c), [{ data: cats.map(([, items]) => items.length) }]);
  }
}
