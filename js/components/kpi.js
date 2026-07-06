/**
 * KPI tile components — animated stat cards used on the dashboard,
 * department pages and module headers.
 */
import { el, animateCount, fmtNum } from "../lib/utils.js";

/**
 * Single KPI tile.
 * @param {object} o {label, value, icon, color, sub, dp, suffix, onClick}
 */
export function kpiCard({ label, value, icon = "📊", color = "var(--brand)", sub = "", dp = 0, suffix = "", onClick = null }) {
  const valNode = el("div", { class: "kpi-value mono" }, "0");
  const card = el("div", {
    class: "kpi", style: { "--kpi-color": color, cursor: onClick ? "pointer" : "default" },
    onclick: onClick || undefined,
  },
    el("div", { class: "kpi-top" },
      el("span", { class: "kpi-label" }, label),
      el("span", { class: "kpi-icon" }, icon)),
    valNode,
    sub ? el("div", { class: "kpi-sub" }, sub) : null);

  if (typeof value === "number") animateCount(valNode, value, { dp, suffix });
  else valNode.textContent = value ?? "—";

  /** Update value/sub in place (realtime refresh without re-mounting). */
  card._update = (v, newSub) => {
    if (typeof v === "number") animateCount(valNode, v, { dp, suffix, duration: 450 });
    else valNode.textContent = v ?? "—";
    if (newSub != null) {
      let subNode = card.querySelector(".kpi-sub");
      if (!subNode) { subNode = el("div", { class: "kpi-sub" }); card.append(subNode); }
      subNode.textContent = newSub;
    }
  };
  return card;
}

/**
 * Grid of KPI tiles from spec array. Returns {el, update(values)} where
 * update re-animates tiles by spec id.
 */
export function kpiGrid(specs) {
  const grid = el("div", { class: "grid grid-kpi" });
  const tiles = {};
  for (const spec of specs) {
    const tile = kpiCard(spec);
    tiles[spec.id || spec.label] = tile;
    grid.append(tile);
  }
  grid._tiles = tiles;
  grid._update = (values) => {
    for (const [id, v] of Object.entries(values)) {
      if (!tiles[id]) continue;
      if (v && typeof v === "object") tiles[id]._update(v.value, v.sub);
      else tiles[id]._update(v);
    }
  };
  return grid;
}

/** Compact stat row (label + value) for side panels. */
export function statRow(label, value, tone = "") {
  return el("div", { class: "stat-row" },
    el("span", { class: "muted" }, label),
    el("strong", { class: tone ? `text-${tone}` : "" }, typeof value === "number" ? fmtNum(value) : (value ?? "—")));
}
