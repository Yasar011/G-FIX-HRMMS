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
          exportVal: (r) => r.name,
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
