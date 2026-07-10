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
import { toast, modal, badge, progressBar, emptyState, friendlyDbError } from "../lib/ui.js";
import { dataTable } from "../components/table.js";
import { kpiGrid } from "../components/kpi.js";
import { chartCard } from "../lib/charts.js";
import { dropZone } from "../components/uploader.js";
import { readWorkbook, parseBudgetSheet, importBudget, importBudgetWide } from "../lib/importers.js";
import { notify } from "../lib/notify.js";
import { el, ym, fmtNum, fmtPct, uniq, sanitizeKey } from "../lib/utils.js";
import { empList, activeEmps, budgetStats, budgetSummary } from "../lib/metrics.js";

const C = { ok: "#34d399", warn: "#fbbf24", bad: "#f87171", brand: "#6366f1", violet: "#a78bfa" };

/**
 * Classify a budget category / employee grade name as Direct or Indirect.
 * The budget file's "Category 2" carries this explicitly ("Associate - Direct"
 * / "Associate - Indirect"); everything else (Staff, Manager, Executive…) is
 * indirect labour, while production roles read as direct.
 */
function classifyDI(name) {
  const s = String(name || "").toLowerCase();
  if (s.includes("indirect")) return "Indirect";
  if (s.includes("direct")) return "Direct";
  if (/oper|sew|cut|tailor|helper|\bline\b|machinist|iron|pack|production|kaizen/.test(s)) return "Direct";
  return "Indirect";
}

/** Budget Direct/Indirect totals from a month node's per-dept category breakdown. */
function budgetDirectIndirect(budgetMonth) {
  const out = { Direct: 0, Indirect: 0, known: false };
  for (const dept of Object.values(budgetMonth || {})) {
    for (const c of dept?.categories || []) { out[classifyDI(c.name)] += c.count || 0; out.known = true; }
  }
  return out;
}

/** Actual Direct/Indirect headcount from the live employee register (uses grade, falls back to category/designation). */
function actualDirectIndirect(employees) {
  const out = { Direct: 0, Indirect: 0 };
  for (const e of employees) out[classifyDI(e.grade || e.category || e.designation)]++;
  return out;
}

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
  const diChart = chartCard({ title: "Budget vs Actual — Direct / Indirect", type: "bar", datasets: [] });
  const diHost = el("div");
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
    el("div", { class: "grid grid-2" }, diChart, diHost),
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

    // Direct / Indirect split — budget (from the wide file's category data) vs actual (from grade).
    const bDI = budgetDirectIndirect(budgetMonth);
    const aDI = actualDirectIndirect(activeEmps(employees));
    diChart._update(["Direct", "Indirect"], [
      { label: "Budget", data: [bDI.Direct, bDI.Indirect], color: C.violet },
      { label: "Actual", data: [aDI.Direct, aDI.Indirect], color: C.brand },
    ]);
    diHost.replaceChildren(directIndirectCard(bDI, aDI));

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
      summary: [
        { label: "Departments", value: rows.length },
        { label: "Total Budget", value: s.budget },
        { label: "Total Actual", value: s.actual },
        { label: "Vacancies", value: s.vacancies },
        { label: "Excess", value: s.excess },
        { label: "Budget Filled %", value: `${s.filledPct.toFixed(1)}%` },
      ],
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

  /** Summary card: Direct vs Indirect budget/actual with variance. */
  function directIndirectCard(bDI, aDI) {
    const rowOf = (label) => {
      const budget = bDI[label], actual = aDI[label], variance = actual - budget;
      return el("div", { class: "stat-row" },
        el("span", {}, label),
        el("span", { style: { display: "flex", gap: "16px", minWidth: "180px", justifyContent: "flex-end" } },
          el("span", { class: "muted" }, `Budget ${fmtNum(budget)}`),
          el("span", {}, `Actual ${fmtNum(actual)}`),
          el("strong", { class: variance > 0 ? "text-bad" : variance < 0 ? "text-warn" : "text-ok" }, (variance > 0 ? "+" : "") + fmtNum(variance))));
    };
    return el("div", { class: "card" },
      el("div", { class: "card-head" }, el("h4", {}, "🧑‍🏭 Direct / Indirect Split")),
      !bDI.known
        ? el("p", { class: "muted", style: { fontSize: "12.5px", marginBottom: "8px" } },
            "Budget split needs a detailed budget file with a Category column (Direct/Indirect). Showing actual headcount only.")
        : null,
      rowOf("Direct"),
      rowOf("Indirect"),
      el("div", { class: "stat-row", style: { borderTop: "1px solid var(--border)", marginTop: "4px", paddingTop: "8px" } },
        el("strong", {}, "Total"),
        el("span", { style: { display: "flex", gap: "16px", minWidth: "180px", justifyContent: "flex-end" } },
          el("span", { class: "muted" }, `Budget ${fmtNum(bDI.Direct + bDI.Indirect)}`),
          el("strong", {}, `Actual ${fmtNum(aDI.Direct + aDI.Indirect)}`),
          el("span", {}, ""))));
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
            const d = sanitizeKey(deptInput.value);
            const total = Number(totalInput.value);
            if (d === "—" || !(total >= 0)) { toast("Enter a department and a valid number", "warn"); return true; }
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
            } catch (err) { console.error(err); toast(friendlyDbError(err), "err", 8000); }
            close();
          },
        },
      ],
    });
  }
}

/** Minimal escaper for the upload preview filename. */
function escB(s) { return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
