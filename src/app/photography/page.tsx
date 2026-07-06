"use client";

import { useEffect, useMemo, useState } from "react";
import type { Photo } from "@/lib/photography";
import { subscribePhotos } from "@/lib/photography";
import { PublicShell, PageHeader } from "@/components/PublicShell";
import { ImageSlot } from "@/components/ImageSlot";

export default function PhotographyPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Photo | null>(null);
  const [category, setCategory] = useState<string>("All");

  useEffect(() => {
    return subscribePhotos(
      (list) => {
        setPhotos(list.filter((p) => p.published).sort((a, b) => a.priority - b.priority));
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, []);

  const categories = useMemo(() => {
    const set = new Set(photos.map((p) => p.category).filter(Boolean));
    return ["All", ...Array.from(set)];
  }, [photos]);

  const visible = category === "All" ? photos : photos.filter((p) => p.category === category);

  return (
    <PublicShell active="/photography">
      <PageHeader
        kicker="📷 Creative Studio"
        title="Photography"
        subtitle="Event cinematography, portraits, and product work."
      />

      <div className="mx-auto max-w-5xl px-6 py-12">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : photos.length === 0 ? (
          <p className="text-sm text-zinc-500">No photos published yet.</p>
        ) : (
          <>
            {categories.length > 1 && (
              <div className="mb-6 flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                      category === cat
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                        : "border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            <div className="columns-2 gap-4 sm:columns-3 [&>*]:mb-4">
              {visible.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => setActive(photo)}
                  className="group block w-full overflow-hidden rounded-xl"
                >
                  <ImageSlot
                    src={photo.imageUrl}
                    alt={photo.title}
                    className="w-full rounded-xl object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {active && (
        <div
          onClick={() => setActive(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur"
        >
          <div className="max-h-[90vh] max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <ImageSlot
              src={active.imageUrl}
              alt={active.title}
              className="max-h-[80vh] w-auto rounded-xl object-contain"
            />
            {(active.title || active.caption) && (
              <div className="mt-3 text-center text-white">
                <p className="font-medium">{active.title}</p>
                {active.caption && <p className="text-sm text-white/60">{active.caption}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </PublicShell>
  );
}
