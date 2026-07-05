"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Project } from "@/lib/projects";
import { subscribeProjects } from "@/lib/projects";
import { ImageSlot } from "@/components/ImageSlot";

const SKILLS = [
  "Pattern Making",
  "Garment Construction",
  "Quality Management",
  "React",
  "Firebase",
  "IoT",
];

const TIMELINE = [
  {
    company: "Brandix",
    role: "Internship",
    period: "Placeholder dates",
    image: "/images/brandix.jpg",
    description: "Placeholder — add a summary of your role and learnings here.",
  },
  {
    company: "Arvind",
    role: "Internship",
    period: "Placeholder dates",
    image: "/images/arvind.jpg",
    description: "Placeholder — add a summary of your role and learnings here.",
  },
];

function NavBar() {
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-black/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <span className="font-semibold text-zinc-900 dark:text-zinc-50">
          Yasar
        </span>
        <nav className="flex items-center gap-5 text-sm text-zinc-600 dark:text-zinc-400">
          <a href="#about" className="hover:text-zinc-900 dark:hover:text-zinc-50">
            About
          </a>
          <a href="#skills" className="hover:text-zinc-900 dark:hover:text-zinc-50">
            Skills
          </a>
          <a href="#timeline" className="hover:text-zinc-900 dark:hover:text-zinc-50">
            Timeline
          </a>
          <Link href="/projects" className="hover:text-zinc-900 dark:hover:text-zinc-50">
            Projects
          </Link>
          <a href="#contact" className="hover:text-zinc-900 dark:hover:text-zinc-50">
            Contact
          </a>
          <Link
            href="/login"
            className="rounded-full bg-zinc-900 px-3 py-1.5 text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-6 py-20 text-center sm:flex-row sm:text-left">
      <ImageSlot
        src="/images/profile.jpg"
        alt="Profile photo"
        className="h-40 w-40 shrink-0 rounded-full object-cover"
      />
      <div>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          Yasar
        </h1>
        <p className="mt-2 max-w-lg text-zinc-600 dark:text-zinc-400">
          Placeholder headline — e.g. &quot;Apparel Engineer &amp; Software
          Builder.&quot; Edit this in{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            src/app/page.tsx
          </code>
          .
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3 sm:justify-start">
          <Link
            href="/projects"
            className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            View projects
          </Link>
          <a
            href="/resume.pdf"
            className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Download resume
          </a>
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section id="about" className="mx-auto max-w-5xl px-6 py-16">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        About
      </h2>
      <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
        Placeholder about paragraph — introduce your background across
        fashion/apparel engineering and software, and what drives your work.
        Edit this directly in the code, or in the admin CMS once that module
        is built.
      </p>
    </section>
  );
}

function Skills() {
  return (
    <section id="skills" className="mx-auto max-w-5xl px-6 py-16">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Skills
      </h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {SKILLS.map((skill) => (
          <span
            key={skill}
            className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            {skill}
          </span>
        ))}
      </div>
    </section>
  );
}

function Timeline() {
  return (
    <section id="timeline" className="mx-auto max-w-5xl px-6 py-16">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Timeline
      </h2>
      <div className="mt-6 flex flex-col gap-6">
        {TIMELINE.map((entry) => (
          <div key={entry.company} className="flex gap-4">
            <ImageSlot
              src={entry.image}
              alt={entry.company}
              className="h-16 w-16 shrink-0 rounded-lg object-cover"
            />
            <div>
              <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
                {entry.role} · {entry.company}
              </h3>
              <p className="text-sm text-zinc-500">{entry.period}</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {entry.description}
              </p>
            </div>
          </div>
        ))}
        <p className="text-sm text-zinc-400">
          Future internships and roles will appear here.
        </p>
      </div>
    </section>
  );
}

function FeaturedProjects() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeProjects(
      (list) => {
        setProjects(
          list
            .filter((p) => p.published && p.featured)
            .sort((a, b) => a.priority - b.priority)
            .slice(0, 3)
        );
      },
      () => setProjects([])
    );
    return unsubscribe;
  }, []);

  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Featured Projects
        </h2>
        <Link href="/projects" className="text-sm underline">
          View all
        </Link>
      </div>
      {projects.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">
          No featured projects published yet — add and feature one from the
          admin panel.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.slug}`}
              className="rounded-xl border border-zinc-200 p-4 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
            >
              <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
                {project.name}
              </h3>
              <p className="mt-1 text-sm text-zinc-500">
                {project.shortDescription}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function Contact() {
  return (
    <footer
      id="contact"
      className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="mx-auto max-w-5xl px-6 py-16 text-center">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Get in touch
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          Placeholder — replace with your real email and social links.
        </p>
        <div className="mt-4 flex justify-center gap-4 text-sm">
          <a href="mailto:you@example.com" className="underline">
            Email
          </a>
          <a href="https://github.com" target="_blank" rel="noreferrer" className="underline">
            GitHub
          </a>
          <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="underline">
            LinkedIn
          </a>
        </div>
        <p className="mt-8 text-xs text-zinc-400">
          © {new Date().getFullYear()} Yasar. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-white dark:bg-black">
      <NavBar />
      <Hero />
      <About />
      <Skills />
      <Timeline />
      <FeaturedProjects />
      <Contact />
    </div>
  );
}
