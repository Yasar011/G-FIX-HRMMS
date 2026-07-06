"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Photo } from "@/lib/photography";
import { savePhoto } from "@/lib/photography";
import { uploadToCloudinary } from "@/lib/cloudinary-upload";
import { ImageSlot } from "./ImageSlot";

type FormState = Omit<Photo, "id" | "createdAt">;

const EMPTY_FORM: FormState = {
  title: "",
  caption: "",
  category: "",
  imageUrl: "",
  featured: false,
  published: false,
  priority: 50,
};

function fieldClass() {
  return "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";
}

export function PhotoForm({
  photoId,
  initialPhoto,
}: {
  photoId: string;
  initialPhoto?: Photo;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(
    initialPhoto ? { ...initialPhoto } : EMPTY_FORM
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleImage(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file, "photography");
      update("imageUrl", url);
    } catch {
      setError("Image upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!form.title.trim() || !form.imageUrl) {
      setError("Title and an uploaded image are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await savePhoto(photoId, {
        ...form,
        createdAt: initialPhoto?.createdAt ?? Date.now(),
      });
      router.push("/admin/photography");
    } catch {
      setError("Could not save the photo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-5 pb-16">
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Photo
        </label>
        {form.imageUrl && (
          <ImageSlot
            src={form.imageUrl}
            alt={form.title}
            className="mt-2 h-40 w-full rounded-lg object-cover"
          />
        )}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleImage(e.target.files)}
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
          className={fieldClass()}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Caption
        </label>
        <textarea
          value={form.caption}
          onChange={(e) => update("caption", e.target.value)}
          rows={2}
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
          placeholder="e.g. Street, Portrait, Product"
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
            checked={form.featured}
            onChange={(e) => update("featured", e.target.checked)}
          />
          Featured
        </label>
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
          {saving ? "Saving..." : "Save photo"}
        </button>
        <button
          onClick={() => router.push("/admin/photography")}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
