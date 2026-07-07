/**
 * Public "Check My Leave" kiosk — no login required.
 *
 * Anyone with this link (leave-status.html) can look themselves up by
 * Employee ID and see their own leave requests (pending/approved/rejected),
 * downloading a PDF certificate for any approved leave. Authenticates with
 * Firebase Anonymous sign-in, same as the HR-visit kiosk; the database
 * rules scope anonymous sessions to read ONLY their own
 * leavesByEmployee/{empId} subtree — never anyone else's, and never the
 * flat admin `leaves` list.
 *
 * Requires: Firebase Console → Authentication → Sign-in method →
 * enable "Anonymous" (same toggle used by the HR-visit kiosk).
 */
import { auth, db, signInAnonymously, onAuthStateChanged, ref, get } from "./lib/firebase.js";
import { toast } from "./lib/ui.js";
import { initials, fmtDate, el } from "./lib/utils.js";

const $ = (id) => document.getElementById(id);
const steps = ["loading", "id", "confirm", "list"];
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
    $("list-avatar").textContent = initials(current.name);
    $("list-name").textContent = current.name;
    $("list-dept").textContent = current.department || "—";
    await loadLeaves();
    showStep("list");
  });
  $("back-id-btn").addEventListener("click", () => {
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

async function loadLeaves() {
  const host = $("leave-list");
  host.replaceChildren(el("p", { class: "muted", style: { textAlign: "center", padding: "10px 0" } }, "Loading…"));
  try {
    const snap = await get(ref(db, `leavesByEmployee/${current.empId}`));
    const rows = Object.entries(snap.val() || {})
      .map(([key, r]) => ({ _key: key, ...r }))
      .sort((a, b) => (b.appliedAt || 0) - (a.appliedAt || 0));

    if (!rows.length) {
      host.replaceChildren(el("div", { class: "empty-state" },
        el("div", { class: "big" }, "🌴"),
        el("h4", {}, "No leave requests yet")));
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
