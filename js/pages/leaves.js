/**
 * Leaves module — apply, approve/reject (role-gated), leave analysis chart,
 * automatic attendance marking for approved leave days.
 */
import { pageWatchAll, dbPush, dbUpdate } from "../lib/store.js";
import { can, deptScope, currentUser } from "../lib/auth.js";
import { toast, modal, confirmDialog, badge } from "../lib/ui.js";
import { dataTable } from "../components/table.js";
import { kpiGrid } from "../components/kpi.js";
import { chartCard } from "../lib/charts.js";
import { notify } from "../lib/notify.js";
import { el, fmtDate, today, flattenNested, dateRange, ym, fmtMonth, lastMonths, groupBy } from "../lib/utils.js";
import { empList, activeEmps } from "../lib/metrics.js";

const C = { ok: "#34d399", warn: "#fbbf24", bad: "#f87171", info: "#38bdf8", brand: "#6366f1" };
const TYPES = ["Annual", "Casual", "Medical", "Maternity", "No-pay", "Other"];

export async function render(root) {
  const approver = can("approve_leaves");
  const scope = deptScope();
  let employees = [];
  let listFilter = null; // "pending" | "approvedMtd" | "onLeaveToday" | null — set by clicking a KPI tile
  const portalLink = `${location.origin}${location.pathname.replace(/index\.html$/, "").replace(/\/$/, "")}/employee-portal.html`;

  const kpis = kpiGrid([
    { id: "pending", label: "Pending Approval", icon: "⏳", color: C.warn, onClick: () => setListFilter("pending") },
    { id: "approvedMtd", label: "Approved (MTD)", icon: "✅", color: C.ok, onClick: () => setListFilter("approvedMtd") },
    { id: "daysMtd", label: "Leave Days (MTD)", icon: "🌴", color: C.info },
    { id: "onLeaveToday", label: "On Leave Today", icon: "🏖️", color: C.brand, onClick: () => setListFilter("onLeaveToday") },
  ]);
  const typeChart = chartCard({ title: "Leave Analysis by Type", type: "doughnut", datasets: [] });
  const trendChart = chartCard({ title: "Leave Days Trend (12 months)", type: "bar", datasets: [] });
  const filterHost = el("div");
  const tableHost = el("div");
  let renderTable = () => {}; // set once pageWatchAll has data; re-invoked by setListFilter

  function setListFilter(id) { listFilter = listFilter === id ? null : id; renderTable(); }

  const linkInput = el("input", { type: "text", value: portalLink, readonly: "", style: { flex: 1 } });
  const linkCard = el("div", { class: "card", style: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" } },
    el("span", { style: { fontSize: "20px" } }, "🔗"),
    el("div", { style: { flex: 1, minWidth: "220px" } },
      el("strong", {}, "Employee Portal link"),
      el("p", { class: "muted", style: { fontSize: "12.5px", marginTop: "2px" } },
        "One link for employees to request leave, check leave status + download an approved-leave certificate, and request to visit HR. No login required.")),
    linkInput,
    el("button", {
      class: "btn btn-sm",
      onclick: () => { navigator.clipboard?.writeText(portalLink); toast("Link copied", "ok"); },
    }, "📋 Copy"));

  root.append(
    el("div", { class: "page-head" },
      el("h3", {}, "Leave Management"),
      scope ? el("span", { class: "chip" }, `Scope: ${scope}`) : null,
      el("div", { class: "spacer" }),
      el("button", { class: "btn btn-primary", onclick: () => applyLeave() }, "＋ Apply leave")),
    linkCard,
    kpis,
    el("div", { class: "grid grid-2" }, typeChart, trendChart),
    filterHost,
    tableHost);

  const FILTER_LABELS = { pending: "Pending Approval", approvedMtd: "Approved (This Month)", onLeaveToday: "On Leave Today" };

  pageWatchAll(["employees", "leaves"], (data) => {
    employees = empList(data.employees);
    let leaves = flattenNested(data.leaves, "empId");
    if (scope) leaves = leaves.filter((l) => l.department === scope);
    const month = ym();
    const approved = leaves.filter((l) => l.status === "approved");

    kpis._update({
      pending: leaves.filter((l) => l.status === "pending").length,
      approvedMtd: approved.filter((l) => l.from?.startsWith(month) || l.to?.startsWith(month)).length,
      daysMtd: approved.filter((l) => l.from?.startsWith(month)).reduce((s, l) => s + (Number(l.days) || 0), 0),
      onLeaveToday: approved.filter((l) => l.from <= today() && l.to >= today()).length,
    });

    const byType = [...groupBy(approved, (l) => l.type || "Other")];
    typeChart._update(byType.map(([t]) => t), [{ data: byType.map(([, items]) => items.reduce((s, l) => s + (Number(l.days) || 0), 0)) }]);

    const months = lastMonths(12);
    trendChart._update(months.map(fmtMonth), [{
      label: "Leave days",
      data: months.map((m) => approved.filter((l) => l.from?.startsWith(m)).reduce((s, l) => s + (Number(l.days) || 0), 0)),
      color: C.info,
    }]);

    renderTable = () => {
      filterHost.replaceChildren(listFilter ? el("div", { class: "chip", style: { marginBottom: "10px" } },
        `Filtered: ${FILTER_LABELS[listFilter]} `,
        el("button", { class: "btn btn-sm btn-ghost", style: { padding: "0 6px", marginLeft: "6px" }, onclick: () => setListFilter(listFilter) }, "✕ Clear")) : null);

      const rows = listFilter === "pending" ? leaves.filter((l) => l.status === "pending")
        : listFilter === "approvedMtd" ? approved.filter((l) => l.from?.startsWith(month) || l.to?.startsWith(month))
        : listFilter === "onLeaveToday" ? approved.filter((l) => l.from <= today() && l.to >= today())
        : leaves;

      tableHost.replaceChildren(dataTable({
      title: `Leave Requests${listFilter ? ` — ${FILTER_LABELS[listFilter]}` : ""}`,
      exportName: "leaves",
      pageSize: 15,
      summary: [
        { label: "Total Requests", value: leaves.length },
        { label: "Pending", value: leaves.filter((l) => l.status === "pending").length },
        { label: "Approved", value: approved.length },
        { label: "Rejected", value: leaves.filter((l) => l.status === "rejected").length },
        { label: "Total Days (Approved)", value: approved.reduce((s, l) => s + (Number(l.days) || 0), 0) },
        { label: "On Leave Today", value: approved.filter((l) => l.from <= today() && l.to >= today()).length },
      ],
      columns: [
        { key: "empId", label: "ID" },
        { key: "name", label: "Name" },
        { key: "department", label: "Department" },
        {
          key: "source", label: "From",
          render: (r) => r.source === "employee" ? badge("🙋 Employee", "dim")
            : r.source === "attendance" ? badge("📥 Attendance", "dim") : badge("👤 HR", "info"),
          exportVal: (r) => r.source === "employee" ? "Employee" : r.source === "attendance" ? "Attendance" : "HR",
        },
        {
          key: "type", label: "Type",
          render: (r) => el("span", {}, r.type, r.halfDay ? el("span", { class: "chip", style: { marginLeft: "6px", fontSize: "10px" } }, "½ day") : null),
          exportVal: (r) => r.type + (r.halfDay ? " (half day)" : ""),
        },
        { key: "from", label: "From", render: (r) => fmtDate(r.from), exportVal: (r) => r.from },
        { key: "to", label: "To", render: (r) => fmtDate(r.to), exportVal: (r) => r.to },
        { key: "days", label: "Days", align: "right" },
        { key: "reason", label: "Reason" },
        { key: "status", label: "Status", render: (r) => badge(r.status, r.status === "approved" ? "ok" : r.status === "rejected" ? "bad" : "warn"), exportVal: (r) => r.status },
        {
          key: "_act", label: "Action",
          render: (r) => r.status === "pending" && approver
            ? el("div", { style: { display: "flex", gap: "6px" } },
                el("button", { class: "btn btn-sm btn-primary", onclick: (e) => { e.stopPropagation(); decide(r, "approved"); } }, "Approve"),
                el("button", { class: "btn btn-sm btn-danger", onclick: (e) => { e.stopPropagation(); decide(r, "rejected"); } }, "Reject"))
            : (r.approvedBy ? el("small", { class: "muted" }, `by ${r.approvedBy}`) : "—"),
          exportVal: (r) => r.approvedBy || "",
        },
      ],
      rows: rows.slice().sort((a, b) => (b.appliedAt || 0) - (a.appliedAt || 0)),
      empty: listFilter ? "No leave requests match this filter" : "No leave requests",
      }));
    };
    renderTable();
  });

  /** Approve/reject and (on approve) mark attendance L (or HD for half-day) for the range. */
  async function decide(leave, status) {
    const span = leave.halfDay ? `${fmtDate(leave.from)} (half day)` : `${fmtDate(leave.from)} → ${fmtDate(leave.to)}`;
    if (!(await confirmDialog(`${status === "approved" ? "Approve" : "Reject"} ${leave.name}'s ${leave.type} leave (${span})?`, { danger: status === "rejected" }))) return;
    const patch = { status, approvedBy: currentUser?.name || "—", decidedAt: Date.now() };
    await dbUpdate(`leaves/${leave.empId}/${leave._key}`, patch);
    if (status === "approved") {
      const updates = {};
      if (leave.halfDay) updates[`${leave.from}/${leave.empId}`] = { status: "HD" };
      else for (const d of dateRange(leave.from, leave.to)) updates[`${d}/${leave.empId}`] = { status: "L" };
      await dbUpdate("attendance", updates);
      notify("leave", "Leave approved", `${leave.name}: ${leave.type}, ${span}`);
    }
    toast(`Leave ${status}`, status === "approved" ? "ok" : "warn");
  }

  function applyLeave() {
    const active = activeEmps(employees).filter((e) => !scope || e.department === scope);
    const empSel = el("select", {}, ...active.map((e) => el("option", { value: e.id }, `${e.name} (${e.id})`)));
    const typeSel = el("select", {}, ...TYPES.map((t) => el("option", { value: t }, t)));
    const fromInput = el("input", { type: "date", value: today() });
    const toInput = el("input", { type: "date", value: today() });
    const halfDayChk = el("input", { type: "checkbox" });
    const daysLabel = el("strong", {}, "1");
    const toField = el("label", { class: "field" }, el("span", {}, "To"), toInput);
    const reason = el("input", { type: "text", placeholder: "Optional" });

    /** Keep the day-count preview and the To field in sync with From/To/Half-day. */
    function syncDays() {
      if (halfDayChk.checked) {
        toInput.value = fromInput.value;
        toField.style.display = "none";
        daysLabel.textContent = "0.5";
      } else {
        toField.style.display = "";
        if (toInput.value < fromInput.value) toInput.value = fromInput.value;
        daysLabel.textContent = String(dateRange(fromInput.value, toInput.value).length);
      }
    }
    halfDayChk.addEventListener("change", syncDays);
    fromInput.addEventListener("change", syncDays);
    toInput.addEventListener("change", syncDays);
    syncDays();

    modal({
      title: "Apply for leave",
      width: "600px",
      body: el("div", { class: "form-grid" },
        el("label", { class: "field" }, el("span", {}, "Employee"), empSel),
        el("label", { class: "field" }, el("span", {}, "Type"), typeSel),
        el("label", { class: "field" }, el("span", {}, "From"), fromInput),
        toField,
        el("label", { class: "inline", style: { marginTop: "8px" } }, halfDayChk, "Half day (single day only)"),
        el("label", { class: "field" }, el("span", {}, "Days"), el("div", { style: { padding: "9px 0" } }, daysLabel)),
        el("label", { class: "field" }, el("span", {}, "Reason"), reason)),
      actions: [
        { label: "Cancel", class: "btn-ghost", onClick: () => {} },
        {
          label: "Submit", class: "btn-primary",
          onClick: async (e, close) => {
            const emp = active.find((x) => x.id === empSel.value);
            if (!emp || !fromInput.value || (!halfDayChk.checked && toInput.value < fromInput.value)) {
              toast("Check the employee and date range", "warn"); return true;
            }
            const halfDay = halfDayChk.checked;
            const to = halfDay ? fromInput.value : toInput.value;
            const leaveObj = {
              empId: emp.id, name: emp.name, department: emp.department || "—",
              type: typeSel.value, from: fromInput.value, to,
              days: halfDay ? 0.5 : dateRange(fromInput.value, to).length,
              halfDay,
              reason: reason.value.trim(), status: "pending", appliedAt: Date.now(),
            };
            await dbPush(`leaves/${emp.id}`, leaveObj);
            toast("Leave request submitted", "ok");
            close();
          },
        },
      ],
    });
  }
}
