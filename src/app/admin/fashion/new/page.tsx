"use client";

import { useMemo } from "react";
import { newGarmentId } from "@/lib/garments";
import { GarmentForm } from "@/components/GarmentForm";

export default function NewGarmentPage() {
  const garmentId = useMemo(() => newGarmentId(), []);
  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">New garment</h1>
      <GarmentForm garmentId={garmentId} />
    </div>
  );
}
