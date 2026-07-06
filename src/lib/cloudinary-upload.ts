import { auth } from "./firebase";

export async function uploadToCloudinary(file: File, folder?: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("You must be signed in to upload files.");
  }
  const idToken = await user.getIdToken();

  const formData = new FormData();
  formData.append("file", file);
  if (folder) formData.append("folder", folder);

  const response = await fetch("/api/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Upload failed.");
  }

  const data = (await response.json()) as { url: string };
  return data.url;
}
