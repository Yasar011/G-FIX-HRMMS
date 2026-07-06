import { get, onValue, push, ref, remove, set } from "firebase/database";
import { db } from "./firebase";

export type Internship = {
  id: string;
  company: string;
  role: string;
  period: string;
  location: string;
  description: string;
  logoUrl: string;
  published: boolean;
  priority: number;
  createdAt: number;
};

const INTERNSHIPS_PATH = "content/internships";

export function newInternshipId(): string {
  return push(ref(db, INTERNSHIPS_PATH)).key as string;
}

export async function saveInternship(id: string, data: Omit<Internship, "id">): Promise<void> {
  await set(ref(db, `${INTERNSHIPS_PATH}/${id}`), data);
}

export async function deleteInternship(id: string): Promise<void> {
  await remove(ref(db, `${INTERNSHIPS_PATH}/${id}`));
}

export function subscribeInternships(
  callback: (internships: Internship[]) => void,
  onError?: (error: Error) => void
): () => void {
  return onValue(
    ref(db, INTERNSHIPS_PATH),
    (snapshot) => {
      const value = snapshot.val() as Record<string, Omit<Internship, "id">> | null;
      const list = value
        ? Object.entries(value).map(([id, data]) => ({ id, ...data }))
        : [];
      callback(list);
    },
    (error) => onError?.(error)
  );
}

export async function getInternship(id: string): Promise<Internship | null> {
  const snapshot = await get(ref(db, `${INTERNSHIPS_PATH}/${id}`));
  if (!snapshot.exists()) return null;
  return { id, ...(snapshot.val() as Omit<Internship, "id">) };
}
