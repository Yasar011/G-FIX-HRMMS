"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Project } from "@/lib/projects";
import {
  deleteProject,
  subscribeProjects,
  updateProjectFields,
} from "@/lib/projects";

export default function ProjectsAdminPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeProjects((list) => {
      setProjects([...list].sort((a, b) => a.priority - b.priority));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await deleteProject(id);
  }

  async function togglePublished(project: Project) {
    await updateProjectFields(project, { published: !project.published });
  }

  async function toggleFeatured(project: Project) {
    await updateProjectFields(project, { featured: !project.featured });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Projects
        </h1>
        <Link
          href="/admin/projects/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          + New project
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : projects.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No projects yet. Create your first one.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Published</th>
                <th className="px-4 py-2">Featured</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {projects.map((project) => (
                <tr key={project.id}>
                  <td className="px-4 py-2 font-medium text-zinc-900 dark:text-zinc-50">
                    {project.name}
                  </td>
                  <td className="px-4 py-2 text-zinc-500">
                    {project.category || "—"}
                  </td>
                  <td className="px-4 py-2 text-zinc-500">{project.status}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => togglePublished(project)}
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        project.published
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                      }`}
                    >
                      {project.published ? "Published" : "Draft"}
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => toggleFeatured(project)}
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        project.featured
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                      }`}
                    >
                      {project.featured ? "Featured" : "Not featured"}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/admin/projects/${project.id}/edit`}
                      className="mr-3 text-zinc-600 underline dark:text-zinc-300"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(project.id, project.name)}
                      className="text-red-600 underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
