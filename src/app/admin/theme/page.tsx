"use client";

import { useEffect, useState } from "react";
import { DEFAULT_THEME, THEME_PATH, getNode, saveNode, type ThemeSettings } from "@/lib/settings";

const PRESETS = ["#f59e0b", "#ef4444", "#ec4899", "#a855f7", "#3b82f6", "#22c55e", "#14b8a6"];

export default function ThemePage() {
  const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    getNode<ThemeSettings>(THEME_PATH, DEFAULT_THEME).then((t) => {
      setTheme(t);
      setLoading(false);
    });
  }, []);

  async function save() {
    setStatus("Saving…");
    await saveNode<ThemeSettings>(THEME_PATH, theme);
    document.documentElement.style.setProperty("--accent", theme.accent);
    setStatus("Saved ✓");
    setTimeout(() => setStatus(null), 2000);
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Theme Builder</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Set the primary accent color used across buttons, links, and highlights.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Accent color</label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {PRESETS.map((c) => (
            <button
              key={c}
              onClick={() => setTheme({ accent: c })}
              className={`h-9 w-9 rounded-full ring-2 ring-offset-2 transition dark:ring-offset-zinc-950 ${
                theme.accent === c ? "ring-zinc-900 dark:ring-white" : "ring-transparent"
              }`}
              style={{ background: c }}
              aria-label={c}
            />
          ))}
          <input
            type="color"
            value={theme.accent}
            onChange={(e) => setTheme({ accent: e.target.value })}
            className="h-9 w-12 cursor-pointer rounded border border-zinc-300 dark:border-zinc-700"
          />
          <span className="font-mono text-sm text-zinc-500">{theme.accent}</span>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <p className="mb-3 text-xs uppercase tracking-wide text-zinc-400">Preview</p>
        <div className="flex flex-wrap items-center gap-3">
          <button className="rounded-full px-4 py-2 text-sm font-medium text-white" style={{ background: theme.accent }}>
            Primary button
          </button>
          <a className="text-sm font-medium" style={{ color: theme.accent }}>
            A themed link →
          </a>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
          Save theme
        </button>
        {status && <span className="text-sm text-zinc-500">{status}</span>}
      </div>
    </div>
  );
}
