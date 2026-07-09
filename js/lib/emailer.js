/**
 * Email engine (EmailJS).
 *
 * Configuration lives at settings/emailjs = {publicKey, serviceId, templateId}
 * (set from the Settings page). The EmailJS template should use these params:
 *   to_email, subject, message, report_html
 * and may define dynamic attachments bound to `attachment_pdf` /
 * `attachment_xlsx` (base64, "Variable Attachment" type — EmailJS paid plans).
 *
 * Automation: because this is a serverless client-side app, scheduled emails
 * are dispatched by `runAutomation()` — called on sign-in and every 30 min
 * while the dashboard is open. Sent-state is guarded through
 * emailAutomation/lastSent/{ruleId} in the database so multiple open clients
 * don't double-send. For guaranteed delivery with no browser open, port
 * `buildReportEmail` into a Firebase Cloud Function on a schedule.
 */
import { read, dbUpdate, dbPush } from "./store.js";
import { getReport } from "./reports.js";
import { buildPDF } from "./export.js";
import { notify } from "./notify.js";
import { ym, ymd, today, addDays, toList } from "./utils.js";
import { track } from "./firebase.js";

let inited = false;

/** Initialize the EmailJS SDK with the stored public key. Returns config or null. */
async function getConfig() {
  const cfg = await read("settings/emailjs");
  if (!cfg?.publicKey || !cfg?.serviceId || !cfg?.templateId) return null;
  if (!inited) { emailjs.init({ publicKey: cfg.publicKey }); inited = true; }
  return cfg;
}

/** True when EmailJS is fully configured. */
export async function emailReady() { return !!(await getConfig()); }

/**
 * Send one email.
 * @param {object} o {to, subject, message, html, attachPdf, attachXlsx}
 *   attachPdf  — jsPDF doc (optional)
 *   attachXlsx — {rows, columns, name} (optional)
 */
export async function sendEmail({ to, subject, message = "", html = "", attachPdf = null, attachXlsx = null }) {
  const cfg = await getConfig();
  if (!cfg) throw new Error("EmailJS is not configured — set it up in Settings");

  const params = { to_email: to, subject, message, report_html: html };
  if (attachPdf) params.attachment_pdf = attachPdf.output("datauristring").split(",")[1];
  if (attachXlsx) {
    const ws = XLSX.utils.json_to_sheet(attachXlsx.columns
      ? attachXlsx.rows.map((r) => Object.fromEntries(attachXlsx.columns.map((c) => [c.label, r[c.key] ?? ""])))
      : attachXlsx.rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (attachXlsx.name || "report").slice(0, 31));
    params.attachment_xlsx = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
  }

  await emailjs.send(cfg.serviceId, cfg.templateId, params);
  await dbPush("emailLogs", { to, subject, ts: Date.now(), status: "sent" });
  track("email_sent", { subject });
}

/** Compact HTML table for the email body from report rows. */
export function reportHtml(columns, rows, limit = 40) {
  const th = columns.map((c) => `<th style="text-align:left;padding:6px 10px;background:#6366f1;color:#fff;font-size:12px">${c.label}</th>`).join("");
  const trs = rows.slice(0, limit).map((r) =>
    `<tr>${columns.map((c) => `<td style="padding:5px 10px;border-bottom:1px solid #e5e7f0;font-size:12px">${r[c.key] ?? ""}</td>`).join("")}</tr>`).join("");
  const more = rows.length > limit ? `<p style="font-size:12px;color:#666">…and ${rows.length - limit} more rows (see attachment)</p>` : "";
  return `<table style="border-collapse:collapse;width:100%">${`<tr>${th}</tr>`}${trs}</table>${more}`;
}

/**
 * Build and send a registry report by id.
 * @param {string} reportId  id from lib/reports.js
 * @param {object} o {to, params, attachPdf, attachXlsx, noteTop}
 */
export async function sendReportEmail(reportId, { to, params = {}, attachPdf = true, attachXlsx = true, noteTop = "" }) {
  const report = getReport(reportId);
  if (!report) throw new Error(`Unknown report: ${reportId}`);
  const data = {};
  for (const path of ["employees", "attendance", "budget", "attrition", "leaves", "vacancies", "recruitment", "settings"]) {
    data[path] = await read(path);
  }
  const { columns, rows, subtitle, summary } = report.build(data, { date: today(), month: ym(), year: String(new Date().getFullYear()), ...params });
  const subject = `[Brandix U3 HR] ${report.title}${subtitle ? " — " + subtitle : ""}`;
  await sendEmail({
    to, subject,
    message: `${noteTop || report.title} · ${rows.length} records · generated ${new Date().toLocaleString()}`,
    html: reportHtml(columns, rows),
    attachPdf: attachPdf && rows.length ? buildPDF(rows, report.id, columns, { title: report.title, subtitle, summary }) : null,
    attachXlsx: attachXlsx && rows.length ? { rows, columns, name: report.id } : null,
  });
  return { subject, rows: rows.length };
}

/* ================= Automation rules ================= */

/**
 * Automation rule catalog. `due(lastSent)` decides whether a rule should fire
 * now; `run(recipients)` performs the send.
 */
export const AUTOMATION_RULES = [
  {
    id: "daily_attendance", label: "Daily attendance report", desc: "Yesterday's attendance, sent each morning",
    due: (last) => ymd(new Date(last || 0)) < today(),
    run: (to) => sendReportEmail("daily_attendance", { to, params: { date: addDays(today(), -1) }, noteTop: "Automated daily attendance report" }),
  },
  {
    id: "weekly_report", label: "Weekly attendance report", desc: "Rolling 7-day summary, sent on Mondays",
    due: (last) => new Date().getDay() === 1 && Date.now() - (last || 0) > 6 * 86400e3,
    run: (to) => sendReportEmail("weekly_attendance", { to, noteTop: "Automated weekly report" }),
  },
  {
    id: "monthly_report", label: "Monthly attendance report", desc: "Previous month, sent on the 1st",
    due: (last) => new Date().getDate() === 1 && !ymd(new Date(last || 0)).startsWith(ym()),
    run: (to) => {
      const prev = ym(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
      return sendReportEmail("monthly_attendance", { to, params: { month: prev }, noteTop: "Automated monthly report" });
    },
  },
  {
    id: "budget_exceeded", label: "Budget exceeded alert", desc: "Departments over budget (daily check)",
    due: (last) => ymd(new Date(last || 0)) < today(),
    run: async (to) => {
      const r = await import("./metrics.js");
      const [budget, employees] = [await read(`budget/${ym()}`), r.empList(await read("employees"))];
      const over = r.budgetStats(budget, employees).filter((b) => b.excess > 0);
      if (!over.length) return null; // nothing to alert
      const columns = [{ key: "department", label: "Department" }, { key: "budget", label: "Budget" }, { key: "actual", label: "Actual" }, { key: "excess", label: "Excess" }];
      await sendEmail({ to, subject: "[Brandix U3 HR] ⚠ Budget exceeded", message: `${over.length} department(s) over budget in ${ym()}`, html: reportHtml(columns, over) });
      return { rows: over.length };
    },
  },
  {
    id: "absentee_alert", label: "Frequent absentee alert", desc: "Employees absent >3 days this month (daily check)",
    due: (last) => ymd(new Date(last || 0)) < today(),
    run: async (to) => {
      const res = await sendReportEmail("frequent_absentee", { to, noteTop: "Employees absent more than 3 days this month", attachPdf: true, attachXlsx: false });
      return res;
    },
  },
  {
    id: "management_summary", label: "Management summary", desc: "Daily plant KPI digest for management",
    due: (last) => ymd(new Date(last || 0)) < today(),
    run: async (to) => {
      const m = await import("./metrics.js");
      const employees = m.empList(await read("employees"));
      const attendance = await read("attendance");
      const t = m.dayStats(attendance?.[today()] || {}, employees);
      const w = m.workforceStats(employees);
      const b = m.budgetSummary(await read(`budget/${ym()}`), employees);
      const rows = [
        { metric: "Headcount", value: w.headcount }, { metric: "Present today", value: t.present },
        { metric: "Absent today", value: t.absent }, { metric: "Attendance %", value: t.attendancePct.toFixed(1) + "%" },
        { metric: "Late", value: t.late }, { metric: "On leave", value: t.leave },
        { metric: "OT hours today", value: t.otHours.toFixed(1) }, { metric: "Budget filled %", value: b.filledPct.toFixed(1) + "%" },
        { metric: "Vacancies", value: b.vacancies }, { metric: "Notice period", value: w.notice },
      ];
      const columns = [{ key: "metric", label: "Metric" }, { key: "value", label: "Value" }];
      await sendEmail({ to, subject: `[Brandix U3 HR] Management summary — ${today()}`, message: "Automated daily management digest", html: reportHtml(columns, rows) });
      return { rows: rows.length };
    },
  },
];

/**
 * Fire any enabled + due automation rules. Safe to call repeatedly; a
 * lastSent claim is written before sending so concurrent clients skip.
 */
export async function runAutomation() {
  try {
    if (!(await getConfig())) return;
    const auto = (await read("emailAutomation")) || {};
    const recipients = auto.recipients;
    if (!recipients) return;
    for (const rule of AUTOMATION_RULES) {
      if (!auto.enabled?.[rule.id]) continue;
      const last = auto.lastSent?.[rule.id] || 0;
      if (!rule.due(last)) continue;
      // Claim before sending to avoid double-send from a second open tab.
      await dbUpdate("emailAutomation/lastSent", { [rule.id]: Date.now() });
      try {
        const res = await rule.run(recipients);
        if (res) notify("email", "Automated email sent", `${rule.label} → ${recipients}`);
      } catch (e) {
        console.error(`automation ${rule.id}`, e);
        await dbPush("emailLogs", { to: recipients, subject: rule.label, ts: Date.now(), status: "failed", error: String(e.message || e) });
      }
    }
  } catch (e) { console.error("runAutomation", e); }
}

/** Start the 30-minute automation heartbeat (call once after sign-in). */
export function startAutomationLoop() {
  runAutomation();
  setInterval(runAutomation, 30 * 60 * 1000);
}
