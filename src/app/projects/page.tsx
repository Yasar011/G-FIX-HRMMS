"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Project } from "@/lib/projects";
import { subscribeProjects } from "@/lib/projects";

export default function PublicProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeProjects(
      (list) => {
        setProjects(
          list.filter((p) => p.published).sort((a, b) => a.priority - b.priority)
        );
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
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-16">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Projects
      </h1>

      {error ? (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      ) : loading ? (
        <p className="mt-4 text-sm text-zinc-500">Loading...</p>
      ) : projects.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">
          No projects published yet.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.slug}`}
              className="rounded-xl border border-zinc-200 p-5 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
            >
              {project.images[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={project.images[0]}
                  alt=""
                  className="mb-3 h-32 w-full rounded-md object-cover"
                />
              )}
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {project.name}
                </h2>
                {project.featured && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                    Featured
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                {project.shortDescription}
              </p>
              {project.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
