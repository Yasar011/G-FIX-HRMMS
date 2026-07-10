/**
 * Excel import engine — shared by the Attendance page, the Budget page and the
 * Data Upload center so parsing/writing logic exists in exactly one place.
 *
 * Two attendance formats are auto-detected, no user choice needed:
 *  1. Simple template — one sheet, one row per employee per day:
 *       EmpID | Name | Date | Status | In | Out | Shift | OT
 *  2. Real HRIS export ("Brandix" format) — one sheet PER DAY, with a
 *     dated status column like " 01/07\r\nWe/W" and per-day Work/OT hour
 *     columns stored as Excel time values. Employee master fields present in
 *     every row (Name, Department, Section, Designation, …) are also synced
 *     into the employee register.
 *
 * Two budget formats are auto-detected:
 *  1. Simple template — one row per department (+ optional section):
 *       Department | Budget | Section
 *  2. Wide HRIS export — one row per designation, with a budget column per
 *     month ("April'26" … "Mar'27"). Imports ALL months found in one go.
 */
import { dbUpdate, dbPush, getCached } from "./store.js";
import { notify } from "./notify.js";
import { currentUser } from "./auth.js";
import { ymd, hmToMin, fmtDate, fmtPct, sanitizeKey, isSunday } from "./utils.js";
import { dayStats } from "./metrics.js";
import { track } from "./firebase.js";

/** Read a workbook (all sheets) from a File. */
export async function readWorkbookRaw(file) {
  const buf = await file.arrayBuffer();
  return XLSX.read(buf, { cellDates: true });
}

/** Rows of one sheet as objects (default) or arrays (`{ header: 1 }`). */
export function sheetRows(wb, sheetName, opts = {}) {
  return XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "", ...opts });
}

/** Read just the first sheet of a workbook as row objects. */
export async function readWorkbook(file) {
  const wb = await readWorkbookRaw(file);
  return sheetRows(wb, wb.SheetNames[0]);
}

/* ============ Attendance: simple template ============ */

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

/** Parse the simple one-row-per-day template into normalized records. */
function parseSimpleAttendance(raw, settings = {}) {
  const out = { format: "simple", records: [], dates: new Set(), empIds: new Set(), skipped: 0, errors: [], employeesSync: {} };
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

/* ============ Attendance: real HRIS export (one sheet per day) ============ */

/** Day-status codes seen in real exports → canonical attendance status. */
const DAY_STATUS_MAP = {
  p: "P", od: "P", // Present / On Duty
  a: "A", // Absent
  cl: "L", el: "L", esl: "L", sl: "L", eml: "L", lp: "L", co: "L", // leave variants
};

/** Map a raw day-status cell (e.g. "P", "A", "CL", "p/el") to a canonical status. */
function mapDayStatus(raw) {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return null;
  if (v.includes("/")) return v.split("/").includes("p") ? "HD" : "L"; // half-day vs split leave
  return DAY_STATUS_MAP[v] || "L";
}

/** Excel time cell (Date at 1899-12-30 epoch, a day-fraction number, or an "HH:MM:SS" string) → decimal hours. */
function excelTimeToHours(v) {
  if (v instanceof Date) return v.getUTCHours() + v.getUTCMinutes() / 60;
  if (typeof v === "number") return v * 24;
  const m = typeof v === "string" && v.trim().match(/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/);
  if (m) return Number(m[1]) + Number(m[2]) / 60 + (Number(m[3]) || 0) / 3600;
  return 0;
}

/**
 * True when the raw file bytes are an HTML table export mislabeled with an
 * .xls/.xlsx extension — common for HRIS "print to Excel" style reports.
 */
function looksLikeHtmlExport(headText) {
  return /<table[\s>]/i.test(headText) || /<html[\s>]/i.test(headText);
}

/**
 * Parse an HTML table export into {name, rows} sheets (rows = array-of-arrays,
 * header first — the same shape `sheetRows(wb, name, {header:1})` produces).
 *
 * Uses the browser's own HTML5 parser rather than SheetJS's HTML reader.
 * Some export tools emit malformed markup with unclosed <td> tags
 * (`<td>A<td>B<td>C</td>`); a real HTML5 parser auto-closes each cell at the
 * next <td>/<tr> per spec (exactly like a browser renders the table), while
 * SheetJS's lenient HTML reader instead concatenates the unclosed cells'
 * text into one cell — silently shifting every column after it.
 */
function parseHtmlTables(text) {
  const doc = new DOMParser().parseFromString(text, "text/html");
  return [...doc.querySelectorAll("table")].map((table, i) => ({
    name: `Sheet${i + 1}`,
    rows: [...table.rows].map((tr) => [...tr.cells].map((td) => td.textContent.trim())),
  }));
}

/** True when a workbook looks like the real HRIS export (dated sheet headers). */
function looksLikeHrisWorkbook(wb) {
  for (const name of wb.SheetNames) {
    const header = sheetRows(wb, name, { header: 1 })[0];
    if (header?.some((h) => /^\s*\d{1,2}\/\d{1,2}/.test(String(h)))) return true;
  }
  return false;
}

/** Normalize a header cell for fuzzy matching: lowercase, letters only. */
function normHeader(h) { return String(h).toLowerCase().replace(/[^a-z]/g, ""); }

/**
 * Column-name → index lookup. Fuzzy: case/space/punctuation-insensitive, and
 * accepts a list of alias names (real exports vary the exact wording).
 */
function colIndex(header, ...aliases) {
  const normed = header.map(normHeader);
  for (const alias of aliases) {
    const target = normHeader(alias);
    const i = normed.findIndex((h) => h === target);
    if (i !== -1) return i;
  }
  return -1;
}

/**
 * Parse one or more HRIS-format sheets (one sheet per day, each with its own
 * dated status column) into normalized records, plus an employee-master-data
 * sync map built from every row.
 * @param {Array<{name:string, rows:Array<Array>}>} sheets  header row first
 */
function parseHrisAttendanceSheets(sheets, year) {
  const out = { format: "hris", records: [], dates: new Set(), empIds: new Set(), skipped: 0, errors: [], employeesSync: {} };

  for (const { name: sheetName, rows } of sheets) {
    if (!rows.length) continue;
    const header = rows[0];
    const dateColIdx = header.findIndex((h) => /^\s*\d{1,2}\/\d{1,2}/.test(String(h)));
    if (dateColIdx === -1) continue; // not a dated sheet — skip (e.g. a notes tab)

    const m = String(header[dateColIdx]).trim().match(/^(\d{1,2})\/(\d{1,2})/);
    const date = `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    const idx = {
      empId: colIndex(header, "emp id", "empid", "employee id", "id", "epf"),
      name: colIndex(header, "name", "employee name", "emp name"),
      team: colIndex(header, "team", "shift"),
      designation: colIndex(header, "designation", "unique designation", "job title", "position"),
      module: colIndex(header, "module", "line"),
      section: colIndex(header, "section", "sub section"),
      buyer: colIndex(header, "buyer division", "buyer", "buyer group"),
      doj: colIndex(header, "emp doj", "doj", "date of joining", "joining date"),
      department: colIndex(header, "department", "dept", "department name", "dept name"),
      category: colIndex(header, "category", "employee category"),
      grade: colIndex(header, "grade"),
      workHours: dateColIdx + 1, otHours: dateColIdx + 2,
    };
    if (idx.empId === -1) { out.errors.push(`Sheet "${sheetName}": no "EMP ID" column found — headers were: ${header.join(" | ")}`); continue; }

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const empId = String(row[idx.empId] ?? "").trim();
      const status = mapDayStatus(row[dateColIdx]);
      if (!empId || !status) { out.skipped++; continue; }

      const workHrs = excelTimeToHours(row[idx.workHours]);
      const otHrs = excelTimeToHours(row[idx.otHours]);
      const record = { status, workMin: Math.round(workHrs * 60), otHours: Number(otHrs.toFixed(2)) };
      if (idx.team !== -1 && row[idx.team]) record.shift = String(row[idx.team]);
      out.records.push({ empId, date, record });
      out.dates.add(date);
      out.empIds.add(empId);

      if (!out.employeesSync[empId]) {
        const doj = idx.doj !== -1 ? row[idx.doj] : null;
        const category = idx.category !== -1 ? String(row[idx.category] || "") : "";
        const sync = {};
        if (idx.name !== -1 && row[idx.name]) sync.name = String(row[idx.name]).trim();
        if (idx.department !== -1 && row[idx.department]) sync.department = String(row[idx.department]).trim();
        if (idx.section !== -1 && row[idx.section] !== "") sync.section = String(row[idx.section]).trim();
        if (idx.module !== -1 && row[idx.module]) sync.module = String(row[idx.module]).trim();
        if (idx.buyer !== -1 && row[idx.buyer]) sync.buyer = String(row[idx.buyer]).trim();
        if (idx.designation !== -1 && row[idx.designation]) sync.designation = String(row[idx.designation]).trim();
        if (idx.grade !== -1 && row[idx.grade]) sync.grade = String(row[idx.grade]).trim();
        if (category) { sync.category = category.trim(); sync.nationality = /expat/i.test(category) ? "Expat" : "Local"; }
        if (doj instanceof Date) sync.doj = ymd(doj);
        else if (typeof doj === "string" && /^\d{4}-\d{2}-\d{2}/.test(doj.trim())) sync.doj = doj.trim().slice(0, 10);
        out.employeesSync[empId] = sync;
      }
    }
  }
  return out;
}

/** Parse a multi-sheet HRIS workbook (one sheet per day) — real .xlsx/.xls binary path. */
function parseHrisAttendanceWorkbook(wb, year) {
  return parseHrisAttendanceSheets(
    wb.SheetNames.map((name) => ({ name, rows: sheetRows(wb, name, { header: 1 }) })),
    year,
  );
}

/**
 * Auto-detect the attendance workbook format and parse it.
 * @param {File} file
 * @param {object} o {settings, year} — year is required for the HRIS format
 *   (its sheet headers carry day/month only, e.g. "01/07").
 */
export async function parseAttendanceWorkbook(file, { settings = {}, year } = {}) {
  const buf = await file.arrayBuffer();
  const head = new TextDecoder("utf-8", { fatal: false }).decode(buf.slice(0, 4096));
  if (looksLikeHtmlExport(head)) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    const sheets = parseHtmlTables(text);
    return parseHrisAttendanceSheets(sheets, Number(year) || new Date().getFullYear());
  }
  const wb = XLSX.read(buf, { cellDates: true });
  if (looksLikeHrisWorkbook(wb)) {
    return parseHrisAttendanceWorkbook(wb, Number(year) || new Date().getFullYear());
  }
  return parseSimpleAttendance(sheetRows(wb, wb.SheetNames[0]), settings);
}

/**
 * Write parsed attendance in one batch, sync any discovered employee master
 * data, log to history, raise a threshold alert when the latest day is low.
 * @returns number of records written
 */
export async function importAttendance(parsed, { employees = [], settings = {} } = {}) {
  const updates = {};
  // The plant doesn't operate on Sundays — mark every Sunday as a holiday
  // regardless of what status the sheet carries (hours/OT, if any, are kept).
  for (const { empId, date, record } of parsed.records) {
    updates[`${date}/${empId}`] = isSunday(date) && record.status !== "H" ? { ...record, status: "H" } : record;
  }
  await dbUpdate("attendance", updates);

  // Merge (never overwrite unrelated fields) any employee master data found in the sheet.
  const syncCount = Object.keys(parsed.employeesSync || {}).length;
  if (syncCount) {
    const existingById = new Map(employees.map((e) => [e.id, e]));
    const empUpdates = {};
    for (const [empId, fields] of Object.entries(parsed.employeesSync)) {
      for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== "") empUpdates[`${empId}/${k}`] = v;
      // Employees discovered purely through attendance sync need a status or
      // they're invisible everywhere (Departments, headcount, budget actuals,
      // demographics) — activeEmps() only counts active/notice. Never touch
      // an employee that already has one (e.g. resigned via Attrition).
      if (!existingById.get(empId)?.status) empUpdates[`${empId}/status`] = "active";
    }
    if (Object.keys(empUpdates).length) await dbUpdate("employees", empUpdates);
  }

  track("attendance_upload", { rows: parsed.records.length, format: parsed.format });

  const sorted = [...parsed.dates].sort();
  notify("attendance", "Attendance uploaded",
    `${parsed.records.length} records for ${sorted.join(", ").slice(0, 80)}`);
  await dbPush("uploads", {
    type: "attendance", file: parsed.fileName || "attendance.xlsx",
    rows: parsed.records.length,
    info: `${parsed.dates.size} day(s) · ${parsed.empIds.size} employee(s)` + (syncCount ? ` · ${syncCount} profile(s) synced` : ""),
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

/* ============ Budget: simple template ============ */

/** Parse the simple Department|Budget|Section template. */
function parseSimpleBudget(raw) {
  const parsed = {};
  for (const row of raw) {
    const norm = {};
    for (const [k, v] of Object.entries(row)) norm[String(k).toLowerCase().replace(/[^a-z]/g, "")] = v;
    const dept = sanitizeKey(norm.department || norm.dept || "");
    const total = Number(norm.budget ?? norm.headcount ?? norm.total);
    const section = String(norm.section || "").trim();
    if (dept === "—" || isNaN(total)) continue;
    if (!parsed[dept]) parsed[dept] = { total: 0 };
    if (section) {
      // Array, not a keyed object — section names routinely contain "/", ".", etc.
      // which Firebase forbids in keys.
      parsed[dept].sections = parsed[dept].sections || [];
      const existing = parsed[dept].sections.find((s) => s.name === section);
      if (existing) existing.count += total; else parsed[dept].sections.push({ name: section, count: total });
      parsed[dept].total += total;
    } else parsed[dept].total = total;
  }
  const deptCount = Object.keys(parsed).length;
  const totalBudget = Object.values(parsed).reduce((s, d) => s + d.total, 0);
  return { format: "simple", parsed, deptCount, totalBudget };
}

/* ============ Budget: wide multi-month HRIS export ============ */

const MONTH_ABBR = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/** "April'26" / "Mar'27" → "2026-04" / "2027-03", or null if not a month header. */
function parseMonthHeader(h) {
  const m = String(h).trim().match(/^([A-Za-z]+)'(\d{2})$/);
  if (!m) return null;
  const mon = MONTH_ABBR[m[1].slice(0, 3).toLowerCase()];
  if (!mon) return null;
  return `${2000 + Number(m[2])}-${String(mon).padStart(2, "0")}`;
}

/** Look up a field on an object-row by fuzzy/aliased header name. */
function pickField(row, ...aliases) {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const target = normHeader(alias);
    const k = keys.find((kk) => normHeader(kk) === target);
    if (k) return row[k];
  }
  return "";
}

/** Add (or accumulate onto) a {name, count} entry in a breakdown array. */
function accumulate(arr, name, n) {
  if (!name) return;
  const existing = arr.find((x) => x.name === name);
  if (existing) existing.count += n; else arr.push({ name, count: n });
}

/**
 * Parse a wide per-designation, per-month budget export. Alongside the
 * per-department total, also captures a detailed breakdown by designation,
 * category (e.g. Staff / Associate-Indirect) and Local/Expat — so a
 * department page can show exactly what mix of roles is budgeted, not just
 * a headcount number.
 */
function parseWideBudget(raw) {
  const monthCols = Object.keys(raw[0] || {}).map((key) => ({ key, month: parseMonthHeader(key) })).filter((x) => x.month);
  const months = {};
  for (const row of raw) {
    const dept = sanitizeKey(pickField(row, "Department", "Dept"));
    const designation = String(pickField(row, "Unique Designation", "Designation")).trim();
    const category = String(pickField(row, "Category 2", "Category")).trim();
    const localExpat = String(pickField(row, "Local/ Expat", "Local/Expat", "Local Expat")).trim();
    if (dept === "—") continue;
    for (const { key, month } of monthCols) {
      const raw_v = row[key];
      const n = raw_v === "-" || raw_v === "" ? 0 : Number(raw_v);
      if (!n || isNaN(n)) continue;
      if (!months[month]) months[month] = {};
      if (!months[month][dept]) months[month][dept] = { total: 0, designations: [], categories: [], localExpat: [] };
      months[month][dept].total += n;
      // Arrays, not keyed objects — real designation/category titles ("Sr.
      // Manager", "QC/QA Officer") routinely contain characters Firebase
      // forbids in keys.
      accumulate(months[month][dept].designations, designation, n);
      accumulate(months[month][dept].categories, category, n);
      accumulate(months[month][dept].localExpat, localExpat, n);
    }
  }
  const monthList = monthCols.map((m) => m.month).sort();
  const deptSet = new Set();
  for (const m of Object.values(months)) for (const d of Object.keys(m)) deptSet.add(d);
  return { format: "wide", months, monthList, deptCount: deptSet.size };
}

/** Auto-detect and parse either budget format from raw sheet-object rows. */
export function parseBudgetSheet(raw) {
  const hasMonthCols = Object.keys(raw[0] || {}).some((k) => parseMonthHeader(k));
  return hasMonthCols ? parseWideBudget(raw) : parseSimpleBudget(raw);
}

/** Write a single-month simple budget import, log to history, notify. */
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

/** Write a wide multi-month budget import (all months found in the file). */
export async function importBudgetWide(res, fileName = "budget.xlsx") {
  const months = Object.keys(res.months).sort();
  for (const month of months) await dbUpdate(`budget/${month}`, res.months[month]);
  notify("budget", "Budget uploaded", `${months.length} months × ${res.deptCount} departments (${months[0]} → ${months[months.length - 1]})`);
  await dbPush("uploads", {
    type: "budget", file: fileName, rows: res.deptCount,
    info: `${months.length} months × ${res.deptCount} departments`,
    range: `${months[0]} → ${months[months.length - 1]}`,
    by: currentUser?.name || "—", ts: Date.now(),
  });
}
