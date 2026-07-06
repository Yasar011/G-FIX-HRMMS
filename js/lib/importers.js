/**
 * Excel import engine — shared by the Attendance page, the Budget page and the
 * Data Upload center so parsing/writing logic exists in exactly one place.
 *
 * Attendance sheet columns (case/space-insensitive, extras ignored):
 *   EmpID | Name | Date | Status | In | Out | Shift | OT
 * Budget sheet columns:
 *   Department | Budget | (optional) Section
 */
import { dbUpdate, dbPush, getCached } from "./store.js";
import { notify } from "./notify.js";
import { currentUser } from "./auth.js";
import { ymd, hmToMin, fmtDate, fmtPct } from "./utils.js";
import { dayStats } from "./metrics.js";
import { track } from "./firebase.js";

/* Normalized header → canonical attendance field. */
const HEADER_MAP = {
  empid: "empId", employeeid: "empId", id: "empId", epf: "empId", empno: "empId",
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
  hd: "HD", halfday: "HD", wfh: "WFH", workfromhome: "WFH",
  h: "H", holiday: "H", off: "H", lt: "P", late: "P",
};

/** Read the first sheet of an Excel/CSV File into an array of row objects. */
export async function readWorkbook(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { cellDates: true });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
}

/* ============ Attendance ============ */

/**
 * Parse raw sheet rows into normalized attendance records.
 * @returns {records, dates:Set, empIds:Set, skipped, errors}
 */
export function parseAttendanceRows(raw, settings = {}) {
  const out = { records: [], dates: new Set(), empIds: new Set(), skipped: 0, errors: [] };
  const std = settings.shiftStart || "08:00";
  const stdEnd = settings.shiftEnd || "17:00";
  const grace = Number(settings.graceMin) || 10;
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

    const record = {
      status,
      in: rec.in ? String(rec.in).slice(0, 5) : null,
      out: rec.out ? String(rec.out).slice(0, 5) : null,
      shift: rec.shift ? String(rec.shift) : null,
      otHours: Number(rec.otHours) || 0,
      workMin: inMin != null && outMin != null ? Math.max(0, outMin - inMin) : 0,
      late: status === "P" && inMin != null && inMin > hmToMin(std) + grace,
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

/**
 * Write parsed attendance in one batch, log to history, raise a threshold
 * alert when the latest day is below target.
 * @returns number of records written
 */
export async function importAttendance(parsed, { employees = [], settings = {} } = {}) {
  const updates = {};
  for (const { empId, date, record } of parsed.records) updates[`${date}/${empId}`] = record;
  await dbUpdate("attendance", updates);
  track("attendance_upload", { rows: parsed.records.length });

  const sorted = [...parsed.dates].sort();
  notify("attendance", "Attendance uploaded",
    `${parsed.records.length} records for ${sorted.join(", ").slice(0, 80)}`);
  await dbPush("uploads", {
    type: "attendance", file: parsed.fileName || "attendance.xlsx",
    rows: parsed.records.length,
    info: `${parsed.dates.size} day(s) · ${parsed.empIds.size} employee(s)`,
    range: sorted.length ? `${sorted[0]} → ${sorted[sorted.length - 1]}` : "",
    by: currentUser?.name || "—", ts: Date.now(),
  });

  const latest = sorted[sorted.length - 1];
  const stats = dayStats({ ...(getCached("attendance")?.[latest] || {}) }, employees);
  const threshold = Number(settings.attendanceThreshold) || 90;
  if (stats.marked && stats.attendancePct < threshold) {
    notify("alert", "Attendance below threshold",
      `${fmtPct(stats.attendancePct)} on ${fmtDate(latest)} (target ${threshold}%)`);
  }
  return parsed.records.length;
}

/* ============ Budget ============ */

/**
 * Parse budget rows into a { department: {total, sections?} } map.
 * @returns {parsed, deptCount, totalBudget}
 */
export function parseBudgetRows(raw) {
  const parsed = {};
  for (const row of raw) {
    const norm = {};
    for (const [k, v] of Object.entries(row)) norm[String(k).toLowerCase().replace(/[^a-z]/g, "")] = v;
    const dept = String(norm.department || norm.dept || "").trim();
    const total = Number(norm.budget ?? norm.headcount ?? norm.total);
    const section = String(norm.section || "").trim();
    if (!dept || isNaN(total)) continue;
    if (!parsed[dept]) parsed[dept] = { total: 0 };
    if (section) {
      parsed[dept].sections = parsed[dept].sections || {};
      parsed[dept].sections[section] = (parsed[dept].sections[section] || 0) + total;
      parsed[dept].total += total;
    } else parsed[dept].total = total;
  }
  const deptCount = Object.keys(parsed).length;
  const totalBudget = Object.values(parsed).reduce((s, d) => s + d.total, 0);
  return { parsed, deptCount, totalBudget };
}

/** Write budget for a month, log to history, notify. */
export async function importBudget(month, parsed, fileName = "budget.xlsx") {
  await dbUpdate(`budget/${month}`, parsed);
  const deptCount = Object.keys(parsed).length;
  notify("budget", "Budget uploaded", `${deptCount} departments for ${month}`);
  await dbPush("uploads", {
    type: "budget", file: fileName, rows: deptCount,
    info: `${deptCount} departments`, range: month,
    by: currentUser?.name || "—", ts: Date.now(),
  });
}
