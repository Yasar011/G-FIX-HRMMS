"use client";

import { useEffect, useState } from "react";
import type { Certificate } from "@/lib/certificates";
import { subscribeCertificates } from "@/lib/certificates";
import { PublicShell, PageHeader } from "@/components/PublicShell";

export default function CertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return subscribeCertificates(
      (list) => {
        setCertificates(list.filter((c) => c.published).sort((a, b) => a.priority - b.priority));
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, []);

  return (
    <PublicShell active="/certificates">
      <PageHeader
        kicker="🏆 Quality Control"
        title="Certifications"
        subtitle="Internship certificates, recommendation letters, awards, and workshops."
      />

      <div className="mx-auto max-w-5xl px-6 py-12">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : certificates.length === 0 ? (
          <p className="text-sm text-zinc-500">No certificates published yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {certificates.map((cert) => (
              <a
                key={cert.id}
                href={cert.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="group flex flex-col rounded-2xl border border-zinc-200 p-5 transition hover:border-amber-400 hover:shadow-md dark:border-zinc-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold">{cert.title}</h2>
                    <p className="mt-0.5 text-sm text-zinc-500">{cert.issuer}</p>
                  </div>
                  {cert.category && (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                      {cert.category}
                    </span>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-zinc-400">{cert.date}</span>
                  <span className="font-medium text-amber-600 group-hover:underline dark:text-amber-400">
                    View →
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </PublicShell>
  );
}
