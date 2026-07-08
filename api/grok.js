/**
 * Vercel serverless function — proxies AI requests to xAI's Grok API.
 *
 * The Grok API key lives only here (server-side env var), never in the
 * browser bundle. To stop random visitors from hitting this endpoint
 * directly and burning through the account's Grok quota, every request
 * must carry a valid Firebase ID token for a NON-anonymous (staff) user —
 * verified here by checking the token's RS256 signature against Google's
 * public certs, without needing the Firebase Admin SDK as a dependency.
 *
 * Required Vercel environment variables:
 *   GROK_API_KEY       — your xAI API key (required)
 *   GROK_MODEL         — model id (optional, defaults to "grok-4-latest")
 *   FIREBASE_PROJECT_ID — optional, defaults to this project's id below
 */
const crypto = require("crypto");

const DEFAULT_PROJECT_ID = "hr-brandxunit-3";
const CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let certsCache = null; // { certs, expiresAt }

async function getGoogleCerts() {
  if (certsCache && certsCache.expiresAt > Date.now()) return certsCache.certs;
  const res = await fetch(CERTS_URL);
  if (!res.ok) throw new Error("Could not fetch signing certs");
  const certs = await res.json();
  const cacheControl = res.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAge = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 3600000;
  certsCache = { certs, expiresAt: Date.now() + maxAge };
  return certs;
}

function base64UrlDecode(s) {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/** Verify a Firebase ID token's signature + claims without the Admin SDK. */
async function verifyFirebaseIdToken(idToken, projectId) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Malformed token");
  const header = JSON.parse(base64UrlDecode(parts[0]).toString("utf8"));
  const payload = JSON.parse(base64UrlDecode(parts[1]).toString("utf8"));

  if (header.alg !== "RS256") throw new Error("Unexpected token algorithm");
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) throw new Error("Token expired");
  if (payload.iat > now + 300) throw new Error("Token issued in the future");
  if (payload.aud !== projectId) throw new Error("Token audience mismatch");
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error("Token issuer mismatch");
  if (!payload.sub) throw new Error("Token missing subject");

  const certs = await getGoogleCerts();
  const cert = certs[header.kid];
  if (!cert) throw new Error("Unknown signing key");

  const signedData = `${parts[0]}.${parts[1]}`;
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(signedData);
  if (!verifier.verify(cert, base64UrlDecode(parts[2]))) throw new Error("Invalid token signature");

  return payload;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    res.status(401).json({ error: "Sign in required." });
    return;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID;
  let claims;
  try {
    claims = await verifyFirebaseIdToken(idToken, projectId);
  } catch (e) {
    res.status(401).json({ error: "Invalid or expired session — please sign in again." });
    return;
  }
  if (claims.firebase?.sign_in_provider === "anonymous") {
    res.status(403).json({ error: "AI features require a staff account." });
    return;
  }

  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "AI is not configured — missing GROK_API_KEY on the server." });
    return;
  }

  const { messages, temperature = 0.5, max_tokens = 700 } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }
  if (messages.length > 40 || JSON.stringify(messages).length > 60000) {
    res.status(400).json({ error: "Request too large" });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const upstream = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.GROK_MODEL || "grok-4-latest",
        messages,
        temperature,
        max_tokens: Math.min(Number(max_tokens) || 700, 1200),
      }),
      signal: controller.signal,
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: data?.error?.message || "Grok API request failed" });
      return;
    }
    res.status(200).json({ text: data?.choices?.[0]?.message?.content || "" });
  } catch (e) {
    const timedOut = e.name === "AbortError";
    res.status(timedOut ? 504 : 502).json({ error: timedOut ? "AI request timed out" : "Could not reach the AI service" });
  } finally {
    clearTimeout(timeout);
  }
};
