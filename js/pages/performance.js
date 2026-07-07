/**
 * Performance module — composite performance scoring per employee derived
 * from attendance discipline (attendance %, punctuality, absence) plus
 * frequent-absentee analytics with heatmap.
 *
 * Score = attendance% − late penalty − absent penalty (clamped 0–100):
 *   ≥ 90 Excellent · ≥ 75 Good · ≥ 60 Needs attention · < 60 Critical
 */
import { pageWatchAll } from "../lib/store.js";
import { kpiGrid } from "../components/kpi.js";
import { chartCard } from "../lib/charts.js";
import { dataTable } from "../components/table.js";
import { filterBar, allOptions } from "../components/filters.js";
import { badge, emptyState } from "../lib/ui.js";
import { el, ym, fmtPct, uniq, clamp, avg, parseYmd } from "../lib/utils.js";
import { empList, activeEmps, employeeAttendance, monthDates, absenteeStats } from "../lib/metrics.js";

const C = { ok: "#34d399", warn: "#fbbf24", bad: "#f87171", brand: "#6366f1", violet: "#a78bfa" };

/** Grade a 0–100 performance score. */
function gradeOf(score) {
  if (score >= 90) return { label: "Excellent", tone: "ok" };
  if (score >= 75) return { label: "Good", tone: "info" };
  if (score >= 60) return { label: "Needs attention", tone: "warn" };
  return { label: "Critical", tone: "bad" };
}

export async function render(root) {
  let view = { month: ym(), dept: "" };

  const kpis = kpiGrid([
    { id: "avgScore", label: "Avg Performance Score", icon: "🚀", color: C.brand, dp: 1 },
    { id: "excellent", label: "Excellent (90+)", icon: "🏆", color: C.ok },
    { id: "critical", label: "Critical (<60)", icon: "🚨", color: C.bad },
    { id: "abs3", label: "Absent > 3 days", icon: "📵", color: C.warn },
    { id: "abs5", label: "Absent > 5 days", icon: "⛔", color: C.bad },
    { id: "abs10", label: "Absent > 10 days", icon: "🆘", color: C.bad },
  ]);

  const filters = filterBar([
    { id: "month", label: "Month", type: "month", value: view.month },
    { id: "dept", label: "Department", type: "select", options: allOptions([]) },
  ], (v) => { Object.assign(view, v); refresh(); });

  const distChart = chartCard({ title: "Performance Distribution", type: "bar", datasets: [] });
  const topAbsChart = chartCard({ title: "Top 20 Absentees", type: "bar", options: { indexAxis: "y" }, datasets: [] });
  const heatCard = el("div", { class: "card" },
    el("div", { class: "card-head" }, el("h4", {}, "Absentee Heatmap (employee × day)")),
    el("div", { class: "hm-host" }));
  const tableHost = el("div");

  root.append(
    el("div", { class: "page-head" }, el("h3", {}, "Performance & Discipline")),
    kpis, filters,
    el("div", { class: "grid grid-2" }, distChart, topAbsChart),
    heatCard, tableHost);

  let cache = null;
  pageWatchAll(["employees", "attendance"], (data) => { cache = data; refresh(); });

  function refresh() {
    if (!cache) return;
    let employees = empList(cache.employees);
    const attendance = cache.attendance || {};
    filters._setOptions("dept", allOptions(uniq(activeEmps(employees), (e) => e.department)));
    if (view.dept) employees = employees.filter((e) => e.department === view.dept);

    const dates = monthDates(attendance, view.month);
    const abs = absenteeStats(attendance, employees, view.month);

    const rows = activeEmps(employees).map((e) => {
      const a = employeeAttendance(e.id, attendance, dates);
      const score = a.marked ? clamp(a.attendancePct - a.late * 2 - a.absent * 3, 0, 100) : null;
      return {
        empId: e.id, name: e.name, department: e.department || "—", section: e.section || "—",
        attPct: a.marked ? Number(a.attendancePct.toFixed(1)) : null,
        late: a.late, absent: a.absent, otHours: Number(a.otHours.toFixed(1)),
        score: score == null ? null : Number(score.toFixed(1)),
      };
    }).filter((r) => r.score != null).sort((a, b) => b.score - a.score);

    kpis._update({
      avgScore: avg(rows, (r) => r.score),
      excellent: rows.filter((r) => r.score >= 90).length,
      critical: rows.filter((r) => r.score < 60).length,
      abs3: abs.filter((a) => a.absents > 3).length,
      abs5: abs.filter((a) => a.absents > 5).length,
      abs10: abs.filter((a) => a.absents > 10).length,
    });

    const bands = [["90-100", 90, 101], ["75-89", 75, 90], ["60-74", 60, 75], ["<60", 0, 60]];
    distChart._update(bands.map(([l]) => l), [{
      label: "Employees",
      data: bands.map(([, lo, hi]) => rows.filter((r) => r.score >= lo && r.score < hi).length),
      backgroundColor: [C.ok, "#38bdf8", C.warn, C.bad],
    }]);

    const top20 = abs.filter((a) => a.absents > 0).slice(0, 20);
    topAbsChart._update(top20.map((a) => a.name), [{ label: "Absent days", data: top20.map((a) => a.absents), color: C.bad }]);

    renderHeatmap(top20, dates);

    tableHost.replaceChildren(dataTable({
      title: `Performance Scores — ${view.month}`,
      exportName: `performance_${view.month}`,
      pageSize: 15,
      onRowClick: (r) => { location.hash = `#/employees/${encodeURIComponent(r.empId)}`; },
      columns: [
        { key: "empId", label: "ID" },
        { key: "name", label: "Name" },
        { key: "department", label: "Department" },
        { key: "attPct", label: "Att %", align: "right", render: (r) => fmtPct(r.attPct), exportVal: (r) => r.attPct },
        { key: "late", label: "Late", align: "right" },
        { key: "absent", label: "Absent", align: "right" },
        { key: "otHours", label: "OT Hrs", align: "right" },
        { key: "score", label: "Score", align: "right", render: (r) => el("strong", { class: `text-${gradeOf(r.score).tone === "info" ? "ok" : gradeOf(r.score).tone}` }, String(r.score)) },
        { key: "_grade", label: "Grade", render: (r) => { const g = gradeOf(r.score); return badge(g.label, g.tone); }, exportVal: (r) => gradeOf(r.score).label },
      ],
      rows,
      empty: "No attendance data for this month",
    }));
  }

  /** Employee × day grid where red intensity = absence. */
  function renderHeatmap(top, dates) {
    const host = heatCard.querySelector(".hm-host");
    if (!top.length || !dates.length) {
      host.replaceChildren(emptyState("🌡️", "No absences to map"));
      return;
    }
    // Fixed-size cells (not 1fr) — with few dates uploaded, 1fr columns would
    // stretch to fill the card width and, combined with aspect-ratio:1,
    // produce giant cells. Fixed size + horizontal scroll handles both a
    // 2-day upload and a full 30-day month correctly.
    const CELL = 22;
    const grid = el("div", {
      class: "heatmap",
      style: { gridTemplateColumns: `140px repeat(${dates.length}, ${CELL}px)`, width: "max-content" },
    });
    grid.append(el("div"));
    for (const d of dates) grid.append(el("small", { class: "muted", style: { fontSize: "9px", textAlign: "center" } }, d.slice(8)));
    for (const emp of top.slice(0, 12)) {
      grid.append(el("small", { class: "muted", style: { fontSize: "11px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", alignSelf: "center" } }, emp.name));
      const absSet = new Set(emp.absentDates);
      for (const d of dates) {
        grid.append(el("div", {
          class: "hm-cell",
          title: `${emp.name} · ${d} · ${absSet.has(d) ? "Absent" : "OK"}`,
          style: absSet.has(d) ? { background: "var(--bad)" } : null,
        }));
      }
    }
    host.replaceChildren(el("div", { class: "table-scroll", style: { maxHeight: "none" } }, grid),
      el("div", { class: "hm-legend" },
        el("i", { style: { background: "var(--surface-2)" } }), "Present/other",
        el("i", { style: { background: "var(--bad)" } }), "Absent"));
  }
}
