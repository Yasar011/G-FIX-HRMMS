import { buildYbotSystemPrompt } from "@/lib/ybot-context";

type ChatMessage = { role: "user" | "assistant"; content: string };

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const MAX_MESSAGES = 20;

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Y-BOT is not configured yet." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = (await request.json()) as { messages?: ChatMessage[] };
  const messages = (body.messages ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-MAX_MESSAGES);

  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: "No messages provided." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const systemPrompt = await buildYbotSystemPrompt();

  const upstream = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || DEFAULT_MODEL,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true,
      temperature: 0.6,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errorText = await upstream.text().catch(() => "");
    return new Response(
      JSON.stringify({ error: "Y-BOT couldn't reach Groq.", detail: errorText.slice(0, 300) }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  // Re-stream the upstream SSE as plain text tokens the client can append directly.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") {
            controller.close();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const token = parsed.choices?.[0]?.delta?.content;
            if (token) controller.enqueue(encoder.encode(token));
          } catch {
            // ignore malformed SSE chunks
          }
        }
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
