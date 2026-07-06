"use client";

import Link from "next/link";
import type { SiteContent } from "@/lib/site-content";
import type { Project } from "@/lib/projects";
import type { Photo } from "@/lib/photography";
import type { Certificate } from "@/lib/certificates";
import { ImageSlot } from "@/components/ImageSlot";

type PanelProps = {
  accent: string;
  kicker: string;
  title: string;
  children: React.ReactNode;
};

/** Shared premium card shell used by every department. */
function Panel({ accent, kicker, title, children }: PanelProps) {
  return (
    <div
      className="animate-panel-rise relative w-full max-w-2xl overflow-hidden rounded-[26px] border border-white/60 bg-white/80 text-zinc-900 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.5)] ring-1 ring-black/5 backdrop-blur-2xl"
      style={{ ["--accent" as string]: accent }}
    >
      {/* accent top edge */}
      <div className="h-1 w-full" style={{ background: accent }} />
      {/* soft corner glow tinted by the department accent */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-20 blur-3xl"
        style={{ background: accent }}
      />

      <div className="ybot-scroll max-h-[66vh] overflow-y-auto px-8 py-7">
        <p
          className="font-mono text-[11px] font-medium uppercase tracking-[0.28em]"
          style={{ color: accent }}
        >
          {kicker}
        </p>
        <h2 className="mt-1.5 font-heading text-2xl font-semibold tracking-tight text-zinc-900">
          {title}
        </h2>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

function AccentButton({
  href,
  accent,
  children,
}: {
  href: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="rounded-full px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
      style={{ background: accent }}
    >
      {children}
    </a>
  );
}

export function ReceptionPanel({
  content,
  accent,
}: {
  content: SiteContent;
  accent: string;
}) {
  return (
    <Panel accent={accent} kicker="🏠 Reception · Home" title={`Welcome — I'm ${content.heroName}`}>
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="relative">
          <div
            className="absolute inset-0 rounded-full opacity-40 blur-md"
            style={{ background: accent }}
          />
          <ImageSlot
            src={content.heroPhoto}
            alt="Profile photo"
            className="relative h-28 w-28 shrink-0 rounded-full object-cover ring-2 ring-white"
          />
        </div>
        <p className="max-w-md text-sm leading-relaxed text-zinc-600">{content.heroHeadline}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <AccentButton href={content.resumeUrl} accent={accent}>
            Download resume
          </AccentButton>
          <a
            href={`mailto:${content.contactEmail}`}
            className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100"
          >
            Get in touch
          </a>
        </div>
      </div>
    </Panel>
  );
}

export function HrPanel({ content, accent }: { content: SiteContent; accent: string }) {
  return (
    <Panel accent={accent} kicker="🧑‍💼 HR Office · About Me" title="About Me">
      <p className="text-sm leading-relaxed text-zinc-700">{content.aboutText}</p>

      <h3 className="mt-6 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400">
        Skills
      </h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {content.skills.map((skill) => (
          <span
            key={skill}
            className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700"
          >
            {skill}
          </span>
        ))}
      </div>

      <h3 className="mt-6 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400">
        Experience
      </h3>
      <div className="relative mt-3 flex flex-col gap-4 pl-4">
        <span className="absolute left-[5px] top-1 bottom-1 w-px bg-zinc-200" />
        {content.timeline.map((entry, i) => (
          <div key={`${entry.company}-${i}`} className="relative">
            <span
              className="absolute -left-4 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white"
              style={{ background: accent }}
            />
            <p className="text-sm font-semibold text-zinc-900">
              {entry.role} · {entry.company}
            </p>
            <p className="text-xs text-zinc-400">{entry.period}</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600">{entry.description}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function ProductionPanel({
  projects,
  accent,
}: {
  projects: Project[];
  accent: string;
}) {
  const published = projects.filter((p) => p.published).sort((a, b) => a.priority - b.priority);
  return (
    <Panel accent={accent} kicker="🧵 Production Line · Projects" title="Apparel & Software Projects">
      {published.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No published projects yet — add and publish one from the admin panel.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {published.slice(0, 5).map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.slug}`}
              className="group rounded-2xl border border-zinc-200 p-4 transition hover:border-transparent hover:shadow-md"
              style={{ ["--tw-ring-color" as string]: accent }}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-zinc-900">{project.name}</p>
                <span
                  className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                  style={{ background: accent }}
                >
                  {project.category?.split(" ")[0] || "Project"}
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                {project.shortDescription}
              </p>
            </Link>
          ))}
          <Link
            href="/projects"
            className="mt-1 text-center text-sm font-medium"
            style={{ color: accent }}
          >
            View all projects →
          </Link>
        </div>
      )}
    </Panel>
  );
}

export function CreativePanel({ photos, accent }: { photos: Photo[]; accent: string }) {
  const published = photos.filter((p) => p.published).sort((a, b) => a.priority - b.priority);
  return (
    <Panel accent={accent} kicker="📷 Creative Studio · Photography" title="Photography">
      {published.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No photos published yet — add albums from the admin panel to fill this studio.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {published.slice(0, 6).map((photo) => (
            <div
              key={photo.id}
              className="group relative overflow-hidden rounded-xl"
            >
              <ImageSlot
                src={photo.imageUrl}
                alt={photo.title}
                className="h-28 w-full object-cover transition duration-500 group-hover:scale-105"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
                <p className="truncate text-[11px] font-medium text-white">{photo.title}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function QualityPanel({
  certificates,
  accent,
}: {
  certificates: Certificate[];
  accent: string;
}) {
  const published = certificates.filter((c) => c.published).sort((a, b) => a.priority - b.priority);
  return (
    <Panel accent={accent} kicker="🏆 Quality Control · Certifications" title="Certifications">
      {published.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No certificates published yet — add internship letters, awards, and completions from the
          admin panel.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {published.map((cert) => (
            <a
              key={cert.id}
              href={cert.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-2xl border border-zinc-200 p-3.5 transition hover:shadow-md"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-zinc-900">{cert.title}</span>
                <span className="text-xs text-zinc-500">{cert.issuer}</span>
              </span>
              <span className="ml-3 shrink-0 text-xs text-zinc-400">{cert.date}</span>
            </a>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function DispatchPanel({ content, accent }: { content: SiteContent; accent: string }) {
  const links = [
    { label: "Email", href: `mailto:${content.contactEmail}`, show: true },
    { label: "GitHub", href: content.githubUrl, show: !!content.githubUrl },
    { label: "LinkedIn", href: content.linkedinUrl, show: !!content.linkedinUrl },
    { label: "Instagram", href: content.instagramUrl, show: !!content.instagramUrl },
  ].filter((l) => l.show);

  return (
    <Panel accent={accent} kicker="📞 Dispatch · Contact" title="Let's build something">
      <p className="text-sm leading-relaxed text-zinc-600">
        Reach out about apparel engineering, IoT, or software work — I usually reply within a day.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target={link.href.startsWith("mailto:") ? undefined : "_blank"}
            rel="noreferrer"
            className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-800 transition hover:shadow-md"
          >
            {link.label}
          </a>
        ))}
      </div>
      <p className="mt-6 text-xs text-zinc-400">
        © {new Date().getFullYear()} {content.heroName}. All rights reserved.
      </p>
    </Panel>
  );
}
