/**
 * Budget module — monthly manpower budget vs actual headcount.
 *
 *  - Per-department (and per-section) budget, editable inline or via Excel upload.
 *  - Automatic actuals from the live employee register.
 *  - Utilization % with green / yellow / red color coding.
 *  - Copy-forward from previous month, budget-exceeded alerts.
 *
 * Excel columns: Department | Budget  (optional: Section)
 */
import { pageWatch, dbUpdate, dbSet, read } from "../lib/store.js";
import { can } from "../lib/auth.js";
import { toast, modal, badge, progressBar, emptyState } from "../lib/ui.js";
import { dataTable } from "../components/table.js";
import { kpiGrid } from "../components/kpi.js";
import { chartCard } from "../lib/charts.js";
import { dropZone } from "../components/uploader.js";
import { readWorkbook, parseBudgetSheet, importBudget, importBudgetWide } from "../lib/importers.js";
import { notify } from "../lib/notify.js";
import { el, ym, fmtNum, fmtPct, uniq } from "../lib/utils.js";
import { empList, activeEmps, budgetStats, budgetSummary } from "../lib/metrics.js";

const C = { ok: "#34d399", warn: "#fbbf24", bad: "#f87171", brand: "#6366f1", violet: "#a78bfa" };

export async function render(root) {
  let employees = [];
  let budgetMonth = null;
  let month = ym();
  const editable = can("manage_budget");

  const kpis = kpiGrid([
    { id: "budget", label: "Budget Headcount", icon: "🎯", color: C.violet },
    { id: "actual", label: "Actual Headcount", icon: "👥", color: C.brand },
    { id: "vacancies", label: "Vacancies", icon: "🪑", color: C.warn },
    { id: "excess", label: "Excess Manpower", icon: "🚨", color: C.bad },
    { id: "filled", label: "Budget Filled %", icon: "📦", color: C.ok, dp: 1, suffix: "%" },
    { id: "exceeded", label: "Depts Exceeded", icon: "📛", color: C.bad },
  ]);

  const monthInput = el("input", { type: "month", value: month, onchange: (e) => { month = e.target.value; watchMonth(); } });
  const chart = chartCard({ title: "Budget vs Actual by Department", type: "bar", datasets: [] });
  const utilChart = chartCard({ title: "Budget Utilization %", type: "bar", options: { indexAxis: "y", scales: { x: { beginAtZero: true } } }, datasets: [] });
  const tableHost = el("div");

  root.append(
    el("div", { class: "page-head" },
      el("h3", {}, "Manpower Budget"),
      el("div", { class: "spacer" }),
      el("label", { class: "field", style: { margin: 0 } }, el("span", {}, "Month"), monthInput),
      editable ? el("button", { class: "btn", onclick: copyForward }, "⧉ Copy previous month") : null,
      editable ? el("button", { class: "btn", onclick: openUpload }, "⬆ Upload Excel") : null,
      editable ? el("button", { class: "btn btn-primary", onclick: () => editDept() }, "＋ Set budget") : null),
    kpis,
    el("div", { class: "grid grid-2" }, chart, utilChart),
    tableHost);

  pageWatch("employees", (v) => { employees = empList(v); refresh(); });

  let unwatchMonth = null;
  function watchMonth() {
    unwatchMonth?.();
    unwatchMonth = pageWatch(`budget/${month}`, (v) => { budgetMonth = v; refresh(); });
  }
  watchMonth();

  function refresh() {
    const rows = budgetStats(budgetMonth, employees);
    const s = budgetSummary(budgetMonth, employees);
    kpis._update({
      budget: s.budget, actual: s.actual, vacancies: s.vacancies,
      excess: s.excess, filled: s.filledPct, exceeded: s.exceeded,
    });

    chart._update(rows.map((r) => r.department), [
      { label: "Budget", data: rows.map((r) => r.budget), color: C.violet },
      { label: "Actual", data: rows.map((r) => r.actual), color: C.brand },
    ]);
    utilChart._update(rows.map((r) => r.department), [{
      label: "Utilization %",
      data: rows.map((r) => Number(Math.min(r.utilization, 150).toFixed(1))),
      backgroundColor: rows.map((r) => r.utilization > 100 ? C.bad : r.utilization >= 90 ? C.ok : r.utilization >= 70 ? C.warn : C.bad),
    }]);

    if (!rows.length) {
      tableHost.replaceChildren(emptyState("💰", "No budget set for this month",
        editable ? "Use “Set budget”, “Upload Excel” or “Copy previous month”." : "Ask an HR Admin to set the budget."));
      return;
    }

    tableHost.replaceChildren(dataTable({
      title: `Department Budget — ${month}`,
      exportName: `budget_${month}`,
      pageSize: 25,
      onRowClick: editable ? (r) => editDept(r.department) : null,
      columns: [
        { key: "department", label: "Department" },
        { key: "budget", label: "Budget", align: "right" },
        { key: "actual", label: "Actual", align: "right" },
        { key: "variance", label: "Variance", align: "right", render: (r) => el("strong", { class: r.variance > 0 ? "text-bad" : r.variance < 0 ? "text-warn" : "text-ok" }, (r.variance > 0 ? "+" : "") + r.variance) },
        { key: "vacancies", label: "Vacancies", align: "right" },
        { key: "excess", label: "Excess", align: "right", render: (r) => r.excess ? badge(`+${r.excess}`, "bad") : "—" },
        {
          key: "utilization", label: "Utilization",
          render: (r) => el("div", { style: { minWidth: "160px", display: "flex", alignItems: "center", gap: "8px" } },
            el("div", { style: { flex: 1 } }, utilBar(r)),
            el("small", { class: `text-${r.tone}` }, fmtPct(Math.min(r.utilization, 999)))),
          exportVal: (r) => r.utilization.toFixed(1),
          sortVal: (r) => r.utilization,
        },
        {
          key: "status", label: "Status",
          render: (r) => r.excess > 0 ? badge("Exceeded", "bad") : r.utilization >= 90 ? badge("Healthy", "ok") : r.utilization >= 70 ? badge("Under", "warn") : badge("Critical", "bad"),
          exportVal: (r) => r.excess > 0 ? "Exceeded" : r.utilization >= 90 ? "Healthy" : r.utilization >= 70 ? "Under" : "Critical",
        },
      ],
      rows,
    }));
  }

  /** Utilization bar where >100% shows red. */
  function utilBar(r) {
    const bar = progressBar(Math.min(r.utilization, 100), { invert: true, warnAt: 70, badAt: 90 });
    if (r.utilization > 100) bar.firstChild.className = "bad";
    return bar;
  }

  /* ---------- editing ---------- */
  function editDept(dept = "") {
    const deptInput = el("input", { type: "text", value: dept, list: "dept-list", placeholder: "e.g. Sewing" });
    const datalist = el("datalist", { id: "dept-list" },
      ...uniq(activeEmps(employees), (e) => e.department).map((d) => el("option", { value: d })));
    const totalInput = el("input", { type: "number", min: "0", value: budgetMonth?.[dept]?.total ?? "" });

    modal({
      title: dept ? `Edit budget — ${dept}` : "Set department budget",
      body: el("div", {},
        el("label", { class: "field" }, el("span", {}, "Department"), deptInput, datalist),
        el("label", { class: "field" }, el("span", {}, `Budgeted headcount for ${month}`), totalInput)),
      actions: [
        { label: "Cancel", class: "btn-ghost", onClick: () => {} },
        {
          label: "Save", class: "btn-primary",
          onClick: async (e, close) => {
            const d = deptInput.value.trim();
            const total = Number(totalInput.value);
            if (!d || !(total >= 0)) { toast("Enter a department and a valid number", "warn"); return true; }
            await dbUpdate(`budget/${month}/${d}`, { total });
            await maybeAlertExceeded(d, total);
            notify("budget", "Budget updated", `${d}: ${total} for ${month}`);
            toast("Budget saved", "ok");
            close();
          },
        },
      ],
    });
  }

  async function maybeAlertExceeded(dept, total) {
    const actual = activeEmps(employees).filter((e) => e.department === dept).length;
    if (actual > total) notify("alert", "Budget exceeded", `${dept} has ${actual} employees vs budget ${total} (${month})`);
  }

  /** Copy the previous month's budget into the selected month. */
  async function copyForward() {
    const [y, m] = month.split("-").map(Number);
    const prev = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`;
    const prevData = await read(`budget/${prev}`);
    if (!prevData) { toast(`No budget found for ${prev}`, "warn"); return; }
    await dbSet(`budget/${month}`, prevData);
    notify("budget", "Budget copied", `${prev} → ${month}`);
    toast(`Copied budget from ${prev}`, "ok");
  }

  /* ---------- Excel upload (delegates to shared importer) ---------- */
  function openUpload() {
    const preview = el("div", { style: { marginTop: "12px" } });
    let parsed = null;
    let uploadName = "";

    const zone = dropZone({
      accept: ".xlsx,.xls,.csv",
      hint: "Simple template: Department · Budget · (optional) Section — or a wide multi-month export (auto-detected, imports every month found)",
      onFile: async (file) => {
        try {
          uploadName = file.name;
          preview.replaceChildren(el("p", { class: "muted" }, "Reading file…"));
          const raw = await readWorkbook(file);
          parsed = parseBudgetSheet(raw);
          const summary = parsed.format === "wide"
            ? `${parsed.monthList.length} months (${parsed.monthList[0]} → ${parsed.monthList[parsed.monthList.length - 1]}) × ${parsed.deptCount} departments — multi-month export detected, importing all months`
            : `${parsed.deptCount} departments, total budget <b>${fmtNum(parsed.totalBudget)}</b> · month ${month}`;
          preview.replaceChildren(el("div", { class: "card", style: { padding: "12px 16px" } },
            el("p", { html: `<b>${escB(file.name)}</b> — ${summary}` })));
        } catch (err) { console.error(err); toast("Could not read that file", "err"); preview.replaceChildren(); }
      },
    });

    modal({
      title: `Upload Budget — ${month}`,
      width: "620px",
      body: el("div", {}, zone, preview),
      actions: [
        { label: "Cancel", class: "btn-ghost", onClick: () => {} },
        {
          label: "Import", class: "btn-primary",
          onClick: async (e, close) => {
            const hasData = parsed?.format === "wide" ? parsed.deptCount > 0 : Object.keys(parsed?.parsed || {}).length > 0;
            if (!hasData) { toast("Choose a file first", "warn"); return true; }
            try {
              if (parsed.format === "wide") await importBudgetWide(parsed, uploadName);
              else await importBudget(month, parsed.parsed, uploadName);
              toast("Budget imported", "ok");
            } catch (err) { console.error(err); toast("Import failed — check your permissions", "err"); }
            close();
          },
        },
      ],
    });
  }
}

/** Minimal escaper for the upload preview filename. */
function escB(s) { return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
