"use client";

import Link from "next/link";
import type { SiteContent } from "@/lib/site-content";
import type { Project } from "@/lib/projects";
import type { Photo } from "@/lib/photography";
import type { Certificate } from "@/lib/certificates";
import { ImageSlot } from "@/components/ImageSlot";

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-h-[70vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-black/10 bg-white/85 p-8 text-zinc-900 shadow-2xl backdrop-blur-xl">
      {children}
    </div>
  );
}

export function ReceptionPanel({ content }: { content: SiteContent }) {
  return (
    <Panel>
      <div className="flex flex-col items-center gap-5 text-center">
        <ImageSlot
          src={content.heroPhoto}
          alt="Profile photo"
          className="h-28 w-28 shrink-0 rounded-full object-cover"
        />
        <div>
          <h2 className="text-2xl font-semibold">{content.heroName}</h2>
          <p className="mt-2 max-w-md text-sm text-zinc-600">{content.heroHeadline}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href={content.resumeUrl}
            className="rounded-full bg-amber-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-400"
          >
            Download resume
          </a>
          <a
            href={`mailto:${content.contactEmail}`}
            className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
          >
            Get in touch
          </a>
        </div>
      </div>
    </Panel>
  );
}

export function HrPanel({ content }: { content: SiteContent }) {
  return (
    <Panel>
      <h2 className="text-xl font-semibold">About Me</h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-700">{content.aboutText}</p>

      <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-zinc-500">Skills</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {content.skills.map((skill) => (
          <span key={skill} className="rounded-full bg-sky-100 px-3 py-1 text-sm text-sky-800">
            {skill}
          </span>
        ))}
      </div>

      <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-zinc-500">Timeline</h3>
      <div className="mt-3 flex flex-col gap-4">
        {content.timeline.map((entry, i) => (
          <div key={`${entry.company}-${i}`} className="flex gap-3">
            <ImageSlot
              src={entry.image}
              alt={entry.company}
              className="h-12 w-12 shrink-0 rounded-lg object-cover"
            />
            <div>
              <p className="text-sm font-medium">
                {entry.role} · {entry.company}
              </p>
              <p className="text-xs text-zinc-500">{entry.period}</p>
              <p className="mt-1 text-xs text-zinc-600">{entry.description}</p>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function ProductionPanel({ projects }: { projects: Project[] }) {
  const published = projects.filter((p) => p.published).sort((a, b) => a.priority - b.priority);
  return (
    <Panel>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Apparel Projects</h2>
        <Link href="/projects" className="text-sm text-orange-600 underline">
          View all
        </Link>
      </div>
      {published.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">
          No published projects yet — add and publish one from the admin panel.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {published.slice(0, 4).map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.slug}`}
              className="rounded-xl border border-zinc-200 p-4 hover:border-orange-400"
            >
              <p className="font-medium">{project.name}</p>
              <p className="mt-1 text-sm text-zinc-500">{project.shortDescription}</p>
            </Link>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function InnovationPanel() {
  return (
    <Panel>
      <h2 className="text-xl font-semibold">AI & Automation</h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-700">
        This is where Y-BOT lives — an AI assistant that answers questions about my work using data
        stored in Firebase, streamed straight from this factory floor.
      </p>
      <p className="mt-4 rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
        Y-BOT is coming online soon. This department is reserved for the streaming chatbot,
        project cards, and conversation history once the backend is wired up.
      </p>
    </Panel>
  );
}

export function CreativePanel({ photos }: { photos: Photo[] }) {
  const published = photos.filter((p) => p.published).sort((a, b) => a.priority - b.priority);
  return (
    <Panel>
      <h2 className="text-xl font-semibold">Photography</h2>
      {published.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">
          No photos published yet — add albums from the admin panel to fill this studio.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {published.slice(0, 6).map((photo) => (
            <div key={photo.id} className="overflow-hidden rounded-lg">
              <ImageSlot
                src={photo.imageUrl}
                alt={photo.title}
                className="h-28 w-full object-cover"
              />
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function QualityPanel({ certificates }: { certificates: Certificate[] }) {
  const published = certificates.filter((c) => c.published).sort((a, b) => a.priority - b.priority);
  return (
    <Panel>
      <h2 className="text-xl font-semibold">Certifications</h2>
      {published.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">
          No certificates published yet — add internship letters, awards, and completions from the
          admin panel.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {published.map((cert) => (
            <a
              key={cert.id}
              href={cert.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-xl border border-zinc-200 p-3 hover:border-emerald-400"
            >
              <span>
                <span className="font-medium">{cert.title}</span>
                <span className="ml-2 text-sm text-zinc-500">{cert.issuer}</span>
              </span>
              <span className="text-xs text-zinc-400">{cert.date}</span>
            </a>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function DispatchPanel({ content }: { content: SiteContent }) {
  return (
    <Panel>
      <h2 className="text-xl font-semibold">Get in touch</h2>
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <a href={`mailto:${content.contactEmail}`} className="text-sky-700 underline">
          Email
        </a>
        {content.githubUrl && (
          <a href={content.githubUrl} target="_blank" rel="noreferrer" className="text-sky-700 underline">
            GitHub
          </a>
        )}
        {content.linkedinUrl && (
          <a href={content.linkedinUrl} target="_blank" rel="noreferrer" className="text-sky-700 underline">
            LinkedIn
          </a>
        )}
        {content.instagramUrl && (
          <a href={content.instagramUrl} target="_blank" rel="noreferrer" className="text-sky-700 underline">
            Instagram
          </a>
        )}
      </div>
      <p className="mt-8 text-xs text-zinc-400">
        © {new Date().getFullYear()} {content.heroName}. All rights reserved.
      </p>
    </Panel>
  );
}
