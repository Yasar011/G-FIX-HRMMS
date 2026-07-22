/**
 * Users & Roles page — dedicated management area for user accounts.
 * Moved from Settings so it has its own sidebar entry and full-page space.
 *
 * Features:
 *   - Pending approvals (new sign-ups waiting for a role)
 *   - Full users table with role/department editor + password reset
 *   - Create guest / staff login with one click (HR Admin only)
 */
import { pageWatch, dbUpdate, dbRemove, getCached } from "../lib/store.js";
import { can, ROLES, roleLabel, canonicalRole, currentUser, createGuestAccount } from "../lib/auth.js";
import { toast, modal, confirmDialog, badge } from "../lib/ui.js";
import { dataTable } from "../components/table.js";
import { el, toList, timeAgo, uniq } from "../lib/utils.js";
import { empList, activeEmps } from "../lib/metrics.js";
import { auth, sendPasswordResetEmail } from "../lib/firebase.js";

export async function render(root) {
  if (!can("manage_users")) {
    root.append(
      el("div", { class: "card", style: { padding: "40px", textAlign: "center" } },
        el("p", { style: { fontSize: "48px", marginBottom: "12px" } }, "🔒"),
        el("h3", {}, "Access Restricted"),
        el("p", { class: "muted" }, "Only HR Admins can manage users and roles."))
    );
    return;
  }

  const pendingHost = el("div");
  const usersHost = el("div");

  root.append(
    el("div", { class: "page-head" }, el("h3", {}, "👥 Users & Roles")),

    // ─── Guest / Staff login creator ───────────────────────────────────────
    buildGuestCard(),

    // ─── Pending approvals + full users table (live) ───────────────────────
    pendingHost,
    usersHost
  );

  pageWatch("users", (v) => {
    const all = toList(v, "uid");
    const pending = all.filter((u) => canonicalRole(u.role) === "pending");
    const approved = all.filter((u) => canonicalRole(u.role) !== "pending");

    // Pending approvals card
    pendingHost.replaceChildren(
      pending.length
        ? el("div", { class: "card" },
            el("div", { class: "card-head" },
              el("h4", {}, "⏳ Pending Approvals"),
              el("div", { class: "spacer" }),
              badge(String(pending.length), "warn")),
            el("p", { class: "muted", style: { fontSize: "12.5px", marginBottom: "10px" } },
              "New sign-ups wait here (email verified) until an HR Admin assigns a role."),
            ...pending.map(pendingRow))
        : null
    );

    // Full users table
    usersHost.replaceChildren(dataTable({
      title: `All Accounts (${approved.length})`,
      exportName: "users",
      pageSize: 15,
      columns: [
        { key: "name", label: "Name" },
        { key: "email", label: "Email" },
        {
          key: "role", label: "Role",
          render: (r) => badge(roleLabel(r.role), canonicalRole(r.role) === "hr_admin" ? "bad" : canonicalRole(r.role) === "management" ? "dim" : "info"),
          exportVal: (r) => roleLabel(r.role),
        },
        { key: "department", label: "Department" },
        { key: "empId", label: "Emp ID" },
        {
          key: "createdAt", label: "Joined",
          render: (r) => timeAgo(r.createdAt),
          exportVal: (r) => r.createdAt ? new Date(r.createdAt).toISOString() : "",
        },
        {
          key: "_act", label: "Actions", exportVal: () => "",
          render: (r) => el("div", { style: { display: "flex", gap: "6px" } },
            el("button", { class: "btn btn-sm", onclick: (e) => { e.stopPropagation(); editUser(r); } }, "✏️ Edit role"),
            el("button", { class: "btn btn-sm btn-ghost", onclick: (e) => { e.stopPropagation(); resetPassword(r); } }, "🔑 Reset pw"),
            r.uid === currentUser?.uid
              ? null
              : el("button", { class: "btn btn-sm btn-danger", onclick: (e) => { e.stopPropagation(); deleteUser(r); } }, "🗑 Delete")),
        },
      ],
      rows: approved,
      empty: "No user accounts yet.",
    }));
  });
}

/* ─── Pending-approval row ──────────────────────────────────────────────── */
function pendingRow(u) {
  const roleSel = el("select", {}, ...Object.entries(ROLES).map(([v, l]) => el("option", { value: v }, l)));
  const deptInput = el("input", { type: "text", value: u.department || "", placeholder: "Department", style: { minWidth: "140px" } });
  return el("div", { class: "stat-row", style: { alignItems: "center", flexWrap: "wrap", gap: "10px", padding: "10px 0", borderBottom: "1px solid var(--line)" } },
    el("div", {},
      el("strong", {}, u.name || u.email),
      el("br"),
      el("small", { class: "muted" }, `${u.email} · Emp ID: ${u.empId || "—"} · Dept: ${u.department || "—"} · ${timeAgo(u.createdAt)}`)),
    el("div", { style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" } },
      roleSel, deptInput,
      el("button", {
        class: "btn btn-sm btn-primary",
        onclick: async (e) => {
          e.stopPropagation();
          await dbUpdate(`users/${u.uid}`, { role: roleSel.value, department: deptInput.value.trim() });
          toast(`${u.name || u.email} approved as ${roleLabel(roleSel.value)}`, "ok");
        },
      }, "✅ Approve"),
      el("button", {
        class: "btn btn-sm btn-ghost",
        onclick: async (e) => {
          e.stopPropagation();
          if (!(await confirmDialog(`Reject and delete the sign-up request from ${u.name || u.email}?`))) return;
          await dbRemove(`users/${u.uid}`);
          toast("Sign-up rejected", "warn");
        },
      }, "✕ Reject")));
}

/* ─── Create guest / staff login ────────────────────────────────────────── */
function buildGuestCard() {
  const nameI  = el("input", { type: "text",  placeholder: "Full name" });
  const emailI = el("input", { type: "email", placeholder: "login@brandix.com", autocomplete: "off" });
  const passI  = el("input", { type: "text",  placeholder: "Temporary password (min 6 chars)", autocomplete: "off" });
  const empIdI = el("input", { type: "text",  placeholder: "Employee ID (optional)" });
  const deptI  = el("input", { type: "text",  placeholder: "Department (optional)", list: "guest-depts" });
  const dl = el("datalist", { id: "guest-depts" },
    ...uniq(activeEmps(empList(getCached("employees"))), (e) => e.department).map((d) => el("option", { value: d })));

  const roleI = el("select", {},
    el("option", { value: "employee" },       "Employee (Self-service only)"),
    el("option", { value: "management" },     "Viewer / Management (read-only)"),
    el("option", { value: "dept_manager" },   "Department Manager"),
    el("option", { value: "hr_executive" },   "HR Executive (day-to-day HR)"),
    el("option", { value: "hr_admin" },       "HR Admin (full control)"));

  const expiryI = el("input", { type: "date" });
  const resultBanner = el("div");

  return el("div", { class: "card" },
    el("div", { class: "card-head" },
      el("h4", {}, "🔑 Create Guest / Staff Login"),
      el("small", { class: "muted" }, "No email verification or approval wait — they can log in immediately")),
    el("p", { class: "muted", style: { fontSize: "12.5px", marginBottom: "12px" } },
      "Create a ready-to-use login and share the username + password. Set an expiry date for temporary guests — access is blocked automatically after it. You stay signed in as yourself."),
    el("div", { class: "form-grid" },
      el("label", { class: "field" }, el("span", {}, "Full Name"),          nameI),
      el("label", { class: "field" }, el("span", {}, "Username (email)"),   emailI),
      el("label", { class: "field" }, el("span", {}, "Temporary Password"), passI),
      el("label", { class: "field" }, el("span", {}, "Role"),               roleI),
      el("label", { class: "field" }, el("span", {}, "Employee ID"),        empIdI),
      el("label", { class: "field" }, el("span", {}, "Department"),         deptI, dl),
      el("label", { class: "field" }, el("span", {}, "Expires (optional — leave blank for permanent)"), expiryI)),
    el("button", {
      class: "btn btn-primary", style: { marginTop: "12px" },
      onclick: async (e) => {
        const email    = emailI.value.trim();
        const password = passI.value;
        if (!email || password.length < 6) { toast("Enter an email and a password of at least 6 characters", "warn"); return; }
        const btn = e.target; btn.disabled = true; btn.textContent = "Creating…";
        try {
          const expiresAt = expiryI.value ? new Date(expiryI.value + "T23:59:59").getTime() : null;
          await createGuestAccount({
            email, password,
            name: nameI.value.trim(),
            role: roleI.value,
            department: deptI.value.trim(),
            empId: empIdI.value.trim(),
            expiresAt,
          });
          resultBanner.replaceChildren(
            el("div", { class: "card", style: { padding: "14px 18px", marginTop: "12px", border: "1px solid #34d399" } },
              el("p", {}, "✅ Login created successfully. Share these credentials securely:"),
              el("p", {}, el("strong", {}, "Username: "), email),
              el("p", {}, el("strong", {}, "Password: "), password),
              el("p", { class: "muted", style: { fontSize: "12px" } },
                `Role: ${roleLabel(roleI.value)}${expiryI.value ? " · Expires " + expiryI.value : ""} · They sign in on the normal login page.`)));
          toast("Login created", "ok");
          nameI.value = emailI.value = passI.value = empIdI.value = deptI.value = expiryI.value = "";
        } catch (err) {
          toast(err?.message || "Could not create the login", "err", 7000);
        } finally { btn.disabled = false; btn.textContent = "Create Login"; }
      },
    }, "Create Login"),
    resultBanner);
}

/* ─── Role editor ───────────────────────────────────────────────────────── */
function editUser(user) {
  const roleSel   = el("select", {}, ...Object.entries(ROLES).map(([v, l]) => el("option", { value: v }, l)));
  roleSel.value = canonicalRole(user.role) || "management";
  const deptInput = el("input", { type: "text", value: user.department || "", list: "set-depts" });
  const empIdInput = el("input", { type: "text", value: user.empId || "", placeholder: "Employee ID (links to their record)" });
  const dl = el("datalist", { id: "set-depts" },
    ...uniq(activeEmps(empList(getCached("employees"))), (e) => e.department).map((d) => el("option", { value: d })));

  modal({
    title: `Edit User — ${user.name || user.email}`,
    body: el("div", {},
      el("label", { class: "field" }, el("span", {}, "Role"), roleSel),
      el("label", { class: "field" }, el("span", {}, "Department (required for Dept. Manager scope)"), deptInput, dl),
      el("label", { class: "field" }, el("span", {}, "Employee ID (links account to employee record)"), empIdInput),
      user.uid === currentUser?.uid
        ? el("p", { class: "text-warn", style: { fontSize: "12.5px" } }, "⚠ You are editing your own account.")
        : null),
    actions: [
      { label: "Cancel", class: "btn-ghost", onClick: () => {} },
      {
        label: "Save", class: "btn-primary",
        onClick: async () => {
          await dbUpdate(`users/${user.uid}`, {
            role: roleSel.value,
            department: deptInput.value.trim(),
            empId: empIdInput.value.trim(),
          });
          toast("User updated", "ok");
        },
      },
    ],
  });
}

/* ─── Password reset ────────────────────────────────────────────────────── */
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

/* ─── Delete a user account ─────────────────────────────────────────────── */
async function deleteUser(user) {
  if (!(await confirmDialog(
    `Remove ${user.name || user.email}'s access? This deletes their app account record (role/department/permissions). ` +
    `It does not delete their underlying sign-in credentials — if they try to log in again they'll land back as "Pending" until re-approved.`,
  ))) return;
  await dbRemove(`users/${user.uid}`);
  toast(`${user.name || user.email} removed`, "warn");
}
