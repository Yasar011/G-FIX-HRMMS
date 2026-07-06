"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Certificate } from "@/lib/certificates";
import { saveCertificate } from "@/lib/certificates";
import { uploadToCloudinary } from "@/lib/cloudinary-upload";

type FormState = Omit<Certificate, "id" | "createdAt">;

const EMPTY_FORM: FormState = {
  title: "",
  issuer: "",
  date: "",
  category: "",
  fileUrl: "",
  published: false,
  priority: 50,
};

function fieldClass() {
  return "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";
}

export function CertificateForm({
  certificateId,
  initialCertificate,
}: {
  certificateId: string;
  initialCertificate?: Certificate;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(
    initialCertificate ? { ...initialCertificate } : EMPTY_FORM
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file, "certificates");
      update("fileUrl", url);
    } catch {
      setError("File upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!form.title.trim() || !form.fileUrl) {
      setError("Title and an uploaded file are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveCertificate(certificateId, {
        ...form,
        createdAt: initialCertificate?.createdAt ?? Date.now(),
      });
      router.push("/admin/certificates");
    } catch {
      setError("Could not save the certificate.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-5 pb-16">
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Certificate file (image or PDF)
        </label>
        {form.fileUrl && (
          <a
            href={form.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block truncate text-sm text-zinc-600 underline dark:text-zinc-300"
          >
            View uploaded file
          </a>
        )}
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => handleFile(e.target.files)}
          disabled={uploading}
          className="mt-2 text-sm"
        />
        {uploading && <p className="mt-1 text-xs text-zinc-400">Uploading...</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Title
        </label>
        <input
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="e.g. Internship Completion Certificate"
          className={fieldClass()}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Issuer
        </label>
        <input
          value={form.issuer}
          onChange={(e) => update("issuer", e.target.value)}
          placeholder="e.g. Brandix"
          className={fieldClass()}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Date
        </label>
        <input
          value={form.date}
          onChange={(e) => update("date", e.target.value)}
          placeholder="e.g. March 2025"
          className={fieldClass()}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Category
        </label>
        <input
          value={form.category}
          onChange={(e) => update("category", e.target.value)}
          placeholder="e.g. Internship, Award, Workshop, Recommendation Letter"
          className={fieldClass()}
        />
      </div>

      <div className="flex items-center gap-6">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Priority (lower shows first)
          </label>
          <input
            type="number"
            value={form.priority}
            onChange={(e) => update("priority", Number(e.target.value))}
            className={fieldClass()}
          />
        </div>
        <label className="mt-6 flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => update("published", e.target.checked)}
          />
          Published
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={saving || uploading}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {saving ? "Saving..." : "Save certificate"}
        </button>
        <button
          onClick={() => router.push("/admin/certificates")}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
