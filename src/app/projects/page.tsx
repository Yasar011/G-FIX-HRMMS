"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Project } from "@/lib/projects";
import { subscribeProjects } from "@/lib/projects";
import { PublicShell, PageHeader } from "@/components/PublicShell";
import { ImageSlot } from "@/components/ImageSlot";

export default function PublicProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeProjects(
      (list) => {
        setProjects(list.filter((p) => p.published).sort((a, b) => a.priority - b.priority));
        setLoading(false);
      },
      () => {
        setError("Could not load projects from the database.");
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  return (
    <PublicShell active="/projects">
      <PageHeader
        kicker="🧵 Production Line"
        title="Projects"
        subtitle="IoT & automation engineering, manufacturing software, and web builds."
      />

      <div className="mx-auto max-w-5xl px-6 py-12">
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-zinc-500">No projects published yet.</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.slug}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 transition hover:border-amber-400 hover:shadow-lg dark:border-zinc-800"
              >
                {project.images[0] ? (
                  <ImageSlot
                    src={project.images[0]}
                    alt={project.name}
                    className="h-44 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-44 w-full items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200 font-heading text-4xl text-zinc-300 dark:from-zinc-900 dark:to-zinc-800">
                    {project.name.charAt(0)}
                  </div>
                )}
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center gap-2">
                    <h2 className="font-heading font-semibold">{project.name}</h2>
                    {project.featured && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                        Featured
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 flex-1 text-sm leading-relaxed text-zinc-500">
                    {project.shortDescription}
                  </p>
                  {project.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {project.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PublicShell>
  );
}
