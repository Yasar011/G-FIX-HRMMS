"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Internship } from "@/lib/internships";
import { saveInternship } from "@/lib/internships";
import { uploadToCloudinary } from "@/lib/cloudinary-upload";
import { ImageSlot } from "./ImageSlot";

type FormState = Omit<Internship, "id" | "createdAt">;

const EMPTY_FORM: FormState = {
  company: "",
  role: "",
  period: "",
  location: "",
  description: "",
  logoUrl: "",
  published: false,
  priority: 50,
};

function fieldClass() {
  return "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";
}

export function InternshipForm({
  internshipId,
  initialInternship,
}: {
  internshipId: string;
  initialInternship?: Internship;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(
    initialInternship ? { ...initialInternship } : EMPTY_FORM
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleLogo(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      update("logoUrl", await uploadToCloudinary(file, "internships"));
    } catch {
      setError("Logo upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!form.company.trim() || !form.role.trim()) {
      setError("Company and role are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveInternship(internshipId, {
        ...form,
        createdAt: initialInternship?.createdAt ?? Date.now(),
      });
      router.push("/admin/internships");
    } catch {
      setError("Could not save the internship.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-5 pb-16">
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Company logo (optional)
        </label>
        {form.logoUrl && (
          <ImageSlot
            src={form.logoUrl}
            alt={form.company}
            className="mt-2 h-16 w-16 rounded-lg object-cover"
          />
        )}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleLogo(e.target.files)}
          disabled={uploading}
          className="mt-2 text-sm"
        />
        {uploading && <p className="mt-1 text-xs text-zinc-400">Uploading…</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Company</label>
          <input value={form.company} onChange={(e) => update("company", e.target.value)} className={fieldClass()} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Role</label>
          <input value={form.role} onChange={(e) => update("role", e.target.value)} className={fieldClass()} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Period</label>
          <input value={form.period} onChange={(e) => update("period", e.target.value)} placeholder="e.g. July 2025" className={fieldClass()} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Location</label>
          <input value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="e.g. Ahmedabad" className={fieldClass()} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Description</label>
        <textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={4} className={fieldClass()} />
      </div>

      <div className="flex items-center gap-6">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Priority (lower shows first)</label>
          <input type="number" value={form.priority} onChange={(e) => update("priority", Number(e.target.value))} className={fieldClass()} />
        </div>
        <label className="mt-6 flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" checked={form.published} onChange={(e) => update("published", e.target.checked)} />
          Published
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button onClick={handleSubmit} disabled={saving || uploading} className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
          {saving ? "Saving…" : "Save internship"}
        </button>
        <button onClick={() => router.push("/admin/internships")} className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700">
          Cancel
        </button>
      </div>
    </div>
  );
}
