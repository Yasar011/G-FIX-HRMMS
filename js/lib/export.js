/**
 * Export helpers: Excel (SheetJS), CSV, PDF (jsPDF + autotable).
 * Every report and table in the app funnels through these three functions.
 */
import { downloadBlob, today } from "./utils.js";

/**
 * Export rows to an .xlsx workbook.
 * @param {Array<Object>} rows      plain objects; keys become headers
 * @param {string} name             file/sheet name (no extension)
 * @param {Array<{key,label}>} [columns]  optional column order/labels
 */
export function exportXLSX(rows, name = "report", columns = null) {
  const data = columns
    ? rows.map((r) => Object.fromEntries(columns.map((c) => [c.label, r[c.key] ?? ""])))
    : rows;
  const ws = XLSX.utils.json_to_sheet(data);
  autoWidth(ws, data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  XLSX.writeFile(wb, `${name}_${today()}.xlsx`);
}

/** Export rows to CSV (UTF-8 BOM so Excel opens it correctly). */
export function exportCSV(rows, name = "report", columns = null) {
  const cols = columns || Object.keys(rows[0] || {}).map((k) => ({ key: k, label: k }));
  const escCell = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    cols.map((c) => escCell(c.label)).join(","),
    ...rows.map((r) => cols.map((c) => escCell(r[c.key])).join(",")),
  ];
  downloadBlob(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }), `${name}_${today()}.csv`);
}

/**
 * Export rows to a branded PDF table.
 * @returns {jsPDF} the document (caller may attach it to an email instead of saving)
 */
export function buildPDF(rows, name = "report", columns = null, { title = name, subtitle = "", summary = null } = {}) {
  const { jsPDF } = window.jspdf;
  const cols = columns || Object.keys(rows[0] || {}).map((k) => ({ key: k, label: k }));
  const doc = new jsPDF({ orientation: cols.length > 7 ? "landscape" : "portrait", unit: "pt" });
  const pageW = doc.internal.pageSize.getWidth();

  // Header band
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, pageW, 54, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15).setFont(undefined, "bold");
  doc.text("Brandix Unit 3 — HR Analytics", 40, 24);
  doc.setFontSize(10).setFont(undefined, "normal");
  doc.text(`${title}${subtitle ? " · " + subtitle : ""} · Generated ${new Date().toLocaleString()}`, 40, 40);

  // Summary strip (e.g. Present / Absent / Leave / Half Day counts)
  let startY = 66;
  if (summary && summary.length) {
    doc.setFillColor(238, 240, 252);
    doc.rect(0, 54, pageW, 27, "F");
    doc.setTextColor(60, 62, 100);
    doc.setFontSize(9.5).setFont(undefined, "bold");
    doc.text(summary.map((s) => `${s.label}: ${s.value}`).join("      "), 40, 72);
    startY = 96;
  }

  doc.autoTable({
    startY,
    head: [cols.map((c) => c.label)],
    body: rows.map((r) => cols.map((c) => String(r[c.key] ?? ""))),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [55, 60, 120], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [244, 245, 252] },
    margin: { left: 40, right: 40 },
    didDrawPage: () => {
      const h = doc.internal.pageSize.getHeight();
      doc.setFontSize(8).setTextColor(150);
      doc.text(`Page ${doc.internal.getNumberOfPages()}`, doc.internal.pageSize.getWidth() - 70, h - 16);
    },
  });
  return doc;
}

/** Build and immediately download a PDF report. */
export function exportPDF(rows, name = "report", columns = null, meta = {}) {
  buildPDF(rows, name, columns, meta).save(`${name}_${today()}.pdf`);
}

/** Capture any DOM element to a PNG download (dashboards, heatmaps). */
export async function exportElementPNG(node, name = "capture") {
  const dark = document.documentElement.dataset.theme !== "light";
  const canvas = await html2canvas(node, { backgroundColor: dark ? "#0b0e17" : "#eef1f8", scale: 2 });
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = `${name}_${today()}.png`;
  a.click();
}

/** Size worksheet columns to fit content. */
function autoWidth(ws, data) {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  ws["!cols"] = keys.map((k) => ({
    wch: Math.min(40, Math.max(k.length, ...data.slice(0, 200).map((r) => String(r[k] ?? "").length)) + 2),
  }));
}
