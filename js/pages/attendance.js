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
import { pageWatch, dbUpdate, dbPush, getCached, read } from "../lib/store.js";
import { can, currentUser } from "../lib/auth.js";
import { toast, modal, badge, statusTone, emptyState } from "../lib/ui.js";
import { dataTable } from "../components/table.js";
import { filterBar, allOptions } from "../components/filters.js";
import { kpiGrid } from "../components/kpi.js";
import { notify } from "../lib/notify.js";
import {
  el, ym, today, fmtDate, fmtNum, fmtPct, hmToMin, minToHm, uniq, ymd, esc, toList, timeAgo,
} from "../lib/utils.js";
import { empList, activeEmps, dayStats, employeeAttendance, monthDates, ATT_STATUS } from "../lib/metrics.js";
import { track } from "../lib/firebase.js";

const C = { ok: "#34d399", warn: "#fbbf24", bad: "#f87171", info: "#38bdf8", brand: "#6366f1" };

/* Normalized header names → canonical field. */
const HEADER_MAP = {
  empid: "empId", employeeid: "empId", id: "empId", epf: "empId", "emp no": "empId", empno: "empId",
  name: "name", employeename: "name",
  date: "date", attendancedate: "date",
  status: "status", attendance: "status",
  in: "in", intime: "in", timein: "in", checkin: "in",
  out: "out", outtime: "out", timeout: "out", checkout: "out",
  shift: "shift",
  ot: "otHours", othours: "otHours", overtime: "otHours",
};

const STATUS_ALIASES = {
  p: "P", present: "P", a: "A", absent: "A", l: "L", leave: "L",
  hd: "HD", halfday: "HD", "half day": "HD", wfh: "WFH", "work from home": "WFH",
  h: "H", holiday: "H", off: "H", lt: "P", late: "P",
};

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

  /* ---------- Excel upload ---------- */
  function openUpload() {
    const fileInput = el("input", { type: "file", accept: ".xlsx,.xls,.csv", class: "hidden" });
    const zone = el("div", { class: "upload-zone", onclick: () => fileInput.click() },
      el("div", { class: "big" }, "📥"),
      el("p", {}, el("b", {}, "Click to choose"), " or drag & drop an Excel/CSV file"),
      el("small", {}, "Columns: EmpID · Name · Date · Status · In · Out · Shift · OT"));
    const preview = el("div", { style: { marginTop: "14px" } });
    let parsed = null;

    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("drag"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("drag"));
    zone.addEventListener("drop", (e) => { e.preventDefault(); zone.classList.remove("drag"); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
    fileInput.addEventListener("change", () => fileInput.files[0] && handleFile(fileInput.files[0]));

    const m = modal({
      title: "Upload Attendance",
      width: "680px",
      body: el("div", {}, zone, fileInput, preview),
      actions: [
        { label: "Cancel", class: "btn-ghost", onClick: () => {} },
        {
          label: "Import to Firebase", class: "btn-primary",
          onClick: async (e, close) => {
            if (!parsed?.records.length) { toast("Choose a file first", "warn"); return true; }
            await importRecords(parsed);
            close();
          },
        },
      ],
    });

    async function handleFile(file) {
      try {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        parsed = parseRows(raw);
        parsed.fileName = file.name;
        preview.replaceChildren(
          el("div", { class: "card", style: { padding: "12px 16px" } },
            el("p", { html: `<b>${file.name}</b> — ${parsed.records.length} valid rows` +
              ` across <b>${parsed.dates.size}</b> date(s), <b>${parsed.empIds.size}</b> employee(s)` +
              (parsed.skipped ? ` · <span class="text-warn">${parsed.skipped} rows skipped</span>` : "") }),
            parsed.errors.length ? el("p", { class: "text-bad", style: { fontSize: "12px" } }, parsed.errors.slice(0, 3).join(" · ")) : null));
      } catch (err) {
        console.error(err);
        toast("Could not read that file", "err");
      }
    }
  }

  /** Map raw sheet rows to normalized attendance records. */
  function parseRows(raw) {
    const out = { records: [], dates: new Set(), empIds: new Set(), skipped: 0, errors: [] };
    for (const row of raw) {
      const rec = {};
      for (const [k, v] of Object.entries(row)) {
        const key = HEADER_MAP[String(k).toLowerCase().replace(/[^a-z]/g, "")];
        if (key) rec[key] = v;
      }
      const empId = String(rec.empId ?? "").trim();
      let date = rec.date;
      if (date instanceof Date) date = ymd(date);
      else if (typeof date === "number") date = ymd(new Date(Math.round((date - 25569) * 86400e3))); // Excel serial
      else date = String(date || "").trim().replace(/\//g, "-");
      if (/^\d{2}-\d{2}-\d{4}$/.test(date)) date = date.split("-").reverse().join("-"); // DD-MM-YYYY

      if (!empId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { out.skipped++; continue; }

      const inMin = hmToMin(rec.in);
      const outMin = hmToMin(rec.out);
      let status = STATUS_ALIASES[String(rec.status || "").trim().toLowerCase()] || "";
      if (!status) status = inMin != null ? "P" : "A"; // derive when missing

      const std = settings.shiftStart || "08:00";
      const stdEnd = settings.shiftEnd || "17:00";
      const record = {
        status,
        in: rec.in ? String(rec.in).slice(0, 5) : null,
        out: rec.out ? String(rec.out).slice(0, 5) : null,
        shift: rec.shift ? String(rec.shift) : null,
        otHours: Number(rec.otHours) || 0,
        workMin: inMin != null && outMin != null ? Math.max(0, outMin - inMin) : 0,
        late: status === "P" && inMin != null && inMin > hmToMin(std) + (Number(settings.graceMin) || 10),
        earlyOut: status === "P" && outMin != null && outMin < hmToMin(stdEnd),
        name: rec.name ? String(rec.name) : null,
      };
      Object.keys(record).forEach((k) => record[k] == null && delete record[k]);
      out.records.push({ empId, date, record });
      out.dates.add(date);
      out.empIds.add(empId);
    }
    return out;
  }

  /** Batch-write parsed records with one multi-path update. */
  async function importRecords(parsed) {
    const updates = {};
    for (const { empId, date, record } of parsed.records) {
      updates[`${date}/${empId}`] = record;
    }
    try {
      await dbUpdate("attendance", updates);
      toast(`Imported ${parsed.records.length} attendance records`, "ok");
      track("attendance_upload", { rows: parsed.records.length });
      notify("attendance", "Attendance uploaded",
        `${parsed.records.length} records for ${[...parsed.dates].sort().join(", ").slice(0, 80)}`);
      // Record in the upload history log.
      const sorted = [...parsed.dates].sort();
      await dbPush("uploads", {
        type: "attendance", file: parsed.fileName || "attendance.xlsx",
        rows: parsed.records.length,
        info: `${parsed.dates.size} day(s) · ${parsed.empIds.size} employee(s)`,
        range: sorted.length ? `${sorted[0]} → ${sorted[sorted.length - 1]}` : "",
        by: currentUser?.name || "—", ts: Date.now(),
      });
      // Threshold alert
      const latest = [...parsed.dates].sort().pop();
      const stats = dayStats({ ...(getCached("attendance")?.[latest] || {}) }, employees);
      const threshold = Number(settings.attendanceThreshold) || 90;
      if (stats.marked && stats.attendancePct < threshold) {
        notify("alert", "Attendance below threshold",
          `${fmtPct(stats.attendancePct)} on ${fmtDate(latest)} (target ${threshold}%)`);
      }
    } catch (e) {
      console.error(e);
      toast("Import failed — check your permissions", "err");
    }
  }
}
