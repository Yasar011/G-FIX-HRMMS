/**
 * Grok (xAI) client helper. Every call goes through /api/grok — a Vercel
 * serverless function that holds the API key and verifies the caller is a
 * signed-in staff user — so the key and the raw data digest never need to
 * be exposed beyond this app's own backend.
 */
import { auth, getIdToken } from "./firebase.js";

/**
 * Send a chat-style request to Grok.
 * @param {Array<{role: "system"|"user"|"assistant", content: string}>} messages
 * @returns {Promise<string>} the assistant's reply text
 */
export async function askGrok(messages, { temperature = 0.5, maxTokens = 700 } = {}) {
  if (!auth.currentUser) throw new Error("Sign in required.");
  const idToken = await getIdToken(auth.currentUser);

  let res;
  try {
    res = await fetch("/api/grok", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ messages, temperature, max_tokens: maxTokens }),
    });
  } catch (e) {
    throw new Error("Could not reach the AI service — check your connection.");
  }

  let body;
  try { body = await res.json(); } catch { body = {}; }
  if (!res.ok) throw new Error(body.error || `AI request failed (${res.status})`);
  return body.text || "";
}
