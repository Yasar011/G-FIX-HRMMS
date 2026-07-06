"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getInternship } from "@/lib/internships";
import type { Internship } from "@/lib/internships";
import { InternshipForm } from "@/components/InternshipForm";

export default function EditInternshipPage() {
  const params = useParams<{ id: string }>();
  const [internship, setInternship] = useState<Internship | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getInternship(params.id).then((i) => {
      setInternship(i);
      setLoading(false);
    });
  }, [params.id]);

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;
  if (!internship) return <p className="text-sm text-zinc-500">Internship not found.</p>;

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Edit internship</h1>
      <InternshipForm internshipId={internship.id} initialInternship={internship} />
    </div>
  );
}
