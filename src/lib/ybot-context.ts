import { DEFAULT_SITE_CONTENT, type SiteContent } from "./site-content";
import { DEFAULT_PROJECTS, type Project } from "./projects";
import {
  DEFAULT_YBOT_CONFIG,
  DEFAULT_YBOT_KNOWLEDGE,
  type YbotConfig,
  type YbotKnowledge,
} from "./settings";

async function fetchJson<T>(path: string): Promise<T | null> {
  const base = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
  if (!base) return null;
  try {
    const res = await fetch(`${base}/${path}.json`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getYbotModel(): Promise<string> {
  const config = await fetchJson<YbotConfig>("content/ybot/config");
  return config?.model || DEFAULT_YBOT_CONFIG.model;
}

export async function buildYbotSystemPrompt(): Promise<string> {
  const [siteRaw, projectsRaw, knowledgeRaw, configRaw] = await Promise.all([
    fetchJson<SiteContent>("content/site"),
    fetchJson<Record<string, Omit<Project, "id">>>("content/projects"),
    fetchJson<YbotKnowledge>("content/ybot/knowledge"),
    fetchJson<YbotConfig>("content/ybot/config"),
  ]);

  const knowledge = knowledgeRaw?.facts ?? DEFAULT_YBOT_KNOWLEDGE.facts;
  const extraInstructions = configRaw?.extraInstructions ?? DEFAULT_YBOT_CONFIG.extraInstructions;

  const site = siteRaw ?? DEFAULT_SITE_CONTENT;
  const projects = projectsRaw
    ? Object.values(projectsRaw).filter((p) => p.published)
    : DEFAULT_PROJECTS.filter((p) => p.published);

  const projectLines = projects
    .sort((a, b) => a.priority - b.priority)
    .map(
      (p) =>
        `- ${p.name} (${p.category}): ${p.shortDescription} Tech: ${p.technologies.join(", ") || "n/a"}. Tags: ${p.tags.join(", ") || "n/a"}.`
    )
    .join("\n");

  const timelineLines = site.timeline
    .map((t) => `- ${t.role} at ${t.company} (${t.period}): ${t.description}`)
    .join("\n");

  const knowledgeLines = knowledge.length
    ? `\n# Additional facts\n${knowledge.map((f) => `- ${f}`).join("\n")}`
    : "";

  const extraSection = extraInstructions
    ? `\n# Extra instructions\n${extraInstructions}`
    : "";

  return `You are Y-BOT, the AI assistant embedded in ${site.heroName}'s portfolio website ("YASAR INDUSTRIES — The Digital Factory"). Answer questions about ${site.heroName} using only the information below. Be concise, friendly, and specific. Use Markdown formatting (headings, bold, bullet lists) where it helps readability. If asked something you don't have information about, say so honestly instead of inventing details — never fabricate projects, dates, or credentials that aren't listed here.

# About ${site.heroName}
Headline: ${site.heroHeadline}
Summary: ${site.aboutText}

# Skills
${site.skills.join(", ")}

# Experience Timeline
${timelineLines || "No experience entries published yet."}

# Projects
${projectLines || "No published projects yet."}

# Contact
Email: ${site.contactEmail}
${site.githubUrl ? `GitHub: ${site.githubUrl}` : ""}
${site.linkedinUrl ? `LinkedIn: ${site.linkedinUrl}` : ""}${knowledgeLines}${extraSection}`;
}
