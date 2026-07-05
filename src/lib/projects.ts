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
        : [];
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
  if (!snapshot.exists()) return null;
  const value = snapshot.val() as Record<string, Omit<Project, "id">>;
  const [id, data] = Object.entries(value)[0];
  return { id, ...data };
}
