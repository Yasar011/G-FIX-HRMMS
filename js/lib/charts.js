/**
 * Chart.js helpers — theme-aware defaults, a `chartCard` factory used by all
 * pages, and automatic recoloring when the light/dark theme flips.
 */
import { el } from "./utils.js";

/** Categorical palette (mirrors --c1..--c8 in variables.css). */
export const PALETTE = ["#6366f1", "#34d399", "#fbbf24", "#f87171", "#38bdf8", "#a78bfa", "#fb923c", "#f472b6"];

const live = new Set(); // all mounted charts, recolored on theme change

/** Read current theme tokens for chart styling. */
function themeTokens() {
  const dark = document.documentElement.dataset.theme !== "light";
  return {
    text: dark ? "#9aa1b5" : "#5b6478",
    grid: dark ? "rgba(255,255,255,.07)" : "rgba(15,23,42,.08)",
    tooltipBg: dark ? "rgba(17,21,38,.95)" : "rgba(255,255,255,.97)",
    tooltipText: dark ? "#e7e9f2" : "#10152b",
  };
}

/** Apply theme tokens to a chart's options in place. */
function applyTheme(chart) {
  const t = themeTokens();
  const o = chart.options;
  if (o.plugins?.legend?.labels) o.plugins.legend.labels.color = t.text;
  if (o.plugins?.tooltip) {
    Object.assign(o.plugins.tooltip, {
      backgroundColor: t.tooltipBg, titleColor: t.tooltipText, bodyColor: t.text,
      borderColor: t.grid, borderWidth: 1, padding: 10, cornerRadius: 10,
    });
  }
  for (const axis of Object.values(o.scales || {})) {
    if (axis.ticks) axis.ticks.color = t.text;
    if (axis.grid) axis.grid.color = t.grid;
    if (axis.angleLines) axis.angleLines.color = t.grid;
    if (axis.pointLabels) axis.pointLabels.color = t.text;
  }
}

window.addEventListener("themechange", () => {
  live.forEach((c) => { applyTheme(c); c.update("none"); });
});

/** Base options shared by every chart. */
function baseOptions(type) {
  const opts = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 700, easing: "easeOutQuart" },
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { position: "bottom", labels: { usePointStyle: true, pointStyleWidth: 8, boxHeight: 6, font: { size: 11 } } },
      tooltip: {},
    },
  };
  if (["line", "bar"].includes(type)) {
    opts.scales = {
      x: { grid: { display: false }, ticks: { font: { size: 11 }, maxRotation: 45 } },
      y: { beginAtZero: true, grid: {}, ticks: { font: { size: 11 }, precision: 0 } },
    };
  }
  return opts;
}

/** Style dataset defaults (smooth lines, rounded bars, palette colors). */
function styleDatasets(type, datasets) {
  return datasets.map((ds, i) => {
    const color = ds.color || PALETTE[i % PALETTE.length];
    const styled = { borderColor: color, backgroundColor: color, ...ds };
    delete styled.color;
    if (type === "line") {
      styled.tension = ds.tension ?? 0.35;
      styled.borderWidth = ds.borderWidth ?? 2.2;
      styled.pointRadius = ds.pointRadius ?? 0;
      styled.pointHoverRadius = 5;
      if (ds.fill) styled.backgroundColor = hexA(color, 0.14);
    }
    if (type === "bar") {
      styled.borderColor = "transparent";
      styled.borderRadius = ds.borderRadius ?? 6;
      styled.maxBarThickness = ds.maxBarThickness ?? 34;
      styled.backgroundColor = ds.backgroundColor || (Array.isArray(ds.data) && ds.perBarColor
        ? ds.data.map((_, j) => PALETTE[j % PALETTE.length]) : hexA(color, 0.85));
    }
    if (["doughnut", "pie", "polarArea"].includes(type)) {
      styled.backgroundColor = ds.backgroundColor || (ds.data || []).map((_, j) => PALETTE[j % PALETTE.length]);
      styled.borderColor = "transparent";
      styled.hoverOffset = 6;
    }
    return styled;
  });
}

/** Hex color → rgba string with alpha. */
export function hexA(hex, a) {
  const m = hex.replace("#", "");
  const n = parseInt(m.length === 3 ? m.split("").map((c) => c + c).join("") : m, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/**
 * Create a glass chart card with title + canvas + PNG export button.
 * Returns the card element; `card._update(labels, datasets)` refreshes data
 * in place (used by realtime subscriptions).
 */
export function chartCard({ title, type = "line", labels = [], datasets = [], options = {}, height = "" }) {
  const canvas = el("canvas");
  const titleNode = el("h4", {}, title);
  const card = el("div", { class: "card chart-card" },
    el("div", { class: "card-head" },
      titleNode,
      el("div", { class: "spacer" }),
      el("button", {
        class: "icon-btn", title: "Download chart as PNG",
        onclick: () => downloadChartPNG(canvas, titleNode.textContent),
      }, "📷")),
    el("div", { class: `chart-wrap ${height}` }, canvas));

  const opts = deepMerge(baseOptions(type), options);
  const chart = new Chart(canvas, { type, data: { labels, datasets: styleDatasets(type, datasets) }, options: opts });
  applyTheme(chart);
  chart.update("none");
  live.add(chart);

  card._chart = chart;
  card._title = (newTitle) => { titleNode.textContent = newTitle; };
  card._update = (newLabels, newDatasets) => {
    chart.data.labels = newLabels;
    chart.data.datasets = styleDatasets(type, newDatasets);
    chart.update();
  };
  // Dispose with the DOM node (router replaces page contents).
  const obs = new MutationObserver(() => {
    if (!document.body.contains(card)) { live.delete(chart); chart.destroy(); obs.disconnect(); }
  });
  obs.observe(document.getElementById("page-container") || document.body, { childList: true, subtree: true });
  return card;
}

/** Export a chart canvas as a PNG download (solid background). */
export function downloadChartPNG(canvas, name = "chart") {
  const dark = document.documentElement.dataset.theme !== "light";
  const out = document.createElement("canvas");
  out.width = canvas.width; out.height = canvas.height;
  const ctx = out.getContext("2d");
  ctx.fillStyle = dark ? "#0b0e17" : "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, 0, 0);
  const a = document.createElement("a");
  a.href = out.toDataURL("image/png");
  a.download = `${name.replace(/\s+/g, "_")}.png`;
  a.click();
}

/** Minimal deep merge for chart options. */
function deepMerge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b || {})) {
    out[k] = v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object"
      ? deepMerge(a[k], v) : v;
  }
  return out;
}
