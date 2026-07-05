"use client";

import { useState } from "react";
import type { SiteContent, TimelineEntry } from "@/lib/site-content";
import { saveSiteContent } from "@/lib/site-content";
import { uploadSiteFile } from "@/lib/storage";
import { StringListInput } from "./StringListInput";

type FormState = Omit<SiteContent, "updatedAt">;

const EMPTY_TIMELINE_ENTRY: TimelineEntry = {
  company: "",
  role: "",
  period: "",
  image: "",
  description: "",
};

function fieldClass() {
  return "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";
}

export function SiteContentForm({ initialContent }: { initialContent: FormState }) {
  const [form, setForm] = useState<FormState>(initialContent);
  const [saving, setSaving] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [uploadingTimelineIndex, setUploadingTimelineIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function updateTimelineEntry(index: number, patch: Partial<TimelineEntry>) {
    update(
      "timeline",
      form.timeline.map((entry, i) => (i === index ? { ...entry, ...patch } : entry))
    );
  }

  async function handleHeroPhoto(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploadingHero(true);
    try {
      update("heroPhoto", await uploadSiteFile("hero", file));
    } finally {
      setUploadingHero(false);
    }
  }

  async function handleResume(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploadingResume(true);
    try {
      update("resumeUrl", await uploadSiteFile("resume", file));
    } finally {
      setUploadingResume(false);
    }
  }

  async function handleTimelineImage(index: number, files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploadingTimelineIndex(index);
    try {
      const url = await uploadSiteFile("timeline", file);
      updateTimelineEntry(index, { image: url });
    } finally {
      setUploadingTimelineIndex(null);
    }
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      await saveSiteContent(form);
      setSaved(true);
    } catch {
      setError("Could not save site content.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-8 pb-16">
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Hero
        </h2>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Name
          </label>
          <input
            value={form.heroName}
            onChange={(e) => update("heroName", e.target.value)}
            className={fieldClass()}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Headline
          </label>
          <textarea
            value={form.heroHeadline}
            onChange={(e) => update("heroHeadline", e.target.value)}
            rows={2}
            className={fieldClass()}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Profile photo
          </label>
          {form.heroPhoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.heroPhoto}
              alt=""
              className="mt-2 h-20 w-20 rounded-full object-cover"
            />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleHeroPhoto(e.target.files)}
            disabled={uploadingHero}
            className="mt-2 text-sm"
          />
          {uploadingHero && <p className="mt-1 text-xs text-zinc-400">Uploading...</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Resume
          </label>
          {form.resumeUrl && (
            <a
              href={form.resumeUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block text-sm text-zinc-600 underline dark:text-zinc-400"
            >
              Current resume
            </a>
          )}
          <input
            type="file"
            onChange={(e) => handleResume(e.target.files)}
            disabled={uploadingResume}
            className="mt-2 text-sm"
          />
          {uploadingResume && <p className="mt-1 text-xs text-zinc-400">Uploading...</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          About
        </h2>
        <textarea
          value={form.aboutText}
          onChange={(e) => update("aboutText", e.target.value)}
          rows={5}
          className={fieldClass()}
        />
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Skills
        </h2>
        <StringListInput
          label="Skills"
          values={form.skills}
          onChange={(values) => update("skills", values)}
          placeholder="e.g. React"
        />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Timeline
          </h2>
          <button
            type="button"
            onClick={() => update("timeline", [...form.timeline, { ...EMPTY_TIMELINE_ENTRY }])}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
          >
            Add entry
          </button>
        </div>
        {form.timeline.map((entry, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Company
                </label>
                <input
                  value={entry.company}
                  onChange={(e) => updateTimelineEntry(i, { company: e.target.value })}
                  className={fieldClass()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Role
                </label>
                <input
                  value={entry.role}
                  onChange={(e) => updateTimelineEntry(i, { role: e.target.value })}
                  className={fieldClass()}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Period
                </label>
                <input
                  value={entry.period}
                  onChange={(e) => updateTimelineEntry(i, { period: e.target.value })}
                  className={fieldClass()}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Description
                </label>
                <textarea
                  value={entry.description}
                  onChange={(e) => updateTimelineEntry(i, { description: e.target.value })}
                  rows={2}
                  className={fieldClass()}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Image
              </label>
              {entry.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={entry.image}
                  alt=""
                  className="mt-2 h-16 w-16 rounded-md object-cover"
                />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleTimelineImage(i, e.target.files)}
                disabled={uploadingTimelineIndex === i}
                className="mt-2 text-sm"
              />
              {uploadingTimelineIndex === i && (
                <p className="mt-1 text-xs text-zinc-400">Uploading...</p>
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                update(
                  "timeline",
                  form.timeline.filter((_, idx) => idx !== i)
                )
              }
              className="self-start text-sm text-red-600 hover:text-red-700"
            >
              Remove entry
            </button>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Contact
        </h2>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Email
          </label>
          <input
            value={form.contactEmail}
            onChange={(e) => update("contactEmail", e.target.value)}
            className={fieldClass()}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            GitHub URL
          </label>
          <input
            value={form.githubUrl}
            onChange={(e) => update("githubUrl", e.target.value)}
            className={fieldClass()}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            LinkedIn URL
          </label>
          <input
            value={form.linkedinUrl}
            onChange={(e) => update("linkedinUrl", e.target.value)}
            className={fieldClass()}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Instagram URL
          </label>
          <input
            value={form.instagramUrl}
            onChange={(e) => update("instagramUrl", e.target.value)}
            className={fieldClass()}
          />
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-emerald-600">Saved.</p>}

      <div>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  );
}
