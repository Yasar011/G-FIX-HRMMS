/**
 * App entry point: theme, auth flow, shell wiring (sidebar, search, shortcuts).
 */
import { isConfigPlaceholder } from "./lib/firebase.js";
import {
  initAuth, login, register, logout, currentUser, roleLabel, canonicalRole,
  recheckVerification, resendVerification, recordLogin, verifyBadge,
} from "./lib/auth.js";
import { initTheme, toast, modal } from "./lib/ui.js";
import { initRouter, route, buildSidebar } from "./router.js";
import { initNotifications } from "./lib/notify.js";
import { watch } from "./lib/store.js";
import { el, esc, initials, debounce } from "./lib/utils.js";

const $ = (id) => document.getElementById(id);

/* ---------------- Idle auto-logout (30 min of inactivity) ---------------- */
const IDLE_LIMIT_MS = 30 * 60 * 1000;
let idleTimer = null;

function resetIdleTimer() {
  if (!shellReady) return;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    toast("You were signed out after 30 minutes of inactivity", "warn", 6000);
    await logout();
    location.hash = "";
  }, IDLE_LIMIT_MS);
}

["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"].forEach((evt) =>
  document.addEventListener(evt, resetIdleTimer, { passive: true }));

initTheme();
initRouter();
wireShell();
wireLogin();
wireScanId();

if (isConfigPlaceholder) {
  $("loading-screen").classList.add("hidden");
  $("login-screen").classList.remove("hidden");
  showConfigHelp();
} else {
  initAuth(onAuthChanged);
}

let shellReady = false;

const GATE_SCREENS = ["login-screen", "verify-email-screen", "pending-approval-screen", "app"];
function showGateScreen(id) {
  for (const s of GATE_SCREENS) $(s).classList.toggle("hidden", s !== id);
}

/** React to sign-in/out and live profile (role) changes. */
function onAuthChanged(user, errorMessage) {
  $("loading-screen").classList.add("hidden");
  if (!user) {
    shellReady = false;
    clearTimeout(idleTimer);
    showGateScreen("login-screen");
    if (errorMessage) {
      const errBox = $("login-error");
      errBox.textContent = errorMessage;
      errBox.classList.remove("hidden");
    }
    return;
  }

  // Gate 1: must verify their email before anything else — unless this is an
  // admin-created guest/staff account (the admin vouched for it up front).
  if (!user.emailVerified && !user.adminCreated) {
    shellReady = false;
    showGateScreen("verify-email-screen");
    $("verify-email-address").textContent = user.email || "";
    return;
  }

  // Gate 2: verified, but HR hasn't assigned a real role yet.
  if (canonicalRole(user.role) === "pending") {
    shellReady = false;
    showGateScreen("pending-approval-screen");
    return;
  }

  showGateScreen("app");

  // Topbar identity
  $("user-name").textContent = user.name || user.email;
  $("user-role").textContent = roleLabel(user.role);
  const av = $("user-avatar");
  if (user.photo) av.innerHTML = `<img src="${esc(user.photo)}" alt="">`;
  else av.textContent = initials(user.name || user.email);

  buildSidebar(); // role may have changed → rebuild links

  if (!shellReady) {
    shellReady = true;
    recordLogin();
    resetIdleTimer();
    initNotifications();
    initGlobalSearch();
    // Email automation heartbeat (lazy — EmailJS may not be configured yet).
    import("./lib/emailer.js").then((m) => m.startAutomationLoop()).catch(console.error);
    if (!location.hash || location.hash === "#" || location.hash === "#/") {
      location.hash = "#/dashboard";
    }
  }
  route();
}

/* ---------------- Login form ---------------- */

function wireLogin() {
  const form = $("login-form");
  const errBox = $("login-error");
  const regFields = $("register-fields");
  const confirmField = $("confirm-password-field");
  const regInputs = [$("reg-name"), $("reg-department"), $("reg-empid")];
  const confirmInput = $("login-confirm-password");
  let mode = "login";

  $("register-toggle").addEventListener("click", () => {
    mode = mode === "login" ? "register" : "login";
    $("login-submit").textContent = mode === "login" ? "Sign in" : "Create account";
    $("register-toggle").textContent = mode === "login" ? "Create an account" : "Back to sign in";
    regFields.classList.toggle("hidden", mode !== "register");
    confirmField.classList.toggle("hidden", mode !== "register");
    regInputs.forEach((i) => { i.required = mode === "register"; });
    confirmInput.required = mode === "register";
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
      if (mode === "login") {
        await login(email, pass);
      } else {
        if (pass !== confirmInput.value) throw new Error("Passwords do not match.");
        const name = $("reg-name").value.trim();
        const department = $("reg-department").value.trim();
        const empId = $("reg-empid").value.trim();
        await register(email, pass, { name, department, empId });
        toast("Account created — check your email for the verification link", "ok");
      }
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.remove("hidden");
    } finally {
      btn.disabled = false;
      btn.textContent = mode === "login" ? "Sign in" : "Create account";
    }
  });

  $("verify-continue-btn").addEventListener("click", async (e) => {
    const btn = e.target;
    btn.disabled = true;
    btn.textContent = "Checking…";
    const verified = await recheckVerification();
    btn.disabled = false;
    btn.textContent = "I've verified — Continue";
    if (verified) { if (currentUser) currentUser.emailVerified = true; onAuthChanged(currentUser); }
    else toast("Not verified yet — click the link in your email first.", "warn");
  });
  $("verify-resend-btn").addEventListener("click", async () => {
    try { await resendVerification(); toast("Verification email sent again", "ok"); }
    catch (err) { toast(err.message || "Could not resend email", "err"); }
  });
  $("verify-logout-btn").addEventListener("click", async () => { await logout(); });
  $("pending-logout-btn").addEventListener("click", async () => { await logout(); });
}

/* ---------------- Scan ID (badge verification, no login needed) ---------------- */

const HTML5_QRCODE_URL = "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js";

function wireScanId() {
  $("scan-id-btn").addEventListener("click", openScanModal);
}

function loadHtml5Qrcode() {
  if (window.Html5Qrcode) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = HTML5_QRCODE_URL;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load the QR scanner library"));
    document.head.appendChild(s);
  });
}

async function openScanModal() {
  let scanner = null;
  let closed = false;

  const readerDiv = el("div", { id: "qr-reader", style: { width: "100%" } });
  const resultHost = el("div", { style: { marginTop: "12px" } });

  modal({
    title: "📷 Scan Employee ID",
    width: "420px",
    body: el("div", {},
      el("p", { class: "muted", style: { fontSize: "12.5px", marginBottom: "10px" } },
        "Point the camera at the QR code on the back of an employee's ID card. No sign-in required — this only shows their name, department, designation and status."),
      readerDiv, resultHost),
    onClose: async () => {
      closed = true;
      if (scanner) { try { await scanner.stop(); scanner.clear(); } catch { /* already stopped */ } }
    },
  });

  const showScanning = () => resultHost.replaceChildren(el("p", { class: "muted" }, "Point the camera at a badge's QR code…"));
  showScanning();

  async function onDecoded(decodedText) {
    if (closed) return;
    try { await scanner.pause(true); } catch { /* ignore */ }
    resultHost.replaceChildren(el("p", { class: "muted" }, `Looking up ${esc(decodedText)}…`));
    try {
      const info = await verifyBadge(decodedText);
      if (closed) return;
      if (!info) {
        resultHost.replaceChildren(
          el("div", { class: "card", style: { padding: "12px", border: "1px solid #f87171" } },
            el("p", {}, `❌ No employee found with ID "${esc(decodedText)}"`)),
          el("button", { class: "btn btn-sm", style: { marginTop: "10px" }, onclick: resumeScan }, "Scan Another"));
        return;
      }
      const isActive = (info.status || "active") === "active";
      resultHost.replaceChildren(
        el("div", { class: "card", style: { padding: "12px", border: `1px solid ${isActive ? "#34d399" : "#fbbf24"}` } },
          el("p", {}, isActive ? "✅ Valid Badge" : `⚠️ Badge Found — Status: ${esc(info.status)}`),
          el("p", {}, el("strong", {}, info.name)),
          el("p", { class: "muted", style: { fontSize: "13px" } }, `${info.designation} · ${info.department}`),
          el("p", { class: "muted", style: { fontSize: "12px" } }, `ID: ${esc(info.empId)}`)),
        el("button", { class: "btn btn-sm", style: { marginTop: "10px" }, onclick: resumeScan }, "Scan Another"));
    } catch (e) {
      console.error(e);
      if (!closed) resultHost.replaceChildren(el("p", { class: "text-bad" }, "Lookup failed: " + (e.message || e)));
    }
  }

  function resumeScan() {
    if (closed) return;
    showScanning();
    try { scanner.resume(); } catch { /* ignore */ }
  }

  try {
    await loadHtml5Qrcode();
    if (closed) return;
    scanner = new window.Html5Qrcode("qr-reader");
    await scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 220 },
      onDecoded,
      () => {}, // per-frame decode miss — expected constantly while aiming, ignore
    );
  } catch (e) {
    console.error(e);
    if (!closed) resultHost.replaceChildren(el("p", { class: "text-bad" }, "Could not start the camera: " + (e.message || e)));
  }
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
