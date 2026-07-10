/**
 * Settings page (HR Admin) — plant parameters, EmailJS keys, user & role
 * management, sample-data seeder.
 */
import { pageWatch, dbUpdate } from "../lib/store.js";
import { can, ROLES, roleLabel, canonicalRole, currentUser } from "../lib/auth.js";
import { toast, modal, confirmDialog, badge } from "../lib/ui.js";
import { dataTable } from "../components/table.js";
import { el, toList, timeAgo, uniq } from "../lib/utils.js";
import { empList, activeEmps } from "../lib/metrics.js";
import { getCached } from "../lib/store.js";
import { auth, sendPasswordResetEmail } from "../lib/firebase.js";

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
  const hrReqToggle = el("input", {
    type: "checkbox",
    onchange: async () => {
      await dbUpdate("settings", { hrRequestEnabled: hrReqToggle.checked });
      toast(hrReqToggle.checked ? "'Visit HR' option enabled" : "'Visit HR' option disabled", "ok");
    },
  });
  const hrReqCard = el("div", { class: "card" },
    el("div", { class: "card-head" }, el("h4", {}, "🙋 Employee Portal")),
    el("p", { class: "muted", style: { fontSize: "13px", marginBottom: "10px" } },
      "A public, no-login page where any employee can look themselves up by Employee ID to request leave, check their own leave status (with a downloadable approved-leave certificate), and request to visit HR. Only their name and department are ever exposed to it — never phone, email, salary, etc. The toggle below controls the \"Visit HR\" option only; leave requests are always available. Requires Anonymous sign-in enabled in Firebase Console → Authentication → Sign-in method."),
    el("label", { class: "inline", style: { marginBottom: "14px" } }, hrReqToggle, "Enable the 'Visit HR' option"),
    el("div", { style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" } },
      el("input", { type: "text", value: kioskLink, readonly: "", style: { flex: 1, minWidth: "220px", fontSize: "12.5px" } }),
      el("button", {
        class: "btn btn-sm",
        onclick: () => { navigator.clipboard?.writeText(kioskLink); toast("Link copied", "ok"); },
      }, "📋 Copy link")),
    el("p", { class: "muted", style: { fontSize: "12px", marginTop: "8px" } },
      "Leave requests show up under Leaves, HR visit requests show up under HR Visit Requests, both in the sidebar."));

  /* ---------- users & roles ---------- */
  const pendingHost = el("div");
  const usersHost = el("div");

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
    pendingHost,
    usersHost,
    can("seed_data") ? seedCard : null,
    aboutCard);

  pageWatch("settings", (s) => {
    settings = s || {};
    for (const d of paramDefs) if (document.activeElement !== paramInputs[d.id]) paramInputs[d.id].value = settings[d.id] ?? "";
    for (const d of emailDefs) if (document.activeElement !== emailInputs[d.id]) emailInputs[d.id].value = settings.emailjs?.[d.id] ?? "";
    if (document.activeElement !== hrReqToggle) hrReqToggle.checked = !!settings.hrRequestEnabled;
  });

  pageWatch("users", (v) => {
    const all = toList(v, "uid");
    const pending = all.filter((u) => canonicalRole(u.role) === "pending");
    const approved = all.filter((u) => canonicalRole(u.role) !== "pending");

    pendingHost.replaceChildren(pending.length ? el("div", { class: "card" },
      el("div", { class: "card-head" },
        el("h4", {}, "⏳ Pending Approvals"), el("div", { class: "spacer" }),
        badge(String(pending.length), "warn")),
      el("p", { class: "muted", style: { fontSize: "12.5px", marginBottom: "10px" } },
        "New sign-ups wait here (email already verified) until an HR Admin picks a role and department for them."),
      ...pending.map((u) => pendingRow(u))) : null);

    usersHost.replaceChildren(dataTable({
      title: "👥 Users & roles",
      exportName: "users",
      pageSize: 10,
      columns: [
        { key: "name", label: "Name" },
        { key: "email", label: "Email" },
        { key: "role", label: "Role", render: (r) => badge(roleLabel(r.role), canonicalRole(r.role) === "hr_admin" ? "bad" : canonicalRole(r.role) === "management" ? "dim" : "info"), exportVal: (r) => roleLabel(r.role) },
        { key: "department", label: "Department (for Dept. Managers)" },
        { key: "createdAt", label: "Joined", render: (r) => timeAgo(r.createdAt), exportVal: (r) => r.createdAt ? new Date(r.createdAt).toISOString() : "" },
        {
          key: "_act", label: "", exportVal: () => "",
          render: (r) => el("div", { style: { display: "flex", gap: "6px" } },
            el("button", { class: "btn btn-sm", onclick: (e) => { e.stopPropagation(); editUser(r); } }, "Edit role"),
            el("button", { class: "btn btn-sm", onclick: (e) => { e.stopPropagation(); resetPassword(r); } }, "Reset password")),
        },
      ],
      rows: approved,
      empty: "No users yet",
    }));
  });

  /** One pending-approval row: pick a role + department, then grant access. */
  function pendingRow(u) {
    const roleSel = el("select", {}, ...Object.entries(ROLES).map(([v, l]) => el("option", { value: v }, l)));
    const deptInput = el("input", { type: "text", value: u.department || "", placeholder: "Department", style: { minWidth: "140px" } });
    return el("div", { class: "stat-row", style: { alignItems: "center", flexWrap: "wrap", gap: "10px" } },
      el("div", {},
        el("strong", {}, u.name || u.email),
        el("br"),
        el("small", { class: "muted" }, `${u.email} · Emp ID: ${u.empId || "—"} · Requested dept: ${u.department || "—"} · ${timeAgo(u.createdAt)}`)),
      el("div", { style: { display: "flex", gap: "8px", alignItems: "center" } },
        roleSel, deptInput,
        el("button", {
          class: "btn btn-sm btn-primary",
          onclick: async (e) => {
            e.stopPropagation();
            await dbUpdate(`users/${u.uid}`, { role: roleSel.value, department: deptInput.value.trim() });
            toast(`${u.name || u.email} approved as ${roleLabel(roleSel.value)}`, "ok");
          },
        }, "✅ Approve")));
  }

  /** Send a Firebase password-reset email — the secure way to unlock/reset a user's login. */
  async function resetPassword(user) {
    if (!user.email) { toast("This user has no email on file", "warn"); return; }
    if (!(await confirmDialog(`Send a password reset email to ${user.email}?`, { danger: false }))) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      toast(`Reset email sent to ${user.email}`, "ok");
    } catch (e) {
      toast(e?.message || "Could not send reset email", "err");
    }
  }

  /** Role/department editor for a user account. */
  function editUser(user) {
    const roleSel = el("select", {}, ...Object.entries(ROLES).map(([v, l]) => el("option", { value: v }, l)));
    roleSel.value = canonicalRole(user.role) || "management";
    const deptInput = el("input", { type: "text", value: user.department || "", list: "set-depts" });
    const dl = el("datalist", { id: "set-depts" },
      ...uniq(activeEmps(empList(getCached("employees"))), (e) => e.department).map((d) => el("option", { value: d })));

    modal({
      title: `Edit user — ${user.name || user.email}`,
      body: el("div", {},
        el("label", { class: "field" }, el("span", {}, "Role"), roleSel),
        el("label", { class: "field" }, el("span", {}, "Department (required for Department Manager scope)"), deptInput, dl),
        user.uid === currentUser?.uid ? el("p", { class: "text-warn", style: { fontSize: "12.5px" } }, "⚠ You are editing your own account — demoting yourself removes admin access.") : null),
      actions: [
        { label: "Cancel", class: "btn-ghost", onClick: () => {} },
        {
          label: "Save", class: "btn-primary",
          onClick: async () => {
            await dbUpdate(`users/${user.uid}`, { role: roleSel.value, department: deptInput.value.trim() });
            toast("User updated", "ok");
          },
        },
      ],
    });
  }
}
