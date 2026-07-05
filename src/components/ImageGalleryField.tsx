"use client";

import { useState } from "react";
import { uploadProjectFile } from "@/lib/storage";

export function ImageGalleryField({
  projectId,
  images,
  onChange,
}: {
  projectId: string;
  images: string[];
  onChange: (images: string[]) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(
        Array.from(files).map((file) => uploadProjectFile(projectId, "images", file))
      );
      onChange([...images, ...uploaded]);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Images (also used for flowcharts / architecture diagrams)
      </label>
      {images.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-3">
          {images.map((url, i) => (
            <div
              key={url}
              className="relative h-20 w-20 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(images.filter((_, idx) => idx !== i))}
                className="absolute right-0 top-0 rounded-bl bg-black/60 px-1 text-xs text-white"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        disabled={uploading}
        className="mt-2 text-sm"
      />
      {uploading && <p className="mt-1 text-xs text-zinc-400">Uploading...</p>}
    </div>
  );
}
