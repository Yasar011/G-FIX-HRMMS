import { get, onValue, ref, set } from "firebase/database";
import { db } from "./firebase";

export type TimelineEntry = {
  company: string;
  role: string;
  period: string;
  image: string;
  description: string;
};

export type SiteContent = {
  heroName: string;
  heroHeadline: string;
  heroPhoto: string;
  resumeUrl: string;
  aboutText: string;
  skills: string[];
  timeline: TimelineEntry[];
  contactEmail: string;
  githubUrl: string;
  linkedinUrl: string;
  instagramUrl: string;
  updatedAt: number;
};

const SITE_CONTENT_PATH = "content/site";

export const DEFAULT_SITE_CONTENT: SiteContent = {
  heroName: "Yasar",
  heroHeadline:
    'Placeholder headline — e.g. "Apparel Engineer & Software Builder."',
  heroPhoto: "/images/profile.jpg",
  resumeUrl: "/resume.pdf",
  aboutText:
    "Placeholder about paragraph — introduce your background across fashion/apparel engineering and software, and what drives your work.",
  skills: [
    "Pattern Making",
    "Garment Construction",
    "Quality Management",
    "React",
    "Firebase",
    "IoT",
  ],
  timeline: [
    {
      company: "Brandix",
      role: "Internship",
      period: "Placeholder dates",
      image: "/images/brandix.jpg",
      description:
        "Placeholder — add a summary of your role and learnings here.",
    },
    {
      company: "Arvind",
      role: "Internship",
      period: "Placeholder dates",
      image: "/images/arvind.jpg",
      description:
        "Placeholder — add a summary of your role and learnings here.",
    },
  ],
  contactEmail: "you@example.com",
  githubUrl: "https://github.com",
  linkedinUrl: "https://linkedin.com",
  instagramUrl: "",
  updatedAt: 0,
};

export async function saveSiteContent(
  data: Omit<SiteContent, "updatedAt">
): Promise<void> {
  await set(ref(db, SITE_CONTENT_PATH), { ...data, updatedAt: Date.now() });
}

export function subscribeSiteContent(
  callback: (content: SiteContent) => void,
  onError?: (error: Error) => void
): () => void {
  return onValue(
    ref(db, SITE_CONTENT_PATH),
    (snapshot) => {
      const value = snapshot.val() as SiteContent | null;
      callback(value ?? DEFAULT_SITE_CONTENT);
    },
    (error) => onError?.(error)
  );
}

export async function getSiteContent(): Promise<SiteContent> {
  const snapshot = await get(ref(db, SITE_CONTENT_PATH));
  const value = snapshot.val() as SiteContent | null;
  return value ?? DEFAULT_SITE_CONTENT;
}
