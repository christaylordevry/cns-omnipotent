/**
 * Overwrite an existing Google Doc via Google Docs API + OAuth refresh token.
 *
 * Required env (process or ~/.hermes/session-close.env):
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
 *
 * Drive MCP (@googleapis/mcp-server-drive) is optional; this module uses REST directly.
 */

import { readFile } from "node:fs/promises";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DOCS_API = "https://docs.googleapis.com/v1/documents";

/**
 * @param {{ clientId: string; clientSecret: string; refreshToken: string; fetchFn?: typeof fetch }} input
 */
export async function fetchGoogleAccessToken(input) {
  const fetchFn = input.fetchFn ?? globalThis.fetch;
  const body = new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    refresh_token: input.refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetchFn(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Google OAuth token refresh failed (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Google OAuth token refresh returned invalid JSON");
  }
  const accessToken = typeof parsed.access_token === "string" ? parsed.access_token : "";
  if (!accessToken) {
    throw new Error("Google OAuth token refresh missing access_token");
  }
  return accessToken;
}

/**
 * @param {string} accessToken
 * @param {string} documentId
 * @param {typeof fetch} [fetchFn]
 */
async function getDocumentEndIndex(accessToken, documentId, fetchFn = globalThis.fetch) {
  const res = await fetchFn(`${DOCS_API}/${encodeURIComponent(documentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Google Docs get failed (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  const doc = JSON.parse(text);
  const body = doc?.body;
  const content = Array.isArray(body?.content) ? body.content : [];
  let endIndex = 1;
  for (const element of content) {
    const start = element?.startIndex;
    const end = element?.endIndex;
    if (typeof end === "number" && end > endIndex) {
      endIndex = end;
    }
    if (typeof start === "number" && start >= endIndex) {
      endIndex = start + 1;
    }
  }
  return Math.max(1, endIndex);
}

/**
 * Replace all body text in an existing Google Doc (does not create a new file).
 * @param {{
 *   documentId: string;
 *   text: string;
 *   clientId: string;
 *   clientSecret: string;
 *   refreshToken: string;
 *   fetchFn?: typeof fetch;
 * }} input
 */
export async function overwriteGoogleDocContent(input) {
  const fetchFn = input.fetchFn ?? globalThis.fetch;
  const accessToken = await fetchGoogleAccessToken({
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    refreshToken: input.refreshToken,
    fetchFn,
  });

  const endIndex = await getDocumentEndIndex(accessToken, input.documentId, fetchFn);
  /** @type {Record<string, unknown>[]} */
  const requests = [];
  if (endIndex > 1) {
    requests.push({
      deleteContentRange: {
        range: {
          startIndex: 1,
          endIndex: endIndex - 1,
        },
      },
    });
  }
  requests.push({
    insertText: {
      location: { index: 1 },
      text: input.text,
    },
  });

  const res = await fetchFn(
    `${DOCS_API}/${encodeURIComponent(input.documentId)}:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requests }),
    },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Google Docs batchUpdate failed (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  return { ok: true };
}

/**
 * @param {string} exportPath
 */
export async function readExportMarkdown(exportPath) {
  return readFile(exportPath, "utf8");
}
