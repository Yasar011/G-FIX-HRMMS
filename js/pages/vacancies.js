/**
 * Vacancies module — open positions derived from budget gaps plus manually
 * tracked requisitions with priority and status.
 */
import { pageWatchAll, dbPush, dbUpdate, dbRemove } from "../lib/store.js";
import { can } from "../lib/auth.js";
import { toast, modal, confirmDialog, badge } from "../lib/ui.js";
import { dataTable } from "../components/table.js";
import { kpiGrid } from "../components/kpi.js";
import { chartCard } from "../lib/charts.js";
import { notify } from "../lib/notify.js";
import { el, ym, fmtDate, uniq, toList, today, sum } from "../lib/utils.js";
import { empList, activeEmps, budgetStats } from "../lib/metrics.js";

const C = { ok: "#34d399", warn: "#fbbf24", bad: "#f87171", brand: "#6366f1", violet: "#a78bfa" };

export async function render(root) {
  const canManage = can("manage_recruitment");
  let employees = [];

  const kpis = kpiGrid([
    { id: "open", label: "Open Positions", icon: "🪑", color: C.warn },
    { id: "budgetGap", label: "Budget Vacancies", icon: "🎯", color: C.violet },
    { id: "high", label: "High Priority", icon: "🚨", color: C.bad },
    { id: "filled", label: "Filled (This Month)", icon: "✅", color: C.ok },
  ]);
  const deptChart = chartCard({ title: "Open Vacancies by Department", type: "bar", datasets: [] });
  const gapChart = chartCard({ title: "Budget Gap by Department", type: "bar", options: { indexAxis: "y" }, datasets: [] });
  const tableHost = el("div");

  root.append(
    el("div", { class: "page-head" },
      el("h3", {}, "Vacancies"),
      el("div", { class: "spacer" }),
      canManage ? el("button", { class: "btn btn-primary", onclick: () => editVacancy() }, "＋ New requisition") : null),
    kpis,
    el("div", { class: "grid grid-2" }, deptChart, gapChart),
    tableHost);

  pageWatchAll(["employees", "vacancies", `budget/${ym()}`], (data) => {
    employees = empList(data.employees);
    const vacs = toList(data.vacancies, "_key");
    const open = vacs.filter((v) => v.status !== "closed");
    const budget = budgetStats(data[`budget/${ym()}`], employees).filter((b) => b.vacancies > 0);

    kpis._update({
      open: sum(open, (v) => Number(v.count) || 1),
      budgetGap: sum(budget, (b) => b.vacancies),
      high: open.filter((v) => v.priority === "High").length,
      filled: vacs.filter((v) => v.status === "closed" && v.closedAt?.startsWith(ym())).length,
    });

    const byDept = {};
    for (const v of open) byDept[v.department || "—"] = (byDept[v.department || "—"] || 0) + (Number(v.count) || 1);
    deptChart._update(Object.keys(byDept), [{ label: "Open", data: Object.values(byDept), perBarColor: true }]);
    gapChart._update(budget.map((b) => b.department), [{ label: "Budget gap", data: budget.map((b) => b.vacancies), color: C.violet }]);

    tableHost.replaceChildren(dataTable({
      title: "Requisitions",
      exportName: "vacancies",
      pageSize: 15,
      onRowClick: canManage ? (r) => editVacancy(r) : null,
      columns: [
        { key: "designation", label: "Position" },
        { key: "department", label: "Department" },
        { key: "section", label: "Section" },
        { key: "count", label: "Openings", align: "right" },
        { key: "priority", label: "Priority", render: (r) => badge(r.priority || "Normal", r.priority === "High" ? "bad" : r.priority === "Low" ? "dim" : "warn"), exportVal: (r) => r.priority || "Normal" },
        { key: "openedAt", label: "Opened", render: (r) => fmtDate(r.openedAt), exportVal: (r) => r.openedAt || "" },
        { key: "status", label: "Status", render: (r) => badge(r.status === "closed" ? "Closed" : "Open", r.status === "closed" ? "dim" : "ok"), exportVal: (r) => r.status || "open" },
      ],
      rows: vacs.sort((a, b) => (b.openedAt || "").localeCompare(a.openedAt || "")),
      empty: "No requisitions yet",
    }));
  });

  function editVacancy(rec = null) {
    const depts = uniq(activeEmps(employees), (e) => e.department);
    const desig = el("input", { type: "text", value: rec?.designation || "", placeholder: "e.g. Machine Operator" });
    const deptSel = el("input", { type: "text", value: rec?.department || "", list: "vac-depts" });
    const dl = el("datalist", { id: "vac-depts" }, ...depts.map((d) => el("option", { value: d })));
    const section = el("input", { type: "text", value: rec?.section || "" });
    const count = el("input", { type: "number", min: "1", value: rec?.count || 1 });
    const priority = el("select", {}, ...["Normal", "High", "Low"].map((p) => el("option", { value: p }, p)));
    priority.value = rec?.priority || "Normal";
    const status = el("select", {}, ...[["open", "Open"], ["closed", "Closed"]].map(([v, l]) => el("option", { value: v }, l)));
    status.value = rec?.status || "open";

    modal({
      title: rec ? "Edit requisition" : "New requisition",
      width: "600px",
      body: el("div", { class: "form-grid" },
        el("label", { class: "field" }, el("span", {}, "Position *"), desig),
        el("label", { class: "field" }, el("span", {}, "Department"), deptSel, dl),
        el("label", { class: "field" }, el("span", {}, "Section"), section),
        el("label", { class: "field" }, el("span", {}, "Openings"), count),
        el("label", { class: "field" }, el("span", {}, "Priority"), priority),
        el("label", { class: "field" }, el("span", {}, "Status"), status)),
      actions: [
        rec ? {
          label: "Delete", class: "btn-danger",
          onClick: async (e, close) => {
            if (!(await confirmDialog("Delete this requisition?"))) return true;
            await dbRemove(`vacancies/${rec._key}`);
            close();
          },
        } : null,
        { label: "Cancel", class: "btn-ghost", onClick: () => {} },
        {
          label: "Save", class: "btn-primary",
          onClick: async (e, close) => {
            if (!desig.value.trim()) { toast("Position is required", "warn"); return true; }
            const data = {
              designation: desig.value.trim(), department: deptSel.value.trim(),
              section: section.value.trim(), count: Number(count.value) || 1,
              priority: priority.value, status: status.value,
              openedAt: rec?.openedAt || today(),
            };
            if (status.value === "closed" && rec?.status !== "closed") data.closedAt = today();
            if (rec) await dbUpdate(`vacancies/${rec._key}`, data);
            else {
              await dbPush("vacancies", data);
              notify("vacancy", "Vacancy created", `${data.count} × ${data.designation} (${data.department || "—"})`);
            }
            toast("Saved", "ok");
            close();
          },
        },
      ].filter(Boolean),
    });
  }
}
