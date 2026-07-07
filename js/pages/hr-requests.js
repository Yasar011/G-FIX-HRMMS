/**
 * HR Visit Requests — two-way "come see us" workflow between employees and HR.
 *
 *  - Employee-initiated: submitted anonymously via the public kiosk
 *    (hr-request.html), no login required.
 *  - HR-initiated: HR staff can also ask a specific employee to come in,
 *    creating a request the same way (so both directions live in one list).
 *
 * Data model: hrRequests/{empId}/{pushId} — keyed by employee ID (not a
 * flat list) so the anonymous kiosk can privately check "has HR asked to
 * see me?" for its own ID without being able to browse anyone else's
 * requests (see database.rules.json).
 */
import { pageWatch, dbUpdate, dbPush } from "../lib/store.js";
import { toast, badge, modal } from "../lib/ui.js";
import { dataTable } from "../components/table.js";
import { kpiGrid } from "../components/kpi.js";
import { el, timeAgo, toList } from "../lib/utils.js";
import { currentUser } from "../lib/auth.js";
import { empList, activeEmps } from "../lib/metrics.js";

const C = { ok: "#34d399", warn: "#fbbf24", bad: "#f87171", info: "#38bdf8", brand: "#6366f1" };
const STATUS_TONE = { pending: "warn", seen: "info", approved: "ok", rejected: "bad" };

/** Flatten hrRequests/{empId}/{pushId} into a flat row list. */
function flattenRequests(v) {
  const rows = [];
  for (const [empId, reqs] of Object.entries(v || {})) {
    for (const [key, r] of Object.entries(reqs || {})) rows.push({ _key: key, empId, ...r });
  }
  return rows;
}

export async function render(root) {
  const kioskLink = `${location.origin}${location.pathname.replace(/index\.html$/, "").replace(/\/$/, "")}/hr-request.html`;
  let employees = [];

  const kpis = kpiGrid([
    { id: "pending", label: "Pending", icon: "⏳", color: C.warn },
    { id: "seen", label: "Seen", icon: "👀", color: C.info },
    { id: "approved", label: "Approved (30d)", icon: "✅", color: C.ok },
    { id: "rejected", label: "Rejected (30d)", icon: "🚫", color: C.bad },
  ]);

  const linkInput = el("input", { type: "text", value: kioskLink, readonly: "", style: { flex: 1 } });
  const linkCard = el("div", { class: "card", style: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" } },
    el("span", { style: { fontSize: "20px" } }, "🔗"),
    el("div", { style: { flex: 1, minWidth: "220px" } },
      el("strong", {}, "Public request link"),
      el("p", { class: "muted", style: { fontSize: "12.5px", marginTop: "2px" } },
        "Share this with employees (notice board, WhatsApp, printed poster). No login required — turn it on/off in Settings.")),
    linkInput,
    el("button", {
      class: "btn btn-sm",
      onclick: () => { navigator.clipboard?.writeText(kioskLink); toast("Link copied", "ok"); },
    }, "📋 Copy"));

  const tableHost = el("div");
  root.append(
    el("div", { class: "page-head" },
      el("h3", {}, "HR Visit Requests"),
      el("div", { class: "spacer" }),
      el("button", { class: "btn btn-primary", onclick: () => requestEmployee() }, "📣 Request employee to visit")),
    linkCard, kpis, tableHost);

  pageWatch("employees", (v) => { employees = empList(v); });

  pageWatch("hrRequests", (v) => {
    const rows = flattenRequests(v).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .map((r) => ({ ...r, when: timeAgo(r.createdAt) }));
    const now30 = Date.now() - 30 * 86400e3;

    kpis._update({
      pending: rows.filter((r) => r.status === "pending").length,
      seen: rows.filter((r) => r.status === "seen").length,
      approved: rows.filter((r) => r.status === "approved" && (r.decidedAt || 0) > now30).length,
      rejected: rows.filter((r) => r.status === "rejected" && (r.decidedAt || 0) > now30).length,
    });

    tableHost.replaceChildren(dataTable({
      title: "Requests",
      exportName: "hr_requests",
      pageSize: 15,
      onRowClick: (r) => openDetail(r),
      columns: [
        { key: "when", label: "Submitted", sortVal: (r) => r.createdAt || 0 },
        { key: "empId", label: "ID" },
        { key: "name", label: "Name" },
        { key: "department", label: "Department" },
        {
          key: "direction", label: "From",
          render: (r) => r.direction === "hr" ? badge("📣 HR", "info") : badge("🙋 Employee", "dim"),
          exportVal: (r) => r.direction === "hr" ? "HR" : "Employee",
        },
        { key: "reason", label: "Reason", render: (r) => el("span", { style: { maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis", display: "inline-block", whiteSpace: "nowrap" } }, r.reason) },
        { key: "status", label: "Status", render: (r) => badge(r.status, STATUS_TONE[r.status] || "dim"), exportVal: (r) => r.status },
      ],
      rows,
      empty: "No HR visit requests yet",
    }));
  });

  function openDetail(r) {
    const setStatus = async (status) => {
      await dbUpdate(`hrRequests/${r.empId}/${r._key}`, { status, decidedBy: currentUser?.name || "—", decidedAt: Date.now() });
      toast(`Marked as ${status}`, status === "rejected" ? "warn" : "ok");
    };
    modal({
      title: `${r.name} · ${r.empId}`,
      width: "560px",
      body: el("div", {},
        el("p", {}, el("strong", {}, "Department: "), r.department || "—"),
        el("p", {}, el("strong", {}, "Direction: "), r.direction === "hr" ? "HR asked employee to visit" : "Employee requested to visit HR"),
        el("p", { style: { margin: "10px 0" } }, el("strong", {}, "Reason:")),
        el("p", { class: "card", style: { padding: "12px 14px", whiteSpace: "pre-wrap" } }, r.reason),
        el("p", { class: "muted", style: { fontSize: "12px", marginTop: "10px" } },
          `Submitted ${timeAgo(r.createdAt)}` + (r.decidedBy ? ` · Last action by ${r.decidedBy}` : ""))),
      actions: [
        { label: "Close", class: "btn-ghost", onClick: () => {} },
        r.status === "pending" ? { label: "Mark Seen", class: "btn", onClick: () => setStatus("seen") } : null,
        { label: "Reject", class: "btn-danger", onClick: () => setStatus("rejected") },
        { label: "Approve", class: "btn-primary", onClick: () => setStatus("approved") },
      ].filter(Boolean),
    });
  }

  /** HR-initiated: ask a specific employee to come see HR. Shows in the same list, marked "From: HR". */
  function requestEmployee() {
    const active = activeEmps(employees);
    const empSel = el("select", {}, ...active.map((e) => el("option", { value: e.id }, `${e.name} (${e.id}) — ${e.department || "—"}`)));
    const reason = el("textarea", { rows: "3", placeholder: "e.g. Please come collect your ID card renewal" });

    modal({
      title: "Request an employee to visit HR",
      width: "560px",
      body: el("div", { class: "form-grid" },
        el("label", { class: "field" }, el("span", {}, "Employee"), empSel),
        el("label", { class: "field" }, el("span", {}, "Reason"), reason)),
      actions: [
        { label: "Cancel", class: "btn-ghost", onClick: () => {} },
        {
          label: "Send request", class: "btn-primary",
          onClick: async (e, close) => {
            const emp = active.find((x) => x.id === empSel.value);
            if (!emp || !reason.value.trim()) { toast("Pick an employee and add a reason", "warn"); return true; }
            await dbPush(`hrRequests/${emp.id}`, {
              name: emp.name, department: emp.department || "—",
              reason: reason.value.trim(), status: "pending", direction: "hr",
              createdBy: currentUser?.name || "—", createdAt: Date.now(),
            });
            toast(`Request sent for ${emp.name}`, "ok");
            close();
          },
        },
      ],
    });
  }
}
