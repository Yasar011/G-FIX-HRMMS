/**
 * ID Card Generator
 *
 * Enter an Employee ID → details auto-fill from the database.
 * Upload a passport photo (stays local, never sent to Firebase).
 * Live card preview + one-click Download PNG / Print.
 */
import { read } from "../lib/store.js";
import { el, fmtDate } from "../lib/utils.js";
import { toast } from "../lib/ui.js";

export async function render(root) {
  /* ── State ─────────────────────────────────────────────────────────────── */
  let photoDataUrl = null;  // local only — never stored
  let emp = null;

  /* ── Left panel — inputs ────────────────────────────────────────────────── */
  const empIdInput   = el("input", { type: "text",   placeholder: "e.g. 245", id: "idc-empid" });
  const nameInput    = el("input", { type: "text",   placeholder: "Auto-filled from ID" });
  const deptInput    = el("input", { type: "text",   placeholder: "Auto-filled from ID" });
  const desigInput   = el("input", { type: "text",   placeholder: "Auto-filled from ID" });
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
            el("small", { class: "muted" }, "Updates live as you type")),
          el("div", { style: "display:flex; justify-content:center; padding: 20px 0" }, cardEl)))
    )
  );

  /* ── Inline CSS for the card ────────────────────────────────────────────── */
  if (!document.getElementById("idc-style")) {
    const style = document.createElement("style");
    style.id = "idc-style";
    style.textContent = `
      /* ID card — credit-card ratio 85.6 × 54 mm → scaled up 3× for screen */
      .idc-card {
        width: 324px; min-height: 204px;
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
        padding: 10px 12px 6px;
        border-bottom: 3px solid #c8102e;
      }
      .idc-logo-row {
        display: flex; align-items: center; gap: 6px; margin-bottom: 2px;
      }
      .idc-logo-dot {
        width: 28px; height: 28px;
        background: #c8102e; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-weight:900; color:#fff; font-size: 14px; letter-spacing:-1px;
      }
      .idc-logo-text { line-height: 1.1; }
      .idc-logo-text .brand  { font-size: 17px; font-weight: 900; color: #222; }
      .idc-logo-text .sub    { font-size: 9px;  color: #555; letter-spacing: 1px; }
      .idc-unit { font-size: 8.5px; color: #888; letter-spacing:.5px; margin-top: 1px; }
      .idc-photo-wrap {
        margin: 10px 0 8px;
        width: 88px; height: 108px;
        border: 2px solid #c8102e;
        border-radius: 4px; overflow: hidden;
        background: #f0f0f0;
        display: flex; align-items: center; justify-content: center;
      }
      .idc-photo-wrap img { width:100%; height:100%; object-fit:cover; }
      .idc-photo-placeholder { color:#bbb; font-size:32px; }
      .idc-body {
        width:100%; padding: 0 12px 12px;
        display: flex; flex-direction: column; align-items: center; text-align: center;
      }
      .idc-name       { font-size:14px; font-weight:900; color:#1a1a1a; letter-spacing:.5px; margin-bottom:3px; }
      .idc-desig      { font-size:10px; font-weight:700; color:#c8102e; margin-bottom:2px; }
      .idc-dept       { font-size:9.5px; color:#444; margin-bottom:6px; }
      .idc-id-row     {
        background:#c8102e; color:#fff; border-radius: 12px;
        padding: 2px 14px; font-size:9px; font-weight:700; letter-spacing:1px;
        margin-bottom:4px;
      }
      .idc-phone      { font-size:9px; color:#555; }
      .idc-footer     {
        width:100%; background:#c8102e; color:#fff;
        text-align:center; font-size:8px; padding: 4px 0; letter-spacing:1px;
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
          position: fixed !important; top:50% !important; left:50% !important;
          transform: translate(-50%,-50%) scale(2.5) !important;
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
    const phone = phoneInput.value.trim() || "";
    const empId = empIdInput.value.trim() || "—";
    const unit  = unitInput.value.trim()  || "Unit 3";

    cardEl.replaceChildren(
      // ── top header ──────────────────────────────────────────────────
      el("div", { class: "idc-header" },
        el("div", { class: "idc-logo-row" },
          el("div", { class: "idc-logo-dot" }, "b"),
          el("div", { class: "idc-logo-text" },
            el("div", { class: "brand" }, "brandix"),
            el("div", { class: "sub"   }, "apparel india"))),
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
        phone ? el("div", { class: "idc-phone" }, `📞 ${phone}`) : null),

      // ── footer stripe ────────────────────────────────────────────────
      el("div", { class: "idc-footer" }, `BRANDIX APPAREL INDIA  ·  ${unit.toUpperCase()}`)
    );
  }

  /* ── Wire inputs to refresh card live ───────────────────────────────────── */
  [empIdInput, nameInput, desigInput, deptInput, phoneInput, unitInput].forEach((inp) =>
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
        scale: 3,
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
