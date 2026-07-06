"use client";

import { useEffect, useState } from "react";
import { DEFAULT_SEO, SEO_PATH, getNode, saveNode, type SeoSettings } from "@/lib/settings";

function fieldClass() {
  return "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";
}

export default function SeoPage() {
  const [seo, setSeo] = useState<SeoSettings>(DEFAULT_SEO);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    getNode<SeoSettings>(SEO_PATH, DEFAULT_SEO).then((s) => {
      setSeo(s);
      setLoading(false);
    });
  }, []);

  function update<K extends keyof SeoSettings>(key: K, value: SeoSettings[K]) {
    setSeo((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setStatus("Saving…");
    await saveNode<SeoSettings>(SEO_PATH, seo);
    setStatus("Saved ✓ — refresh the site to see updated tags.");
    setTimeout(() => setStatus(null), 3000);
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">SEO Manager</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Controls the meta title, description, and social share preview applied across the site.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Meta title</label>
        <input value={seo.title} onChange={(e) => update("title", e.target.value)} className={fieldClass()} />
        <p className="mt-1 text-xs text-zinc-400">{seo.title.length} chars (aim for 50–60)</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Meta description</label>
        <textarea value={seo.description} onChange={(e) => update("description", e.target.value)} rows={3} className={fieldClass()} />
        <p className="mt-1 text-xs text-zinc-400">{seo.description.length} chars (aim for 150–160)</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Keywords (comma-separated)</label>
        <input value={seo.keywords} onChange={(e) => update("keywords", e.target.value)} className={fieldClass()} />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Open Graph image URL</label>
        <input value={seo.ogImage} onChange={(e) => update("ogImage", e.target.value)} placeholder="https://… (social share preview)" className={fieldClass()} />
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
          Save SEO settings
        </button>
        {status && <span className="text-sm text-zinc-500">{status}</span>}
      </div>
    </div>
  );
}
