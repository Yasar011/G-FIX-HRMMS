"use client";

import { useMemo } from "react";
import { newCertificateId } from "@/lib/certificates";
import { CertificateForm } from "@/components/CertificateForm";

export default function NewCertificatePage() {
  const certificateId = useMemo(() => newCertificateId(), []);
  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        New certificate
      </h1>
      <CertificateForm certificateId={certificateId} />
    </div>
  );
}
