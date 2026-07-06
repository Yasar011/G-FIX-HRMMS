"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Garment } from "@/lib/garments";
import { deleteGarment, saveGarment, subscribeGarments } from "@/lib/garments";
import { ImageSlot } from "@/components/ImageSlot";

export default function FashionAdminPage() {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return subscribeGarments(
      (list) => {
        setGarments([...list].sort((a, b) => a.priority - b.priority));
        setLoading(false);
      },
      () => {
        setError("Could not load garments from the database.");
        setLoading(false);
      }
    );
  }, []);

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    await deleteGarment(id);
  }

  async function togglePublished(garment: Garment) {
    const { id, ...rest } = garment;
    await saveGarment(id, { ...rest, published: !garment.published });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Fashion Portfolio</h1>
        <Link href="/admin/fashion/new" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
          + New garment
        </Link>
      </div>

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : garments.length === 0 ? (
        <p className="text-sm text-zinc-500">No garments yet. Upload your first one.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {garments.map((garment) => (
            <div key={garment.id} className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <ImageSlot src={garment.imageUrl} alt={garment.title} className="h-40 w-full object-cover" />
              <div className="flex flex-col gap-2 p-3">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{garment.title}</p>
                <button
                  onClick={() => togglePublished(garment)}
                  className={`w-fit rounded-full px-2 py-0.5 text-xs ${
                    garment.published
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                  }`}
                >
                  {garment.published ? "Published" : "Draft"}
                </button>
                <div className="flex justify-between text-sm">
                  <Link href={`/admin/fashion/${garment.id}/edit`} className="text-zinc-600 underline dark:text-zinc-300">
                    Edit
                  </Link>
                  <button onClick={() => handleDelete(garment.id, garment.title)} className="text-red-600 underline">
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
