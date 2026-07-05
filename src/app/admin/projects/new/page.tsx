"use client";

import { useMemo } from "react";
import { newProjectId } from "@/lib/projects";
import { ProjectForm } from "@/components/ProjectForm";

export default function NewProjectPage() {
  const projectId = useMemo(() => newProjectId(), []);
  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        New project
      </h1>
      <ProjectForm projectId={projectId} />
    </div>
  );
}
