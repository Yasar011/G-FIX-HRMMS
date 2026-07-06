"use client";

import { useMemo } from "react";
import { newPhotoId } from "@/lib/photography";
import { PhotoForm } from "@/components/PhotoForm";

export default function NewPhotoPage() {
  const photoId = useMemo(() => newPhotoId(), []);
  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        New photo
      </h1>
      <PhotoForm photoId={photoId} />
    </div>
  );
}
