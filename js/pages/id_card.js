/**
 * ID Card Generator
 *
 * Enter an Employee ID → details auto-fill from the database.
 * Upload a passport photo (stays local, never sent to Firebase).
 * Live card preview + one-click Download PNG / Print.
 *
 * Card size follows the standard CR80 badge (3.375in × 2.125in / 85.6 × 54mm).
 */
import { read } from "../lib/store.js";
import { el, fmtDate } from "../lib/utils.js";
import { toast } from "../lib/ui.js";

const LOGO_URL = new URL("../../assets/brandix-logo.jpg", import.meta.url).href;

export async function render(root) {
  /* ── State ─────────────────────────────────────────────────────────────── */
  let photoDataUrl = null;  // local only — never stored
  let emp = null;

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

  /* ── Right panel — live card preview ────────────────────────────────────── */
  const cardEl = el("div", { class: "idc-card", id: "idc-preview" });
  buildCard();   // initial empty state

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

        el("div", { style: "display:flex; gap:8px; margin-top:20px; padding-top:16px; border-top:1px solid var(--line)" },
          printBtn, dlBtn)),

      // ── Right: live preview ──
      el("div", {},
        el("div", { class: "card" },
          el("div", { class: "card-head" },
            el("h4", {}, "Preview"),
            el("small", { class: "muted" }, "3.375\" × 2.125\" standard card · updates live as you type")),
          el("div", { style: "display:flex; justify-content:center; padding: 20px 0" }, cardEl)))
    )
  );

  /* ── Inline CSS for the card ────────────────────────────────────────────── */
  if (!document.getElementById("idc-style")) {
    const style = document.createElement("style");
    style.id = "idc-style";
    style.textContent = `
      /* ID card — true CR80 badge size: 3.375in × 2.125in (85.6 × 54mm) */
      .idc-card {
        width: 3.375in; height: 2.125in;
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
        padding: 8px 12px 5px;
        border-bottom: 3px solid #c8102e;
      }
      .idc-logo-img { height: 30px; object-fit: contain; }
      .idc-unit { font-size: 8.5px; color: #888; letter-spacing:.5px; margin-top: 2px; }
      .idc-photo-wrap {
        margin: 8px 0 6px;
        width: 80px; height: 96px;
        border: 2px solid #c8102e;
        border-radius: 4px; overflow: hidden;
        background: #f0f0f0;
        display: flex; align-items: center; justify-content: center;
      }
      .idc-photo-wrap img { width:100%; height:100%; object-fit:cover; }
      .idc-photo-placeholder { color:#bbb; font-size:32px; }
      .idc-body {
        width:100%; padding: 0 12px 10px;
        display: flex; flex-direction: column; align-items: center; text-align: center;
      }
      .idc-name       { font-size:13px; font-weight:900; color:#1a1a1a; letter-spacing:.5px; margin-bottom:2px; }
      .idc-desig      { font-size:9.5px; font-weight:700; color:#c8102e; margin-bottom:2px; }
      .idc-dept       { font-size:9px; color:#444; margin-bottom:4px; }
      .idc-id-row     {
        background:#c8102e; color:#fff; border-radius: 12px;
        padding: 2px 14px; font-size:8.5px; font-weight:700; letter-spacing:1px;
        margin-bottom:3px;
      }
      .idc-meta-row   { font-size:8px; color:#555; margin-bottom:1px; }
      .idc-phone      { font-size:8.5px; color:#555; }
      .idc-footer     {
        width:100%; background:#c8102e; color:#fff;
        text-align:center; font-size:7.5px; padding: 3px 0; letter-spacing:1px;
        font-weight:700;
      }
      /* Photo thumb in form */
      .idc-thumb-preview img {
        width:80px; height:96px; object-fit:cover;
        border:2px solid var(--glass-border); border-radius:4px; margin-top:8px;
      }
      @media print {
        body * { visibility: hidden !important; }
        #idc-preview, #idc-preview * { visibility: visible !important; }
        #idc-preview {
          /* No scaling — prints at the card's true 3.375in × 2.125in size. */
          position: fixed !important; top:50% !important; left:50% !important;
          transform: translate(-50%,-50%) !important;
          box-shadow: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /* ── Build / refresh card ────────────────────────────────────────────────── */
  function buildCard() {
    const name  = nameInput.value.trim()  || "EMPLOYEE NAME";
    const desig = desigInput.value.trim() || "Designation";
    const dept  = deptInput.value.trim()  || "Department";
    const grade = gradeInput.value.trim() || "";
    const doj   = dojInput.value          || "";
    const blood = bloodInput.value.trim() || "";
    const phone = phoneInput.value.trim() || "";
    const empId = empIdInput.value.trim() || "—";
    const unit  = unitInput.value.trim()  || "Unit 3";

    const meta = [grade && `Grade: ${grade}`, doj && `DOJ: ${fmtDate(doj)}`, blood && `Blood: ${blood}`]
      .filter(Boolean).join("  ·  ");

    cardEl.replaceChildren(
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
        el("div", { class: "idc-id-row"}, `ID: ${empId}`),
        meta ? el("div", { class: "idc-meta-row" }, meta) : null,
        phone ? el("div", { class: "idc-phone" }, `📞 ${phone}`) : null),

      // ── footer stripe ────────────────────────────────────────────────
      el("div", { class: "idc-footer" }, `BRANDIX APPAREL INDIA  ·  ${unit.toUpperCase()}`)
    );
  }

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

  /* ── Print ───────────────────────────────────────────────────────────────── */
  root.querySelector("#idc-print").addEventListener("click", () => window.print());

  /* ── Download PNG ────────────────────────────────────────────────────────── */
  root.querySelector("#idc-dl").addEventListener("click", async () => {
    if (!window.html2canvas) { toast("html2canvas not loaded — check index.html CDN scripts", "warn"); return; }
    const btn = root.querySelector("#idc-dl");
    btn.disabled = true; btn.textContent = "Generating…";
    try {
      const canvas = await html2canvas(cardEl, {
        scale: 300 / 96, // render at 300 DPI for a true 3.375in × 2.125in print-quality PNG
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });
      const a = document.createElement("a");
      const name = nameInput.value.trim().replace(/\s+/g, "_") || "id_card";
      a.href = canvas.toDataURL("image/png");
      a.download = `${name}_ID_Card.png`;
      a.click();
      toast("ID Card downloaded!", "ok");
    } catch (e) {
      console.error(e);
      toast("Download failed: " + (e.message || e), "err");
    } finally {
      btn.disabled = false; btn.textContent = "⬇️ Download PNG";
    }
  });
}
