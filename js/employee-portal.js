/**
 * Public "Employee Portal" kiosk — no login required.
 *
 * Employees look themselves up by Employee ID, then request leave and see
 * their own leave history with a downloadable PDF certificate for approved
 * leaves. Authenticates with Firebase Anonymous sign-in; the database rules
 * scope anonymous sessions to only ever read/write their OWN employee ID's
 * data (see database.rules.json) — never anyone else's, and never the
 * admin lists.
 *
 * Requires: Firebase Console → Authentication → Sign-in method →
 * enable "Anonymous".
 */
import { auth, db, signInAnonymously, onAuthStateChanged, ref, get, push, serverTimestamp } from "./lib/firebase.js";
import { toast } from "./lib/ui.js";
import { initials, fmtDate, el, dateRange, today } from "./lib/utils.js";

const $ = (id) => document.getElementById(id);
const steps = ["loading", "id", "confirm", "menu", "leave-form", "success"];
function showStep(name) {
  for (const s of steps) $(`step-${s}`).classList.toggle("active", s === name);
}

const STATUS_LABEL = { pending: "⏳ Pending", approved: "✅ Approved", rejected: "🚫 Rejected" };
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
    $("step-loading").innerHTML = `<div class="empty-state"><div class="big">⚠️</div>
      <h4>Can't connect right now</h4>
      <p>Ask HR to check that Anonymous sign-in is enabled in the Firebase console.</p></div>`;
    return;
  }

  showStep("id");
  wireForm();
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
  $("confirm-btn").addEventListener("click", async () => {
    await enterMenu();
  });
  $("back-id-btn").addEventListener("click", () => {
    current = null;
    $("emp-id-input").value = "";
    showStep("id");
  });

  $("go-leave-btn").addEventListener("click", () => {
    resetLeaveForm();
    showStep("leave-form");
  });
  $("leave-back-btn").addEventListener("click", () => showStep("menu"));
  $("lv-submit-btn").addEventListener("click", submitLeave);
  wireLeaveFormSync();

  $("success-back-btn").addEventListener("click", () => enterMenu());
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

/** Land on the menu hub: identity card, leave list, action buttons. */
async function enterMenu() {
  $("menu-avatar").textContent = initials(current.name);
  $("menu-name").textContent = current.name;
  $("menu-dept").textContent = current.department || "—";

  await loadLeaves();
  showStep("menu");
}

/* ---------------- Leave: history list + apply form ---------------- */

async function loadLeaves() {
  const host = $("leave-list");
  host.replaceChildren(el("p", { class: "muted", style: { textAlign: "center", padding: "10px 0" } }, "Loading…"));
  try {
    const snap = await get(ref(db, `leaves/${current.empId}`));
    const rows = Object.entries(snap.val() || {})
      .map(([key, r]) => ({ _key: key, ...r }))
      .sort((a, b) => (b.appliedAt || 0) - (a.appliedAt || 0));

    if (!rows.length) {
      host.replaceChildren(el("p", { class: "muted", style: { fontSize: "12.5px", textAlign: "center", padding: "10px 0" } }, "No leave requests yet"));
      return;
    }

    host.replaceChildren(...rows.map((r) => {
      const span = r.halfDay ? `${fmtDate(r.from)} (half day)` : `${fmtDate(r.from)} → ${fmtDate(r.to)}`;
      const items = [
        el("div", { class: "row1" },
          el("strong", {}, r.type),
          el("span", {}, STATUS_LABEL[r.status] || r.status)),
        el("div", { class: "muted-line" }, `${span} · ${r.days} day${r.days === 1 ? "" : "s"}`),
        r.reason ? el("div", { class: "muted-line" }, r.reason) : null,
      ];
      if (r.status === "approved") {
        items.push(el("button", {
          class: "btn btn-sm btn-primary", style: { marginTop: "10px" },
          onclick: () => downloadCertificate(r),
        }, "📄 Download Certificate"));
      }
      return el("div", { class: "leave-item" }, ...items.filter(Boolean));
    }));
  } catch (e) {
    console.error(e);
    host.replaceChildren(el("p", { class: "kiosk-error" }, "Could not load your leave requests — please try again."));
  }
}

function resetLeaveForm() {
  $("lv-type").value = "Annual";
  const todayStr = today();
  $("lv-from").value = todayStr;
  $("lv-to").value = todayStr;
  $("lv-half").checked = false;
  $("lv-reason").value = "";
  $("lv-error").textContent = "";
  syncLeaveDays();
}

function wireLeaveFormSync() {
  $("lv-half").addEventListener("change", syncLeaveDays);
  $("lv-from").addEventListener("change", syncLeaveDays);
  $("lv-to").addEventListener("change", syncLeaveDays);
}

function syncLeaveDays() {
  const half = $("lv-half").checked;
  const toField = $("lv-to-field");
  const fromInput = $("lv-from");
  const toInput = $("lv-to");
  if (half) {
    toInput.value = fromInput.value;
    toField.style.display = "none";
    $("lv-days").textContent = "0.5";
  } else {
    toField.style.display = "";
    if (toInput.value < fromInput.value) toInput.value = fromInput.value;
    $("lv-days").textContent = String(dateRange(fromInput.value, toInput.value).length);
  }
}

async function submitLeave() {
  const errEl = $("lv-error");
  errEl.textContent = "";
  const from = $("lv-from").value;
  const half = $("lv-half").checked;
  const to = half ? from : $("lv-to").value;
  if (!from || (!half && to < from)) { errEl.textContent = "Check the date range."; return; }

  const btn = $("lv-submit-btn");
  btn.disabled = true;
  btn.textContent = "Submitting…";
  try {
    const leaveObj = {
      empId: current.empId, name: current.name, department: current.department || "—",
      type: $("lv-type").value, from, to,
      days: half ? 0.5 : dateRange(from, to).length,
      halfDay: half,
      reason: $("lv-reason").value.trim(), status: "pending", appliedAt: Date.now(),
      source: "employee",
    };
    await push(ref(db, `leaves/${current.empId}`), leaveObj);
    await push(ref(db, "notifications"), {
      type: "leave", title: "Leave requested",
      body: `${current.name} (${current.empId}) — ${leaveObj.type}, ${half ? fmtDate(from) + " (half day)" : `${fmtDate(from)} → ${fmtDate(to)}`}`,
      ts: Date.now(), by: current.name,
    }).catch(() => {});
    $("success-title").textContent = "Leave request submitted";
    $("success-body").textContent = "HR will review it and you'll see the status update here.";
    showStep("success");
  } catch (e) {
    console.error(e);
    errEl.textContent = "Could not submit your request — please try again.";
  } finally {
    btn.disabled = false;
    btn.textContent = "Submit leave request";
  }
}

function downloadCertificate(leave) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt" });
  const W = doc.internal.pageSize.getWidth();

  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, W, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17).setFont(undefined, "bold");
  doc.text("Brandix Unit 3 — Leave Approval Certificate", 40, 32);
  doc.setFontSize(10).setFont(undefined, "normal");
  doc.text(`Generated ${new Date().toLocaleString()}`, 40, 50);

  doc.setTextColor(20, 20, 20);
  let y = 110;
  const line = (label, value) => {
    doc.setFontSize(11).setFont(undefined, "bold").text(label, 40, y);
    doc.setFont(undefined, "normal").text(String(value ?? "—"), 210, y);
    y += 26;
  };
  line("Employee Name:", current.name);
  line("Employee ID:", current.empId);
  line("Department:", current.department || "—");
  line("Leave Type:", leave.type);
  line("Duration:", leave.halfDay ? `${fmtDate(leave.from)} (Half day)` : `${fmtDate(leave.from)} to ${fmtDate(leave.to)}`);
  line("Days:", leave.days);
  line("Reason:", leave.reason || "—");
  line("Status:", "APPROVED");

  y += 24;
  doc.setDrawColor(180).line(40, y, 280, y);
  y += 16;
  doc.setFontSize(11).setFont(undefined, "bold").text(leave.approvedBy || "HR Department", 40, y);
  doc.setFontSize(9).setFont(undefined, "normal")
    .text(`Approved · ${leave.decidedAt ? new Date(leave.decidedAt).toLocaleString() : "—"}`, 40, y + 14);

  doc.save(`Leave_Certificate_${current.empId}_${leave.from}.pdf`);
  toast("Certificate downloaded", "ok");
}
