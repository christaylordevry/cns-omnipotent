/** @typedef {{ patterns: string[]; domain: string }} DomainRule */

/**
 * Tokenize text for domain lexicon building (same rules as notebook-scorer).
 * @param {string} text
 * @returns {string[]}
 */
function tokenizePatternForLexicon(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2);
}

/** @type {DomainRule[]} */
export const DOMAIN_RULES = [
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

/** @type {Map<string, string[]>} */
const DOMAIN_KEYWORDS_BY_SLUG = (() => {
  /** @type {Map<string, Set<string>>} */
  const building = new Map();
  for (const rule of DOMAIN_RULES) {
    const slug = normalizeDomainSlug(rule.domain);
    if (!building.has(slug)) {
      building.set(slug, new Set());
    }
    const tokens = building.get(slug);
    for (const pattern of rule.patterns) {
      for (const token of tokenizePatternForLexicon(pattern)) {
        tokens.add(token);
      }
    }
  }
  /** @type {Map<string, string[]>} */
  const frozen = new Map();
  for (const [slug, set] of building) {
    frozen.set(slug, [...set].sort());
  }
  return frozen;
})();

/**
 * Extra domain keyword tokens for a slug (from DOMAIN_RULES). Excludes slug tokens;
 * callers also tokenize `entry.domain`. Returns [] for `general` and unknown slugs.
 * @param {string} slug
 * @returns {string[]}
 */
export function getDomainKeywordTokens(slug) {
  const normalized = normalizeDomainSlug(slug);
  if (normalized === "general") {
    return [];
  }
  return DOMAIN_KEYWORDS_BY_SLUG.get(normalized) ?? [];
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
