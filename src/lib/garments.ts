import { get, onValue, push, ref, remove, set } from "firebase/database";
import { db } from "./firebase";

export type Garment = {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  published: boolean;
  featured: boolean;
  priority: number;
  createdAt: number;
};

const GARMENTS_PATH = "content/garments";

export function newGarmentId(): string {
  return push(ref(db, GARMENTS_PATH)).key as string;
}

export async function saveGarment(id: string, data: Omit<Garment, "id">): Promise<void> {
  await set(ref(db, `${GARMENTS_PATH}/${id}`), data);
}

export async function deleteGarment(id: string): Promise<void> {
  await remove(ref(db, `${GARMENTS_PATH}/${id}`));
}

export function subscribeGarments(
  callback: (garments: Garment[]) => void,
  onError?: (error: Error) => void
): () => void {
  return onValue(
    ref(db, GARMENTS_PATH),
    (snapshot) => {
      const value = snapshot.val() as Record<string, Omit<Garment, "id">> | null;
      const list = value
        ? Object.entries(value).map(([id, data]) => ({ id, ...data }))
        : [];
      callback(list);
    },
    (error) => onError?.(error)
  );
}

export async function getGarment(id: string): Promise<Garment | null> {
  const snapshot = await get(ref(db, `${GARMENTS_PATH}/${id}`));
  if (!snapshot.exists()) return null;
  return { id, ...(snapshot.val() as Omit<Garment, "id">) };
}
