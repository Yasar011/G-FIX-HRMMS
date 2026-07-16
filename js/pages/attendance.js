/**
 * Attendance module.
 *
 *  - Excel upload (drag & drop) → parsed with SheetJS → written to
 *    attendance/{date}/{empId} → every dashboard updates in realtime.
 *  - Daily view with date/department/shift filters.
 *  - Monthly summary per employee (present/absent/late/leave/OT/attendance %).
 *  - Per-employee history drill-down.
 *
 * Accepted sheet columns (case/space-insensitive, extras ignored):
 *   EmpID | Name | Date | Status | In | Out | Shift | OT
 * Status accepts P/A/L/HD/WFH/H or the full words (Present, Absent, Leave,
 * Half Day, Work From Home, Holiday). In/Out times are used to derive working
 * minutes, late and early-out flags when Status is absent.
 */
import { pageWatch } from "../lib/store.js";
import { can } from "../lib/auth.js";
import { toast, modal, badge, statusTone, emptyState, friendlyDbError } from "../lib/ui.js";
import { dataTable } from "../components/table.js";
import { filterBar, allOptions } from "../components/filters.js";
import { kpiGrid } from "../components/kpi.js";
import { dropZone } from "../components/uploader.js";
import { parseAttendanceWorkbook, importAttendance } from "../lib/importers.js";
import {
  el, ym, today, fmtDate, fmtNum, fmtPct, minToHm, uniq, toList, timeAgo, addDays, dateRange,
} from "../lib/utils.js";
import { empList, activeEmps, dayStats, employeeAttendance, monthDates, ATT_STATUS } from "../lib/metrics.js";

const C = { ok: "#34d399", warn: "#fbbf24", bad: "#f87171", info: "#38bdf8", brand: "#6366f1", violet: "#a78bfa" };

export async function render(root) {
  let employees = [];
  let attendance = {};
  let settings = {};
  let view = { date: today(), month: ym(), from: `${ym()}-01`, to: today(), dept: "", category: "", shift: "", tab: "daily", rowFilter: null };

  /* ---------- header + upload ---------- */
  const uploadBtn = can("upload_attendance")
    ? el("button", { class: "btn btn-primary", onclick: () => openUpload() }, "⬆ Upload Excel")
    : null;

  function updateFilterVisibility() {
    filters.querySelectorAll(".field").forEach(f => {
      const span = f.querySelector("span").textContent;
      if (span === "Date") f.style.display = (view.tab === "daily" || view.tab === "weekly") ? "" : "none";
      if (span === "Month") f.style.display = view.tab === "monthly" ? "" : "none";
      if (span === "From" || span === "To") f.style.display = view.tab === "range" ? "" : "none";
      if (span === "Shift") f.style.display = view.tab === "daily" ? "" : "none";
    });
  }

  /** Switch to a tab (used by both the tab buttons and KPI-tile clicks). */
  function switchTab(id) {
    view.tab = id;
    tabs.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === id));
    updateFilterVisibility();
    refresh();
  }
  /** Jump to Daily View filtered to one status/flag — the KPI tiles drill into this. */
  function filterDaily(key, value) {
    view.rowFilter = { key, value };
    switchTab("daily");
  }

  const kpis = kpiGrid([
    { id: "present", label: "Present", icon: "✅", color: C.ok, onClick: () => filterDaily("status", "P") },
    { id: "absent", label: "Absent", icon: "🚫", color: C.bad, onClick: () => filterDaily("status", "A") },
    { id: "leave", label: "Leave", icon: "🌴", color: C.info, onClick: () => { location.hash = "#/leaves"; } },
    { id: "halfDay", label: "Half Day", icon: "🌓", color: C.info, onClick: () => filterDaily("status", "HD") },
    { id: "holiday", label: "Holiday", icon: "🏖️", color: C.violet, onClick: () => filterDaily("status", "H") },
    { id: "late", label: "Late", icon: "⏰", color: C.warn, onClick: () => filterDaily("late", "Yes") },
    { id: "attPct", label: "Attendance %", icon: "📊", color: C.brand, dp: 1, suffix: "%" },
    { id: "ot", label: "OT Hours", icon: "⏱️", color: C.warn, dp: 1, onClick: () => { location.hash = "#/overtime"; } },
  ]);

  /* ---------- tabs ---------- */
  const tabs = el("div", { class: "tabs" },
    tabBtn("daily", "Daily View"),
    tabBtn("weekly", "Weekly Summary"),
    tabBtn("monthly", "Monthly Summary"),
    tabBtn("range", "Custom Range"));
  function tabBtn(id, label) {
    return el("button", {
      class: `tab ${view.tab === id ? "active" : ""}`, "data-tab": id,
      onclick: () => { view.rowFilter = null; switchTab(id); },
    }, label);
  }

  /* ---------- filters ---------- */
  const filters = filterBar([
    { id: "date", label: "Date", type: "date", value: view.date },
    { id: "month", label: "Month", type: "month", value: view.month },
    { id: "from", label: "From", type: "date", value: view.from },
    { id: "to", label: "To", type: "date", value: view.to },
    { id: "dept", label: "Department", type: "select", options: allOptions([]) },
    { id: "category", label: "Category", type: "select", options: allOptions([]) },
    { id: "shift", label: "Shift", type: "select", options: allOptions([]) },
  ], (v) => { Object.assign(view, { date: v.date, month: v.month, from: v.from, to: v.to, dept: v.dept, category: v.category, shift: v.shift }); refresh(); });

  const avgHost = el("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", margin: "4px 0 12px" } });
  const filterHost = el("div");
  const tableHost = el("div");
  const uploadsHost = el("div");
  root.append(
    el("div", { class: "page-head" }, el("h3", {}, "Attendance"), el("div", { class: "spacer" }), uploadBtn),
    kpis, tabs, filters, avgHost, filterHost, tableHost,
    el("div", { class: "section-label" }, "Upload History"),
    uploadsHost);

  switchTab(view.tab);

  /** Show/hide the "drilled into <status> — Clear" banner above the Daily table. */
  function showFilterBanner(label) {
    if (!label) { filterHost.replaceChildren(); return; }
    filterHost.replaceChildren(el("div", { class: "chip", style: { marginBottom: "10px" } },
      `Filtered: ${label} `,
      el("button", { class: "btn btn-sm btn-ghost", style: { padding: "0 6px", marginLeft: "6px" }, onclick: () => { view.rowFilter = null; refresh(); } }, "✕ Clear")));
  }

  /** Render a labelled chip row of averages/totals above the table. */
  function showAverages(chips) {
    avgHost.replaceChildren(
      el("span", { class: "muted", style: { fontSize: "12px", alignSelf: "center" } }, "Summary:"),
      ...chips.map((c) => el("span", { class: "chip" }, `${c.label}: ${c.value}`)));
  }

  /* ---------- realtime data ---------- */
  pageWatch("settings", (s) => { settings = s || {}; });
  pageWatch("employees", (v) => {
    employees = empList(v);
    filters._setOptions("dept", allOptions(uniq(activeEmps(employees), (e) => e.department)));
    refresh();
  });
  pageWatch("attendance", (v) => {
    attendance = v || {};
    refresh();
  });

  // Upload history — every attendance & budget import, newest first.
  pageWatch("uploads", (v) => {
    const rows = toList(v, "_key").sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .map((u) => ({ ...u, when: new Date(u.ts).toLocaleString(), ago: timeAgo(u.ts) }));
    uploadsHost.replaceChildren(dataTable({
      title: "Upload history",
      exportName: "upload_history",
      pageSize: 8,
      columns: [
        { key: "ago", label: "When", sortVal: (r) => r.ts, render: (r) => el("span", { title: r.when }, r.ago) },
        { key: "type", label: "Type", render: (r) => badge(r.type === "budget" ? "Budget" : "Attendance", r.type === "budget" ? "warn" : "info"), exportVal: (r) => r.type },
        { key: "file", label: "File" },
        { key: "rows", label: "Rows", align: "right" },
        { key: "info", label: "Details" },
        { key: "range", label: "Period" },
        { key: "by", label: "Uploaded by" },
      ],
      rows,
      empty: "No files uploaded yet — use “Upload Excel” above",
    }));
  });

  /* ---------- rendering ---------- */
  function refresh() {
    if (!employees.length && !Object.keys(attendance).length) {
      tableHost.replaceChildren(emptyState("🗂️", "No attendance data yet", "Upload an Excel sheet to get started."));
      return;
    }
    if (view.tab !== "daily") { filterHost.replaceChildren(); view.rowFilter = null; }
    
    let scoped = employees;
    if (view.dept) scoped = scoped.filter((e) => e.department === view.dept);
    
    filters._setOptions("category", allOptions(uniq(scoped, e => e.category)));
    view.category = filters._values().category;

    const shifts = new Set();
    const deptEmpIds = new Set(scoped.map(e => e.id));
    for (const day of Object.values(attendance)) {
      for (const [id, r] of Object.entries(day)) {
        if (r.shift && deptEmpIds.has(id)) shifts.add(r.shift);
      }
    }
    filters._setOptions("shift", allOptions([...shifts].sort()));
    view.shift = filters._values().shift;

    if (view.category) scoped = scoped.filter(e => e.category === view.category);

    if (view.tab === "daily") renderDaily(scoped);
    else if (view.tab === "weekly") renderWeekly(scoped);
    else if (view.tab === "range") renderRange(scoped);
    else renderMonthly(scoped);
  }

  function renderDaily(scoped) {
    const dayObj = attendance[view.date] || {};
    const byId = Object.fromEntries(scoped.map((e) => [e.id, e]));
    let rows = Object.entries(dayObj)
      .filter(([id]) => byId[id])
      .map(([id, r]) => ({
        empId: id,
        name: byId[id].name,
        department: byId[id].department || "—",
        category: byId[id].category || "—",
        section: byId[id].section || "—",
        shift: r.shift || "—",
        status: r.status,
        in: r.in || "—", out: r.out || "—",
        workMin: r.workMin || 0,
        otHours: Number(r.otHours) || 0,
        late: r.late ? "Yes" : "", earlyOut: r.earlyOut ? "Yes" : "",
      }));
      
    if (view.shift) {
      rows = rows.filter((r) => r.shift === view.shift);
      const shiftEmpIds = new Set(rows.map(r => r.empId));
      scoped = scoped.filter(e => shiftEmpIds.has(e.id));
    }

    // Scope the KPI tiles to exactly the same set of rows the table shows —
    // otherwise changing the Department/Shift filter leaves the tiles above unchanged.
    const filteredIds = new Set(rows.map((r) => r.empId));
    const scopedDayObj = Object.fromEntries(Object.entries(dayObj).filter(([id]) => filteredIds.has(id)));
    const stats = dayStats(scopedDayObj, scoped);
    kpis._update({
      present: stats.present, absent: stats.absent, leave: stats.leave,
      halfDay: stats.halfDay, holiday: stats.holiday, late: stats.late,
      attPct: { value: stats.attendancePct, sub: fmtDate(view.date) },
      ot: stats.otHours,
    });

    // A KPI-tile click drills the TABLE (not the totals above) into one status/flag.
    const tableRows = view.rowFilter ? rows.filter((r) => r[view.rowFilter.key] === view.rowFilter.value) : rows;

    const summary = [
      { label: "Present", value: stats.present }, { label: "Absent", value: stats.absent },
      { label: "Leave", value: stats.leave }, { label: "Half Day", value: stats.halfDay },
      { label: "Marked", value: stats.marked },
      { label: "Attendance %", value: fmtPct(stats.attendancePct) },
      { label: "Avg Work Hrs", value: fmtNum(stats.avgWorkMin / 60, 1) },
      { label: "Total OT Hrs", value: fmtNum(stats.otHours, 1) },
      { label: "Avg OT/Present", value: fmtNum(stats.present ? stats.otHours / stats.present : 0, 2) },
    ];

    const filterLabels = { status: { P: "Present", A: "Absent", L: "Leave", HD: "Half Day", H: "Holiday" }, late: { Yes: "Late" } };
    showFilterBanner(view.rowFilter ? filterLabels[view.rowFilter.key]?.[view.rowFilter.value] || String(view.rowFilter.value) : null);

    tableHost.replaceChildren(dataTable({
      title: `Daily Attendance — ${fmtDate(view.date)}${view.rowFilter ? ` (${filterLabels[view.rowFilter.key]?.[view.rowFilter.value] || view.rowFilter.value} only)` : ""}`,
      exportName: `attendance_${view.date}`,
      pageSize: 20,
      onRowClick: (r) => openHistory(r.empId, r.name),
      summary,
      columns: [
        { key: "empId", label: "ID" },
        { key: "name", label: "Name" },
        { key: "department", label: "Department" },
        { key: "category", label: "Category" },
        { key: "section", label: "Section" },
        { key: "shift", label: "Shift" },
        { key: "status", label: "Status", render: (r) => badge(ATT_STATUS[r.status] || r.status, statusTone(r.status)), exportVal: (r) => ATT_STATUS[r.status] || r.status },
        { key: "in", label: "In" },
        { key: "out", label: "Out" },
        { key: "workMin", label: "Hours", render: (r) => minToHm(r.workMin), exportVal: (r) => (r.workMin / 60).toFixed(2) },
        { key: "otHours", label: "OT", align: "right" },
        { key: "late", label: "Late", render: (r) => r.late ? badge("Late", "warn") : "—" },
        { key: "earlyOut", label: "Early Out", render: (r) => r.earlyOut ? badge("Early", "warn") : "—" },
      ],
      rows: tableRows,
      empty: view.rowFilter ? "No records match this filter" : "No attendance uploaded for this date",
    }));

    showAverages(summary);
  }

  function renderMonthly(scoped) {
    const dates = monthDates(attendance, view.month);
    renderSummary(scoped, dates, {
      title: `Monthly Summary — ${view.month}`,
      exportName: `attendance_monthly_${view.month}`,
      attSub: `${dates.length} working days`,
      empty: "No attendance uploaded for this month",
      keepEmpty: dates.length === 0,
    });
  }

  /** 7-day rolling window ending on the Date filter. */
  function renderWeekly(scoped) {
    const dates = dateRange(addDays(view.date, -6), view.date);
    renderSummary(scoped, dates, {
      title: `Weekly Summary — ${fmtDate(dates[0])} → ${fmtDate(view.date)}`,
      exportName: `attendance_weekly_${view.date}`,
      attSub: `${fmtDate(dates[0])} → ${fmtDate(view.date)}`,
      empty: "No attendance uploaded for this week",
    });
  }

  /** Free From→To date range (the "this date to this date" view). */
  function renderRange(scoped) {
    const from = view.from <= view.to ? view.from : view.to;
    const to = view.from <= view.to ? view.to : view.from;
    const dates = dateRange(from, to);
    renderSummary(scoped, dates, {
      title: `Attendance — ${fmtDate(from)} → ${fmtDate(to)}`,
      exportName: `attendance_range_${from}_${to}`,
      attSub: `${fmtDate(from)} → ${fmtDate(to)} · ${dates.length} day(s)`,
      empty: "No attendance uploaded for this date range",
    });
  }

  /** Shared per-employee summary table (weekly/monthly) with Category column + averages. */
  function renderSummary(scoped, dates, opts) {
    const rows = activeEmps(scoped).map((e) => {
      const a = employeeAttendance(e.id, attendance, dates);
      return {
        empId: e.id, name: e.name, department: e.department || "—", category: e.category || "—",
        present: a.present, absent: a.absent, leave: a.leave, late: a.late,
        halfDay: a.halfDay, holiday: a.holiday,
        workHrs: Number((a.workMin / 60).toFixed(1)),
        otHours: Number(a.otHours.toFixed(1)),
        attPct: Number(a.attendancePct.toFixed(1)),
      };
    }).filter((r) => r.present + r.absent + r.leave + r.halfDay > 0 || opts.keepEmpty);

    const totPresent = rows.reduce((s, r) => s + r.present, 0);
    const totMarked = rows.reduce((s, r) => s + r.present + r.absent + r.leave + r.halfDay, 0);
    const totOt = rows.reduce((s, r) => s + r.otHours, 0);
    const avgAtt = rows.length ? rows.reduce((s, r) => s + r.attPct, 0) / rows.length : 0;
    const avgWork = rows.length ? rows.reduce((s, r) => s + r.workHrs, 0) / rows.length : 0;
    kpis._update({
      present: totPresent,
      absent: rows.reduce((s, r) => s + r.absent, 0),
      leave: rows.reduce((s, r) => s + r.leave, 0),
      halfDay: rows.reduce((s, r) => s + r.halfDay, 0),
      holiday: rows.reduce((s, r) => s + r.holiday, 0),
      late: rows.reduce((s, r) => s + r.late, 0),
      attPct: { value: totMarked ? (totPresent / totMarked) * 100 : 0, sub: opts.attSub },
      ot: totOt,
    });

    const summary = [
      { label: "Employees", value: rows.length },
      { label: "Present", value: totPresent },
      { label: "Absent", value: rows.reduce((s, r) => s + r.absent, 0) },
      { label: "Leave", value: rows.reduce((s, r) => s + r.leave, 0) },
      { label: "Avg Attendance %", value: fmtPct(avgAtt) },
      { label: "Avg Work Hrs", value: fmtNum(avgWork, 1) },
      { label: "Total OT Hrs", value: fmtNum(totOt, 1) },
      { label: "Avg OT/Employee", value: fmtNum(rows.length ? totOt / rows.length : 0, 1) },
    ];

    tableHost.replaceChildren(dataTable({
      title: opts.title,
      exportName: opts.exportName,
      pageSize: 20,
      onRowClick: (r) => openHistory(r.empId, r.name),
      summary,
      columns: [
        { key: "empId", label: "ID" },
        { key: "name", label: "Name" },
        { key: "department", label: "Department" },
        { key: "category", label: "Category" },
        { key: "present", label: "Present", align: "right" },
        { key: "absent", label: "Absent", align: "right" },
        { key: "leave", label: "Leave", align: "right" },
        { key: "late", label: "Late", align: "right" },
        { key: "halfDay", label: "Half Day", align: "right" },
        { key: "holiday", label: "Holiday", align: "right" },
        { key: "workHrs", label: "Work Hrs", align: "right" },
        { key: "otHours", label: "OT Hrs", align: "right" },
        { key: "attPct", label: "Att %", align: "right", render: (r) => el("strong", { class: r.attPct >= 95 ? "text-ok" : r.attPct >= 85 ? "text-warn" : "text-bad" }, fmtPct(r.attPct)) },
      ],
      rows,
      empty: opts.empty,
    }));

    showAverages(summary);
  }

  /* ---------- employee history modal ---------- */
  function openHistory(empId, name) {
    const dates = monthDates(attendance, view.month);
    const a = employeeAttendance(empId, attendance, dates);
    modal({
      title: `${name} — ${view.month}`,
      width: "640px",
      body: el("div", {},
        el("div", { class: "grid grid-4", style: { marginBottom: "14px" } },
          miniStat("Attendance", fmtPct(a.attendancePct)),
          miniStat("Present", a.present), miniStat("Absent", a.absent),
          miniStat("Late", a.late), miniStat("Leave", a.leave),
          miniStat("OT Hours", fmtNum(a.otHours, 1)), miniStat("Half Days", a.halfDay),
          miniStat("Work Hrs", fmtNum(a.workMin / 60, 1))),
        el("div", { class: "table-scroll", style: { maxHeight: "300px" } },
          el("table", { class: "dt" },
            el("thead", {}, el("tr", {}, ...["Date", "Status", "In", "Out", "OT"].map((h) => el("th", {}, h)))),
            el("tbody", {}, ...a.records.map((r) => el("tr", {},
              el("td", {}, fmtDate(r.date)),
              el("td", {}, badge(ATT_STATUS[r.status] || r.status, statusTone(r.status)), r.late ? " ⏰" : ""),
              el("td", {}, r.in || "—"), el("td", {}, r.out || "—"),
              el("td", {}, String(r.otHours || 0)))))))),
    });
  }
  const miniStat = (label, value) => el("div", { class: "card", style: { padding: "10px 14px" } },
    el("small", { class: "muted" }, label), el("div", { style: { fontSize: "18px", fontWeight: "700" } }, String(value)));

  /* ---------- Excel upload (delegates to shared importer) ---------- */
  function openUpload() {
    const preview = el("div", { style: { marginTop: "14px" } });
    const yearInput = el("input", { type: "number", value: String(new Date().getFullYear()), min: "2000", max: "2100", style: { width: "90px" } });
    let parsed = null;

    const zone = dropZone({
      accept: ".xlsx,.xls,.csv",
      hint: "Simple template: EmpID · Name · Date · Status · In · Out · Shift · OT — or a full HRIS export (auto-detected)",
      onFile: async (file) => {
        try {
          preview.replaceChildren(el("p", { class: "muted" }, "Reading file…"));
          parsed = await parseAttendanceWorkbook(file, { settings, year: yearInput.value });
          parsed.fileName = file.name;
          const syncCount = Object.keys(parsed.employeesSync || {}).length;
          preview.replaceChildren(el("div", { class: "card", style: { padding: "12px 16px" } },
            el("p", { html: `<b>${esc2(file.name)}</b> — ${parsed.records.length} valid rows`
              + ` across <b>${parsed.dates.size}</b> date(s), <b>${parsed.empIds.size}</b> employee(s)`
              + (parsed.skipped ? ` · <span class="text-warn">${parsed.skipped} rows skipped</span>` : "")
              + (syncCount ? ` · will sync <b>${syncCount}</b> employee profile(s)` : "")
              + (parsed.errors?.length ? ` · <span class="text-bad">${esc2(parsed.errors[0])}</span>` : "") })));
        } catch (err) { console.error(err); toast("Could not read that file", "err"); preview.replaceChildren(); }
      },
    });

    modal({
      title: "Upload Attendance",
      width: "680px",
      body: el("div", {},
        el("label", { class: "field", style: { maxWidth: "160px" } },
          el("span", {}, "Year (for HRIS exports without a year in the date)"), yearInput),
        zone, preview),
      actions: [
        { label: "Cancel", class: "btn-ghost", onClick: () => {} },
        {
          label: "Import to Firebase", class: "btn-primary",
          onClick: async (e, close) => {
            if (!parsed?.records.length) { toast("Choose a file first", "warn"); return true; }
            try {
              const n = await importAttendance(parsed, { employees, settings });
              toast(`Imported ${n} attendance records`, "ok");
            } catch (err) { console.error(err); toast(friendlyDbError(err), "err", 8000); }
            close();
          },
        },
      ],
    });
  }
}

/** Minimal escaper for the upload preview filename. */
function esc2(s) { return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
