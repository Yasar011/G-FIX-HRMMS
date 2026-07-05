"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Project } from "@/lib/projects";
import { getProjectBySlug } from "@/lib/projects";

export default function ProjectDetailPage() {
  const params = useParams<{ slug: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProjectBySlug(params.slug).then((p) => {
      setProject(p);
      setLoading(false);
    });
  }, [params.slug]);

  if (loading) return <p className="p-16 text-sm text-zinc-500">Loading...</p>;
  if (!project || !project.published)
    return <p className="p-16 text-sm text-zinc-500">Project not found.</p>;

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {project.name}
      </h1>
      <p className="mt-2 text-zinc-500">{project.shortDescription}</p>

      <div className="mt-4 flex flex-wrap gap-2 text-sm text-zinc-500">
        {project.category && <span>{project.category}</span>}
        {project.timeline && <span>· {project.timeline}</span>}
        <span>· {project.status}</span>
      </div>

      {project.images.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {project.images.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt="" className="rounded-lg object-cover" />
          ))}
        </div>
      )}

      <Section title="Problem" content={project.problemStatement} />
      <Section title="Solution" content={project.solution} />
      <Section title="Case Study" content={project.fullCaseStudy} />

      {project.technologies.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Technologies
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {project.technologies.map((tech) => (
              <span
                key={tech}
                className="rounded-full bg-zinc-100 px-3 py-1 text-xs dark:bg-zinc-800"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-4 text-sm">
        {project.githubLink && (
          <a
            href={project.githubLink}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            GitHub
          </a>
        )}
        {project.liveDemo && (
          <a
            href={project.liveDemo}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Live demo
          </a>
        )}
      </div>

      {project.documents.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Documents
          </h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {project.documents.map((doc) => (
              <li key={doc.url}>
                <a href={doc.url} target="_blank" rel="noreferrer" className="underline">
                  {doc.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {project.videos.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Videos
          </h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {project.videos.map((url) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noreferrer" className="underline">
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Section({ title, content }: { title: string; content: string }) {
  if (!content) return null;
  return (
    <div className="mt-6">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        {title}
      </h2>
      <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
        {content}
      </p>
    </div>
  );
}
