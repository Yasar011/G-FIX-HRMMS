"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getGarment } from "@/lib/garments";
import type { Garment } from "@/lib/garments";
import { GarmentForm } from "@/components/GarmentForm";

export default function EditGarmentPage() {
  const params = useParams<{ id: string }>();
  const [garment, setGarment] = useState<Garment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGarment(params.id).then((g) => {
      setGarment(g);
      setLoading(false);
    });
  }, [params.id]);

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;
  if (!garment) return <p className="text-sm text-zinc-500">Garment not found.</p>;

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Edit garment</h1>
      <GarmentForm garmentId={garment.id} initialGarment={garment} />
    </div>
  );
}
