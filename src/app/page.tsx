"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Project } from "@/lib/projects";
import { subscribeProjects } from "@/lib/projects";
import type { SiteContent } from "@/lib/site-content";
import { DEFAULT_SITE_CONTENT, subscribeSiteContent } from "@/lib/site-content";
import type { Photo } from "@/lib/photography";
import { subscribePhotos } from "@/lib/photography";
import type { Certificate } from "@/lib/certificates";
import { subscribeCertificates } from "@/lib/certificates";
import { FactoryJourney } from "@/components/factory-3d/FactoryJourney";
import { ThemeToggle } from "@/components/ThemeToggle";

function TopBar({ name }: { name: string }) {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-4 sm:px-8">
      <span className="pointer-events-auto flex items-center gap-2 font-heading text-base font-semibold tracking-tight text-white drop-shadow">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500 text-xs font-bold text-black">
          Y
        </span>
        {name}
      </span>
      <div className="pointer-events-auto flex items-center gap-2">
        <Link
          href="/projects"
          className="rounded-full border border-white/20 bg-black/30 px-3.5 py-1.5 text-sm font-medium text-white backdrop-blur transition hover:bg-black/50"
        >
          Projects
        </Link>
        <Link
          href="/login"
          className="rounded-full bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200"
        >
          Admin
        </Link>
        <div className="rounded-full bg-black/30 p-0.5 backdrop-blur">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  const [content, setContent] = useState<SiteContent>(DEFAULT_SITE_CONTENT);
  const [projects, setProjects] = useState<Project[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeSiteContent(setContent, () =>
      setError("Could not load site content from the database.")
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeProjects(setProjects, () => setProjects([]));
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = subscribePhotos(setPhotos, () => setPhotos([]));
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeCertificates(setCertificates, () => setCertificates([]));
    return unsubscribe;
  }, []);

  return (
    <div className="flex flex-1 flex-col bg-black">
      <TopBar name={content.heroName} />
      {error && (
        <p className="fixed inset-x-0 top-16 z-30 mx-auto max-w-md rounded-lg bg-red-950/80 px-4 py-2 text-center text-sm text-red-200">
          {error}
        </p>
      )}
      <FactoryJourney
        content={content}
        projects={projects}
        photos={photos}
        certificates={certificates}
      />
    </div>
  );
}
