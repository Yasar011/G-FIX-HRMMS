import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { firebaseApp } from "./firebase";

export const storage = getStorage(firebaseApp);

export async function uploadSiteFile(
  folder: "hero" | "timeline" | "resume",
  file: File
): Promise<string> {
  const path = `site/${folder}/${Date.now()}-${file.name}`;
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}
