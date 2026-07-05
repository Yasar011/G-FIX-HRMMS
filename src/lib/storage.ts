import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { firebaseApp } from "./firebase";

export const storage = getStorage(firebaseApp);

export async function uploadProjectFile(
  projectId: string,
  folder: "images" | "documents",
  file: File
): Promise<string> {
  const path = `projects/${projectId}/${folder}/${Date.now()}-${file.name}`;
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}
