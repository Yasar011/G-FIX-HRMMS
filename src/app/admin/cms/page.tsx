"use client";

import { useEffect, useState } from "react";
import type { SiteContent } from "@/lib/site-content";
import { getSiteContent } from "@/lib/site-content";
import { SiteContentForm } from "@/components/SiteContentForm";

export default function CmsPage() {
  const [content, setContent] = useState<SiteContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSiteContent()
      .then(setContent)
      .catch(() => setError("Could not load site content from the database."));
  }, []);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        CMS — Homepage content
      </h1>
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : content ? (
        <SiteContentForm initialContent={content} />
      ) : (
        <p className="text-sm text-zinc-500">Loading...</p>
      )}
    </div>
  );
}
