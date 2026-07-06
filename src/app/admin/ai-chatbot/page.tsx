"use client";

import { useEffect, useState } from "react";
import { StringListInput } from "@/components/StringListInput";
import {
  DEFAULT_YBOT_CONFIG,
  YBOT_CONFIG_PATH,
  getNode,
  saveNode,
  type YbotConfig,
} from "@/lib/settings";

const MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "openai/gpt-oss-120b",
  "moonshotai/kimi-k2-instruct",
];

export default function AiChatbotPage() {
  const [config, setConfig] = useState<YbotConfig>(DEFAULT_YBOT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    getNode<YbotConfig>(YBOT_CONFIG_PATH, DEFAULT_YBOT_CONFIG).then((c) => {
      setConfig(c);
      setLoading(false);
    });
  }, []);

  function update<K extends keyof YbotConfig>(key: K, value: YbotConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setStatus("Saving…");
    await saveNode<YbotConfig>(YBOT_CONFIG_PATH, config);
    setStatus("Saved ✓");
    setTimeout(() => setStatus(null), 2000);
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">AI Chatbot Manager</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Configure Y-BOT. The API key is stored securely as a server environment variable and is
          never editable here.
        </p>
      </div>

      <StringListInput
        label="Suggested questions (shown as starter chips)"
        values={config.suggestedQuestions}
        onChange={(v) => update("suggestedQuestions", v)}
        placeholder="e.g. What internships have you done?"
      />

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Extra system instructions
        </label>
        <textarea
          value={config.extraInstructions}
          onChange={(e) => update("extraInstructions", e.target.value)}
          rows={4}
          placeholder="Optional tone/behaviour notes, e.g. 'Keep answers under 4 sentences and encourage recruiters to email me.'"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Model (Groq)</label>
        <select
          value={config.model}
          onChange={(e) => update("model", e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {MODELS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Save chatbot config
        </button>
        {status && <span className="text-sm text-zinc-500">{status}</span>}
      </div>
    </div>
  );
}
