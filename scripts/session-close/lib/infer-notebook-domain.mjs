/** @typedef {{ patterns: string[]; domain: string }} DomainRule */

/** @type {DomainRule[]} */
const DOMAIN_RULES = [
  { patterns: ["cns", "vault", "pake", "brain"], domain: "cns-brain" },
  { patterns: ["ai factory", "blueprint", "architecting ai"], domain: "ai-factory" },
  { patterns: ["linkedin"], domain: "linkedin" },
  { patterns: ["directory", "monetization", "lead gen"], domain: "lead-gen" },
  {
    patterns: [
      "notebooklm",
      "cursor",
      "claude code",
      "code with",
      "tech with",
      "tina huang",
      "justin sung",
    ],
    domain: "learning",
  },
  { patterns: ["nutrition", "muscle", "fat loss"], domain: "health" },
];

/**
 * Normalize domain slug to lowercase [a-z0-9-] only.
 * @param {string} value
 * @returns {string}
 */
export function normalizeDomainSlug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Infer automation domain from notebook title (first-match, case-insensitive).
 * @param {string} title
 * @returns {string}
 */
export function inferNotebookDomain(title) {
  const haystack = String(title ?? "").toLowerCase();
  for (const rule of DOMAIN_RULES) {
    if (rule.patterns.some((p) => haystack.includes(p))) {
      return normalizeDomainSlug(rule.domain);
    }
  }
  return "general";
}
