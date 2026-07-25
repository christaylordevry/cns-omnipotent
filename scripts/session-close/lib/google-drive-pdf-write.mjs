/**
 * Overwrite an existing Google Drive PDF via media upload (no Docs convert).
 * Reuses OAuth helpers from google-drive-doc-write.mjs.
 */
import { fetchGoogleAccessToken, GOOGLE_OAUTH_SCOPE } from "./google-drive-doc-write.mjs";

export { fetchGoogleAccessToken, GOOGLE_OAUTH_SCOPE };

const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";

/**
 * Replace PDF bytes in place (same fileId). Suitable for files ≤5 MB (simple media upload).
 *
 * @param {{
 *   fileId: string;
 *   pdfBytes: Buffer | Uint8Array;
 *   clientId: string;
 *   clientSecret: string;
 *   refreshToken: string;
 *   fetchFn?: typeof fetch;
 * }} input
 */
export async function overwriteDrivePdfContent(input) {
  const fileId = typeof input.fileId === "string" ? input.fileId.trim() : "";
  if (!fileId) {
    throw new Error("Google Drive PDF overwrite skipped: fileId is required");
  }
  const pdfBytes = input.pdfBytes;
  if (!pdfBytes || !(pdfBytes instanceof Uint8Array) || pdfBytes.length === 0) {
    throw new Error("Google Drive PDF overwrite skipped: pdfBytes is empty");
  }

  const fetchFn = input.fetchFn ?? globalThis.fetch;
  const accessToken = await fetchGoogleAccessToken({
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    refreshToken: input.refreshToken,
    fetchFn,
  });

  const res = await fetchFn(
    `${DRIVE_UPLOAD}/${encodeURIComponent(fileId)}?uploadType=media`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/pdf",
      },
      body: pdfBytes,
    },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Google Drive PDF media update failed (HTTP ${res.status}): ${text.slice(0, 200)}`,
    );
  }
  return { ok: true };
}
