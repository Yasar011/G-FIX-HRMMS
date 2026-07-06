import {
  equalTo,
  get,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  remove,
  set,
} from "firebase/database";
import { db } from "./firebase";

export type ProjectStatus =
  | "Planning"
  | "In Progress"
  | "Completed"
  | "On Hold"
  | "Archived";

export type ProjectDocument = { name: string; url: string };

export type Project = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  fullCaseStudy: string;
  problemStatement: string;
  solution: string;
  githubLink: string;
  liveDemo: string;
  technologies: string[];
  tags: string[];
  category: string;
  recruiterCategory: string;
  priority: number;
  featured: boolean;
  timeline: string;
  status: ProjectStatus;
  published: boolean;
  images: string[];
  documents: ProjectDocument[];
  videos: string[];
  createdAt: number;
  updatedAt: number;
};

const PROJECTS_PATH = "content/projects";
const SEED_TIMESTAMP = 1751500000000;

function seedProject(
  overrides: Omit<
    Project,
    | "fullCaseStudy"
    | "githubLink"
    | "liveDemo"
    | "featured"
    | "published"
    | "images"
    | "documents"
    | "videos"
    | "createdAt"
    | "updatedAt"
  > &
    Partial<
      Pick<
        Project,
        | "fullCaseStudy"
        | "githubLink"
        | "liveDemo"
        | "featured"
        | "published"
        | "images"
        | "documents"
        | "videos"
      >
    >
): Project {
  return {
    fullCaseStudy: "",
    githubLink: "",
    liveDemo: "",
    featured: false,
    published: true,
    images: [],
    documents: [],
    videos: [],
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
    ...overrides,
  };
}

// Shown until real projects are published from /admin/projects — same
// "seed until overridden" pattern as DEFAULT_SITE_CONTENT.
export const DEFAULT_PROJECTS: Project[] = [
  seedProject({
    id: "garmentfix-iot-oee",
    name: "GarmentFix: Industry 5.0 IoT Condition Monitoring & OEE System",
    slug: "garmentfix-iot-oee",
    shortDescription:
      "Low-cost IoT retrofit turning legacy sewing and multi-head embroidery machines into smart, cloud-connected Industry 5.0 assets with a 100% accurate, real-time OEE score. Engineered for under $40 in prototype components.",
    problemStatement:
      "Legacy sewing and embroidery machines on factory floors have no digital visibility into uptime, vibration, or true operating state, making OEE tracking manual and inaccurate.",
    solution:
      "Edge Data Acquisition (Node A): an Arduino Uno (C++) polls an MPU6050 (tri-axial vibration) and MAX6675 K-Type thermocouple over SPI/I2C, using hardware interrupts on native motor encoders for absolute RPM and stitch counting. Master Cloud Gateway (Node B): an ESP32 (FreeRTOS) manages physical Andon buttons and an opto-isolated kill-switch, and sniffs the proprietary CAN Bus (via SN65HVD230) to tell \"Idle\" apart from \"Powered Off\". An AI-assisted single-page SCADA dashboard (HTML5, Vanilla JS, Tailwind CSS) drives a live Andon indicator, a custom JS OEE math engine (Chart.js), and automated shift auditing exporting ISO-compliant PDF reports (jsPDF). Firebase Realtime Database handles high-frequency telemetry with cloud-persistent state sync.",
    technologies: [
      "Arduino Uno (C++)",
      "ESP32 (FreeRTOS)",
      "MPU6050",
      "MAX6675",
      "CAN Bus (SN65HVD230)",
      "Firebase RTDB",
      "Chart.js",
      "jsPDF",
      "Tailwind CSS",
    ],
    tags: ["IoT", "Predictive Maintenance", "Smart Manufacturing", "Industry 5.0"],
    category: "IoT & Automation Engineering",
    recruiterCategory: "IoT / Industrial Engineering",
    priority: 10,
    timeline: "Prototype, tailored for high-tier manufacturers (e.g. Shahi Exports)",
    status: "Completed",
    featured: true,
  }),
  seedProject({
    id: "garmentfix-qms",
    name: "GarmentFix QMS",
    slug: "garmentfix-qms",
    shortDescription:
      "Real-time Quality Management System (mobile Worker App + Admin Dashboard) built during a Brandix India Unit 3 internship, eliminating 70-80 paper sheets and 3-4 hours of manual data re-entry per shift.",
    problemStatement:
      "Quality and maintenance tracking on the Brandix production floor ran on paper, causing 6-hour reporting delays and no operator-level accountability for recurring defects.",
    solution:
      "QR-based machine identification, role-based defect logging, and automatic generation of maintenance tickets for recurring defect patterns, built as an AI-assisted Vanilla JavaScript PWA with Firebase RTDB, Chart.js, Groq (LLM), and jsPDF/SheetJS for reporting. Piloted live on a production line, fixing issues in real time before full-factory rollout.",
    technologies: ["Vanilla JavaScript (PWA)", "Firebase RTDB", "Chart.js", "Groq (LLM)", "jsPDF", "SheetJS"],
    tags: ["QMS", "Manufacturing", "PWA"],
    category: "Manufacturing Software Architecture",
    recruiterCategory: "Manufacturing Software",
    priority: 20,
    timeline: "Brandix India Unit 3 internship",
    status: "Completed",
    featured: true,
  }),
  seedProject({
    id: "apms",
    name: "APMS — Apparel Production Management System",
    slug: "apms",
    shortDescription:
      "Maintenance and quality-management platform connecting floor-level equipment breakdowns, preventive maintenance, and QC defects into a single automated pipeline.",
    problemStatement:
      "A fragile third-party automation layer (n8n) was unreliable for connecting breakdowns, PM, and QC data, and 1,400+ real-world ERP asset records needed importing and deduplicating.",
    solution:
      "Replaced the n8n automation layer with a resilient client-side direct-write architecture, and built a robust custom CSV parser to import and deduplicate 1,400+ ERP asset records.",
    technologies: ["JavaScript", "Firebase", "Custom CSV parser"],
    tags: ["Maintenance", "ERP", "Automation"],
    category: "Manufacturing Software Architecture",
    recruiterCategory: "Manufacturing Software",
    priority: 30,
    timeline: "Brandix India Unit 3 internship",
    status: "Completed",
    featured: true,
  }),
  seedProject({
    id: "spectrum-tedx-platforms",
    name: "Spectrum '26 & TEDxNIFT Jodhpur Registration Platforms",
    slug: "spectrum-tedx-platforms",
    shortDescription:
      "Directed technical setups and deployed official registration platforms for two major college fests, featuring custom ticketing, dynamic pricing, and real-time Firebase backend verification.",
    problemStatement: "",
    solution:
      "Built custom ticketing and dynamic pricing flows with a Firebase backend for real-time registration data verification, alongside directing the events' technical setups.",
    technologies: ["Firebase", "JavaScript"],
    tags: ["Events", "Ticketing"],
    category: "Web & E-Commerce Architecture",
    recruiterCategory: "Web Development",
    priority: 40,
    timeline: "",
    status: "Completed",
  }),
  seedProject({
    id: "blaze-in",
    name: "Blaze.in",
    slug: "blaze-in",
    shortDescription:
      "Premium jewelry e-commerce brand specializing in silver earrings and customized accessories, complete with an admin dashboard.",
    problemStatement: "",
    solution: "Conceptualized and developed the storefront and a full admin dashboard for catalog and order management.",
    technologies: [],
    tags: ["E-commerce", "Branding"],
    category: "Web & E-Commerce Architecture",
    recruiterCategory: "Web Development",
    priority: 50,
    timeline: "April 2026",
    status: "Completed",
  }),
  seedProject({
    id: "apc-local-cloud-server",
    name: "APC Local Cloud Server",
    slug: "apc-local-cloud-server",
    shortDescription:
      "Secure internal local cloud network managing terabytes of club media assets on existing college hardware, paired with a custom web app automating member task assignments.",
    problemStatement: "",
    solution: "Engineered a secure local cloud network on existing college hardware and a custom web app for automating member task assignments.",
    technologies: [],
    tags: ["Infrastructure", "Local Cloud"],
    category: "Web & E-Commerce Architecture",
    recruiterCategory: "Systems Engineering",
    priority: 60,
    timeline: "",
    status: "Completed",
  }),
  seedProject({
    id: "manufacturing-setup-costing",
    name: "Large-Scale Manufacturing Setup & Costing Analysis",
    slug: "manufacturing-setup-costing",
    shortDescription:
      "Technical report and supply chain analysis for a 100,000 piece/month viscose casual shirt manufacturing facility in Ahmedabad, plus comparative costing research on apparel factory setups between India and Vietnam.",
    problemStatement: "",
    solution: "Architected the facility's supply chain analysis and conducted comparative costing research across both countries.",
    technologies: [],
    tags: ["Manufacturing Strategy", "Costing"],
    category: "Fashion Technology & Apparel Production",
    recruiterCategory: "Apparel Manufacturing",
    priority: 70,
    timeline: "April 2026",
    status: "Completed",
  }),
];

export function newProjectId(): string {
  return push(ref(db, PROJECTS_PATH)).key as string;
}

export async function saveProject(
  id: string,
  data: Omit<Project, "id">
): Promise<void> {
  await set(ref(db, `${PROJECTS_PATH}/${id}`), data);
}

export async function deleteProject(id: string): Promise<void> {
  await remove(ref(db, `${PROJECTS_PATH}/${id}`));
}

export async function updateProjectFields(
  project: Project,
  patch: Partial<Omit<Project, "id">>
): Promise<void> {
  const { id, ...rest } = project;
  await saveProject(id, { ...rest, ...patch, updatedAt: Date.now() });
}

export function subscribeProjects(
  callback: (projects: Project[]) => void,
  onError?: (error: Error) => void
): () => void {
  return onValue(
    ref(db, PROJECTS_PATH),
    (snapshot) => {
      const value = snapshot.val() as Record<string, Omit<Project, "id">> | null;
      const list = value
        ? Object.entries(value).map(([id, data]) => ({ id, ...data }))
        : DEFAULT_PROJECTS;
      callback(list);
    },
    (error) => onError?.(error)
  );
}

export async function getProject(id: string): Promise<Project | null> {
  const snapshot = await get(ref(db, `${PROJECTS_PATH}/${id}`));
  if (!snapshot.exists()) return null;
  return { id, ...(snapshot.val() as Omit<Project, "id">) };
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  const q = query(ref(db, PROJECTS_PATH), orderByChild("slug"), equalTo(slug));
  const snapshot = await get(q);
  if (!snapshot.exists()) {
    return DEFAULT_PROJECTS.find((project) => project.slug === slug) ?? null;
  }
  const value = snapshot.val() as Record<string, Omit<Project, "id">>;
  const [id, data] = Object.entries(value)[0];
  return { id, ...data };
}
