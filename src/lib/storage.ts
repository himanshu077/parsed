import { del, put } from "@vercel/blob";

// Files above this size are uploaded in parallel parts (with per-part retry),
// which is far more reliable than a single-shot upload for large files.
const MULTIPART_THRESHOLD = 8 * 1024 * 1024; // 8 MB

export async function uploadToBlob(
  pathname: string,
  data: ArrayBuffer,
  contentType: string,
): Promise<string> {
  const blob = await put(pathname, data, {
    access: "public",
    addRandomSuffix: true,
    contentType,
    multipart: data.byteLength > MULTIPART_THRESHOLD,
  });
  return blob.url;
}

export async function deleteFromBlob(url: string): Promise<void> {
  await del(url);
}
