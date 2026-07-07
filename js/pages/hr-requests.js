/**
 * HR Visit Requests — admin view of the public "Request to Visit HR" kiosk
 * (hr-request.html). Employees submit these without logging in; HR staff
 * review, mark seen, and approve/reject them here.
 */
import { pageWatch, dbUpdate } from "../lib/store.js";
import { toast, badge, modal } from "../lib/ui.js";
import { dataTable } from "../components/table.js";
import { kpiGrid } from "../components/kpi.js";
import { el, timeAgo, toList, esc } from "../lib/utils.js";
import { currentUser } from "../lib/auth.js";

const C = { ok: "#34d399", warn: "#fbbf24", bad: "#f87171", info: "#38bdf8", brand: "#6366f1" };
const STATUS_TONE = { pending: "warn", seen: "info", approved: "ok", rejected: "bad" };

export async function render(root) {
  const kioskLink = `${location.origin}${location.pathname.replace(/index\.html$/, "").replace(/\/$/, "")}/hr-request.html`;

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
    el("div", { class: "page-head" }, el("h3", {}, "HR Visit Requests")),
    linkCard, kpis, tableHost);

  pageWatch("hrRequests", (v) => {
    const rows = toList(v, "_key").sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
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
        { key: "reason", label: "Reason", render: (r) => el("span", { style: { maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", display: "inline-block", whiteSpace: "nowrap" } }, r.reason) },
        { key: "status", label: "Status", render: (r) => badge(r.status, STATUS_TONE[r.status] || "dim"), exportVal: (r) => r.status },
      ],
      rows,
      empty: "No HR visit requests yet",
    }));
  });

  function openDetail(r) {
    const setStatus = async (status) => {
      await dbUpdate(`hrRequests/${r._key}`, { status, decidedBy: currentUser?.name || "—", decidedAt: Date.now() });
      toast(`Marked as ${status}`, status === "rejected" ? "warn" : "ok");
    };
    modal({
      title: `${r.name} · ${r.empId}`,
      width: "560px",
      body: el("div", {},
        el("p", {}, el("strong", {}, "Department: "), r.department || "—"),
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
}
