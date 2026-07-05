"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getProject } from "@/lib/projects";
import type { Project } from "@/lib/projects";
import { ProjectForm } from "@/components/ProjectForm";

export default function EditProjectPage() {
  const params = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProject(params.id).then((p) => {
      setProject(p);
      setLoading(false);
    });
  }, [params.id]);

  if (loading) return <p className="text-sm text-zinc-500">Loading...</p>;
  if (!project) return <p className="text-sm text-zinc-500">Project not found.</p>;

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Edit project
      </h1>
      <ProjectForm projectId={project.id} initialProject={project} />
    </div>
  );
}
