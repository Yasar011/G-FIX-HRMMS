/**
 * Employees module — searchable register, full profile drill-down, CRUD with
 * photo/document upload to Firebase Storage, Excel import.
 *
 * Route: #/employees            → register table
 *        #/employees/{empId}    → profile page
 */
import { pageWatch, dbSet, dbUpdate, dbRemove } from "../lib/store.js";
import { storage, sRef, uploadBytes, getDownloadURL } from "../lib/firebase.js";
import { can } from "../lib/auth.js";
import { toast, modal, confirmDialog, badge, statusTone, emptyState } from "../lib/ui.js";
import { dataTable } from "../components/table.js";
import { filterBar, allOptions } from "../components/filters.js";
import { statRow } from "../components/kpi.js";
import { notify } from "../lib/notify.js";
import {
  el, esc, fmtDate, fmtNum, fmtPct, initials, uniq, ym, ymd, yearsSince, minToHm,
} from "../lib/utils.js";
import { empList, activeEmps, employeeAttendance, monthDates, ATT_STATUS } from "../lib/metrics.js";
import { exportXLSX, exportPDF } from "../lib/export.js";

const FIELDS = [
  { id: "id", label: "Employee ID", required: true },
  { id: "name", label: "Full Name", required: true },
  { id: "department", label: "Department" },
  { id: "section", label: "Section" },
  { id: "module", label: "Module" },
  { id: "buyer", label: "Buyer" },
  { id: "designation", label: "Designation" },
  { id: "grade", label: "Grade" },
  { id: "category", label: "Category" },
  { id: "gender", label: "Gender", type: "select", options: ["", "Male", "Female"] },
  { id: "dob", label: "Date of Birth", type: "date" },
  { id: "doj", label: "Date of Joining", type: "date" },
  { id: "type", label: "Employment Type", type: "select", options: ["Permanent", "Contract"] },
  { id: "nationality", label: "Nationality", type: "select", options: ["Local", "Expat"] },
  { id: "status", label: "Status", type: "select", options: ["active", "notice", "inactive", "resigned"] },
  { id: "resignDate", label: "Resign Date", type: "date" },
  { id: "email", label: "Email", type: "email" },
  { id: "phone", label: "Phone" },
  { id: "otRate", label: "OT Rate (per hour)", type: "number" },
];

export async function render(root, params = []) {
  const empId = params[0] ? decodeURIComponent(params[0]) : null;
  if (empId) return renderProfile(root, empId);
  return renderRegister(root);
}

/* ================= Register ================= */

function renderRegister(root) {
  let employees = [];
  let attendance = {};
  let filters = { dept: "", status: "", type: "", gender: "", category: "" };
  const canEdit = can("manage_employees");

  const bar = filterBar([
    { id: "dept", label: "Department", type: "select", options: allOptions([]) },
    { id: "status", label: "Status", type: "select", options: allOptions(["active", "notice", "inactive", "resigned"]) },
    { id: "type", label: "Type", type: "select", options: allOptions(["Permanent", "Contract"]) },
    { id: "gender", label: "Gender", type: "select", options: allOptions(["Male", "Female"]) },
    { id: "category", label: "Category", type: "select", options: allOptions([]) },
  ], (v) => { filters = v; refresh(); },
    canEdit ? [el("button", { class: "btn btn-primary", onclick: () => editEmployee(null, employees) }, "＋ Add Employee")] : null);

  const tableHost = el("div");
  root.append(el("div", { class: "page-head" }, el("h3", {}, "Employee Register")), bar, tableHost);

  pageWatch("attendance", (v) => { attendance = v || {}; });
  pageWatch("employees", (v) => {
    employees = empList(v);
    bar._setOptions("dept", allOptions(uniq(employees, (e) => e.department)));
    bar._setOptions("category", allOptions(uniq(employees, (e) => e.category)));
    refresh();
  });

  function refresh() {
    let rows = employees;
    if (filters.dept) rows = rows.filter((e) => e.department === filters.dept);
    if (filters.status) rows = rows.filter((e) => e.status === filters.status);
    if (filters.type) rows = rows.filter((e) => e.type === filters.type);
    if (filters.gender) rows = rows.filter((e) => e.gender === filters.gender);
    if (filters.category) rows = rows.filter((e) => e.category === filters.category);

    const dates = monthDates(attendance, ym());
    rows = rows.map((e) => {
      const a = employeeAttendance(e.id, attendance, dates);
      return { ...e, attPct: a.marked ? Number(a.attendancePct.toFixed(1)) : null, experience: e.doj ? Number(yearsSince(e.doj).toFixed(1)) : null };
    });

    tableHost.replaceChildren(dataTable({
      title: `Employees (${rows.length})`,
      exportName: "employees",
      pageSize: 20,
      onRowClick: (r) => { location.hash = `#/employees/${encodeURIComponent(r.id)}`; },
      columns: [
        {
          key: "name", label: "Employee",
          render: (r) => el("div", { style: { display: "flex", alignItems: "center", gap: "10px" } },
            el("div", { class: "avatar", style: { background: r.photo ? "none" : undefined } },
              r.photo ? el("img", { src: r.photo, alt: "" }) : initials(r.name)),
            el("div", {}, el("div", {}, r.name), el("small", { class: "muted" }, r.id))),
          // Include both name AND emp ID in search so you can search by ID number
          exportVal: (r) => r.name,
          searchVal: (r) => `${r.name} ${r.id}`,
        },
        { key: "department", label: "Department" },
        { key: "section", label: "Section" },
        { key: "designation", label: "Designation" },
        { key: "category", label: "Category" },
        { key: "type", label: "Type" },
        { key: "doj", label: "DOJ", render: (r) => fmtDate(r.doj), exportVal: (r) => r.doj || "" },
        { key: "experience", label: "Exp (y)", align: "right" },
        {
          key: "attPct", label: "Att % (MTD)", align: "right",
          render: (r) => r.attPct == null ? "—" : el("strong", { class: r.attPct >= 95 ? "text-ok" : r.attPct >= 85 ? "text-warn" : "text-bad" }, fmtPct(r.attPct)),
        },
        { key: "status", label: "Status", render: (r) => badge(r.status, statusTone(r.status)), exportVal: (r) => r.status },
      ],
      rows,
      empty: "No employees found — add your first employee",
    }));
  }
}

/* ================= Profile ================= */

function renderProfile(root, empId) {
  const canEdit = can("manage_employees");
  let emp = null;
  let attendance = {};
  let month = ym();
  const body = el("div", { class: "page" });
  root.append(body);

  pageWatch("attendance", (v) => { attendance = v || {}; draw(); });
  pageWatch(`employees/${empId}`, (v) => { emp = v; draw(); });

  function draw() {
    if (!emp) {
      body.replaceChildren(emptyState("🔍", "Employee not found", `No record for ID "${esc(empId)}"`));
      return;
    }
    const dates = monthDates(attendance, month);
    const a = employeeAttendance(empId, attendance, dates);
    const leaveBalance = Math.max(0, (Number(emp.leaveEntitlement) || 21) - yearLeaves());

    body.replaceChildren(
      el("div", { class: "page-head" },
        el("button", { class: "btn btn-ghost", onclick: () => { location.hash = "#/employees"; } }, "← Back"),
        el("div", { class: "spacer" }),
        // ── Download dropdown ──────────────────────────────────────────────
        el("div", { style: { position: "relative", display: "inline-block" } },
          el("button", {
            class: "btn btn-primary",
            onclick: (e) => {
              const menu = e.currentTarget.nextElementSibling;
              menu.style.display = menu.style.display === "block" ? "none" : "block";
              // Close on outside click
              const close = (ev) => { if (!menu.contains(ev.target) && ev.target !== e.currentTarget) { menu.style.display = "none"; document.removeEventListener("click", close); } };
              setTimeout(() => document.addEventListener("click", close), 0);
            },
          }, "⬇ Download Report ▾"),
          el("div", {
            style: { display: "none", position: "absolute", right: "0", top: "110%", background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: "10px", padding: "8px", zIndex: "100", minWidth: "190px", backdropFilter: "blur(12px)", boxShadow: "var(--shadow)" },
          },
            el("button", { class: "btn btn-ghost", style: { width: "100%", textAlign: "left", marginBottom: "4px" }, onclick: () => downloadReport("xlsx") }, "📊 Excel — Full Report"),
            el("button", { class: "btn btn-ghost", style: { width: "100%", textAlign: "left" },              onclick: () => downloadReport("pdf") },  "📄 PDF — Full Report"))),
        canEdit ? el("button", { class: "btn", onclick: () => editEmployee(emp ? { id: empId, ...emp } : null, []) }, "✏️ Edit") : null,
        canEdit ? el("button", { class: "btn btn-danger", onclick: removeEmp }, "🗑 Delete") : null),

      el("div", { class: "card profile-hero" },
        el("div", { class: "avatar" }, emp.photo ? el("img", { src: emp.photo, alt: "" }) : initials(emp.name)),
        el("div", { style: { flex: 1 } },
          el("h3", {}, emp.name),
          el("p", { class: "muted" }, `${emp.designation || "—"} · ${emp.department || "—"}${emp.section ? " / " + emp.section : ""}`),
          el("div", { class: "profile-meta" },
            badge(emp.status || "active", statusTone(emp.status)),
            el("span", { class: "chip" }, `ID ${empId}`),
            emp.grade ? el("span", { class: "chip" }, `Grade ${emp.grade}`) : null,
            emp.category ? el("span", { class: "chip" }, emp.category) : null,
            emp.type ? el("span", { class: "chip" }, emp.type) : null)),
        canEdit ? photoUploader() : null),

      el("div", { class: "grid grid-3" },
        el("div", { class: "card" },
          el("div", { class: "card-head" }, el("h4", {}, "Details")),
          statRow("Module", emp.module), statRow("Buyer", emp.buyer),
          statRow("Gender", emp.gender), statRow("Nationality", emp.nationality || "Local"),
          statRow("Date of Birth", fmtDate(emp.dob)),
          statRow("Age", emp.dob ? `${yearsSince(emp.dob).toFixed(1)} yrs` : "—"),
          statRow("Email", emp.email), statRow("Phone", emp.phone)),
        el("div", { class: "card" },
          el("div", { class: "card-head" }, el("h4", {}, "Employment")),
          statRow("Date of Joining", fmtDate(emp.doj)),
          statRow("Service", emp.doj ? `${yearsSince(emp.doj).toFixed(1)} yrs` : "—"),
          statRow("Type", emp.type || "Permanent"),
          statRow("OT Rate", emp.otRate ? fmtNum(emp.otRate) : "—"),
          statRow("Leave Balance", `${leaveBalance} days`),
          emp.status === "resigned" || emp.status === "notice" ? statRow("Resign Date", fmtDate(emp.resignDate)) : null),
        el("div", { class: "card" },
          el("div", { class: "card-head" },
            el("h4", {}, "This Month"),
            el("div", { class: "spacer" }),
            el("input", { type: "month", value: month, style: { padding: "4px 8px", fontSize: "12px" }, onchange: (e) => { month = e.target.value; draw(); } })),
          statRow("Attendance %", fmtPct(a.attendancePct), a.attendancePct >= 95 ? "ok" : a.attendancePct >= 85 ? "warn" : "bad"),
          statRow("Present / Absent", `${a.present} / ${a.absent}`),
          statRow("Late arrivals", a.late, a.late > 3 ? "bad" : ""),
          statRow("Leaves", a.leave), statRow("Half days", a.halfDay),
          statRow("OT hours", fmtNum(a.otHours, 1)),
          statRow("Working hours", fmtNum(a.workMin / 60, 1)))),

      el("div", { class: "card" },
        el("div", { class: "card-head" }, el("h4", {}, `Attendance History — ${month}`)),
        a.records.length
          ? el("div", { class: "table-scroll", style: { maxHeight: "320px" } },
              el("table", { class: "dt" },
                el("thead", {}, el("tr", {}, ...["Date", "Status", "In", "Out", "Hours", "OT", "Flags"].map((h) => el("th", {}, h)))),
                el("tbody", {}, ...a.records.map((r) => el("tr", {},
                  el("td", {}, fmtDate(r.date)),
                  el("td", {}, badge(ATT_STATUS[r.status] || r.status, statusTone(r.status))),
                  el("td", {}, r.in || "—"), el("td", {}, r.out || "—"),
                  el("td", {}, minToHm(r.workMin)),
                  el("td", {}, String(r.otHours || 0)),
                  el("td", {}, [r.late && "⏰ Late", r.earlyOut && "🚪 Early"].filter(Boolean).join(" ") || "—"))))))
          : emptyState("🗓️", "No attendance records this month")));
  }

  /** Approved leave days taken this calendar year (rough balance calc). */
  function yearLeaves() {
    const year = String(new Date().getFullYear());
    let days = 0;
    for (const d of Object.keys(attendance)) {
      if (d.startsWith(year) && attendance[d]?.[empId]?.status === "L") days++;
    }
    return days;
  }

  /** One-click professional HR dossier — Excel (3 sheets) or fully formatted PDF. */
  function downloadReport(format) {
    if (!emp) { toast("Employee data not loaded yet", "warn"); return; }
    const dates = monthDates(attendance, month);
    const a     = employeeAttendance(empId, attendance, dates);
    const safe  = (v) => v || "—";
    const fn    = `${(emp.name || empId).replace(/\s+/g, "_")}_${empId}_${month}`;

    // shared daily log rows
    const logRows = a.records
      .slice().sort((x, y) => x.date.localeCompare(y.date))
      .map((r) => ({
        Date:       fmtDate(r.date),
        Status:     ATT_STATUS[r.status] || r.status || "—",
        "In":       r.in  || "—",
        "Out":      r.out || "—",
        "Work Hrs": minToHm(r.workMin),
        "OT Hrs":   String(r.otHours || 0),
        Flags:      [r.late && "Late", r.earlyOut && "Early Out"].filter(Boolean).join(", ") || "—",
      }));

    /* ═══ EXCEL ════════════════════════════════════════════════════════ */
    if (format === "xlsx") {
      const wb = XLSX.utils.book_new();

      // Sheet 1 — Employee Profile (2-column key/value layout)
      const p = emp;
      const profileAOA = [
        ["EMPLOYEE PROFILE REPORT", "", "", ""],
        [`Generated: ${new Date().toLocaleString()}`, "", "", ""],
        [],
        ["PERSONAL DETAILS", "", "EMPLOYMENT DETAILS", ""],
        ["Employee ID",     empId,                                      "Department",       safe(p.department)],
        ["Full Name",       safe(p.name),                               "Section",          safe(p.section)],
        ["Status",          (p.status || "active").toUpperCase(),       "Module",           safe(p.module)],
        ["Gender",          safe(p.gender),                             "Buyer",            safe(p.buyer)],
        ["Nationality",     safe(p.nationality),                        "Designation",      safe(p.designation)],
        ["Date of Birth",   fmtDate(p.dob),                            "Grade",            safe(p.grade)],
        ["Age",             p.dob ? `${yearsSince(p.dob).toFixed(1)} yrs` : "—", "Category", safe(p.category)],
        ["Phone",           safe(p.phone),                              "Emp Type",         safe(p.type) || "Permanent"],
        ["Email",           safe(p.email),                              "Date of Joining",  fmtDate(p.doj)],
        ["", "",                                                         "Service Length",   p.doj ? `${yearsSince(p.doj).toFixed(1)} yrs` : "—"],
        ["", "",                                                         "OT Rate",          p.otRate ? fmtNum(p.otRate) : "—"],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(profileAOA);
      ws1["!cols"] = [{ wch: 18 }, { wch: 24 }, { wch: 18 }, { wch: 24 }];
      XLSX.utils.book_append_sheet(wb, ws1, "Employee Profile");

      // Sheet 2 — Attendance Summary
      const sumAOA = [
        ["ATTENDANCE SUMMARY", ""],
        [`Report Month: ${month}`, ""],
        [],
        ["Metric",             "Value"],
        ["Attendance %",       fmtPct(a.attendancePct)],
        ["Present Days",       a.present],
        ["Absent Days",        a.absent],
        ["Leave Days",         a.leave],
        ["Half Days",          a.halfDay],
        ["WFH Days",           a.wfh],
        ["Late Arrivals",      a.late],
        ["Early Outs",         a.earlyOut],
        ["OT Hours",           fmtNum(a.otHours, 1)],
        ["Total Work Hours",   fmtNum(a.workMin / 60, 1)],
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(sumAOA);
      ws2["!cols"] = [{ wch: 22 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws2, "Attendance Summary");

      // Sheet 3 — Daily Log
      const ws3 = XLSX.utils.json_to_sheet(logRows.length ? logRows : [{ Date: "No records for this month" }]);
      ws3["!cols"] = [{ wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, ws3, "Daily Log");

      XLSX.writeFile(wb, `${fn}.xlsx`);
      toast("Excel report downloaded", "ok");
      return;
    }

    /* ═══ PDF — professional HR dossier ════════════════════════════════════ */
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pw  = doc.internal.pageSize.getWidth();    // 595 pt
    const ph  = doc.internal.pageSize.getHeight();   // 842 pt
    const ML  = 36, MR = 36, CW = pw - ML - MR;     // margins + content width = 523 pt

    // Colours
    const INDIGO = [63, 81, 181], DARK = [25, 30, 55], MID = [80, 95, 145];
    const LITE = [235, 238, 255], WHITE = [255, 255, 255];
    const OK = [34, 197, 94], BAD = [239, 68, 68], WARN = [234, 179, 8];

    const fill = (r, g, b) => doc.setFillColor(r, g, b);
    const ink  = (r, g, b) => doc.setTextColor(r, g, b);
    const fnt  = (sz, bold) => { doc.setFontSize(sz); doc.setFont(undefined, bold ? "bold" : "normal"); };
    const drawRect = (x, y, w, h, col, mode = "F") => { fill(...col); doc.rect(x, y, w, h, mode); };
    const txt = (s, x, y, sz, col, bold, align = "left", mw) => {
      ink(...col); fnt(sz, bold);
      doc.text(String(s ?? "—"), x, y, { align, maxWidth: mw });
    };
    const hr = (y, col = [210, 215, 240]) => { doc.setDrawColor(...col); doc.setLineWidth(0.35); doc.line(ML, y, ML + CW, y); };

    let Y = 0;

    // ── Header band ───────────────────────────────────────────────────
    drawRect(0, 0, pw, 58, INDIGO);
    txt("Brandix Unit 3  —  HR Analytics", ML, 22, 15, WHITE, true);
    txt(`Employee Dossier  ·  Generated ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}  ·  ${new Date().toLocaleTimeString()}`, ML, 40, 8.5, [190, 205, 255], false);
    Y = 58;

    // ── Name / Identity card ───────────────────────────────────
    drawRect(0, Y, pw, 62, LITE);
    // initials avatar circle
    const ini = (emp.name || "?").split(" ").map(w => w[0] || "").slice(0, 2).join("").toUpperCase();
    fill(...MID); doc.circle(ML + 24, Y + 31, 22, "F");
    txt(ini, ML + 24, Y + 36, 13, WHITE, true, "center");
    // name + sub-title
    txt(emp.name || "Unknown", ML + 56, Y + 26, 14, DARK, true);
    txt(`${safe(emp.designation)}  ·  ${safe(emp.department)}${emp.section ? " / " + emp.section : ""}`, ML + 56, Y + 41, 9, MID, false);
    // ID badge (right)
    drawRect(pw - MR - 74, Y + 14, 72, 17, INDIGO); fill(...INDIGO);
    txt(`EMP  ${empId}`, pw - MR - 38, Y + 25.5, 8.5, WHITE, true, "center");
    // status badge
    const stCol = (emp.status === "active") ? OK : (emp.status === "resigned") ? BAD : WARN;
    drawRect(pw - MR - 74, Y + 35, 72, 14, stCol);
    txt((emp.status || "ACTIVE").toUpperCase(), pw - MR - 38, Y + 45, 7.5, WHITE, true, "center");
    Y += 62;

    // ── Section header helper ──────────────────────────────────
    const secHead = (label, y) => {
      drawRect(ML, y, CW, 17, DARK);
      txt(label, ML + 8, y + 12, 8.5, WHITE, true);
      return y + 17;
    };

    // ── Two-column detail row helper ──────────────────────────
    const RH = 18, HC = CW / 2;
    let ri = 0;
    const dRow = (l1, v1, l2, v2, y) => {
      if (ri % 2 === 0) drawRect(ML, y, CW, RH, [244, 246, 253]);
      ri++;
      // left cell
      txt(l1, ML + 5,       y + 12, 7.5, MID,  true);
      txt(v1, ML + 92,      y + 12, 9,   DARK,  false, "left", HC - 96);
      // right cell (vertical divider)
      doc.setDrawColor(210, 215, 240); doc.setLineWidth(0.3);
      doc.line(ML + HC, y, ML + HC, y + RH);
      if (l2 !== undefined) {
        txt(l2, ML + HC + 5, y + 12, 7.5, MID,  true);
        txt(v2, ML + HC + 92, y + 12, 9,  DARK,  false, "left", HC - 96);
      }
      hr(y + RH);
      return y + RH;
    };

    Y += 6;

    // ────────────────────── PERSONAL DETAILS ─────────────────────
    Y = secHead("PERSONAL DETAILS", Y); ri = 0;
    Y = dRow("Employee ID",  empId,                                       "Full Name",       safe(emp.name),        Y);
    Y = dRow("Gender",        safe(emp.gender),                           "Nationality",     safe(emp.nationality), Y);
    Y = dRow("Date of Birth", fmtDate(emp.dob),                          "Age",             emp.dob ? `${yearsSince(emp.dob).toFixed(1)} yrs` : "—", Y);
    Y = dRow("Phone",         safe(emp.phone),                            "Email",           safe(emp.email),       Y);
    Y += 7;

    // ─────────────────── EMPLOYMENT DETAILS ─────────────────────
    Y = secHead("EMPLOYMENT DETAILS", Y); ri = 0;
    Y = dRow("Department",    safe(emp.department),                       "Section",         safe(emp.section),     Y);
    Y = dRow("Module",        safe(emp.module),                           "Buyer",           safe(emp.buyer),       Y);
    Y = dRow("Designation",   safe(emp.designation),                      "Grade",           safe(emp.grade),       Y);
    Y = dRow("Category",      safe(emp.category),                         "Emp Type",        safe(emp.type) || "Permanent", Y);
    Y = dRow("Date of Joining", fmtDate(emp.doj),                        "Service Length",  emp.doj ? `${yearsSince(emp.doj).toFixed(1)} yrs` : "—", Y);
    Y = dRow("OT Rate",       emp.otRate ? fmtNum(emp.otRate) : "—",     "Status",          (emp.status || "active").toUpperCase(), Y);
    Y += 10;

    // ─────────────── ATTENDANCE SUMMARY — KPI boxes ────────────
    Y = secHead(`ATTENDANCE SUMMARY  —  ${month}`, Y);
    Y += 7;
    const kpis = [
      { lbl: "Attendance %", val: fmtPct(a.attendancePct), col: a.attendancePct >= 95 ? OK : a.attendancePct >= 85 ? WARN : BAD },
      { lbl: "Present",      val: String(a.present),        col: OK },
      { lbl: "Absent",       val: String(a.absent),         col: BAD },
      { lbl: "Leave",        val: String(a.leave),          col: INDIGO },
      { lbl: "Late",         val: String(a.late),           col: WARN },
      { lbl: "Half Day",     val: String(a.halfDay),        col: [160, 130, 220] },
      { lbl: "WFH",          val: String(a.wfh),            col: [56, 180, 240] },
      { lbl: "Early Out",    val: String(a.earlyOut),       col: [245, 140, 50] },
      { lbl: "OT Hours",     val: fmtNum(a.otHours, 1),    col: INDIGO },
      { lbl: "Work Hours",   val: fmtNum(a.workMin / 60, 1), col: MID },
    ];
    const KW = CW / 5, KH = 46;
    kpis.forEach((k, i) => {
      const kx = ML + (i % 5) * KW;
      const ky = Y + Math.floor(i / 5) * (KH + 5);
      drawRect(kx, ky, KW - 4, KH, [244, 246, 253]);   // box
      drawRect(kx, ky, KW - 4, 4,  k.col);              // colour top strip
      txt(k.val, kx + (KW - 4) / 2, ky + 27, 14, DARK, true,  "center");
      txt(k.lbl, kx + (KW - 4) / 2, ky + 41, 7.5, MID, false, "center");
    });
    Y += (KH + 5) * 2 + 12;

    // ──────────────────── DAILY ATTENDANCE LOG ─────────────────
    Y = secHead("DAILY ATTENDANCE LOG", Y);
    const LCols = [
      { h: "Date",     w: 80 },
      { h: "Status",   w: 74 },
      { h: "In",       w: 44 },
      { h: "Out",      w: 44 },
      { h: "Work Hrs", w: 56 },
      { h: "OT Hrs",   w: 46 },
      { h: "Flags",    w: CW - 344 },
    ];
    // table col header
    let cx = ML;
    drawRect(ML, Y, CW, 17, MID);
    LCols.forEach((c) => { txt(c.h, cx + 4, Y + 12, 8, WHITE, true); cx += c.w; });
    Y += 17;

    const footer = () => {
      const pg = doc.internal.getCurrentPageInfo().pageNumber;
      ink(170, 175, 200); fnt(7.5, false);
      doc.text(`Brandix Unit 3  ·  G-FIX HR Analytics  ·  Confidential`, ML, ph - 18);
      doc.text(`Page ${pg}`, pw - MR, ph - 18, { align: "right" });
    };

    if (!logRows.length) {
      drawRect(ML, Y, CW, 28, [248, 249, 255]);
      txt("No attendance records for this month.", ML + CW / 2, Y + 18, 9, MID, false, "center");
      Y += 28;
    } else {
      logRows.forEach((row, idx) => {
        if (Y > ph - 55) { footer(); doc.addPage(); Y = 40;
          cx = ML; drawRect(ML, Y, CW, 17, MID);
          LCols.forEach((c) => { txt(c.h, cx + 4, Y + 12, 8, WHITE, true); cx += c.w; }); Y += 17;
        }
        if (idx % 2 === 0) drawRect(ML, Y, CW, 17, [247, 248, 255]);
        const vals = [row["Date"], row["Status"], row["In"], row["Out"], row["Work Hrs"], row["OT Hrs"], row["Flags"]];
        cx = ML;
        LCols.forEach((c, ci) => {
          const col = ci === 1 && vals[ci].toLowerCase().includes("absent") ? BAD
                    : ci === 6 && vals[ci] !== "—" ? WARN : DARK;
          txt(vals[ci] ?? "—", cx + 4, Y + 12, 8, col, ci === 1); cx += c.w;
        });
        hr(Y + 17); Y += 17;
      });
    }
    footer();
    doc.save(`${fn}.pdf`);
    toast("PDF downloaded", "ok");
  }

  function photoUploader() {
    const input = el("input", { type: "file", accept: "image/*", class: "hidden" });
    input.addEventListener("change", async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        toast("Uploading photo…");
        const refPath = sRef(storage, `employees/${empId}/photo_${Date.now()}`);
        await uploadBytes(refPath, file);
        const url = await getDownloadURL(refPath);
        await dbUpdate(`employees/${empId}`, { photo: url });
        toast("Photo updated", "ok");
      } catch (e) { console.error(e); toast("Upload failed (is Firebase Storage enabled?)", "err"); }
    });
    return el("div", {}, input, el("button", { class: "btn btn-sm", onclick: () => input.click() }, "📷 Photo"));
  }

  async function removeEmp() {
    if (!(await confirmDialog(`Delete ${emp.name} (${empId})? Attendance history remains stored.`))) return;
    await dbRemove(`employees/${empId}`);
    toast("Employee deleted", "ok");
    location.hash = "#/employees";
  }
}

/* ================= Add / Edit form (shared) ================= */

/**
 * Open the add/edit employee modal.
 * @param {Object|null} emp existing employee (with id) or null for new
 */
export function editEmployee(emp, employees) {
  const inputs = {};
  const grid = el("div", { class: "form-grid" });
  for (const f of FIELDS) {
    let input;
    if (f.type === "select") {
      input = el("select", {}, ...f.options.map((o) => el("option", { value: o }, o || "—")));
      input.value = emp?.[f.id] ?? f.options[0];
    } else {
      input = el("input", { type: f.type || "text", value: emp?.[f.id] ?? "" });
    }
    if (f.id === "id" && emp) input.disabled = true;
    inputs[f.id] = input;
    grid.append(el("label", { class: "field" }, el("span", {}, f.label + (f.required ? " *" : "")), input));
  }

  modal({
    title: emp ? `Edit — ${emp.name}` : "Add Employee",
    width: "720px",
    body: grid,
    actions: [
      { label: "Cancel", class: "btn-ghost", onClick: () => {} },
      {
        label: emp ? "Save changes" : "Add employee", class: "btn-primary",
        onClick: async (e, close) => {
          const data = {};
          for (const f of FIELDS) {
            const v = inputs[f.id].value.trim?.() ?? inputs[f.id].value;
            if (v !== "" && v != null) data[f.id] = f.type === "number" ? Number(v) : v;
          }
          const id = String(data.id || "").trim();
          if (!id || !data.name) { toast("Employee ID and Name are required", "warn"); return true; }
          if (!emp && employees.some((x) => x.id === id)) { toast(`Employee ${id} already exists`, "warn"); return true; }
          delete data.id;
          if (!data.status) data.status = "active";
          if (emp?.photo) data.photo = emp.photo;
          await dbSet(`employees/${id}`, { ...data, updatedAt: Date.now() });
          if (!emp) notify("joiner", "Employee joined", `${data.name} (${id}) added to ${data.department || "the plant"}`);
          else if (data.status === "resigned" && emp.status !== "resigned") notify("resignation", "Employee resigned", `${data.name} (${id})`);
          toast(emp ? "Employee updated" : "Employee added", "ok");
          close();
        },
      },
    ],
  });
}
