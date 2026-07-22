/**
 * Records — plant-wide view of Employee Records (warnings, promotions,
 * actions, documents, other) across every employee. The per-employee card
 * (see employees.js) is where entries are added/edited/deleted; this page
 * is a reporting/browsing view over all of them at once, e.g. "how many
 * warnings were issued this month".
 */
import { pageWatchAll } from "../lib/store.js";
import { dataTable } from "../components/table.js";
import { filterBar, allOptions } from "../components/filters.js";
import { kpiGrid } from "../components/kpi.js";
import { badge } from "../lib/ui.js";
import { el, fmtDate, ym, flattenNested, uniq } from "../lib/utils.js";
import { empList, activeEmps, RECORD_TYPES, RECORD_TONE } from "../lib/metrics.js";

const C = { Warning: "#f87171", Promotion: "#34d399", Action: "#fbbf24", Document: "#38bdf8", Other: "#9ca3af" };

export async function render(root) {
  let view = { dept: "", type: "", month: "" };

  const kpis = kpiGrid([
    { id: "total", label: "Total Records", icon: "📋", color: "#6366f1" },
    ...RECORD_TYPES.map((t) => ({ id: t, label: t, icon: "•", color: C[t] })),
  ]);

  const filters = filterBar([
    { id: "dept", label: "Department", type: "select", options: allOptions([]) },
    { id: "type", label: "Type", type: "select", options: allOptions(RECORD_TYPES) },
    { id: "month", label: "Month", type: "month", value: "" },
  ], (v) => { view = v; refresh(); });

  const tableHost = el("div");
  root.append(
    el("div", { class: "page-head" }, el("h3", {}, "📋 Employee Records"),
      el("p", { class: "muted", style: { fontSize: "12.5px", marginTop: "4px" } },
        "Plant-wide view of warnings, promotions, actions, documents and other remarks. Add or edit entries from an employee's profile.")),
    kpis, filters, tableHost);

  let employees = [];
  let recordsRaw = {};

  pageWatchAll(["employees", "employeeRecords"], (data) => {
    employees = empList(data.employees);
    recordsRaw = data.employeeRecords || {};
    filters._setOptions("dept", allOptions(uniq(activeEmps(employees), (e) => e.department)));
    refresh();
  });

  function refresh() {
    const empById = Object.fromEntries(employees.map((e) => [e.id, e]));
    let rows = flattenNested(recordsRaw, "empId").map((r) => ({
      ...r,
      name: empById[r.empId]?.name || r.empId,
      department: empById[r.empId]?.department || "—",
    }));

    if (view.dept) rows = rows.filter((r) => r.department === view.dept);
    if (view.type) rows = rows.filter((r) => (r.type || "Other") === view.type);
    if (view.month) rows = rows.filter((r) => (r.date || "").startsWith(view.month));

    kpis._update({
      total: rows.length,
      ...Object.fromEntries(RECORD_TYPES.map((t) => [t, rows.filter((r) => (r.type || "Other") === t).length])),
    });

    tableHost.replaceChildren(dataTable({
      title: `Records (${rows.length})`,
      exportName: "employee_records",
      pageSize: 20,
      onRowClick: (r) => { location.hash = `#/employees/${encodeURIComponent(r.empId)}`; },
      columns: [
        { key: "date", label: "Date", render: (r) => fmtDate(r.date), exportVal: (r) => r.date || "" },
        { key: "name", label: "Employee", searchVal: (r) => `${r.name} ${r.empId}` },
        { key: "department", label: "Department" },
        {
          key: "type", label: "Type",
          render: (r) => badge(r.type || "Other", RECORD_TONE[r.type] || "dim"),
          exportVal: (r) => r.type || "Other",
        },
        { key: "title", label: "Title" },
        { key: "certificateId", label: "Certificate ID", render: (r) => r.certificateId || "—" },
        { key: "details", label: "Details", render: (r) => r.details || "—" },
        { key: "addedBy", label: "Added By", render: (r) => r.addedBy || "—" },
      ],
      rows: rows.sort((a, b) => (b.date || "").localeCompare(a.date || "")),
      empty: "No records match these filters",
    }));
  }
}
