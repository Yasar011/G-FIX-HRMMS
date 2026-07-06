/**
 * Reusable Excel drop-zone. Handles click-to-pick and drag & drop, then calls
 * `onFile(file)`. Used by the Data Upload page and the in-page upload modals.
 */
import { el } from "../lib/utils.js";

/**
 * @param {object} o
 * @param {string} [o.accept]  file accept filter
 * @param {string} [o.title]   bold prompt text
 * @param {string} [o.hint]    small hint line (e.g. column list)
 * @param {string} [o.icon]    emoji shown large
 * @param {Function} o.onFile  called with the chosen File
 * @returns HTMLElement (the drop zone, with a hidden file input inside)
 */
export function dropZone({ accept = ".xlsx,.xls,.csv", title = "Click to choose", hint = "", icon = "📥", onFile }) {
  const input = el("input", { type: "file", accept, class: "hidden" });
  const zone = el("div", { class: "upload-zone", onclick: () => input.click() },
    el("div", { class: "big" }, icon),
    el("p", {}, el("b", {}, title), " or drag & drop a file"),
    hint ? el("small", {}, hint) : null,
    input);
  input.addEventListener("change", () => { if (input.files[0]) { onFile(input.files[0]); input.value = ""; } });
  zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("drag"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault(); zone.classList.remove("drag");
    if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
  });
  return zone;
}
