"use client";

import { useEffect, useState } from "react";
import type { Garment } from "@/lib/garments";
import { subscribeGarments } from "@/lib/garments";
import { PublicShell, PageHeader } from "@/components/PublicShell";
import { ImageSlot } from "@/components/ImageSlot";

export default function GarmentsPage() {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return subscribeGarments(
      (list) => {
        setGarments(list.filter((g) => g.published).sort((a, b) => a.priority - b.priority));
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, []);

  return (
    <PublicShell active="/garments">
      <PageHeader
        kicker="👕 Fashion Studio"
        title="Garments"
        subtitle="Garment construction, pattern making, samples, and tech packs."
      />

      <div className="mx-auto max-w-5xl px-6 py-12">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : garments.length === 0 ? (
          <p className="text-sm text-zinc-500">No garments published yet.</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {garments.map((garment) => (
              <div
                key={garment.id}
                className="group overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800"
              >
                <div className="overflow-hidden">
                  <ImageSlot
                    src={garment.imageUrl}
                    alt={garment.title}
                    className="h-64 w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <h2 className="font-heading font-semibold">{garment.title}</h2>
                    {garment.featured && (
                      <span className="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-700 dark:bg-pink-900/50 dark:text-pink-300">
                        Featured
                      </span>
                    )}
                  </div>
                  {garment.category && <p className="mt-0.5 text-xs text-zinc-400">{garment.category}</p>}
                  {garment.description && (
                    <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{garment.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PublicShell>
  );
}
