"use client";

import { useState } from "react";
import { uploadToCloudinary } from "@/lib/cloudinary-upload";
import type { ProjectDocument } from "@/lib/projects";

export function DocumentListField({
  projectId,
  documents,
  onChange,
}: {
  projectId: string;
  documents: ProjectDocument[];
  onChange: (documents: ProjectDocument[]) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(
        Array.from(files).map(async (file) => ({
          name: file.name,
          url: await uploadToCloudinary(file, `projects/${projectId}/documents`),
        }))
      );
      onChange([...documents, ...uploaded]);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Documents
      </label>
      {documents.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {documents.map((doc, i) => (
            <li
              key={doc.url}
              className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-1.5 text-sm dark:border-zinc-700"
            >
              <a
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="truncate text-zinc-700 underline dark:text-zinc-300"
              >
                {doc.name}
              </a>
              <button
                type="button"
                onClick={() => onChange(documents.filter((_, idx) => idx !== i))}
                className="ml-3 shrink-0 text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        type="file"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        disabled={uploading}
        className="mt-2 text-sm"
      />
      {uploading && <p className="mt-1 text-xs text-zinc-400">Uploading...</p>}
    </div>
  );
}
