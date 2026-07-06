import { get, onValue, push, ref, remove, set } from "firebase/database";
import { db } from "./firebase";

export type Certificate = {
  id: string;
  title: string;
  issuer: string;
  date: string;
  category: string;
  fileUrl: string;
  published: boolean;
  priority: number;
  createdAt: number;
};

const CERTIFICATES_PATH = "content/certificates";

export function newCertificateId(): string {
  return push(ref(db, CERTIFICATES_PATH)).key as string;
}

export async function saveCertificate(id: string, data: Omit<Certificate, "id">): Promise<void> {
  await set(ref(db, `${CERTIFICATES_PATH}/${id}`), data);
}

export async function deleteCertificate(id: string): Promise<void> {
  await remove(ref(db, `${CERTIFICATES_PATH}/${id}`));
}

export function subscribeCertificates(
  callback: (certificates: Certificate[]) => void,
  onError?: (error: Error) => void
): () => void {
  return onValue(
    ref(db, CERTIFICATES_PATH),
    (snapshot) => {
      const value = snapshot.val() as Record<string, Omit<Certificate, "id">> | null;
      const list = value
        ? Object.entries(value).map(([id, data]) => ({ id, ...data }))
        : [];
      callback(list);
    },
    (error) => onError?.(error)
  );
}

export async function getCertificates(): Promise<Certificate[]> {
  const snapshot = await get(ref(db, CERTIFICATES_PATH));
  const value = snapshot.val() as Record<string, Omit<Certificate, "id">> | null;
  return value ? Object.entries(value).map(([id, data]) => ({ id, ...data })) : [];
}

export async function getCertificate(id: string): Promise<Certificate | null> {
  const snapshot = await get(ref(db, `${CERTIFICATES_PATH}/${id}`));
  if (!snapshot.exists()) return null;
  return { id, ...(snapshot.val() as Omit<Certificate, "id">) };
}
