/**
 * Home dashboard — realtime KPI wall + core trend charts.
 * Everything re-computes automatically whenever employees, attendance,
 * budget, attrition or vacancies change in Firebase.
 */
import { pageWatchAll } from "../lib/store.js";
import { kpiGrid } from "../components/kpi.js";
import { chartCard } from "../lib/charts.js";
import { filterBar } from "../components/filters.js";
import { el, fmtNum, fmtMoney, fmtMonth, ym, today, sum, dateRange, fmtDate } from "../lib/utils.js";
import {
  empList, activeEmps, workforceStats, periodStats, dailyTrend, monthlyTrend,
  groupAttendance, monthDates, otTrend, headcountTrend, budgetSummary,
  distribution, AGE_BANDS,
} from "../lib/metrics.js";
import { exportElementPNG } from "../lib/export.js";
import { deptScope } from "../lib/auth.js";

const C = { ok: "#34d399", warn: "#fbbf24", bad: "#f87171", info: "#38bdf8", brand: "#6366f1", violet: "#a78bfa", pink: "#f472b6", orange: "#fb923c" };

export async function render(root) {
  const month = ym();
  const scope = deptScope(); // dept managers see their department only
  const view = { from: today(), to: today() };

  /* ---------- navigation helpers ---------- */
  const go = (hash) => () => { location.hash = hash; };

  /* ---------- KPI sections ---------- */
  const todayKpis = kpiGrid([
    { id: "present", label: "Present", icon: "✅", color: C.ok, onClick: go("#/attendance") },
    { id: "absent", label: "Absent", icon: "🚫", color: C.bad, onClick: go("#/attendance") },
    { id: "leave", label: "Leave", icon: "🌴", color: C.info, onClick: go("#/leaves") },
    { id: "late", label: "Late", icon: "⏰", color: C.warn, onClick: go("#/attendance") },
    { id: "earlyOut", label: "Early Out", icon: "🚪", color: C.warn, onClick: go("#/attendance") },
    { id: "halfDay", label: "Half Day", icon: "🌗", color: C.violet, onClick: go("#/attendance") },
    { id: "wfh", label: "Work From Home", icon: "🏡", color: C.info, onClick: go("#/attendance") },
    { id: "holiday", label: "Holiday", icon: "🎌", color: C.pink, onClick: go("#/attendance") },
    { id: "attPct", label: "Attendance %", icon: "📊", color: C.brand, dp: 1, suffix: "%", onClick: go("#/attendance") },
    { id: "avgWork", label: "Avg Working Hours", icon: "🕒", color: C.brand, dp: 1, onClick: go("#/attendance") },
  ]);

  const workforceKpis = kpiGrid([
    { id: "headcount", label: "Current Headcount", icon: "👥", color: C.brand, onClick: go("#/employees") },
    { id: "budgetHc", label: "Budget Headcount", icon: "🎯", color: C.violet, onClick: go("#/budget") },
    { id: "vacancies", label: "Vacancies", icon: "🪑", color: C.warn, onClick: go("#/recruitment") },
    { id: "filledPct", label: "Budget Filled %", icon: "📦", color: C.ok, onClick: go("#/budget") },
    { id: "exceeded", label: "Budget Exceeded (Depts)", icon: "🚨", color: C.bad, onClick: go("#/budget") },
    { id: "departments", label: "Departments", icon: "🏭", color: C.info, onClick: go("#/departments") },
    { id: "newJoiners", label: "New Joiners (MTD)", icon: "🎉", color: C.ok, onClick: go("#/employees") },
    { id: "resigned", label: "Resigned (MTD)", icon: "👋", color: C.bad, onClick: go("#/attrition") },
    { id: "notice", label: "Notice Period", icon: "📮", color: C.warn, onClick: go("#/attrition") },
    { id: "inactive", label: "Inactive Employees", icon: "💤", color: C.bad, onClick: go("#/employees") },
  ]);

  const demoKpis = kpiGrid([
    { id: "male", label: "Male Employees", icon: "👨", color: C.info, onClick: go("#/employees") },
    { id: "female", label: "Female Employees", icon: "👩", color: C.pink, onClick: go("#/employees") },
    { id: "permanent", label: "Permanent", icon: "🧷", color: C.ok, onClick: go("#/employees") },
    { id: "contract", label: "Contract", icon: "📄", color: C.warn, onClick: go("#/employees") },
    { id: "local", label: "Local", icon: "🏠", color: C.brand, onClick: go("#/employees") },
    { id: "expat", label: "Expat", icon: "✈️", color: C.violet, onClick: go("#/employees") },
    { id: "categories", label: "Employee Categories", icon: "🏷️", color: C.info, onClick: go("#/employees") },
    { id: "avgExp", label: "Avg Experience (yrs)", icon: "📚", color: C.brand, dp: 1, onClick: go("#/employees") },
    { id: "avgAge", label: "Avg Age (yrs)", icon: "🎂", color: C.pink, dp: 1, onClick: go("#/employees") },
    { id: "birthdays", label: "Birthdays (7 days)", icon: "🎈", color: C.pink, onClick: go("#/employees") },
    { id: "anniversaries", label: "Anniversaries (7 days)", icon: "🏅", color: C.ok, onClick: go("#/employees") },
  ]);

  const otKpis = kpiGrid([
    { id: "avgOt", label: "Avg OT Hours (MTD)", icon: "⏱️", color: C.warn, dp: 1, onClick: go("#/overtime") },
    { id: "otToday", label: "Today's OT Cost", icon: "💸", color: C.orange, onClick: go("#/overtime") },
    { id: "otMonth", label: "Monthly OT Cost", icon: "💰", color: C.bad, onClick: go("#/overtime") },
  ]);

  /* ---------- Charts ---------- */
  const dailyChart = chartCard({ title: "Daily Attendance Trend (30 days)", type: "line", datasets: [] });
  const monthlyChart = chartCard({ title: "Monthly Attendance Trend (12 months)", type: "bar", datasets: [] });
  const deptChart = chartCard({ title: "Department Attendance % (This Month)", type: "bar", options: { indexAxis: "y", scales: { x: { beginAtZero: true, max: 100 } } }, datasets: [] });
  const pvaChart = chartCard({ title: "Present vs Absent (Today)", type: "doughnut", datasets: [] });
  const otChart = chartCard({ title: "OT Trend (This Month)", type: "line", datasets: [] });
  const hcChart = chartCard({ title: "Headcount Trend (12 months)", type: "line", datasets: [] });
  const genderChart = chartCard({ title: "Gender Distribution", type: "doughnut", datasets: [] });
  const ageChart = chartCard({ title: "Age Distribution", type: "bar", datasets: [] });

  const periodLabel = el("div", { class: "section-label" }, "Today");
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
      el("h3", {}, `Plant Overview — ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`),
      scope ? el("span", { class: "chip" }, `Scope: ${scope}`) : null,
      el("div", { class: "spacer" }),
      el("button", { class: "btn btn-sm", onclick: () => exportElementPNG(root, "dashboard") }, "📷 Snapshot")),
    dateFilters,
    periodLabel,
    todayKpis,
    el("div", { class: "section-label" }, "Workforce & Budget"),
    workforceKpis,
    el("div", { class: "section-label" }, "Overtime"),
    otKpis,
    el("div", { class: "section-label" }, "Demographics"),
    demoKpis,
    el("div", { class: "section-label" }, "Trends"),
    el("div", { class: "grid grid-2" }, dailyChart, monthlyChart),
    el("div", { class: "grid grid-2" }, deptChart, pvaChart),
    el("div", { class: "grid grid-2" }, otChart, hcChart),
    el("div", { class: "grid grid-2" }, genderChart, ageChart),
  );

  /* ---------- Realtime recompute ---------- */
  let cache = null;
  pageWatchAll(["employees", "attendance", `budget/${month}`, "attrition", "settings"], (data) => {
    cache = data;
    recompute();
  });

  function recompute() {
    if (!cache) return;
    const data = cache;
    let employees = empList(data.employees);
    if (scope) employees = employees.filter((e) => e.department === scope);
    const attendance = data.attendance || {};
    const settings = data.settings || {};
    const otRate = Number(settings.otRate) || 0;
    const currency = settings.currency || "LKR";

    /* Selected period (date range, default today→today) */
    const from = view.from <= view.to ? view.from : view.to;
    const to = view.from <= view.to ? view.to : view.from;
    const pDates = dateRange(from, to);
    const isToday = from === today() && to === today();
    periodLabel.textContent = isToday ? "Today" : `Selected Period — ${fmtDate(from)} → ${fmtDate(to)}`;

    const t = periodStats(attendance, employees, pDates);
    todayKpis._update({
      present: t.present, absent: t.absent, leave: t.leave, late: t.late,
      earlyOut: t.earlyOut, halfDay: t.halfDay, wfh: t.wfh, holiday: t.holiday,
      attPct: { value: t.attendancePct, sub: `${t.marked} marked · ${t.activeDays} day(s)` },
      avgWork: { value: t.avgWorkMin / 60, sub: isToday ? "hours (today)" : "avg hours/record" },
    });

    /* Workforce + budget */
    const w = workforceStats(employees);
    const b = budgetSummary(data[`budget/${month}`], employees);
    workforceKpis._update({
      headcount: w.headcount, budgetHc: b.budget, vacancies: b.vacancies,
      filledPct: Number(b.filledPct.toFixed(1)), exceeded: b.exceeded,
      departments: w.departments, newJoiners: w.newJoiners,
      resigned: w.resignedThisMonth, notice: w.notice, inactive: w.inactive,
    });

    demoKpis._update({
      male: w.male, female: w.female, permanent: w.permanent, contract: w.contract,
      local: w.local, expat: w.expat, categories: w.categories,
      avgExp: Number(w.avgExperience.toFixed(1)), avgAge: Number(w.avgAge.toFixed(1)),
      birthdays: w.birthdays7d, anniversaries: w.anniversaries7d,
    });

    /* OT — over the selected range */
    const ot = otTrend(attendance, pDates, employees, otRate);
    const periodOtHours = sum(ot, (o) => o.hours);
    otKpis._update({
      avgOt: { value: Number((w.headcount ? periodOtHours / w.headcount : 0).toFixed(1)), sub: "per employee (range)" },
      otToday: { value: fmtMoney(sum(ot, (o) => o.cost), currency), sub: `${fmtNum(periodOtHours, 1)} hrs (range)` },
      otMonth: { value: fmtMoney(sum(otTrend(attendance, monthDates(attendance, month), employees, otRate), (o) => o.cost), currency), sub: "this month" },
    });

    /* Charts */
    const daily = dailyTrend(attendance, employees, 30);
    dailyChart._update(daily.map((d) => d.date.slice(5)), [
      { label: "Present", data: daily.map((d) => d.present), color: C.ok, fill: true },
      { label: "Absent", data: daily.map((d) => d.absent), color: C.bad },
      { label: "Leave", data: daily.map((d) => d.leave), color: C.info },
    ]);

    const monthly = monthlyTrend(attendance, employees, 12);
    monthlyChart._update(monthly.map((m) => fmtMonth(m.month)), [
      { label: "Attendance %", data: monthly.map((m) => Number(m.attendancePct.toFixed(1))), color: C.brand },
    ]);

    // Department attendance % over the selected range (department-wise, date-aware).
    deptChart._title(isToday ? "Department Attendance % (Today)" : "Department Attendance % (Selected Range)");
    const byDept = groupAttendance(attendance, employees, pDates, "department");
    deptChart._update(byDept.map((d) => d.name), [
      { label: "Attendance %", data: byDept.map((d) => Number(d.attendancePct.toFixed(1))), perBarColor: true },
    ]);

    pvaChart._title(isToday ? "Present vs Absent (Today)" : "Present vs Absent (Range)");
    pvaChart._update(["Present", "Absent", "Leave", "Half Day", "WFH"], [
      { data: [t.present, t.absent, t.leave, t.halfDay, t.wfh], backgroundColor: [C.ok, C.bad, C.info, C.violet, C.pink] },
    ]);

    otChart._update(ot.map((o) => o.date.slice(5)), [
      { label: "OT Hours", data: ot.map((o) => Number(o.hours.toFixed(1))), color: C.warn, fill: true },
    ]);

    const hc = headcountTrend(employees, 12);
    hcChart._update(hc.map((h) => fmtMonth(h.month)), [
      { label: "Headcount", data: hc.map((h) => h.count), color: C.brand, fill: true },
    ]);

    genderChart._update(["Male", "Female"], [{ data: [w.male, w.female], backgroundColor: [C.info, C.pink] }]);

    const ages = distribution(activeEmps(employees), (e) => e.dob ? Math.floor((Date.now() - new Date(e.dob)) / (365.25 * 86400e3)) : null, AGE_BANDS);
    ageChart._update(ages.map((a) => a.label), [{ label: "Employees", data: ages.map((a) => a.count), color: C.violet }]);
  }
}
