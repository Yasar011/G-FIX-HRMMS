"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Project, ProjectStatus } from "@/lib/projects";
import { saveProject } from "@/lib/projects";
import { slugify } from "@/lib/slugify";
import { StringListInput } from "./StringListInput";
import { ImageGalleryField } from "./ImageGalleryField";
import { DocumentListField } from "./DocumentListField";

const STATUS_OPTIONS: ProjectStatus[] = [
  "Planning",
  "In Progress",
  "Completed",
  "On Hold",
  "Archived",
];

type FormState = Omit<Project, "id" | "createdAt" | "updatedAt">;

const EMPTY_FORM: FormState = {
  name: "",
  slug: "",
  shortDescription: "",
  fullCaseStudy: "",
  problemStatement: "",
  solution: "",
  githubLink: "",
  liveDemo: "",
  technologies: [],
  tags: [],
  category: "",
  recruiterCategory: "",
  priority: 50,
  featured: false,
  timeline: "",
  status: "Planning",
  published: false,
  images: [],
  documents: [],
  videos: [],
};

function fieldClass() {
  return "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";
}

export function ProjectForm({
  projectId,
  initialProject,
}: {
  projectId: string;
  initialProject?: Project;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(
    initialProject ? { ...initialProject } : EMPTY_FORM
  );
  const [slugEdited, setSlugEdited] = useState(!!initialProject);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleNameChange(name: string) {
    update("name", name);
    if (!slugEdited) {
      update("slug", slugify(name));
    }
  }

  async function handleSubmit() {
    if (!form.name.trim() || !form.slug.trim()) {
      setError("Name and slug are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const now = Date.now();
      await saveProject(projectId, {
        ...form,
        createdAt: initialProject?.createdAt ?? now,
        updatedAt: now,
      });
      router.push("/admin/projects");
    } catch {
      setError("Could not save the project.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-8 pb-16">
      <section className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Project name
          </label>
          <input
            value={form.name}
            onChange={(e) => handleNameChange(e.target.value)}
            className={fieldClass()}
          />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Slug
          </label>
          <input
            value={form.slug}
            onChange={(e) => {
              setSlugEdited(true);
              update("slug", e.target.value);
            }}
            className={fieldClass()}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Category
          </label>
          <input
            value={form.category}
            onChange={(e) => update("category", e.target.value)}
            className={fieldClass()}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Recruiter category
          </label>
          <input
            value={form.recruiterCategory}
            onChange={(e) => update("recruiterCategory", e.target.value)}
            placeholder="e.g. Software Engineering"
            className={fieldClass()}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Status
          </label>
          <select
            value={form.status}
            onChange={(e) => update("status", e.target.value as ProjectStatus)}
            className={fieldClass()}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Timeline
          </label>
          <input
            value={form.timeline}
            onChange={(e) => update("timeline", e.target.value)}
            placeholder="e.g. Jan 2025 - Mar 2025"
            className={fieldClass()}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Priority (lower shows first)
          </label>
          <input
            type="number"
            value={form.priority}
            onChange={(e) => update("priority", Number(e.target.value))}
            className={fieldClass()}
          />
        </div>
        <div className="flex items-end gap-6">
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => update("featured", e.target.checked)}
            />
            Featured
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) => update("published", e.target.checked)}
            />
            Published
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Short description
          </label>
          <textarea
            value={form.shortDescription}
            onChange={(e) => update("shortDescription", e.target.value)}
            rows={2}
            className={fieldClass()}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Problem statement
          </label>
          <textarea
            value={form.problemStatement}
            onChange={(e) => update("problemStatement", e.target.value)}
            rows={3}
            className={fieldClass()}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Solution
          </label>
          <textarea
            value={form.solution}
            onChange={(e) => update("solution", e.target.value)}
            rows={3}
            className={fieldClass()}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Full case study
          </label>
          <textarea
            value={form.fullCaseStudy}
            onChange={(e) => update("fullCaseStudy", e.target.value)}
            rows={6}
            className={fieldClass()}
          />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            GitHub link
          </label>
          <input
            value={form.githubLink}
            onChange={(e) => update("githubLink", e.target.value)}
            className={fieldClass()}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Live demo
          </label>
          <input
            value={form.liveDemo}
            onChange={(e) => update("liveDemo", e.target.value)}
            className={fieldClass()}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <StringListInput
          label="Technologies used"
          values={form.technologies}
          onChange={(values) => update("technologies", values)}
          placeholder="e.g. React"
        />
        <StringListInput
          label="Tags"
          values={form.tags}
          onChange={(values) => update("tags", values)}
          placeholder="e.g. IoT"
        />
        <StringListInput
          label="Video links"
          values={form.videos}
          onChange={(values) => update("videos", values)}
          placeholder="https://..."
        />
      </section>

      <section className="flex flex-col gap-6">
        <ImageGalleryField
          projectId={projectId}
          images={form.images}
          onChange={(images) => update("images", images)}
        />
        <DocumentListField
          projectId={projectId}
          documents={form.documents}
          onChange={(documents) => update("documents", documents)}
        />
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {saving ? "Saving..." : "Save project"}
        </button>
        <button
          onClick={() => router.push("/admin/projects")}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
