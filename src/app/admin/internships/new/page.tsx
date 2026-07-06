"use client";

import { useMemo } from "react";
import { newInternshipId } from "@/lib/internships";
import { InternshipForm } from "@/components/InternshipForm";

export default function NewInternshipPage() {
  const internshipId = useMemo(() => newInternshipId(), []);
  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">New internship</h1>
      <InternshipForm internshipId={internshipId} />
    </div>
  );
}
