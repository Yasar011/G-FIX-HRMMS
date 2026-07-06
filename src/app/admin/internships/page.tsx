"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Internship } from "@/lib/internships";
import { deleteInternship, saveInternship, subscribeInternships } from "@/lib/internships";

export default function InternshipsAdminPage() {
  const [internships, setInternships] = useState<Internship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return subscribeInternships(
      (list) => {
        setInternships([...list].sort((a, b) => a.priority - b.priority));
        setLoading(false);
      },
      () => {
        setError("Could not load internships from the database.");
        setLoading(false);
      }
    );
  }, []);

  async function handleDelete(id: string, company: string) {
    if (!confirm(`Delete the ${company} internship? This cannot be undone.`)) return;
    await deleteInternship(id);
  }

  async function togglePublished(internship: Internship) {
    const { id, ...rest } = internship;
    await saveInternship(id, { ...rest, published: !internship.published });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Internships</h1>
        <Link href="/admin/internships/new" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
          + New internship
        </Link>
      </div>

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : internships.length === 0 ? (
        <p className="text-sm text-zinc-500">No internships yet. Add your first one.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">Company</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Period</th>
                <th className="px-4 py-2">Published</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {internships.map((internship) => (
                <tr key={internship.id}>
                  <td className="px-4 py-2 font-medium text-zinc-900 dark:text-zinc-50">{internship.company}</td>
                  <td className="px-4 py-2 text-zinc-500">{internship.role}</td>
                  <td className="px-4 py-2 text-zinc-500">{internship.period || "—"}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => togglePublished(internship)}
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        internship.published
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                      }`}
                    >
                      {internship.published ? "Published" : "Draft"}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link href={`/admin/internships/${internship.id}/edit`} className="mr-3 text-zinc-600 underline dark:text-zinc-300">
                      Edit
                    </Link>
                    <button onClick={() => handleDelete(internship.id, internship.company)} className="text-red-600 underline">
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
