"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Photo } from "@/lib/photography";
import { deletePhoto, savePhoto, subscribePhotos } from "@/lib/photography";
import { ImageSlot } from "@/components/ImageSlot";

export default function PhotographyAdminPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribePhotos(
      (list) => {
        setPhotos([...list].sort((a, b) => a.priority - b.priority));
        setLoading(false);
      },
      () => {
        setError("Could not load photos from the database.");
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    await deletePhoto(id);
  }

  async function togglePublished(photo: Photo) {
    const { id, ...rest } = photo;
    await savePhoto(id, { ...rest, published: !photo.published });
  }

  async function toggleFeatured(photo: Photo) {
    const { id, ...rest } = photo;
    await savePhoto(id, { ...rest, featured: !photo.featured });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Photography
        </h1>
        <Link
          href="/admin/photography/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          + New photo
        </Link>
      </div>

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : loading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : photos.length === 0 ? (
        <p className="text-sm text-zinc-500">No photos yet. Upload your first one.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800"
            >
              <ImageSlot
                src={photo.imageUrl}
                alt={photo.title}
                className="h-32 w-full object-cover"
              />
              <div className="flex flex-col gap-2 p-3">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {photo.title}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => togglePublished(photo)}
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      photo.published
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                    }`}
                  >
                    {photo.published ? "Published" : "Draft"}
                  </button>
                  <button
                    onClick={() => toggleFeatured(photo)}
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      photo.featured
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                    }`}
                  >
                    {photo.featured ? "Featured" : "Not featured"}
                  </button>
                </div>
                <div className="flex justify-between text-sm">
                  <Link
                    href={`/admin/photography/${photo.id}/edit`}
                    className="text-zinc-600 underline dark:text-zinc-300"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(photo.id, photo.title)}
                    className="text-red-600 underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
