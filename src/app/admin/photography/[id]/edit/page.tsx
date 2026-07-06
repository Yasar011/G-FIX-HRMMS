"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getPhoto } from "@/lib/photography";
import type { Photo } from "@/lib/photography";
import { PhotoForm } from "@/components/PhotoForm";

export default function EditPhotoPage() {
  const params = useParams<{ id: string }>();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPhoto(params.id).then((p) => {
      setPhoto(p);
      setLoading(false);
    });
  }, [params.id]);

  if (loading) return <p className="text-sm text-zinc-500">Loading...</p>;
  if (!photo) return <p className="text-sm text-zinc-500">Photo not found.</p>;

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Edit photo
      </h1>
      <PhotoForm photoId={photo.id} initialPhoto={photo} />
    </div>
  );
}
