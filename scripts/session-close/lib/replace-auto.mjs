/**
 * Replace inner content between AUTO marker comment anchors (Story 43.1 / SC-3).
 * @param {string} text
 * @param {string} tag
 * @param {string} inner
 */
export function replaceAuto(text, tag, inner) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<!-- AUTO:${escaped} -->[\\s\\S]*?<!-- /AUTO:${escaped} -->`,
    "m",
  );
  const replacement = `<!-- AUTO:${tag} -->${inner}<!-- /AUTO:${tag} -->`;
  const match = pattern.exec(text);
  if (!match) {
    throw new Error(`AUTO marker not found: ${tag}`);
  }
  return `${text.slice(0, match.index)}${replacement}${text.slice(match.index + match[0].length)}`;
}

/**
 * @param {string} text
 * @param {Record<string, string>} markers
 */
export function applyAutoMarkers(text, markers) {
  let out = text;
  for (const [tag, inner] of Object.entries(markers)) {
    out = replaceAuto(out, tag, inner);
  }
  return out;
}
