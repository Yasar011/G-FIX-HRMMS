"use client";

import { useEffect, useState } from "react";
import type { SiteContent } from "@/lib/site-content";
import { DEFAULT_SITE_CONTENT, subscribeSiteContent } from "@/lib/site-content";
import { PublicShell, PageHeader } from "@/components/PublicShell";
import { ImageSlot } from "@/components/ImageSlot";

export default function AboutPage() {
  const [content, setContent] = useState<SiteContent>(DEFAULT_SITE_CONTENT);

  useEffect(() => subscribeSiteContent(setContent, () => {}), []);

  return (
    <PublicShell active="/about">
      <PageHeader kicker="🧑‍💼 HR Office" title="About Me" subtitle={content.heroHeadline} />

      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-[240px_1fr]">
          <div className="flex flex-col items-center gap-4 md:items-start">
            <ImageSlot
              src={content.heroPhoto}
              alt={content.heroName}
              className="h-44 w-44 rounded-2xl object-cover ring-1 ring-zinc-200 dark:ring-zinc-800"
            />
            <a
              href={content.resumeUrl}
              className="w-full rounded-full bg-amber-500 px-5 py-2.5 text-center text-sm font-medium text-white transition hover:bg-amber-400"
            >
              Download resume
            </a>
            <a
              href={`mailto:${content.contactEmail}`}
              className="w-full rounded-full border border-zinc-300 px-5 py-2.5 text-center text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Contact
            </a>
          </div>

          <div>
            <h2 className="font-heading text-xl font-semibold">{content.heroName}</h2>
            <p className="mt-3 leading-relaxed text-zinc-600 dark:text-zinc-300">
              {content.aboutText}
            </p>

            <h3 className="mt-8 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400">
              Skills
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {content.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                >
                  {skill}
                </span>
              ))}
            </div>

            <h3 className="mt-8 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400">
              Experience
            </h3>
            <div className="relative mt-4 flex flex-col gap-6 pl-5">
              <span className="absolute bottom-2 left-[6px] top-2 w-px bg-zinc-200 dark:bg-zinc-800" />
              {content.timeline.map((entry, i) => (
                <div key={`${entry.company}-${i}`} className="relative">
                  <span className="absolute -left-5 top-1.5 h-3 w-3 rounded-full bg-amber-500 ring-4 ring-white dark:ring-zinc-950" />
                  <p className="font-semibold">
                    {entry.role} · {entry.company}
                  </p>
                  <p className="text-xs text-zinc-400">{entry.period}</p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {entry.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
