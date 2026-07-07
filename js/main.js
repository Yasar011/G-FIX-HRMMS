/**
 * App entry point: theme, auth flow, shell wiring (sidebar, search, shortcuts).
 */
import { isConfigPlaceholder } from "./lib/firebase.js";
import { initAuth, login, register, logout, currentUser, roleLabel } from "./lib/auth.js";
import { initTheme, toast, modal } from "./lib/ui.js";
import { initRouter, route, buildSidebar } from "./router.js";
import { initNotifications } from "./lib/notify.js";
import { watch } from "./lib/store.js";
import { el, esc, initials, debounce } from "./lib/utils.js";

const $ = (id) => document.getElementById(id);

initTheme();
initRouter();
wireShell();
wireLogin();

if (isConfigPlaceholder) {
  $("loading-screen").classList.add("hidden");
  $("login-screen").classList.remove("hidden");
  showConfigHelp();
} else {
  initAuth(onAuthChanged);
}

let shellReady = false;

/** React to sign-in/out and live profile (role) changes. */
function onAuthChanged(user) {
  $("loading-screen").classList.add("hidden");
  if (!user) {
    shellReady = false;
    $("app").classList.add("hidden");
    $("login-screen").classList.remove("hidden");
    return;
  }
  $("login-screen").classList.add("hidden");
  $("app").classList.remove("hidden");

  // Topbar identity
  $("user-name").textContent = user.name || user.email;
  $("user-role").textContent = roleLabel(user.role);
  const av = $("user-avatar");
  if (user.photo) av.innerHTML = `<img src="${esc(user.photo)}" alt="">`;
  else av.textContent = initials(user.name || user.email);

  buildSidebar(); // role may have changed → rebuild links

  if (!shellReady) {
    shellReady = true;
    initNotifications();
    initGlobalSearch();
    // Email automation heartbeat (lazy — EmailJS may not be configured yet).
    import("./lib/emailer.js").then((m) => m.startAutomationLoop()).catch(console.error);
    if (!location.hash) location.hash = "#/dashboard";
  }
  route();
}

/* ---------------- Login form ---------------- */

function wireLogin() {
  const form = $("login-form");
  const errBox = $("login-error");
  let mode = "login";

  $("register-toggle").addEventListener("click", () => {
    mode = mode === "login" ? "register" : "login";
    $("login-submit").textContent = mode === "login" ? "Sign in" : "Create account";
    $("register-toggle").textContent = mode === "login" ? "Create an account" : "Back to sign in";
    errBox.classList.add("hidden");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errBox.classList.add("hidden");
    const btn = $("login-submit");
    btn.disabled = true;
    btn.textContent = "Please wait…";
    try {
      const email = $("login-email").value.trim();
      const pass = $("login-password").value;
      if (mode === "login") await login(email, pass);
      else { await register(email, pass); toast("Account created — welcome!", "ok"); }
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.remove("hidden");
    } finally {
      btn.disabled = false;
      btn.textContent = mode === "login" ? "Sign in" : "Create account";
    }
  });
}

/* ---------------- Shell chrome ---------------- */

function wireShell() {
  const app = $("app");
  $("sidebar-toggle").addEventListener("click", () => {
    if (matchMedia("(max-width: 980px)").matches) app.classList.toggle("sidebar-open");
    else app.classList.toggle("sidebar-collapsed");
  });
  $("sidebar-collapse").addEventListener("click", () => app.classList.add("sidebar-collapsed"));
  $("logout-btn").addEventListener("click", async () => { await logout(); location.hash = ""; });
  $("user-chip").addEventListener("click", () => { location.hash = "#/profile"; });

  // Keyboard shortcuts: / focus search, Ctrl+B sidebar, Ctrl+D theme, g+key nav
  document.addEventListener("keydown", (e) => {
    const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
    if (e.key === "/" && !typing) { e.preventDefault(); $("global-search").focus(); }
    if (e.ctrlKey && e.key.toLowerCase() === "b") { e.preventDefault(); app.classList.toggle("sidebar-collapsed"); }
    if (e.ctrlKey && e.key.toLowerCase() === "d") { e.preventDefault(); $("theme-toggle").click(); }
  });
}

/* ---------------- Global search ---------------- */

function initGlobalSearch() {
  const input = $("global-search");
  const results = $("global-search-results");
  let employees = {};
  watch("employees", (v) => { employees = v || {}; });

  const hide = () => results.classList.add("hidden");
  document.addEventListener("click", (e) => { if (!e.target.closest(".global-search")) hide(); });

  input.addEventListener("input", debounce(() => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { hide(); return; }
    const matches = [];

    // Employees: name / id / designation / department / section / module / buyer
    for (const [id, e] of Object.entries(employees)) {
      const hay = `${id} ${e.name} ${e.designation} ${e.department} ${e.section} ${e.module} ${e.buyer}`.toLowerCase();
      if (hay.includes(q)) matches.push({ kind: "employee", id, label: e.name, sub: `${id} · ${e.designation || ""} · ${e.department || ""}` });
      if (matches.length >= 8) break;
    }
    // Departments
    const depts = [...new Set(Object.values(employees).map((e) => e.department).filter(Boolean))];
    for (const d of depts) {
      if (d.toLowerCase().includes(q)) matches.push({ kind: "department", id: d, label: d, sub: "Department" });
    }

    results.replaceChildren(...(matches.length ? matches.slice(0, 10).map((m) =>
      el("div", {
        class: "search-result",
        onclick: () => {
          hide(); input.value = "";
          location.hash = m.kind === "employee" ? `#/employees/${m.id}` : `#/departments/${encodeURIComponent(m.id)}`;
        },
      },
        el("div", { class: "avatar" }, m.kind === "employee" ? initials(m.label) : "🏭"),
        el("div", {}, el("div", {}, m.label), el("small", {}, m.sub)))) :
      [el("p", { class: "muted", style: { padding: "10px" } }, "No matches")]));
    results.classList.remove("hidden");
  }, 180));
}

/* ---------------- First-run config help ---------------- */

function showConfigHelp() {
  modal({
    title: "Connect your Firebase project",
    width: "620px",
    body: el("div", {},
      el("p", {}, "This dashboard needs a Firebase project. One-time setup:"),
      el("ol", { style: { lineHeight: "1.9", paddingLeft: "20px" } },
        el("li", { html: "Create a project at <b>console.firebase.google.com</b>" }),
        el("li", { html: "Enable <b>Authentication → Email/Password</b>" }),
        el("li", { html: "Create a <b>Realtime Database</b> and publish the rules from <code>database.rules.json</code>" }),
        el("li", { html: "Enable <b>Storage</b> (for employee photos) and publish <code>storage.rules</code>" }),
        el("li", { html: "Copy your web-app config into <code>js/config/firebase-config.js</code>" }),
        el("li", { html: "Reload — the <b>first account you register becomes HR Admin</b>" })),
      el("p", { class: "muted" }, "Full details are in README.md.")),
    actions: [{ label: "Got it", class: "btn-primary", onClick: () => {} }],
  });
}
