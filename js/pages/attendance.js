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
  el, ym, today, fmtDate, fmtNum, fmtPct, minToHm, uniq, toList, timeAgo,
} from "../lib/utils.js";
import { empList, activeEmps, dayStats, employeeAttendance, monthDates, ATT_STATUS } from "../lib/metrics.js";

const C = { ok: "#34d399", warn: "#fbbf24", bad: "#f87171", info: "#38bdf8", brand: "#6366f1" };

export async function render(root) {
  let employees = [];
  let attendance = {};
  let settings = {};
  let view = { date: today(), month: ym(), dept: "", shift: "", tab: "daily" };

  /* ---------- header + upload ---------- */
  const uploadBtn = can("upload_attendance")
    ? el("button", { class: "btn btn-primary", onclick: () => openUpload() }, "⬆ Upload Excel")
    : null;

  const kpis = kpiGrid([
    { id: "present", label: "Present", icon: "✅", color: C.ok },
    { id: "absent", label: "Absent", icon: "🚫", color: C.bad },
    { id: "leave", label: "Leave", icon: "🌴", color: C.info },
    { id: "late", label: "Late", icon: "⏰", color: C.warn },
    { id: "attPct", label: "Attendance %", icon: "📊", color: C.brand, dp: 1, suffix: "%" },
    { id: "ot", label: "OT Hours", icon: "⏱️", color: C.warn, dp: 1 },
  ]);

  /* ---------- tabs ---------- */
  const tabs = el("div", { class: "tabs" },
    tabBtn("daily", "Daily View"),
    tabBtn("monthly", "Monthly Summary"));
  function tabBtn(id, label) {
    return el("button", {
      class: `tab ${view.tab === id ? "active" : ""}`,
      onclick: (e) => {
        view.tab = id;
        tabs.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
        e.target.classList.add("active");
        refresh();
      },
    }, label);
  }

  /* ---------- filters ---------- */
  const filters = filterBar([
    { id: "date", label: "Date", type: "date", value: view.date },
    { id: "month", label: "Month", type: "month", value: view.month },
    { id: "dept", label: "Department", type: "select", options: allOptions([]) },
    { id: "shift", label: "Shift", type: "select", options: allOptions([]) },
  ], (v) => { Object.assign(view, { date: v.date, month: v.month, dept: v.dept, shift: v.shift }); refresh(); });

  const tableHost = el("div");
  const uploadsHost = el("div");
  root.append(
    el("div", { class: "page-head" }, el("h3", {}, "Attendance"), el("div", { class: "spacer" }), uploadBtn),
    kpis, tabs, filters, tableHost,
    el("div", { class: "section-label" }, "Upload History"),
    uploadsHost);

  /* ---------- realtime data ---------- */
  pageWatch("settings", (s) => { settings = s || {}; });
  pageWatch("employees", (v) => {
    employees = empList(v);
    filters._setOptions("dept", allOptions(uniq(activeEmps(employees), (e) => e.department)));
    refresh();
  });
  pageWatch("attendance", (v) => {
    attendance = v || {};
    const shifts = new Set();
    for (const day of Object.values(attendance)) for (const r of Object.values(day)) if (r.shift) shifts.add(r.shift);
    filters._setOptions("shift", allOptions([...shifts].sort()));
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
    const scoped = view.dept ? employees.filter((e) => e.department === view.dept) : employees;
    if (view.tab === "daily") renderDaily(scoped);
    else renderMonthly(scoped);
  }

  function renderDaily(scoped) {
    const dayObj = attendance[view.date] || {};
    const byId = Object.fromEntries(scoped.map((e) => [e.id, e]));
    let rows = Object.entries(dayObj)
      .filter(([id]) => byId[id] || (!view.dept))
      .map(([id, r]) => ({
        empId: id,
        name: byId[id]?.name || r.name || id,
        department: byId[id]?.department || "—",
        section: byId[id]?.section || "—",
        shift: r.shift || "—",
        status: r.status,
        in: r.in || "—", out: r.out || "—",
        workMin: r.workMin || 0,
        otHours: Number(r.otHours) || 0,
        late: r.late ? "Yes" : "", earlyOut: r.earlyOut ? "Yes" : "",
      }));
    if (view.dept) rows = rows.filter((r) => byId[r.empId]);
    if (view.shift) rows = rows.filter((r) => r.shift === view.shift);

    const stats = dayStats(dayObj, scoped);
    kpis._update({
      present: stats.present, absent: stats.absent, leave: stats.leave, late: stats.late,
      attPct: { value: stats.attendancePct, sub: fmtDate(view.date) },
      ot: stats.otHours,
    });

    tableHost.replaceChildren(dataTable({
      title: `Daily Attendance — ${fmtDate(view.date)}`,
      exportName: `attendance_${view.date}`,
      pageSize: 20,
      onRowClick: (r) => openHistory(r.empId, r.name),
      columns: [
        { key: "empId", label: "ID" },
        { key: "name", label: "Name" },
        { key: "department", label: "Department" },
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
      rows,
      empty: "No attendance uploaded for this date",
    }));
  }

  function renderMonthly(scoped) {
    const dates = monthDates(attendance, view.month);
    const rows = activeEmps(scoped).map((e) => {
      const a = employeeAttendance(e.id, attendance, dates);
      return {
        empId: e.id, name: e.name, department: e.department || "—",
        present: a.present, absent: a.absent, leave: a.leave, late: a.late,
        halfDay: a.halfDay, holiday: a.holiday,
        workHrs: Number((a.workMin / 60).toFixed(1)),
        otHours: Number(a.otHours.toFixed(1)),
        attPct: Number(a.attendancePct.toFixed(1)),
      };
    }).filter((r) => r.present + r.absent + r.leave + r.halfDay > 0 || dates.length === 0);

    const totPresent = rows.reduce((s, r) => s + r.present, 0);
    const totMarked = rows.reduce((s, r) => s + r.present + r.absent + r.leave + r.halfDay, 0);
    kpis._update({
      present: totPresent,
      absent: rows.reduce((s, r) => s + r.absent, 0),
      leave: rows.reduce((s, r) => s + r.leave, 0),
      late: rows.reduce((s, r) => s + r.late, 0),
      attPct: { value: totMarked ? (totPresent / totMarked) * 100 : 0, sub: `${dates.length} working days` },
      ot: rows.reduce((s, r) => s + r.otHours, 0),
    });

    tableHost.replaceChildren(dataTable({
      title: `Monthly Summary — ${view.month}`,
      exportName: `attendance_monthly_${view.month}`,
      pageSize: 20,
      onRowClick: (r) => openHistory(r.empId, r.name),
      columns: [
        { key: "empId", label: "ID" },
        { key: "name", label: "Name" },
        { key: "department", label: "Department" },
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
      empty: "No attendance uploaded for this month",
    }));
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
