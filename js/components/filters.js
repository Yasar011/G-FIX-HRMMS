/**
 * FilterBar component — the standard filter strip (date / month / department /
 * section / etc.) used on attendance, reports, OT and analytics pages.
 */
import { el } from "../lib/utils.js";

/**
 * @param {Array} fields  [{id, label, type: "date"|"month"|"select"|"text", options?, value?}]
 * @param {Function} onChange  called with {id: value} map on every change
 * @param {Node|Node[]} [extra]  extra controls appended right-aligned
 * @returns HTMLElement with `_values()`, `_set(id, value)` and `_setOptions(id, options)`
 */
export function filterBar(fields, onChange, extra = null) {
  const inputs = {};
  const bar = el("div", { class: "filter-bar" });

  const values = () => Object.fromEntries(Object.entries(inputs).map(([id, i]) => [id, i.value]));
  const fire = () => onChange?.(values());

  for (const f of fields) {
    let input;
    if (f.type === "select") {
      input = el("select", { onchange: fire });
      setOptions(input, f.options || [], f.value);
    } else {
      input = el("input", {
        type: f.type || "text",
        value: f.value ?? "",
        placeholder: f.placeholder || "",
        onchange: fire,
        oninput: f.type === "text" ? fire : undefined,
      });
    }
    inputs[f.id] = input;
    bar.append(el("label", { class: "field" }, el("span", {}, f.label), input));
  }
  bar.append(el("div", { class: "spacer" }));
  if (extra) (Array.isArray(extra) ? extra : [extra]).forEach((n) => bar.append(n));

  function setOptions(select, options, keep) {
    const cur = keep ?? select.value;
    select.replaceChildren(...options.map((o) => {
      const opt = typeof o === "object" ? o : { value: o, label: o };
      return el("option", { value: opt.value }, opt.label);
    }));
    if ([...select.options].some((o) => o.value === cur)) select.value = cur;
  }

  bar._values = values;
  bar._set = (id, v) => { if (inputs[id]) { inputs[id].value = v; } };
  bar._setOptions = (id, options) => { if (inputs[id]?.tagName === "SELECT") setOptions(inputs[id], options); };
  return bar;
}

/** Standard "All + values" select options from a list. */
export function allOptions(values, allLabel = "All") {
  return [{ value: "", label: allLabel }, ...values.map((v) => ({ value: v, label: v }))];
}
