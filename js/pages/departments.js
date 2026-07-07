/**
 * Departments module.
 *
 * Route: #/departments          → overview cards (one per department)
 *        #/departments/{name}   → department detail page with KPIs + charts
 */
import { pageWatch, pageWatchAll } from "../lib/store.js";
import { el, esc, ym, fmtPct, fmtNum, uniq, groupBy, toList, lastMonths, fmtMonth, sum } from "../lib/utils.js";
import { kpiGrid } from "../components/kpi.js";
import { chartCard } from "../lib/charts.js";
import { dataTable } from "../components/table.js";
import { emptyState, progressBar, badge } from "../lib/ui.js";
import {
  empList, activeEmps, employeeAttendance, monthDates, groupAttendance,
  budgetStats, dailyTrend, dayStats, absenteeStats,
} from "../lib/metrics.js";
import { deptScope } from "../lib/auth.js";

/** Department-jump dropdown, shared by overview and detail. Navigates on change. */
function deptSelect(departments, current) {
  const sel = el("select", {
    style: { minWidth: "200px" },
    onchange: (e) => { if (e.target.value) location.hash = `#/departments/${encodeURIComponent(e.target.value)}`; },
  },
    el("option", { value: "" }, "Jump to department…"),
    ...departments.map((d) => el("option", { value: d, selected: d === current ? "" : null }, d)));
  if (current) sel.value = current;
  return el("label", { class: "field", style: { margin: 0, minWidth: "220px" } }, el("span", {}, "Department"), sel);
}

const C = { ok: "#34d399", warn: "#fbbf24", bad: "#f87171", info: "#38bdf8", brand: "#6366f1", violet: "#a78bfa" };

/** Case/whitespace-insensitive name key, matching the budgetStats() department join. */
function normName(s) { return String(s ?? "").trim().toLowerCase(); }

/** Count department members by a selector (designation, nationality, …), keyed normalized. */
function actualCountsBy(members, sel) {
  const map = new Map();
  for (const e of members) {
    const v = sel(e);
    if (!v) continue;
    const k = normName(v);
    map.set(k, (map.get(k) || 0) + 1);
  }
  return map;
}

/**
 * Small card listing a budget breakdown (designation / category / local-expat)
 * sorted by budget count descending. Only populated when the budget was
 * imported from a wide multi-month HRIS export — the simple Department|Budget
 * template has no such detail, so an empty state points users at what to
 * upload instead of showing a broken/empty table.
 *
 * @param {Array<{name,count}>|null} budgetItems  from budgetStats()'s per-dimension breakdown
 * @param {Map<string,number>|null} actualMap  normalized-name → actual headcount, or null when
 *   there's no comparable field on the employee record (shows budget-only with a note)
 */
const MIN_MATCH_RATE = 0.3; // below this, the two files' naming is too different to compare honestly

function breakdownCard(title, icon, budgetItems, actualMap = null, noCompareNote = "") {
  const items = (budgetItems || []).slice().sort((a, b) => b.count - a.count);
  let showActual = !!actualMap;
  let note = noCompareNote;

  let rows = items.map((it) => ({ name: it.name, budget: it.count, actual: actualMap ? (actualMap.get(normName(it.name)) || 0) : null }));

  if (actualMap) {
    const totalActual = sum([...actualMap.values()]);
    const matchedActual = sum(rows, (r) => r.actual);
    const matchRate = totalActual ? matchedActual / totalActual : 1;
    if (totalActual > 0 && matchRate < MIN_MATCH_RATE) {
      // Names don't align between the two files enough to compare honestly —
      // fall back to budget-only rather than show a wall of false zeros.
      showActual = false;
      rows = items.map((it) => ({ name: it.name, budget: it.count, actual: null }));
      note = `Actual headcount isn't shown — the names in your attendance and budget files don't match closely enough to compare (only ${Math.round(matchRate * 100)}% matched).`;
    } else {
      // Any actual headcount that doesn't match a budgeted name — surface it
      // as a rollup row rather than silently dropping real people.
      const unmatchedTotal = totalActual - matchedActual;
      if (unmatchedTotal) rows.push({ name: "Other (not in budget file)", budget: 0, actual: unmatchedTotal, dim: true });
    }
  }

  return el("div", { class: "card" },
    el("div", { class: "card-head" },
      el("h4", {}, `${icon} ${title}`),
      !showActual && actualMap ? badge("Budget only", "dim") : null),
    rows.length
      ? el("div", {},
          el("div", { class: "stat-row", style: { fontSize: "11px" } },
            el("span", { class: "muted" }, "Role"),
            showActual
              ? el("span", { class: "muted", style: { display: "flex", gap: "14px" } }, el("span", {}, "Budget"), el("span", {}, "Actual"))
              : el("span", { class: "muted" }, "Budget")),
          ...rows.map((r) => el("div", { class: "stat-row" },
            el("span", { class: r.dim ? "muted" : "" }, r.name),
            showActual
              ? el("span", { style: { display: "flex", gap: "14px", minWidth: "90px", justifyContent: "flex-end" } },
                  el("span", {}, fmtNum(r.budget)),
                  el("strong", { class: r.actual > r.budget ? "text-bad" : r.actual < r.budget ? "text-warn" : "text-ok" }, fmtNum(r.actual)))
              : el("strong", {}, fmtNum(r.budget)))))
      : el("p", { class: "muted", style: { fontSize: "12.5px" } },
          "No breakdown for this month — upload a detailed multi-month budget export to see this."),
    note ? el("p", { class: "muted", style: { fontSize: "11.5px", marginTop: "10px" } }, note) : null);
}

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
  const selectHost = el("div");
  const host = el("div", { class: "grid grid-3" });
  root.append(
    el("div", { class: "page-head" }, el("h3", {}, "Departments"), el("div", { class: "spacer" }), selectHost),
    host);

  pageWatchAll(["employees", "attendance", `budget/${month}`, "attrition"], (data) => {
    const employees = empList(data.employees);
    const attendance = data.attendance || {};
    const dates = monthDates(attendance, month);
    const budget = budgetStats(data[`budget/${month}`], employees);
    const attrition = toList(data.attrition, "_key");
    const groups = groupBy(activeEmps(employees), (e) => e.department || "—");
    selectHost.replaceChildren(deptSelect([...groups.keys()].sort(), null));

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
  let month = ym();

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
  const selectHost = el("div");
  const budgetLabel = el("div", { class: "section-label" }, `Detailed Budget — ${month}`);
  const budgetBreakdownHost = el("div", { class: "grid grid-3" });
  const absenteeHost = el("div");
  const tableHost = el("div");
  const monthInput = el("input", { type: "month", value: month, onchange: (e) => { month = e.target.value; watchBudgetMonth(); refresh(); } });

  root.append(
    el("div", { class: "page-head" },
      el("button", { class: "btn btn-ghost", onclick: () => { location.hash = "#/departments"; } }, "← All departments"),
      el("h3", {}, `🏭 ${dept}`),
      el("div", { class: "spacer" }),
      el("label", { class: "field", style: { margin: 0 } }, el("span", {}, "Budget month"), monthInput),
      selectHost),
    kpis,
    budgetLabel,
    budgetBreakdownHost,
    el("div", { class: "grid grid-2" }, trendChart, secChart),
    absenteeHost,
    tableHost);

  let cache = null; // {employees, attendance, attrition, leaves} — stable paths, independent of the month picker
  let budgetMonthObj = null;
  let unwatchBudget = null;

  function watchBudgetMonth() {
    unwatchBudget?.();
    unwatchBudget = pageWatch(`budget/${month}`, (v) => { budgetMonthObj = v; refresh(); });
  }
  watchBudgetMonth();
  pageWatchAll(["employees", "attendance", "attrition", "leaves"], (data) => { cache = data; refresh(); });

  function refresh() {
    if (!cache) return;
    const data = cache;
    budgetLabel.textContent = `Detailed Budget — ${month}`;
    const all = empList(data.employees);
    const members = activeEmps(all).filter((e) => e.department === dept);
    const attendance = data.attendance || {};
    const dates = monthDates(attendance, month);
    selectHost.replaceChildren(deptSelect(uniq(activeEmps(all), (e) => e.department), dept));

    let present = 0, marked = 0, late = 0, ot = 0, leave = 0, workMin = 0, workDays = 0;
    const perEmp = members.map((e) => {
      const a = employeeAttendance(e.id, attendance, dates);
      present += a.present; marked += a.marked; late += a.late;
      ot += a.otHours; leave += a.leave; workMin += a.workMin; workDays += a.present;
      return { ...e, ...a };
    });
    const attPct = marked ? (present / marked) * 100 : 0;
    const latePct = marked ? (late / marked) * 100 : 0;
    const b = budgetStats(budgetMonthObj, all).find((x) => x.department === dept);
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

    budgetBreakdownHost.replaceChildren(
      breakdownCard("Budget by Designation", "🧾", b?.designations, actualCountsBy(members, (e) => e.designation)),
      breakdownCard("Budget by Category", "🏷️", b?.categories, null,
        "No comparable field on employee records — this budget file's category (Staff / Associate-Direct / …) doesn't match anything captured from attendance uploads, so only the budgeted split is shown."),
      breakdownCard("Budget by Local / Expat", "🌍", b?.localExpat, actualCountsBy(members, (e) => e.nationality)));

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

    // Top 3 frequent absentees within this department, this month.
    const top3 = absenteeStats(attendance, members, month).filter((a) => a.absents > 0).slice(0, 3);
    absenteeHost.replaceChildren(el("div", { class: "card" },
      el("div", { class: "card-head" },
        el("h4", {}, "🚫 Top 3 Frequent Absentees"),
        el("div", { class: "spacer" }),
        el("small", { class: "muted" }, month)),
      top3.length
        ? el("div", {}, ...top3.map((a, i) => el("div", { class: "stat-row" },
            el("span", {},
              el("strong", {}, `${i + 1}. `),
              el("a", { href: `#/employees/${encodeURIComponent(a.id)}` }, a.name),
              el("small", { class: "muted" }, ` · ${a.section || "—"}`)),
            el("span", { style: { display: "flex", gap: "8px", alignItems: "center" } },
              a.streak > 1 ? badge(`${a.streak} in a row`, "warn") : null,
              badge(`${a.absents} absent`, "bad")))))
        : emptyState("✅", "No absences this month", "Nobody in this department has been marked absent yet.")));

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
  }
}
