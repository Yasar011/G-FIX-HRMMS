/**
 * DataTable component — searchable, sortable, paginated, sticky-header table
 * with one-click Excel / CSV / PDF export. Used by every list view.
 */
import { el, esc, debounce } from "../lib/utils.js";
import { exportXLSX, exportCSV, exportPDF } from "../lib/export.js";

/**
 * @param {object} o
 * @param {string} o.title                    toolbar title
 * @param {Array<{key,label,render?,sortVal?,align?}>} o.columns
 * @param {Array<Object>} o.rows              row objects
 * @param {number} [o.pageSize=15]
 * @param {string} [o.exportName]             enables export buttons
 * @param {Function} [o.onRowClick]
 * @param {Node|Node[]} [o.toolbar]           extra toolbar controls
 * @param {string} [o.empty]                  empty-state message
 * @param {Array<{label,value}>} [o.summary]  totals strip baked into PDF/Excel/CSV exports
 * @returns HTMLElement with `_setRows(rows)` for realtime updates
 */
export function dataTable({
  title = "", columns, rows = [], pageSize = 15, exportName = "",
  onRowClick = null, toolbar = null, empty = "No records found", summary = null,
}) {
  let all = [...rows];
  let filtered = all;
  let page = 0;
  let sortKey = null;
  let sortDir = 1;
  let q = "";

  const thead = el("thead");
  const tbody = el("tbody");
  const info = el("span", { class: "muted", style: { fontSize: "12px" } });
  const pager = el("div", { class: "pager" });

  /* ---- search ---- */
  const search = el("input", {
    type: "search", placeholder: "Search…",
    oninput: debounce((e) => { q = e.target.value.toLowerCase(); applyFilter(); }, 200),
  });

  /* ---- export buttons ---- */
  const exportBtns = exportName ? [
    el("button", { class: "btn btn-sm btn-ghost", title: "Export Excel", onclick: () => exportXLSX(exportRows(), exportName, columns, { summary }) }, "⬇ Excel"),
    el("button", { class: "btn btn-sm btn-ghost", title: "Export CSV", onclick: () => exportCSV(exportRows(), exportName, columns, { summary }) }, "⬇ CSV"),
    el("button", { class: "btn btn-sm btn-ghost", title: "Export PDF", onclick: () => exportPDF(exportRows(), exportName, columns, { title, summary }) }, "⬇ PDF"),
  ] : [];

  const card = el("div", { class: "card table-card" },
    el("div", { class: "table-toolbar" },
      title ? el("h4", {}, title) : null,
      el("div", { class: "spacer" }),
      ...(Array.isArray(toolbar) ? toolbar : toolbar ? [toolbar] : []),
      ...exportBtns,
      search),
    el("div", { class: "table-scroll" }, el("table", { class: "dt" }, thead, tbody)),
    el("div", { class: "table-foot" }, info, el("div", { class: "spacer" }), pager));

  /* Plain-text rows for export (render functions produce DOM, not text). */
  function exportRows() {
    return filtered.map((r) => Object.fromEntries(columns.map((c) => {
      const v = c.exportVal ? c.exportVal(r) : r[c.key];
      return [c.key, v ?? ""];
    })));
  }

  function buildHead() {
    const tr = el("tr");
    for (const c of columns) {
      tr.append(el("th", {
        style: c.align ? { textAlign: c.align } : null,
        onclick: () => {
          if (sortKey === c.key) sortDir *= -1; else { sortKey = c.key; sortDir = 1; }
          applySort(); render();
        },
      }, c.label, " ", el("span", { class: "sort" }, sortKey === c.key ? (sortDir > 0 ? "▲" : "▼") : "↕")));
    }
    thead.replaceChildren(tr);
  }

  function applyFilter() {
    filtered = !q ? all : all.filter((r) =>
      columns.some((c) => {
        // searchVal overrides exportVal/key for full-text search (e.g. include emp ID in name column)
        const v = c.searchVal ? c.searchVal(r) : (c.exportVal ? c.exportVal(r) : r[c.key]);
        return String(v ?? "").toLowerCase().includes(q);
      }));
    page = 0;
    applySort();
    render();
  }

  function applySort() {
    if (!sortKey) return;
    const col = columns.find((c) => c.key === sortKey);
    filtered = [...filtered].sort((a, b) => {
      const av = col?.sortVal ? col.sortVal(a) : a[sortKey];
      const bv = col?.sortVal ? col.sortVal(b) : b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * sortDir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * sortDir;
    });
  }

  function render() {
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.min(page, pages - 1);
    const slice = filtered.slice(page * pageSize, (page + 1) * pageSize);

    tbody.replaceChildren();
    if (!slice.length) {
      tbody.append(el("tr", {}, el("td", {
        colspan: String(columns.length),
        style: { textAlign: "center", padding: "36px", color: "var(--text-dim)" },
      }, empty)));
    }
    for (const r of slice) {
      const tr = el("tr", { class: onRowClick ? "clickable" : "", onclick: onRowClick ? () => onRowClick(r) : undefined });
      for (const c of columns) {
        const td = el("td", { style: c.align ? { textAlign: c.align } : null });
        const v = c.render ? c.render(r) : r[c.key];
        if (v instanceof Node) td.append(v);
        else td.innerHTML = esc(v ?? "—");
        tr.append(td);
      }
      tbody.append(tr);
    }

    info.textContent = `${filtered.length.toLocaleString()} record${filtered.length === 1 ? "" : "s"}`;
    pager.replaceChildren(
      el("button", { class: "btn btn-sm btn-ghost", disabled: page === 0 ? "" : null, onclick: () => { page--; render(); } }, "‹"),
      el("span", { class: "muted", style: { fontSize: "12px" } }, ` ${page + 1} / ${pages} `),
      el("button", { class: "btn btn-sm btn-ghost", disabled: page >= pages - 1 ? "" : null, onclick: () => { page++; render(); } }, "›"));
  }

  buildHead();
  applyFilter();

  /** Replace rows (realtime updates keep current search/sort/page). */
  card._setRows = (newRows) => { all = [...newRows]; applyFilter(); };
  /** Update the summary baked into future PDF/Excel/CSV exports. */
  card._setSummary = (newSummary) => { summary = newSummary; };
  return card;
}
