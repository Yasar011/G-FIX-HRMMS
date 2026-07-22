/**
 * Settings page (HR Admin) — plant parameters, EmailJS keys, Employee
 * Portal kiosk link, sample-data seeder. User & role management (pending
 * approvals, guest logins, role editing) now lives on its own dedicated
 * page — see pages/users.js.
 */
import { pageWatch, dbUpdate } from "../lib/store.js";
import { can } from "../lib/auth.js";
import { toast, confirmDialog } from "../lib/ui.js";
import { el } from "../lib/utils.js";

export async function render(root) {
  let settings = {};

  /* ---------- plant parameters ---------- */
  const paramDefs = [
    { id: "otRate", label: "Default OT rate (per hour)", type: "number", hint: "Used when an employee has no personal rate" },
    { id: "currency", label: "Currency code", type: "text", hint: "e.g. LKR, USD" },
    { id: "shiftStart", label: "Standard shift start", type: "time", hint: "Late = arriving after start + grace" },
    { id: "shiftEnd", label: "Standard shift end", type: "time", hint: "Early-out = leaving before this" },
    { id: "graceMin", label: "Late grace (minutes)", type: "number", hint: "Default 10" },
    { id: "attendanceThreshold", label: "Attendance alert threshold (%)", type: "number", hint: "Alert when a day falls below this" },
    { id: "leaveEntitlement", label: "Annual leave entitlement (days)", type: "number", hint: "Default 21" },
  ];
  const paramInputs = {};
  const paramsCard = el("div", { class: "card" },
    el("div", { class: "card-head" }, el("h4", {}, "⚙️ Plant parameters")),
    el("div", { class: "form-grid" },
      ...paramDefs.map((d) => {
        const input = el("input", { type: d.type });
        paramInputs[d.id] = input;
        return el("label", { class: "field" }, el("span", {}, d.label), input, el("small", { class: "muted" }, d.hint));
      })),
    el("button", {
      class: "btn btn-primary",
      onclick: async () => {
        const patch = {};
        for (const d of paramDefs) {
          const v = paramInputs[d.id].value;
          patch[d.id] = d.type === "number" ? (v === "" ? null : Number(v)) : (v || null);
        }
        await dbUpdate("settings", patch);
        toast("Settings saved", "ok");
      },
    }, "Save parameters"));

  /* ---------- EmailJS ---------- */
  const emailDefs = [
    { id: "publicKey", label: "Public Key" },
    { id: "serviceId", label: "Service ID" },
    { id: "templateId", label: "Template ID" },
  ];
  const emailInputs = {};
  const emailCard = el("div", { class: "card" },
    el("div", { class: "card-head" }, el("h4", {}, "✉️ EmailJS")),
    el("p", { class: "muted", style: { marginBottom: "10px", fontSize: "13px" } },
      "Create a free account at emailjs.com, add an email service and a template using variables: to_email, subject, message, report_html (+ optional variable attachments attachment_pdf / attachment_xlsx)."),
    el("div", { class: "form-grid" },
      ...emailDefs.map((d) => {
        const input = el("input", { type: "text", autocomplete: "off" });
        emailInputs[d.id] = input;
        return el("label", { class: "field" }, el("span", {}, d.label), input);
      })),
    el("button", {
      class: "btn btn-primary",
      onclick: async () => {
        const patch = {};
        for (const d of emailDefs) patch[d.id] = emailInputs[d.id].value.trim() || null;
        await dbUpdate("settings/emailjs", patch);
        toast("EmailJS settings saved", "ok");
      },
    }, "Save EmailJS settings"));

  /* ---------- Employee Portal kiosk ---------- */
  const kioskLink = `${location.origin}${location.pathname.replace(/index\.html$/, "").replace(/\/$/, "")}/employee-portal.html`;
  const hrReqCard = el("div", { class: "card" },
    el("div", { class: "card-head" }, el("h4", {}, "🙋 Employee Portal")),
    el("p", { class: "muted", style: { fontSize: "13px", marginBottom: "10px" } },
      "A public, no-login page where any employee can look themselves up by Employee ID to request leave and check their own leave status (with a downloadable approved-leave certificate). Only their name and department are ever exposed to it — never phone, email, salary, etc. Requires Anonymous sign-in enabled in Firebase Console → Authentication → Sign-in method."),
    el("div", { style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" } },
      el("input", { type: "text", value: kioskLink, readonly: "", style: { flex: 1, minWidth: "220px", fontSize: "12.5px" } }),
      el("button", {
        class: "btn btn-sm",
        onclick: () => { navigator.clipboard?.writeText(kioskLink); toast("Link copied", "ok"); },
      }, "📋 Copy link")),
    el("p", { class: "muted", style: { fontSize: "12px", marginTop: "8px" } },
      "Leave requests show up under Leaves in the sidebar. User & role management (including pending sign-up approvals) is under Users & Roles."));

  /* ---------- sample data ---------- */
  const seedCard = el("div", { class: "card" },
    el("div", { class: "card-head" }, el("h4", {}, "🧪 Sample data")),
    el("p", { class: "muted", style: { fontSize: "13px", marginBottom: "12px" } },
      "Load a realistic demo plant (~120 employees, 60 days of attendance, budgets, leaves, attrition, recruitment). Replaces existing employees/attendance/budget data — use on a fresh project or for evaluation only."),
    el("button", {
      class: "btn btn-danger",
      onclick: async (e) => {
        if (!(await confirmDialog("Load sample data? This REPLACES employees, attendance, budget, leaves, attrition, vacancies and recruitment nodes."))) return;
        const btn = e.target;
        btn.disabled = true;
        try {
          const { seedDatabase } = await import("../lib/seed.js");
          await seedDatabase((label) => { btn.textContent = label; });
          toast("Sample data loaded — open the Dashboard", "ok");
        } catch (err) { console.error(err); toast("Seeding failed: " + (err.message || err), "err"); }
        finally { btn.disabled = false; btn.textContent = "Load sample data"; }
      },
    }, "Load sample data"));

  /* ---------- about ---------- */
  const aboutCard = el("div", { class: "card" },
    el("div", { class: "card-head" }, el("h4", {}, "ℹ️ About")),
    el("p", { class: "muted", style: { fontSize: "13px" } },
      "Brandix Unit 3 · G-FIX HR Analytics Dashboard"),
    el("p", { class: "muted", style: { fontSize: "12px" } },
      "Developed by NIFT Jodhpur — Yasar CH, Anirudra"));

  root.append(
    el("div", { class: "page-head" }, el("h3", {}, "Settings")),
    el("div", { class: "grid grid-2" }, paramsCard, emailCard),
    hrReqCard,
    can("seed_data") ? seedCard : null,
    aboutCard);

  pageWatch("settings", (s) => {
    settings = s || {};
    for (const d of paramDefs) if (document.activeElement !== paramInputs[d.id]) paramInputs[d.id].value = settings[d.id] ?? "";
    for (const d of emailDefs) if (document.activeElement !== emailInputs[d.id]) emailInputs[d.id].value = settings.emailjs?.[d.id] ?? "";
  });
}
