/**
 * Home dashboard — a compact plant overview focused on AVERAGE ATTENDANCE:
 * today's overall average, per-shift averages and Direct/Indirect averages,
 * plus a couple of trend charts. Everything re-computes automatically
 * whenever employees, attendance, budget or settings change in Firebase.
 */
import { pageWatchAll } from "../lib/store.js";
import { kpiGrid, kpiCard } from "../components/kpi.js";
import { chartCard } from "../lib/charts.js";
import { filterBar } from "../components/filters.js";
import { el, fmtPct, ym, today, dateRange, fmtDate } from "../lib/utils.js";
import {
  empList, workforceStats, periodStats, dailyTrend, groupAttendance, attendanceByShift, budgetSummary,
} from "../lib/metrics.js";
import { exportElementPNG } from "../lib/export.js";
import { deptScope } from "../lib/auth.js";

const C = { ok: "#34d399", warn: "#fbbf24", bad: "#f87171", info: "#38bdf8", brand: "#6366f1", violet: "#a78bfa", pink: "#f472b6" };
const AVG_COLORS = [C.brand, C.info, C.ok, C.warn, C.violet, C.pink];

export async function render(root) {
  const month = ym();
  const scope = deptScope(); // dept managers see their department only
  const view = { from: today(), to: today() };

  const go = (hash) => () => { location.hash = hash; };

  /* ---------- minimal context row ---------- */
  const overviewKpis = kpiGrid([
    { id: "headcount", label: "Headcount", icon: "👥", color: C.brand, onClick: go("#/employees") },
    { id: "present", label: "Present", icon: "✅", color: C.ok, onClick: go("#/attendance") },
    { id: "absent", label: "Absent", icon: "🚫", color: C.bad, onClick: go("#/attendance") },
    { id: "budgetFilled", label: "Budget Filled %", icon: "🎯", color: C.violet, dp: 1, suffix: "%", onClick: go("#/budget") },
  ]);

  /* ---------- the averages section (rebuilt each refresh — shifts are dynamic) ---------- */
  const avgHost = el("div", { class: "grid grid-kpi" });

  /* ---------- charts ---------- */
  const trendChart = chartCard({ title: "Attendance % Trend (30 days)", type: "line", datasets: [] });
  const shiftChart = chartCard({ title: "Attendance % by Shift", type: "bar", options: { scales: { y: { beginAtZero: true, max: 100 } } }, datasets: [] });

  const periodLabel = el("div", { class: "section-label" }, "Average Attendance % — Today");
  const dateFilters = filterBar([
    { id: "from", label: "From", type: "date", value: view.from },
    { id: "to", label: "To", type: "date", value: view.to },
  ], (v) => { Object.assign(view, v); recompute(); },
    el("button", {
      class: "btn btn-sm",
      onclick: () => { view.from = today(); view.to = today(); dateFilters._set("from", view.from); dateFilters._set("to", view.to); recompute(); },
    }, "Today"));

  root.append(
    el("div", { class: "page-head" },
      el("h3", {}, "Plant Overview"),
      scope ? el("span", { class: "chip" }, `Scope: ${scope}`) : null,
      el("div", { class: "spacer" }),
      el("button", { class: "btn btn-sm", onclick: () => exportElementPNG(root, "dashboard") }, "📷 Snapshot")),
    dateFilters,
    overviewKpis,
    periodLabel,
    avgHost,
    el("div", { class: "grid grid-2" }, trendChart, shiftChart),
  );

  /* ---------- realtime recompute ---------- */
  let cache = null;
  pageWatchAll(["employees", "attendance", `budget/${month}`, "settings"], (data) => {
    cache = data;
    recompute();
  });

  function recompute() {
    if (!cache) return;
    const data = cache;
    let employees = empList(data.employees);
    if (scope) employees = employees.filter((e) => e.department === scope);
    const attendance = data.attendance || {};

    /* Selected period (date range, default today→today) */
    const from = view.from <= view.to ? view.from : view.to;
    const to = view.from <= view.to ? view.to : view.from;
    const pDates = dateRange(from, to);
    const isToday = from === today() && to === today();
    periodLabel.textContent = `Average Attendance % — ${isToday ? "Today" : `${fmtDate(from)} → ${fmtDate(to)}`}`;

    const t = periodStats(attendance, employees, pDates);
    const w = workforceStats(employees);
    const b = budgetSummary(data[`budget/${month}`], employees);
    overviewKpis._update({
      headcount: w.headcount, present: t.present, absent: t.absent,
      budgetFilled: Number(b.filledPct.toFixed(1)),
    });

    /* Average attendance %: overall, per shift, per grade (Direct/Indirect) */
    const byShift = attendanceByShift(attendance, employees, pDates);
    const byGrade = groupAttendance(attendance, employees, pDates, "grade");
    const cards = [
      { name: "Overall", attendancePct: t.attendancePct },
      ...byShift.map((s) => ({ name: s.name === "—" ? "No Shift" : `Shift ${s.name}`, attendancePct: s.attendancePct })),
      ...byGrade.map((g) => ({ name: g.name, attendancePct: g.attendancePct })),
    ];
    avgHost.replaceChildren(...cards.map((c, i) => kpiCard({
      label: c.name, value: c.attendancePct, dp: 1, suffix: "%",
      icon: "📊", color: AVG_COLORS[i % AVG_COLORS.length], onClick: go("#/attendance"),
    })));

    /* Charts */
    const daily = dailyTrend(attendance, employees, 30);
    trendChart._update(daily.map((d) => d.date.slice(5)), [
      { label: "Attendance %", data: daily.map((d) => Number(d.attendancePct.toFixed(1))), color: C.brand, fill: true },
    ]);

    shiftChart._update(byShift.map((s) => s.name === "—" ? "No Shift" : s.name), [
      { label: "Attendance %", data: byShift.map((s) => Number(s.attendancePct.toFixed(1))), perBarColor: true },
    ]);
  }
}
