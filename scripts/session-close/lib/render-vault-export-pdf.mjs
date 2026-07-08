/**
 * Render vault-export markdown to an extractable-text PDF via Playwright Chromium.
 * Browsers: prefer ~/.cache/ms-playwright (PLAYWRIGHT_BROWSERS_PATH).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * Escape markdown/text for safe insertion into a monospace HTML shell.
 * @param {string} text
 */
export function escapeHtmlForPdf(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * @param {string} markdown
 * @returns {string}
 */
export function wrapMarkdownAsPrintHtml(markdown) {
  const body = escapeHtmlForPdf(markdown);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10pt;line-height:1.35;white-space:pre-wrap;margin:18mm 14mm;color:#111;}
</style></head><body>${body}</body></html>`;
}

/**
 * Ensure Playwright resolves browser binaries from the shared cache.
 */
export function ensurePlaywrightBrowsersPath(env = process.env) {
  if (!env.PLAYWRIGHT_BROWSERS_PATH?.trim()) {
    env.PLAYWRIGHT_BROWSERS_PATH = join(homedir(), ".cache", "ms-playwright");
  }
  return env.PLAYWRIGHT_BROWSERS_PATH;
}

/**
 * @returns {typeof import('playwright')}
 */
function loadPlaywright() {
  ensurePlaywrightBrowsersPath();
  return require("playwright");
}

/**
 * Render markdown to a PDF file (extractable text, not raster-only).
 *
 * @param {{
 *   markdown: string;
 *   outputPath: string;
 *   chromium?: { launch: Function };
 * }} input
 * @returns {Promise<{ bytes: Buffer; outputPath: string }>}
 */
export async function renderVaultExportPdf(input) {
  if (typeof input.markdown !== "string" || input.markdown.length === 0) {
    throw new Error("PDF render skipped: export markdown is empty");
  }
  if (typeof input.outputPath !== "string" || !input.outputPath.trim()) {
    throw new Error("PDF render skipped: outputPath is required");
  }

  const outputPath = input.outputPath.trim();
  await mkdir(dirname(outputPath), { recursive: true });

  const html = wrapMarkdownAsPrintHtml(input.markdown);
  const playwrightApi = input.chromium
    ? { chromium: input.chromium }
    : loadPlaywright();
  const browser = await playwrightApi.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const bytes = await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: false,
      tagged: true,
    });
    const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    if (buffer.length === 0) {
      // page.pdf with path still returns Buffer; ensure file exists if empty return
      await writeFile(outputPath, buffer);
    }
    if (!buffer.slice(0, 5).toString("utf8").startsWith("%PDF")) {
      throw new Error("PDF render produced invalid magic (expected %PDF)");
    }
    return { bytes: buffer, outputPath };
  } finally {
    await browser.close();
  }
}
