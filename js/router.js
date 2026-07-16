/**
 * Hash router + sidebar builder.
 *
 * Each page is a lazily-imported ES module exporting `render(container, params)`.
 * Role guards come from the capability matrix in lib/auth.js. On navigation the
 * previous page's realtime subscriptions are disposed via store.disposePage().
 */
import { can, currentUser, canonicalRole } from "./lib/auth.js";
import { disposePage } from "./lib/store.js";
import { el } from "./lib/utils.js";
import { emptyState } from "./lib/ui.js";
import { track } from "./lib/firebase.js";

/**
 * Page registry. `cap` is the capability required to see the page
 * (null = everyone signed in). `group` clusters related pages under a
 * section label in the sidebar so a new user isn't faced with one long
 * flat list of 17 items.
 */
export const PAGES = [
  { id: "my_portal", title: "My Portal", icon: "👤", cap: "view_self_service", group: "Self Service", mod: () => import("./pages/my_portal.js") },
  { id: "dashboard", title: "Dashboard", icon: "🏠", cap: "view_dashboard", group: "Overview", mod: () => import("./pages/dashboard.js") },
  { id: "attendance", title: "Attendance", icon: "🗓️", cap: "view_dashboard", group: "Attendance & Data", mod: () => import("./pages/attendance.js") },
  { id: "uploads", title: "Data Upload", icon: "⬆️", cap: "upload_attendance", group: "Attendance & Data", mod: () => import("./pages/uploads.js") },
  { id: "employees", title: "Employees", icon: "👥", cap: "view_dashboard", group: "People", mod: () => import("./pages/employees.js") },
  { id: "departments", title: "Departments", icon: "🏭", cap: "view_dashboard", group: "People", mod: () => import("./pages/departments.js") },
  { id: "budget", title: "Budget", icon: "💰", cap: "view_dashboard", group: "Planning", mod: () => import("./pages/budget.js") },
  { id: "recruitment", title: "Recruitment", icon: "🧲", cap: "view_dashboard", group: "Planning", mod: () => import("./pages/recruitment.js") },
  { id: "leaves", title: "Leaves", icon: "🌴", cap: "view_dashboard", group: "HR Operations", mod: () => import("./pages/leaves.js") },
  { id: "overtime", title: "Overtime", icon: "⏱️", cap: "view_dashboard", group: "HR Operations", mod: () => import("./pages/overtime.js") },
  { id: "attrition", title: "Attrition", icon: "📉", cap: "view_dashboard", group: "HR Operations", mod: () => import("./pages/attrition.js") },
  { id: "performance", title: "Performance", icon: "🚀", cap: "view_dashboard", group: "HR Operations", mod: () => import("./pages/performance.js") },
  { id: "reports", title: "Reports", icon: "📄", cap: "view_reports", group: "Insights", mod: () => import("./pages/reports.js") },
  { id: "email", title: "Email Automation", icon: "✉️", cap: "send_email", group: "Insights", mod: () => import("./pages/email.js") },
  { id: "notifications", title: "Notifications", icon: "🔔", cap: "view_dashboard", group: "Insights", mod: () => import("./pages/notifications.js") },
  { id: "analytics", title: "Analytics", icon: "📈", cap: "view_dashboard", group: "Insights", mod: () => import("./pages/analytics.js") },
  { id: "settings", title: "Settings", icon: "⚙️", cap: "manage_settings", group: "Admin", mod: () => import("./pages/settings.js") },
  { id: "profile", title: "Profile", icon: "👤", cap: null, group: "Admin", mod: () => import("./pages/profile.js") },
];

let current = null;

/** Build sidebar links for the signed-in user's role, grouped under section labels. */
export function buildSidebar() {
  const nav = document.getElementById("sidebar-nav");
  nav.replaceChildren();
  let lastGroup = null;
  for (const p of PAGES) {
    if (p.cap && !can(p.cap)) continue;
    if (p.group !== lastGroup) {
      nav.append(el("div", { class: "nav-section-label" }, p.group));
      lastGroup = p.group;
    }
    nav.append(el("button", {
      class: "nav-item", "data-page": p.id, title: p.title,
      onclick: () => { location.hash = `#/${p.id}`; },
    },
      el("span", { class: "nav-icon" }, p.icon),
      el("span", { class: "nav-label" }, p.title)));
  }
}

/** Navigate to the page named in the current hash. */
export async function route() {
  if (!currentUser) return;

  // Parse the hash safely: "#/departments/Sewing" → id="departments", params=["Sewing"]
  const rawHash = location.hash || "";
  const segments = rawHash.replace(/^#\//, "").split("/");
  const id = segments[0] || "";
  const params = segments.slice(1); // sub-path params passed to render()
  const def = canonicalRole(currentUser.role) === "employee" ? "my_portal" : "dashboard";

  // Find the matching page or fall back to default
  const page = (id ? PAGES.find((p) => p.id === id) : null)
    || PAGES.find((p) => p.id === def)
    || PAGES[0];

  const container = document.getElementById("page-container");

  // Guard
  if (page.cap && !can(page.cap)) {
    container.replaceChildren(emptyState("🔒", "Access restricted", "Your role does not have permission to view this page."));
    return;
  }

  // Highlight nav + title
  document.querySelectorAll(".nav-item[data-page]").forEach((n) =>
    n.classList.toggle("active", n.dataset.page === page.id));
  document.getElementById("page-title").textContent = page.title;
  document.querySelector(".app")?.classList.remove("sidebar-open");

  // Dispose previous page's listeners, then render
  disposePage();
  current = page.id;
  container.replaceChildren(el("div", { class: "page" },
    el("div", { class: "skeleton", style: { height: "110px" } }),
    el("div", { class: "skeleton", style: { height: "300px" } })));
  try {
    const mod = await page.mod();
    if (current !== page.id) return;
    const root = el("div", { class: "page" });
    container.replaceChildren(root);
    await mod.render(root, params);
    track("page_view", { page: page.id });
  } catch (e) {
    console.error(`Failed to render page "${page.id}"`, e);
    container.replaceChildren(emptyState("⚠️", "Something went wrong", String(e.message || e)));
  }
}

/** Start listening to hash changes. */
export function initRouter() {
  window.addEventListener("hashchange", route);
}
