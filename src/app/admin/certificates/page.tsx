"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Certificate } from "@/lib/certificates";
import { deleteCertificate, saveCertificate, subscribeCertificates } from "@/lib/certificates";

export default function CertificatesAdminPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeCertificates(
      (list) => {
        setCertificates([...list].sort((a, b) => a.priority - b.priority));
        setLoading(false);
      },
      () => {
        setError("Could not load certificates from the database.");
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    await deleteCertificate(id);
  }

  async function togglePublished(certificate: Certificate) {
    const { id, ...rest } = certificate;
    await saveCertificate(id, { ...rest, published: !certificate.published });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Certificates
        </h1>
        <Link
          href="/admin/certificates/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          + New certificate
        </Link>
      </div>

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : loading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : certificates.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No certificates yet. Upload your first one.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Issuer</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Published</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {certificates.map((certificate) => (
                <tr key={certificate.id}>
                  <td className="px-4 py-2 font-medium text-zinc-900 dark:text-zinc-50">
                    {certificate.title}
                  </td>
                  <td className="px-4 py-2 text-zinc-500">{certificate.issuer || "—"}</td>
                  <td className="px-4 py-2 text-zinc-500">{certificate.date || "—"}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => togglePublished(certificate)}
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        certificate.published
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                      }`}
                    >
                      {certificate.published ? "Published" : "Draft"}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/admin/certificates/${certificate.id}/edit`}
                      className="mr-3 text-zinc-600 underline dark:text-zinc-300"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(certificate.id, certificate.title)}
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
