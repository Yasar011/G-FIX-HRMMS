/**
 * Reports Center — every report from the registry, grouped, with parameter
 * pickers, live preview and one-click PDF / Excel / CSV download.
 */
import { pageWatchAll } from "../lib/store.js";
import { REPORTS, REPORT_PATHS } from "../lib/reports.js";
import { exportPDF, exportXLSX, exportCSV } from "../lib/export.js";
import { dataTable } from "../components/table.js";
import { toast, emptyState } from "../lib/ui.js";
import { el, ym, today, groupBy } from "../lib/utils.js";
import { track } from "../lib/firebase.js";

export async function render(root) {
  let data = null;
  const params = { date: today(), month: ym(), year: String(new Date().getFullYear()) };
  const previewHost = el("div");

  /* Parameter strip shared by all reports */
  const paramBar = el("div", { class: "filter-bar" },
    field("Date", el("input", { type: "date", value: params.date, onchange: (e) => { params.date = e.target.value; } })),
    field("Month", el("input", { type: "month", value: params.month, onchange: (e) => { params.month = e.target.value; } })),
    field("Year", el("input", { type: "number", min: "2000", max: "2100", value: params.year, style: { width: "90px" }, onchange: (e) => { params.year = e.target.value; } })),
    el("div", { class: "spacer" }),
    el("small", { class: "muted" }, "Pick parameters, then export any report below"));

  const catalog = el("div");
  root.append(
    el("div", { class: "page-head" }, el("h3", {}, "Reports Center"), el("div", { class: "spacer" }),
      el("span", { class: "chip" }, `${REPORTS.length} reports`)),
    paramBar, catalog, previewHost);

  buildCatalog();
  pageWatchAll(REPORT_PATHS, (values) => { data = values; });

  function field(label, input) {
    return el("label", { class: "field" }, el("span", {}, label), input);
  }

  function buildCatalog() {
    catalog.replaceChildren(...[...groupBy(REPORTS, (r) => r.group)].map(([group, reports]) =>
      el("div", {},
        el("div", { class: "section-label", style: { marginBottom: "10px" } }, group),
        el("div", { class: "grid grid-3", style: { marginTop: "10px" } },
          ...reports.map((r) => reportCard(r))))));
  }

  function reportCard(r) {
    const needs = r.params?.length ? `Uses: ${r.params.join(", ")}` : "No parameters";
    return el("div", { class: "card", style: { display: "flex", flexDirection: "column", gap: "10px" } },
      el("div", { class: "card-head", style: { margin: 0 } },
        el("h4", {}, `${r.icon} ${r.title}`),
        el("div", { class: "spacer" }),
        el("small", { class: "muted" }, needs)),
      el("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
        el("button", { class: "btn btn-sm", onclick: () => run(r, "preview") }, "👁 Preview"),
        el("button", { class: "btn btn-sm", onclick: () => run(r, "pdf") }, "PDF"),
        el("button", { class: "btn btn-sm", onclick: () => run(r, "xlsx") }, "Excel"),
        el("button", { class: "btn btn-sm", onclick: () => run(r, "csv") }, "CSV")));
  }

  function run(report, format) {
    if (!data) { toast("Still loading data — try again in a second", "warn"); return; }
    let built;
    try { built = report.build(data, params); }
    catch (e) { console.error(e); toast("Failed to build report", "err"); return; }
    const { columns, rows, subtitle, summary } = built;
    if (!rows.length) { toast("No data for the selected parameters", "warn"); return; }
    const name = report.id;
    track("report_export", { report: name, format });

    if (format === "pdf") exportPDF(rows, name, columns, { title: report.title, subtitle, summary });
    else if (format === "xlsx") exportXLSX(rows, name, columns);
    else if (format === "csv") exportCSV(rows, name, columns);
    else {
      previewHost.replaceChildren(
        el("div", { class: "page-head", style: { marginTop: "6px" } },
          el("h3", {}, `${report.icon} ${report.title}${subtitle ? " — " + subtitle : ""}`)),
        summary ? el("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" } },
          ...summary.map((s) => el("span", { class: "chip" }, `${s.label}: ${s.value}`))) : null,
        dataTable({
          title: `Preview (${rows.length} rows)`,
          exportName: name,
          columns: columns.map((c) => ({ ...c })),
          rows, pageSize: 12,
        }));
      previewHost.scrollIntoView({ behavior: "smooth" });
    }
  }
}
