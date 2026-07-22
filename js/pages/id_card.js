/**
 * ID Card Generator
 *
 * Enter an Employee ID → details auto-fill from the database.
 * Upload a passport photo (stays local, never sent to Firebase).
 * Live front/back preview + one-click Download PNG / Print, either side.
 *
 * Card size follows the standard CR80 badge in PORTRAIT orientation:
 * 2.125in × 3.375in (54 × 85.6mm). The back side carries a QR code
 * (the Employee ID) for scanning at gates/kiosks — see the "Scan ID"
 * button on the login screen, which reads it without signing in.
 */
import { read } from "../lib/store.js";
import { el, fmtDate } from "../lib/utils.js";
import { toast } from "../lib/ui.js";

const LOGO_URL = new URL("../../assets/brandix-logo.png", import.meta.url).href;

export async function render(root) {
  /* ── State ─────────────────────────────────────────────────────────────── */
  let photoDataUrl = null;  // local only — never stored
  let emp = null;
  let side = "front"; // "front" | "back"

  /* ── Left panel — inputs ────────────────────────────────────────────────── */
  const empIdInput   = el("input", { type: "text",   placeholder: "e.g. 245", id: "idc-empid" });
  const nameInput    = el("input", { type: "text",   placeholder: "Auto-filled from ID" });
  const deptInput    = el("input", { type: "text",   placeholder: "Auto-filled from ID" });
  const desigInput   = el("input", { type: "text",   placeholder: "Auto-filled from ID" });
  const gradeInput   = el("input", { type: "text",   placeholder: "Auto-filled / enter manually" });
  const dojInput     = el("input", { type: "date",   placeholder: "Auto-filled from ID" });
  const bloodInput   = el("input", { type: "text",   placeholder: "e.g. O+, A-, AB+" });
  const phoneInput   = el("input", { type: "text",   placeholder: "Auto-filled / enter manually" });
  const unitInput    = el("input", { type: "text",   value: "Unit 3", placeholder: "Unit / Location" });
  const photoInput   = el("input", { type: "file",   accept: "image/*", class: "hidden", id: "idc-photo" });
  const photoThumb   = el("div",   { class: "idc-thumb-preview", style: "display:none" });
  const lookupBtn    = el("button",{ class: "btn btn-primary", style: "width:100%" }, "🔍 Lookup Employee");
  const photoBtn     = el("button",{ class: "btn", style: "width:100%; margin-top:4px" }, "📷 Upload Photo");
  const clearPhotoBtn= el("button",{ class: "btn btn-ghost btn-sm", style: "margin-top:4px; display:none" }, "✕ Remove Photo");
  const printBtn     = el("button",{ class: "btn btn-ghost", id: "idc-print" }, "🖨️ Print");
  const dlBtn        = el("button",{ class: "btn btn-primary", id: "idc-dl"   }, "⬇️ Download PNG");
  const dlBothBtn    = el("button",{ class: "btn", id: "idc-dl-both" }, "⬇️ Download Both Sides");

  /* ── Right panel — live card preview ────────────────────────────────────── */
  const cardEl = el("div", { class: "idc-card", id: "idc-preview" });
  const sideLabel = el("small", { class: "muted" }, "2.125\" × 3.375\" standard card · Front");
  const frontTab = el("button", { class: "tab active", onclick: () => setSide("front") }, "Front");
  const backTab  = el("button", { class: "tab",        onclick: () => setSide("back") },  "Back (QR)");

  /* ── Hidden pair used only for printing BOTH sides (front page 1, back page 2) ── */
  const printFrontEl = el("div", { class: "idc-card" });
  const printBackEl  = el("div", { class: "idc-card" });
  const printBoth = el("div", { class: "idc-print-both" }, printFrontEl, printBackEl);

  /* ── Layout ─────────────────────────────────────────────────────────────── */
  root.append(
    el("div", { class: "page-head" }, el("h3", {}, "🪪 ID Card Generator")),

    el("div", { class: "grid", style: "grid-template-columns: 340px 1fr; gap: 24px; align-items: start" },

      // ── Left: form ──
      el("div", { class: "card" },
        el("div", { class: "card-head" }, el("h4", {}, "Employee Details")),

        el("label", { class: "field" }, el("span", {}, "Employee ID *"),
          el("div", { style: "display:flex; gap:8px" }, empIdInput, lookupBtn.cloneNode(true))),

        el("label", { class: "field" }, el("span", {}, "Full Name"),         nameInput),
        el("label", { class: "field" }, el("span", {}, "Designation"),       desigInput),
        el("label", { class: "field" }, el("span", {}, "Department"),        deptInput),
        el("label", { class: "field" }, el("span", {}, "Grade / Category"),  gradeInput),
        el("label", { class: "field" }, el("span", {}, "Date of Joining"),   dojInput),
        el("label", { class: "field" }, el("span", {}, "Blood Group"),       bloodInput),
        el("label", { class: "field" }, el("span", {}, "Phone"),             phoneInput),
        el("label", { class: "field" }, el("span", {}, "Unit / Location"),   unitInput),

        el("div", { class: "card-head", style: "margin-top:12px" }, el("h4", {}, "Photo")),
        el("p", { class: "muted", style: "font-size:12px; margin-bottom:8px" },
          "Upload a passport-size photo. It stays in your browser only — never uploaded to the server."),
        photoInput,
        photoBtn,
        clearPhotoBtn,
        photoThumb,

        el("div", { style: "display:flex; flex-direction:column; gap:8px; margin-top:20px; padding-top:16px; border-top:1px solid var(--line)" },
          el("div", { style: "display:flex; gap:8px" }, printBtn, dlBtn),
          dlBothBtn)),

      // ── Right: live preview ──
      el("div", {},
        el("div", { class: "card" },
          el("div", { class: "card-head" },
            el("h4", {}, "Preview"),
            sideLabel),
          el("div", { class: "tabs", style: "margin-bottom:12px" }, frontTab, backTab),
          el("div", { style: "display:flex; justify-content:center; padding: 20px 0" }, cardEl)))
    ),
    printBoth
  );

  /* ── Inline CSS for the card ────────────────────────────────────────────── */
  if (!document.getElementById("idc-style")) {
    const style = document.createElement("style");
    style.id = "idc-style";
    style.textContent = `
      /* ID card — CR80 badge, PORTRAIT: 2.125in × 3.375in (54 × 85.6mm) */
      .idc-card {
        width: 2.125in; height: 3.375in;
        background: #fff; border-radius: 10px;
        box-shadow: 0 8px 32px rgba(0,0,0,.28);
        font-family: 'Arial', sans-serif;
        overflow: hidden; position: relative;
        border: 3px solid #c8102e;
        display: flex; flex-direction: column; align-items: center;
      }
      .idc-header {
        width: 100%; background: #fff;
        display: flex; flex-direction: column; align-items: center;
        padding: 8px 10px 5px;
        border-bottom: 3px solid #c8102e;
      }
      .idc-logo-img { height: 28px; object-fit: contain; }
      .idc-unit { font-size: 7.5px; color: #888; letter-spacing:.5px; margin-top: 2px; }
      .idc-photo-wrap {
        margin: 10px 0 6px;
        width: 76px; height: 92px;
        border: 2px solid #c8102e;
        border-radius: 4px; overflow: hidden;
        background: #f0f0f0;
        display: flex; align-items: center; justify-content: center;
      }
      .idc-photo-wrap img { width:100%; height:100%; object-fit:cover; }
      .idc-photo-placeholder { color:#bbb; font-size:30px; }
      .idc-body {
        width:100%; padding: 0 10px 10px;
        display: flex; flex-direction: column; align-items: center; text-align: center;
      }
      .idc-name       { font-size:12.5px; font-weight:900; color:#1a1a1a; letter-spacing:.3px; margin-bottom:2px; }
      .idc-desig      { font-size:9px; font-weight:700; color:#c8102e; margin-bottom:2px; }
      .idc-dept       { font-size:8.5px; color:#444; margin-bottom:5px; }
      .idc-id-row     {
        background:#c8102e; color:#fff; border-radius: 12px;
        padding: 2px 12px; font-size:8px; font-weight:700; letter-spacing:1px;
      }
      .idc-footer     {
        width:100%; background:#c8102e; color:#fff;
        text-align:center; font-size:7px; padding: 4px 0; letter-spacing:1px;
        font-weight:700; margin-top: auto;
      }
      /* Back side */
      .idc-back { width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 16px; box-sizing: border-box; }
      .idc-back-qr { padding: 8px; background:#fff; border: 2px solid #c8102e; border-radius: 6px; }
      .idc-back-id { font-size: 10px; font-weight: 800; letter-spacing: 2px; color:#1a1a1a; margin-top: 10px; }
      .idc-back-name { font-size: 8.5px; color:#555; margin-top: 2px; }
      .idc-back-details {
        width: 100%; margin-top: 12px; padding: 8px 10px;
        background: #f7f7f9; border-radius: 6px;
        display: flex; flex-direction: column; gap: 4px;
      }
      .idc-back-detail-row { display: flex; justify-content: space-between; font-size: 8px; color:#333; }
      .idc-back-detail-label { color:#888; font-weight:700; }
      .idc-back-note { font-size: 7px; color:#777; text-align:center; margin-top: 14px; line-height: 1.5; padding: 0 8px; }
      .idc-back-strip { width:100%; background:#c8102e; color:#fff; text-align:center; font-size:7px; padding: 4px 0; letter-spacing:1px; font-weight:700; }
      /* Photo thumb in form */
      .idc-thumb-preview img {
        width:80px; height:96px; object-fit:cover;
        border:2px solid var(--glass-border); border-radius:4px; margin-top:8px;
      }
      /* Hidden pair used only when printing, so BOTH sides come out (front
         page 1, back page 2) regardless of which side the preview shows. */
      .idc-print-both { display: none; }
      @media print {
        body * { visibility: hidden !important; }
        .idc-print-both, .idc-print-both * { visibility: visible !important; }
        .idc-print-both {
          display: block !important;
          position: absolute !important; top: 0; left: 0; width: 100%;
        }
        .idc-print-both .idc-card {
          /* No scaling — prints at the card's true 2.125in × 3.375in size. */
          margin: 32px auto;
          box-shadow: none !important;
          page-break-after: always;
          break-after: page;
        }
        .idc-print-both .idc-card:last-child { page-break-after: auto; break-after: auto; }
      }
    `;
    document.head.appendChild(style);
  }

  /* ── Side toggle ─────────────────────────────────────────────────────────── */
  function setSide(s) {
    side = s;
    frontTab.classList.toggle("active", s === "front");
    backTab.classList.toggle("active", s === "back");
    sideLabel.textContent = `2.125" × 3.375" standard card · ${s === "front" ? "Front" : "Back (QR)"}`;
    buildCard();
  }

  /* ── Render front side into any target element ───────────────────────────── */
  function renderFront(target) {
    const name  = nameInput.value.trim()  || "EMPLOYEE NAME";
    const desig = desigInput.value.trim() || "Designation";
    const dept  = deptInput.value.trim()  || "Department";
    const empId = empIdInput.value.trim() || "—";
    const unit  = unitInput.value.trim()  || "Unit 3";

    target.replaceChildren(
      // ── top header ──────────────────────────────────────────────────
      el("div", { class: "idc-header" },
        el("img", { class: "idc-logo-img", src: LOGO_URL, alt: "Brandix", crossorigin: "anonymous" }),
        el("div", { class: "idc-unit" }, `Brandix ${unit}`)),

      // ── photo ────────────────────────────────────────────────────────
      el("div", { class: "idc-photo-wrap" },
        photoDataUrl
          ? el("img", { src: photoDataUrl, alt: "photo" })
          : el("div", { class: "idc-photo-placeholder" }, "👤")),

      // ── details ──────────────────────────────────────────────────────
      el("div", { class: "idc-body" },
        el("div", { class: "idc-name"  }, name.toUpperCase()),
        el("div", { class: "idc-desig" }, desig.toUpperCase()),
        el("div", { class: "idc-dept"  }, dept),
        el("div", { class: "idc-id-row"}, `ID: ${empId}`)),

      // ── footer stripe ────────────────────────────────────────────────
      el("div", { class: "idc-footer" }, `BRANDIX APPAREL INDIA  ·  ${unit.toUpperCase()}`)
    );
  }

  /** Render back side (QR code + Grade/DOJ/Blood/Phone) into any target element. */
  function renderBack(target) {
    const name  = nameInput.value.trim()  || "";
    const empId = empIdInput.value.trim() || "";
    const grade = gradeInput.value.trim() || "";
    const doj   = dojInput.value          || "";
    const blood = bloodInput.value.trim() || "";
    const phone = phoneInput.value.trim() || "";

    const details = [
      grade && ["Grade", grade],
      doj && ["DOJ", fmtDate(doj)],
      blood && ["Blood", blood],
      phone && ["Phone", phone],
    ].filter(Boolean);

    const qrHost = el("div", { class: "idc-back-qr" });
    target.replaceChildren(
      el("div", { class: "idc-back" },
        qrHost,
        empId ? el("div", { class: "idc-back-id" }, empId) : null,
        name ? el("div", { class: "idc-back-name" }, name) : null,
        details.length
          ? el("div", { class: "idc-back-details" },
              ...details.map(([label, value]) => el("div", { class: "idc-back-detail-row" },
                el("span", { class: "idc-back-detail-label" }, label), el("span", {}, value))))
          : null,
        el("div", { class: "idc-back-note" },
          "If found, please return to Brandix Unit 3 HR Department. This card remains the property of Brandix Apparel India.")),
      el("div", { class: "idc-back-strip" }, "BRANDIX APPAREL INDIA")
    );

    if (!empId) {
      qrHost.replaceChildren(el("div", { style: "width:110px;height:110px;display:flex;align-items:center;justify-content:center;color:#bbb;font-size:11px;text-align:center" }, "Enter Employee ID for QR"));
      return;
    }
    if (!window.QRCode) {
      qrHost.replaceChildren(el("div", { style: "width:110px;height:110px;display:flex;align-items:center;justify-content:center;color:#bbb;font-size:10px;text-align:center" }, "QR library not loaded"));
      return;
    }
    new window.QRCode(qrHost, { text: empId, width: 110, height: 110, colorDark: "#1a1a1a", colorLight: "#ffffff" });
  }

  /** Refresh the live preview (whichever side is active). */
  function buildCard() {
    if (side === "back") renderBack(cardEl);
    else renderFront(cardEl);
  }

  buildCard(); // initial empty state

  /* ── Wire inputs to refresh card live ───────────────────────────────────── */
  [empIdInput, nameInput, desigInput, deptInput, gradeInput, dojInput, bloodInput, phoneInput, unitInput].forEach((inp) =>
    inp.addEventListener("input", buildCard));

  /* ── Lookup employee from DB ─────────────────────────────────────────────── */
  async function lookupEmployee() {
    const id = empIdInput.value.trim();
    if (!id) { toast("Enter an Employee ID first", "warn"); return; }
    lookupBtn.disabled = true; lookupBtn.textContent = "Searching…";
    try {
      const data = await read(`employees/${id}`);
      if (!data) { toast(`No employee found with ID "${id}"`, "warn"); return; }
      emp = data;
      nameInput.value  = data.name  || "";
      desigInput.value = data.designation || "";
      deptInput.value  = data.department || "";
      gradeInput.value = data.grade || data.category || "";
      dojInput.value   = data.doj || "";
      phoneInput.value = data.phone || "";
      buildCard();
      toast(`Loaded: ${data.name}`, "ok");
    } catch (e) {
      console.error(e);
      toast("Lookup failed — check your connection", "err");
    } finally {
      lookupBtn.disabled = false; lookupBtn.textContent = "🔍 Lookup";
    }
  }

  // Attach lookup button (inside the form layout we cloned, so re-attach)
  root.querySelectorAll("#idc-empid").forEach((inp) => {
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") lookupEmployee(); });
  });
  root.querySelector(".btn.btn-primary").addEventListener("click", lookupEmployee);

  /* ── Photo upload ────────────────────────────────────────────────────────── */
  photoInput.addEventListener("change", () => {
    const file = photoInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      photoDataUrl = e.target.result;
      photoThumb.style.display = "block";
      photoThumb.replaceChildren(el("img", { src: photoDataUrl, alt: "thumb" }));
      clearPhotoBtn.style.display = "block";
      buildCard();
    };
    reader.readAsDataURL(file);
  });

  photoBtn.addEventListener("click", () => photoInput.click());

  clearPhotoBtn.addEventListener("click", () => {
    photoDataUrl = null;
    photoInput.value = "";
    photoThumb.style.display = "none";
    photoThumb.replaceChildren();
    clearPhotoBtn.style.display = "none";
    buildCard();
  });

  /* ── Print (both sides — front page 1, back page 2) ─────────────────────── */
  root.querySelector("#idc-print").addEventListener("click", () => {
    renderFront(printFrontEl);
    renderBack(printBackEl);
    window.print();
  });

  /* ── Download PNG (current side) ────────────────────────────────────────── */
  async function downloadCurrentSide() {
    if (!window.html2canvas) { toast("html2canvas not loaded — check index.html CDN scripts", "warn"); return; }
    const canvas = await html2canvas(cardEl, {
      scale: 300 / 96, // render at 300 DPI for a true 2.125in × 3.375in print-quality PNG
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });
    const a = document.createElement("a");
    const name = nameInput.value.trim().replace(/\s+/g, "_") || "id_card";
    a.href = canvas.toDataURL("image/png");
    a.download = `${name}_ID_Card_${side}.png`;
    a.click();
  }

  root.querySelector("#idc-dl").addEventListener("click", async () => {
    const btn = root.querySelector("#idc-dl");
    btn.disabled = true; btn.textContent = "Generating…";
    try {
      await downloadCurrentSide();
      toast("ID Card downloaded!", "ok");
    } catch (e) {
      console.error(e);
      toast("Download failed: " + (e.message || e), "err");
    } finally {
      btn.disabled = false; btn.textContent = "⬇️ Download PNG";
    }
  });

  /* ── Download both sides (two files) ────────────────────────────────────── */
  root.querySelector("#idc-dl-both").addEventListener("click", async () => {
    const btn = root.querySelector("#idc-dl-both");
    btn.disabled = true; btn.textContent = "Generating…";
    const originalSide = side;
    try {
      setSide("front"); await new Promise((r) => setTimeout(r, 50)); await downloadCurrentSide();
      setSide("back");  await new Promise((r) => setTimeout(r, 50)); await downloadCurrentSide();
      toast("Front + back downloaded!", "ok");
    } catch (e) {
      console.error(e);
      toast("Download failed: " + (e.message || e), "err");
    } finally {
      setSide(originalSide);
      btn.disabled = false; btn.textContent = "⬇️ Download Both Sides";
    }
  });
}
