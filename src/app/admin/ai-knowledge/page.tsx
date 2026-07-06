"use client";

import { useEffect, useState } from "react";
import { StringListInput } from "@/components/StringListInput";
import {
  DEFAULT_YBOT_KNOWLEDGE,
  YBOT_KNOWLEDGE_PATH,
  getNode,
  saveNode,
  type YbotKnowledge,
} from "@/lib/settings";

export default function AiKnowledgePage() {
  const [facts, setFacts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    getNode<YbotKnowledge>(YBOT_KNOWLEDGE_PATH, DEFAULT_YBOT_KNOWLEDGE).then((k) => {
      setFacts(k.facts ?? []);
      setLoading(false);
    });
  }, []);

  async function save() {
    setStatus("Saving…");
    await saveNode<YbotKnowledge>(YBOT_KNOWLEDGE_PATH, { facts });
    setStatus("Saved ✓");
    setTimeout(() => setStatus(null), 2000);
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">AI Knowledge Center</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Extra facts Y-BOT should know about you. Each fact is fed into the chatbot&apos;s context
          alongside your projects, skills, and experience — use it for details not captured elsewhere
          (hobbies, availability, achievements, fun facts).
        </p>
      </div>

      <StringListInput
        label="Knowledge facts"
        values={facts}
        onChange={setFacts}
        placeholder="e.g. Available for full-time roles from June 2026"
      />

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Save knowledge
        </button>
        {status && <span className="text-sm text-zinc-500">{status}</span>}
      </div>
    </div>
  );
}
