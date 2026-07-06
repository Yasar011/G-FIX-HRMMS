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
  heroName: "Yasar C H",
  heroHeadline: "B.F.Tech & Minor in Communication Design | NIFT Jodhpur",
  heroPhoto: "/images/profile.jpg",
  resumeUrl: "/resume.pdf",
  aboutText:
    "Tech-driven Fashion Technology student combining industrial engineering, IoT automation, and digital media to solve complex apparel industry challenges. Experienced in managing technical fests, designing enterprise-level software systems via AI-assisted generation, and conceptualizing modern manufacturing workflows to bridge the gap between physical production and digital tracking.",
  skills: [
    "Firebase Realtime Database",
    "MySQL",
    "AI-Assisted Development & Prompt Engineering",
    "JavaScript",
    "PHP",
    "ESP32 & Arduino",
    "FreeRTOS",
    "CAN Bus / SPI / I2C",
    "WebSockets",
    "Lean Management & TPM",
    "Tech Pack Creation",
    "Quality Management Systems (QMS)",
    "Garment Construction & Pattern Making",
    "Adobe Premiere Pro & CapCut",
    "Photoshop & Illustrator",
    "Photography & Lightroom",
  ],
  timeline: [
    {
      company: "Adventure & Photography Club (APC), NIFT Jodhpur",
      role: "President",
      period: "Dec 2025 – Present",
      image: "/images/apc.jpg",
      description:
        "Spearheading the club's digital transformation, engineering cloud management for assets, mentoring students in technical photography, and managing complex media production teams for major college fests.",
    },
    {
      company: "Brandix India Unit 3",
      role: "Apparel Intern",
      period: "2 Months",
      image: "/images/brandix.jpg",
      description:
        "Led the digital transformation of quality and maintenance tracking on the production floor. Piloted the GarmentFix QMS on a live production line, fixing issues in real-time before full-factory rollout, and managed complex digital asset relocation and maintenance routing via APMS.",
    },
    {
      company: "Arvind Ltd, Ahmedabad",
      role: "Textile Intern",
      period: "July 2025",
      image: "/images/arvind.jpg",
      description:
        "Gained practical exposure to high-volume industrial textile manufacturing. Analyzed production workflows, material handling processes, spinning, weaving, and quality control systems.",
    },
  ],
  contactEmail: "chyasar2004@gmail.com",
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
