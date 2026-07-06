/**
 * Email Automation page — send any report now, toggle automation rules,
 * view the delivery log. Requires the EmailJS keys set in Settings.
 */
import { pageWatch, dbUpdate } from "../lib/store.js";
import { AUTOMATION_RULES, sendReportEmail, emailReady, runAutomation } from "../lib/emailer.js";
import { REPORTS } from "../lib/reports.js";
import { dataTable } from "../components/table.js";
import { toast, badge } from "../lib/ui.js";
import { el, ym, today, timeAgo, toList } from "../lib/utils.js";

export async function render(root) {
  const ready = await emailReady();
  let auto = {};

  /* ---------- status ---------- */
  const statusCard = el("div", { class: "card", style: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" } },
    el("span", { style: { fontSize: "22px" } }, ready ? "✅" : "⚠️"),
    el("div", { style: { flex: 1 } },
      el("h4", {}, ready ? "EmailJS connected" : "EmailJS not configured"),
      el("small", { class: "muted" }, ready
        ? "Emails send through your EmailJS service. Attachments require an EmailJS template with variable attachments (attachment_pdf / attachment_xlsx)."
        : "Add your EmailJS Public Key, Service ID and Template ID in Settings → Email to enable sending.")),
    ready ? el("button", { class: "btn btn-sm", onclick: async () => { toast("Checking due automations…"); await runAutomation(); toast("Automation check complete", "ok"); } }, "▶ Run automation now")
      : el("button", { class: "btn btn-primary btn-sm", onclick: () => { location.hash = "#/settings"; } }, "Open Settings"));

  /* ---------- send-now ---------- */
  const toInput = el("input", { type: "email", placeholder: "recipient@brandix.com", style: { minWidth: "240px" } });
  const reportSel = el("select", {}, ...REPORTS.map((r) => el("option", { value: r.id }, `${r.icon} ${r.title}`)));
  const pdfChk = el("input", { type: "checkbox", checked: "" });
  const xlsxChk = el("input", { type: "checkbox", checked: "" });
  const sendBtn = el("button", {
    class: "btn btn-primary",
    onclick: async () => {
      const to = toInput.value.trim();
      if (!to) { toast("Enter a recipient email", "warn"); return; }
      if (!ready) { toast("Configure EmailJS in Settings first", "warn"); return; }
      sendBtn.disabled = true;
      try {
        const res = await sendReportEmail(reportSel.value, { to, attachPdf: pdfChk.checked, attachXlsx: xlsxChk.checked });
        toast(`Sent “${res.subject}” (${res.rows} rows)`, "ok");
      } catch (e) { console.error(e); toast(e.message || "Send failed", "err"); }
      finally { sendBtn.disabled = false; }
    },
  }, "✉ Send now");

  const sendCard = el("div", { class: "card" },
    el("div", { class: "card-head" }, el("h4", {}, "Send a report now")),
    el("div", { style: { display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" } },
      el("label", { class: "field", style: { margin: 0 } }, el("span", {}, "Report"), reportSel),
      el("label", { class: "field", style: { margin: 0, flex: 1 } }, el("span", {}, "Recipient(s)"), toInput),
      el("label", { class: "inline" }, pdfChk, "Attach PDF"),
      el("label", { class: "inline" }, xlsxChk, "Attach Excel"),
      sendBtn));

  /* ---------- automation rules ---------- */
  const recipientsInput = el("input", {
    type: "text", placeholder: "hr@brandix.com, gm@brandix.com",
    onchange: () => dbUpdate("emailAutomation", { recipients: recipientsInput.value.trim() }),
  });
  const rulesHost = el("div", { class: "grid grid-2" });
  const rulesCard = el("div", { class: "card" },
    el("div", { class: "card-head" }, el("h4", {}, "Automation rules"),
      el("div", { class: "spacer" }),
      el("small", { class: "muted" }, "Runs while the dashboard is open (every 30 min); duplicates are guarded in the database")),
    el("label", { class: "field" }, el("span", {}, "Automation recipients"), recipientsInput),
    rulesHost);

  /* ---------- log ---------- */
  const logHost = el("div");

  root.append(
    el("div", { class: "page-head" }, el("h3", {}, "Email Automation")),
    statusCard, sendCard, rulesCard, logHost);

  pageWatch("emailAutomation", (v) => {
    auto = v || {};
    if (document.activeElement !== recipientsInput) recipientsInput.value = auto.recipients || "";
    drawRules();
  });
  pageWatch("emailLogs", (v) => {
    const rows = toList(v, "_key").sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 200)
      .map((l) => ({ ...l, when: new Date(l.ts).toLocaleString() }));
    logHost.replaceChildren(dataTable({
      title: "Delivery log",
      exportName: "email_log",
      pageSize: 10,
      columns: [
        { key: "when", label: "Time", sortVal: (r) => r.ts },
        { key: "to", label: "To" },
        { key: "subject", label: "Subject" },
        { key: "status", label: "Status", render: (r) => badge(r.status, r.status === "sent" ? "ok" : "bad"), exportVal: (r) => r.status },
        { key: "error", label: "Error" },
      ],
      rows,
      empty: "No emails sent yet",
    }));
  });

  function drawRules() {
    rulesHost.replaceChildren(...AUTOMATION_RULES.map((rule) => {
      const enabled = !!auto.enabled?.[rule.id];
      const last = auto.lastSent?.[rule.id];
      const chk = el("input", {
        type: "checkbox",
        onchange: () => dbUpdate("emailAutomation/enabled", { [rule.id]: chk.checked }),
      });
      chk.checked = enabled;
      return el("div", { class: "card", style: { padding: "13px 15px", display: "flex", gap: "12px", alignItems: "center" } },
        el("label", { class: "inline", style: { flex: 1 } }, chk,
          el("div", {}, el("strong", {}, rule.label),
            el("p", { class: "muted", style: { fontSize: "12px" } }, rule.desc),
            last ? el("small", { class: "muted" }, `Last sent ${timeAgo(last)}`) : null)),
        badge(enabled ? "On" : "Off", enabled ? "ok" : "dim"));
    }));
  }
}
