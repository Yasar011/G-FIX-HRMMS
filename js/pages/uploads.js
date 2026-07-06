/**
 * Data Upload center — the single place to feed data into the system.
 *
 *  • Daily Attendance  → upload the attendance sheet every day
 *  • Monthly Budget    → upload the budget list only when it changes
 *  • Upload History     → full record of every import
 *
 * All parsing/writing is delegated to lib/importers.js (shared with the
 * Attendance and Budget pages — no duplicated logic).
 */
import { pageWatch } from "../lib/store.js";
import { can } from "../lib/auth.js";
import { toast, badge, emptyState } from "../lib/ui.js";
import { dropZone } from "../components/uploader.js";
import { dataTable } from "../components/table.js";
import {
  readWorkbook, parseAttendanceRows, importAttendance, parseBudgetRows, importBudget,
} from "../lib/importers.js";
import { empList } from "../lib/metrics.js";
import { el, ym, today, fmtNum, timeAgo, toList } from "../lib/utils.js";

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
    cards.append(uploadCard({
      title: "Daily Attendance", icon: "🗓️",
      subtitle: "Upload the attendance sheet every day",
      hint: "Columns: EmpID · Name · Date · Status · In · Out · Shift · OT",
      accept: ".xlsx,.xls,.csv",
      controls: null,
      parse: (raw) => {
        const p = parseAttendanceRows(raw, settings);
        return {
          canImport: p.records.length > 0,
          summary: `${p.records.length} valid rows · ${p.dates.size} day(s) · ${p.empIds.size} employee(s)`
            + (p.skipped ? ` · ${p.skipped} skipped` : ""),
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
      hint: "Columns: Department · Budget · (optional) Section",
      accept: ".xlsx,.xls,.csv",
      controls: el("label", { class: "field", style: { margin: "0 0 10px" } },
        el("span", {}, "Budget month"), monthInput),
      parse: (raw) => {
        const { parsed, deptCount, totalBudget } = parseBudgetRows(raw);
        return {
          canImport: deptCount > 0,
          summary: `${deptCount} departments · total budget ${fmtNum(totalBudget)} · month ${monthInput.value}`,
          payload: parsed,
        };
      },
      run: async (parsed, fileName) => {
        await importBudget(monthInput.value, parsed, fileName);
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
 * @param {object} o {title, icon, subtitle, hint, accept, controls, parse(raw)→{canImport,summary,payload}, run(payload,fileName)}
 */
function uploadCard({ title, icon, subtitle, hint, accept, controls, parse, run }) {
  const preview = el("div", { style: { marginTop: "12px" } });
  const importBtn = el("button", { class: "btn btn-primary", disabled: "" }, "Import to Firebase");
  let state = null; // {payload, fileName}

  const zone = dropZone({
    accept, icon, hint,
    onFile: async (file) => {
      try {
        const raw = await readWorkbook(file);
        const res = parse(raw);
        state = res.canImport ? { payload: res.payload, fileName: file.name } : null;
        importBtn.disabled = res.canImport ? null : "";
        preview.replaceChildren(el("div", { class: "card", style: { padding: "12px 14px" } },
          el("p", { html: `<b>${file.name}</b> — ${res.summary}` })));
      } catch (err) {
        console.error(err);
        toast("Could not read that file", "err");
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
