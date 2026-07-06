import { get, onValue, push, ref, remove, set } from "firebase/database";
import { db } from "./firebase";

export type Photo = {
  id: string;
  title: string;
  caption: string;
  category: string;
  imageUrl: string;
  featured: boolean;
  published: boolean;
  priority: number;
  createdAt: number;
};

const PHOTOGRAPHY_PATH = "content/photography";

export function newPhotoId(): string {
  return push(ref(db, PHOTOGRAPHY_PATH)).key as string;
}

export async function savePhoto(id: string, data: Omit<Photo, "id">): Promise<void> {
  await set(ref(db, `${PHOTOGRAPHY_PATH}/${id}`), data);
}

export async function deletePhoto(id: string): Promise<void> {
  await remove(ref(db, `${PHOTOGRAPHY_PATH}/${id}`));
}

export function subscribePhotos(
  callback: (photos: Photo[]) => void,
  onError?: (error: Error) => void
): () => void {
  return onValue(
    ref(db, PHOTOGRAPHY_PATH),
    (snapshot) => {
      const value = snapshot.val() as Record<string, Omit<Photo, "id">> | null;
      const list = value
        ? Object.entries(value).map(([id, data]) => ({ id, ...data }))
        : [];
      callback(list);
    },
    (error) => onError?.(error)
  );
}

export async function getPhotos(): Promise<Photo[]> {
  const snapshot = await get(ref(db, PHOTOGRAPHY_PATH));
  const value = snapshot.val() as Record<string, Omit<Photo, "id">> | null;
  return value ? Object.entries(value).map(([id, data]) => ({ id, ...data })) : [];
}

export async function getPhoto(id: string): Promise<Photo | null> {
  const snapshot = await get(ref(db, `${PHOTOGRAPHY_PATH}/${id}`));
  if (!snapshot.exists()) return null;
  return { id, ...(snapshot.val() as Omit<Photo, "id">) };
}
