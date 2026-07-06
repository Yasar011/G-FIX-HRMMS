"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_GENERAL_SETTINGS,
  GENERAL_SETTINGS_PATH,
  getNode,
  saveNode,
  type GeneralSettings,
} from "@/lib/settings";

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <span>
        <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">{label}</span>
        <span className="mt-0.5 block text-xs text-zinc-500">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 shrink-0"
      />
    </label>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<GeneralSettings>(DEFAULT_GENERAL_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    getNode<GeneralSettings>(GENERAL_SETTINGS_PATH, DEFAULT_GENERAL_SETTINGS).then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  function update<K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setStatus("Saving…");
    await saveNode<GeneralSettings>(GENERAL_SETTINGS_PATH, settings);
    setStatus("Saved ✓");
    setTimeout(() => setStatus(null), 2000);
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Toggle site-wide features. Hero name, bio, contact, and social links live in the CMS module.
        </p>
      </div>

      <Toggle
        label="Factory ambience audio"
        description="Show the sound toggle on the 3D factory intro."
        checked={settings.ambienceEnabled}
        onChange={(v) => update("ambienceEnabled", v)}
      />
      <Toggle
        label="Y-BOT chatbot"
        description="Enable the AI assistant in the Innovation Lab."
        checked={settings.chatbotEnabled}
        onChange={(v) => update("chatbotEnabled", v)}
      />
      <Toggle
        label="Scroll hint"
        description="Show the 'Scroll to enter' cue on first load."
        checked={settings.showScrollHint}
        onChange={(v) => update("showScrollHint", v)}
      />

      <div className="flex items-center gap-3">
        <button onClick={save} className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
          Save settings
        </button>
        {status && <span className="text-sm text-zinc-500">{status}</span>}
      </div>
    </div>
  );
}
