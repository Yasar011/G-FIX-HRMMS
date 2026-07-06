"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getCertificate } from "@/lib/certificates";
import type { Certificate } from "@/lib/certificates";
import { CertificateForm } from "@/components/CertificateForm";

export default function EditCertificatePage() {
  const params = useParams<{ id: string }>();
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCertificate(params.id).then((c) => {
      setCertificate(c);
      setLoading(false);
    });
  }, [params.id]);

  if (loading) return <p className="text-sm text-zinc-500">Loading...</p>;
  if (!certificate) return <p className="text-sm text-zinc-500">Certificate not found.</p>;

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Edit certificate
      </h1>
      <CertificateForm certificateId={certificate.id} initialCertificate={certificate} />
    </div>
  );
}
