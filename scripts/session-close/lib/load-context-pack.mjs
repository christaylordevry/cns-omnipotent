import { readFile } from "node:fs/promises";

/**
 * @param {string} contextPackPath
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function loadContextPackIfPresent(contextPackPath) {
  try {
    const raw = await readFile(contextPackPath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
