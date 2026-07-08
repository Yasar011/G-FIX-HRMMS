/**
 * AI Assistant — general-knowledge chat backed by Grok (xAI).
 *
 * Deliberately does NOT read any company data (employees, attendance,
 * budget, etc.) into the conversation — only the messages typed here are
 * ever sent to the AI. For anything about this company's actual numbers,
 * the assistant is instructed to point the user at the relevant dashboard
 * page instead of guessing.
 */
import { askGrok } from "../lib/ai.js";
import { el } from "../lib/utils.js";

const SYSTEM_PROMPT = "You are a helpful general-knowledge assistant for HR staff at a garment manufacturing "
  + "plant in Sri Lanka (Brandix Unit 3). Answer general questions about HR practices, Sri Lankan labor law "
  + "concepts, garment industry operations, and management advice. You do NOT have access to this company's "
  + "actual employee records, attendance, payroll, or budget data — if asked about specific company numbers, "
  + "say so plainly and suggest the relevant page (Dashboard, Departments, Budget, Reports) instead of guessing "
  + "or making up figures. Keep answers concise.";

export async function render(root) {
  const history = []; // {role, content}

  const msgHost = el("div", {
    class: "card",
    style: { minHeight: "420px", maxHeight: "60vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" },
  }, emptyHint());

  const input = el("input", { type: "text", placeholder: "Ask a general HR question…", style: { flex: 1 } });
  const sendBtn = el("button", { class: "btn btn-primary", onclick: send }, "Send");
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });

  root.append(
    el("div", { class: "page-head" },
      el("h3", {}, "✨ AI Assistant"),
      el("div", { class: "spacer" }),
      el("span", { class: "muted", style: { fontSize: "12px" } }, "General knowledge only — doesn't see your company data")),
    msgHost,
    el("div", { class: "card", style: { display: "flex", gap: "10px", marginTop: "10px" } }, input, sendBtn));

  input.focus();

  function emptyHint() {
    return el("p", { class: "muted", style: { textAlign: "center", padding: "20px 0", margin: "auto" } },
      "Ask something like \"what's a typical overtime policy?\" or \"how do I structure a performance improvement plan?\". "
      + "For questions about THIS company's actual numbers, use the Dashboard, Departments, or Reports pages instead.");
  }

  function addBubble(role, text) {
    if (msgHost.firstElementChild?.tagName === "P") msgHost.replaceChildren();
    const bubble = el("div", {
      style: {
        alignSelf: role === "user" ? "flex-end" : "flex-start",
        maxWidth: "80%",
        padding: "10px 14px",
        borderRadius: "12px",
        background: role === "user" ? "var(--brand)" : "var(--surface-2)",
        color: role === "user" ? "#fff" : "inherit",
        whiteSpace: "pre-wrap",
        fontSize: "13.5px",
      },
    }, text);
    msgHost.append(bubble);
    msgHost.scrollTop = msgHost.scrollHeight;
    return bubble;
  }

  async function send() {
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    input.disabled = true;
    sendBtn.disabled = true;
    addBubble("user", text);
    history.push({ role: "user", content: text });
    const thinking = addBubble("assistant", "…");
    try {
      const reply = await askGrok([{ role: "system", content: SYSTEM_PROMPT }, ...history], { maxTokens: 500 });
      thinking.textContent = reply || "(no response)";
      history.push({ role: "assistant", content: reply || "" });
    } catch (e) {
      thinking.textContent = e.message || "Something went wrong.";
      thinking.classList.add("text-bad");
    } finally {
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }
}
