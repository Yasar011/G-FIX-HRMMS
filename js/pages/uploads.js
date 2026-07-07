/**
 * Data Upload center — the single place to feed data into the system.
 *
 *  • Daily Attendance  → upload the attendance sheet every day
 *  • Monthly Budget    → upload the budget list only when it changes
 *  • Upload History     → full record of every import
 *
 * Both formats are auto-detected: the simple one-sheet templates documented
 * in the hints below, or a real HRIS export (multi-sheet dated attendance,
 * wide multi-month budget) — see lib/importers.js for the detection logic.
 * All parsing/writing is delegated there (shared with the Attendance and
 * Budget pages — no duplicated logic).
 */
import { pageWatch } from "../lib/store.js";
import { can } from "../lib/auth.js";
import { toast, badge, emptyState } from "../lib/ui.js";
import { dropZone } from "../components/uploader.js";
import { dataTable } from "../components/table.js";
import {
  parseAttendanceWorkbook, importAttendance, readWorkbook, parseBudgetSheet, importBudget, importBudgetWide,
} from "../lib/importers.js";
import { empList } from "../lib/metrics.js";
import { el, ym, fmtNum, timeAgo, toList } from "../lib/utils.js";

export async function render(root) {
  let employees = [];
  let settings = {};

  pageWatch("employees", (v) => { employees = empList(v); });
  pageWatch("settings", (v) => { settings = v || {}; });

  const cards = el("div", { class: "grid grid-2" });
  const historyHost = el("div");

  root.append(
    el("div", { class: "page-head" },
      el("h3", {}, "Data Upload"),
      el("div", { class: "spacer" }),
      el("small", { class: "muted" }, "Attendance daily · Budget when it changes")),
    cards, el("div", { class: "section-label" }, "Upload History"), historyHost);

  /* ---------- Attendance card (daily) ---------- */
  if (can("upload_attendance")) {
    const yearInput = el("input", { type: "number", value: String(new Date().getFullYear()), min: "2000", max: "2100", style: { width: "90px" } });
    cards.append(uploadCard({
      title: "Daily Attendance", icon: "🗓️",
      subtitle: "Upload the attendance sheet every day",
      hint: "Simple template: EmpID · Name · Date · Status · In · Out · Shift · OT — or a full HRIS export (auto-detected)",
      accept: ".xlsx,.xls,.csv",
      controls: el("label", { class: "field", style: { margin: "0 0 10px", maxWidth: "160px" } },
        el("span", {}, "Year (for HRIS exports without a year in the date)"), yearInput),
      parseFile: async (file) => {
        const p = await parseAttendanceWorkbook(file, { settings, year: yearInput.value });
        const syncNote = Object.keys(p.employeesSync || {}).length ? ` · will sync ${Object.keys(p.employeesSync).length} employee profile(s)` : "";
        return {
          canImport: p.records.length > 0,
          summary: `${p.records.length} valid rows · ${p.dates.size} day(s) · ${p.empIds.size} employee(s)`
            + (p.skipped ? ` · ${p.skipped} skipped` : "") + syncNote
            + (p.errors?.length ? ` · <span class="text-bad">${p.errors[0]}</span>` : ""),
          payload: p,
        };
      },
      run: async (p) => {
        const n = await importAttendance(p, { employees, settings });
        toast(`Imported ${n} attendance records`, "ok");
      },
    }));
  }

  /* ---------- Budget card (monthly) ---------- */
  if (can("manage_budget")) {
    const monthInput = el("input", { type: "month", value: ym() });
    cards.append(uploadCard({
      title: "Monthly Budget", icon: "💰",
      subtitle: "Upload the budget list only when it changes",
      hint: "Simple template: Department · Budget · (optional) Section — or a wide multi-month export (auto-detected, imports every month found)",
      accept: ".xlsx,.xls,.csv",
      controls: el("label", { class: "field", style: { margin: "0 0 10px" } },
        el("span", {}, "Budget month (used only for the simple template)"), monthInput),
      parseFile: async (file) => {
        const raw = await readWorkbook(file);
        const res = parseBudgetSheet(raw);
        if (res.format === "wide") {
          return {
            canImport: res.deptCount > 0,
            summary: `${res.monthList.length} months (${res.monthList[0]} → ${res.monthList[res.monthList.length - 1]}) × ${res.deptCount} departments — multi-month export detected, importing all months`,
            payload: res,
          };
        }
        return {
          canImport: res.deptCount > 0,
          summary: `${res.deptCount} departments · total budget ${fmtNum(res.totalBudget)} · month ${monthInput.value}`,
          payload: res,
        };
      },
      run: async (res, fileName) => {
        if (res.format === "wide") await importBudgetWide(res, fileName);
        else await importBudget(monthInput.value, res.parsed, fileName);
        toast("Budget imported", "ok");
      },
    }));
  }

  if (!cards.children.length) {
    cards.append(emptyState("🔒", "No upload permissions",
      "Your role cannot upload data. Ask an HR Admin for access."));
  }

  /* ---------- Upload history ---------- */
  pageWatch("uploads", (v) => {
    const rows = toList(v, "_key").sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .map((u) => ({ ...u, when: new Date(u.ts).toLocaleString(), ago: timeAgo(u.ts) }));
    historyHost.replaceChildren(dataTable({
      title: "Upload history",
      exportName: "upload_history",
      pageSize: 12,
      columns: [
        { key: "ago", label: "When", sortVal: (r) => r.ts, render: (r) => el("span", { title: r.when }, r.ago) },
        { key: "type", label: "Type", render: (r) => badge(r.type === "budget" ? "Budget" : "Attendance", r.type === "budget" ? "warn" : "info"), exportVal: (r) => r.type },
        { key: "file", label: "File" },
        { key: "rows", label: "Rows", align: "right" },
        { key: "info", label: "Details" },
        { key: "range", label: "Period" },
        { key: "by", label: "Uploaded by" },
      ],
      rows,
      empty: "No files uploaded yet — use the cards above",
    }));
  });
}

/**
 * Build an inline upload card: drop zone → preview summary → Import button.
 * @param {object} o {title, icon, subtitle, hint, accept, controls,
 *   parseFile(file) → {canImport, summary, payload}, run(payload, fileName)}
 */
function uploadCard({ title, icon, subtitle, hint, accept, controls, parseFile, run }) {
  const preview = el("div", { style: { marginTop: "12px" } });
  const importBtn = el("button", { class: "btn btn-primary", disabled: "" }, "Import to Firebase");
  let state = null; // {payload, fileName}

  const zone = dropZone({
    accept, icon, hint,
    onFile: async (file) => {
      try {
        preview.replaceChildren(el("p", { class: "muted" }, "Reading file…"));
        const res = await parseFile(file);
        state = res.canImport ? { payload: res.payload, fileName: file.name } : null;
        importBtn.disabled = res.canImport ? null : "";
        preview.replaceChildren(el("div", { class: "card", style: { padding: "12px 14px" } },
          el("p", { html: `<b>${escU(file.name)}</b> — ${res.summary}` })));
      } catch (err) {
        console.error(err);
        toast("Could not read that file", "err");
        preview.replaceChildren();
      }
    },
  });

  importBtn.addEventListener("click", async () => {
    if (!state) return;
    importBtn.disabled = "";
    importBtn.textContent = "Importing…";
    try {
      await run(state.payload, state.fileName);
      preview.replaceChildren();
      state = null;
    } catch (e) {
      console.error(e);
      toast("Import failed — check your permissions & rules", "err");
    } finally {
      importBtn.textContent = "Import to Firebase";
    }
  });

  return el("div", { class: "card" },
    el("div", { class: "card-head" },
      el("h4", {}, `${icon} ${title}`),
      el("div", { class: "spacer" })),
    subtitle ? el("p", { class: "muted", style: { marginBottom: "12px", fontSize: "13px" } }, subtitle) : null,
    controls,
    zone, preview,
    el("div", { style: { marginTop: "12px" } }, importBtn));
}

/** Minimal escaper for the upload preview filename. */
function escU(s) { return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
