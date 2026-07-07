/**
 * Public "Request to Visit HR" kiosk — no login required.
 *
 * Anyone with this link (hr-request.html) can look themselves up by
 * Employee ID and submit a reason to visit HR. It authenticates with
 * Firebase Anonymous sign-in so the database rules can still require
 * `auth != null` uniformly; the rules then scope what an anonymous session
 * may touch: it can read ONLY an employee's name/department (never phone,
 * email, salary, etc.) and can ONLY create new pending requests — never
 * read the request list or edit an existing one.
 *
 * Toggle: settings/hrRequestEnabled (set from the admin Settings page).
 *
 * Requires: Firebase Console → Authentication → Sign-in method →
 * enable "Anonymous".
 */
import { auth, db, signInAnonymously, onAuthStateChanged, ref, get, push, serverTimestamp } from "./lib/firebase.js";
import { toast } from "./lib/ui.js";
import { initials, esc } from "./lib/utils.js";

const $ = (id) => document.getElementById(id);
const steps = ["disabled", "loading", "id", "confirm", "reason", "success"];
function showStep(name) {
  for (const s of steps) $(`step-${s}`).classList.toggle("active", s === name);
}

let current = null; // { empId, name, department }

init();

async function init() {
  try {
    await new Promise((resolve, reject) => {
      onAuthStateChanged(auth, (user) => { if (user) resolve(user); });
      signInAnonymously(auth).catch(reject);
    });
  } catch (e) {
    console.error(e);
    $("step-disabled").innerHTML = `<div class="empty-state"><div class="big">⚠️</div>
      <h4>Can't connect right now</h4>
      <p>Ask HR to check that Anonymous sign-in is enabled in the Firebase console.</p></div>`;
    showStep("disabled");
    return;
  }

  let enabled = false;
  try {
    const snap = await get(ref(db, "settings/hrRequestEnabled"));
    enabled = snap.val() === true;
  } catch (e) { console.error(e); }

  showStep(enabled ? "id" : "disabled");
  if (enabled) wireForm();
}

function wireForm() {
  $("lookup-btn").addEventListener("click", lookupEmployee);
  $("emp-id-input").addEventListener("keydown", (e) => { if (e.key === "Enter") lookupEmployee(); });
  $("not-me-btn").addEventListener("click", () => {
    current = null;
    $("emp-id-input").value = "";
    showStep("id");
    $("emp-id-input").focus();
  });
  $("confirm-btn").addEventListener("click", () => {
    $("reason-avatar").textContent = initials(current.name);
    $("reason-name").textContent = current.name;
    $("reason-dept").textContent = current.department || "—";
    $("reason-input").value = "";
    $("reason-error").textContent = "";
    showStep("reason");
  });
  $("back-btn").addEventListener("click", () => showStep("confirm"));
  $("submit-btn").addEventListener("click", submitRequest);
  $("reset-btn").addEventListener("click", () => {
    current = null;
    $("emp-id-input").value = "";
    showStep("id");
  });
}

async function lookupEmployee() {
  const id = $("emp-id-input").value.trim();
  const errEl = $("id-error");
  errEl.textContent = "";
  if (!id) { errEl.textContent = "Enter your Employee ID."; return; }

  const btn = $("lookup-btn");
  btn.disabled = true;
  btn.textContent = "Checking…";
  try {
    // Granular reads — the database rules only allow anonymous sessions to
    // read these two specific child paths, never the full employee record.
    const [nameSnap, deptSnap] = await Promise.all([
      get(ref(db, `employees/${id}/name`)),
      get(ref(db, `employees/${id}/department`)),
    ]);
    const name = nameSnap.val();
    if (!name) { errEl.textContent = "Employee ID not found — check and try again."; return; }

    current = { empId: id, name, department: deptSnap.val() || "" };
    $("confirm-avatar").textContent = initials(name);
    $("confirm-name").textContent = name;
    $("confirm-dept").textContent = current.department || "—";
    showStep("confirm");
  } catch (e) {
    console.error(e);
    errEl.textContent = "Something went wrong — please try again.";
  } finally {
    btn.disabled = false;
    btn.textContent = "Continue";
  }
}

async function submitRequest() {
  const reason = $("reason-input").value.trim();
  const errEl = $("reason-error");
  errEl.textContent = "";
  if (reason.length < 3) { errEl.textContent = "Please add a short reason (at least a few words)."; return; }

  const btn = $("submit-btn");
  btn.disabled = true;
  btn.textContent = "Submitting…";
  try {
    await push(ref(db, "hrRequests"), {
      empId: current.empId, name: current.name, department: current.department || "",
      reason, status: "pending", createdAt: serverTimestamp(),
    });
    await push(ref(db, "notifications"), {
      type: "hr_request", title: "HR visit requested",
      body: `${current.name} (${current.empId}) — ${reason.slice(0, 100)}`,
      ts: Date.now(), by: current.name,
    }).catch(() => {}); // best-effort; request itself already succeeded
    showStep("success");
  } catch (e) {
    console.error(e);
    toast("Could not submit your request — please try again or visit HR directly.", "err", 5000);
  } finally {
    btn.disabled = false;
    btn.textContent = "Submit request";
  }
}
