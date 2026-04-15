import { z } from "zod";

export const BRAIN_CORPUS_ALLOWLIST_SCHEMA_VERSION = 1 as const;

const protectedCorporaOptInSchema = z.object({
  enabled: z.literal(true),
  rationale: z.string(),
  acknowledged_risks: z.literal(true),
});

const rawBrainCorpusAllowlistSchema = z.object({
  schema_version: z.literal(BRAIN_CORPUS_ALLOWLIST_SCHEMA_VERSION),
  subtrees: z.array(z.string()),
  pake_types: z.array(z.string()).optional(),
  inbox: z.object({ enabled: z.boolean() }).optional(),
  protected_corpora_opt_in: protectedCorporaOptInSchema.optional(),
});

export type ProtectedCorporaOptIn = z.infer<typeof protectedCorporaOptInSchema>;

export type BrainCorpusAllowlist = {
  schema_version: typeof BRAIN_CORPUS_ALLOWLIST_SCHEMA_VERSION;
  subtrees: string[];
  pake_types?: string[];
  inbox: { enabled: boolean };
  protected_corpora_opt_in?: ProtectedCorporaOptIn;
};

export type BrainCorpusAllowlistIssueCode =
  | "JSON_PARSE_ERROR"
  | "SCHEMA_ERROR"
  | "POLICY_EMPTY_ALLOWLIST"
  | "POLICY_PATH_ABSOLUTE"
  | "POLICY_PATH_TRAVERSAL"
  | "POLICY_PATH_EMPTY"
  | "POLICY_PROTECTED_PATH";

export type BrainCorpusAllowlistIssue = {
  code: BrainCorpusAllowlistIssueCode;
  message: string;
  /** Logical JSON path for structured logs (no raw config values). */
  path?: (string | number)[];
};

export type BrainCorpusAllowlistParseResult =
  | { ok: true; value: BrainCorpusAllowlist }
  | { ok: false; issues: BrainCorpusAllowlistIssue[] };

function failure(issues: BrainCorpusAllowlistIssue[]): { ok: false; issues: BrainCorpusAllowlistIssue[] } {
  return { ok: false, issues };
}

function zodToSchemaIssues(err: z.ZodError): BrainCorpusAllowlistIssue[] {
  return err.issues.map((iss) => ({
    code: "SCHEMA_ERROR" as const,
    message: `Invalid shape at "${iss.path.join(".") || "(root)"}" (${iss.code}).`,
    path: iss.path.length ? (iss.path as (string | number)[]) : undefined,
  }));
}

function isWindowsAbs(s: string): boolean {
  return /^[A-Za-z]:/.test(s);
}

/**
 * Normalize a single subtree entry for prefix checks and policy.
 * On failure, returns a policy issue without echoing the original string.
 */
export function normalizeVaultSubtreePath(
  raw: string,
): { ok: true; value: string } | { ok: false; issue: BrainCorpusAllowlistIssue } {
  let s = raw.trim().replace(/\\/g, "/");
  while (s.startsWith("./")) {
    s = s.slice(2);
  }
  while (s.endsWith("/**") || s.endsWith("/")) {
    if (s.endsWith("/**")) {
      s = s.slice(0, -3);
    } else {
      s = s.slice(0, -1);
    }
  }
  s = s.replace(/\/{2,}/g, "/");

  if (s.length === 0) {
    return {
      ok: false,
      issue: {
        code: "POLICY_PATH_EMPTY",
        message: "Subtree path is empty after normalization.",
      },
    };
  }
  if (s.startsWith("/") || isWindowsAbs(s)) {
    return {
      ok: false,
      issue: {
        code: "POLICY_PATH_ABSOLUTE",
        message: "Subtree paths must be vault-relative, not absolute filesystem paths.",
      },
    };
  }
  const segments = s.split("/");
  if (segments.some((seg) => seg === "..")) {
    return {
      ok: false,
      issue: {
        code: "POLICY_PATH_TRAVERSAL",
        message: 'Subtree paths must not contain ".." segments.',
      },
    };
  }
  return { ok: true, value: s };
}

function isUnderProtectedPrefix(normalized: string): boolean {
  return (
    normalized === "AI-Context" ||
    normalized.startsWith("AI-Context/") ||
    normalized === "_meta" ||
    normalized.startsWith("_meta/")
  );
}

function dedupePreserveOrder(paths: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of paths) {
    if (seen.has(p)) {
      continue;
    }
    seen.add(p);
    out.push(p);
  }
  return out;
}

function normalizePakeTypes(raw: string[] | undefined): { ok: true; value?: string[] } | { ok: false; issues: BrainCorpusAllowlistIssue[] } {
  if (raw === undefined) {
    return { ok: true, value: undefined };
  }
  const issues: BrainCorpusAllowlistIssue[] = [];
  const out: string[] = [];
  raw.forEach((t, i) => {
    const v = t.trim();
    if (v.length === 0) {
      issues.push({
        code: "SCHEMA_ERROR",
        message: "pake_types entries must be non-empty strings after trimming.",
        path: ["pake_types", i],
      });
      return;
    }
    out.push(v);
  });
  if (issues.length) {
    return { ok: false, issues };
  }
  return { ok: true, value: dedupePreserveOrder(out) };
}

/**
 * Parse JSON text into a validated allowlist. Does not read the filesystem.
 * Error messages are generic (no echo of secret-like file contents).
 */
export function parseBrainCorpusAllowlist(jsonText: string): BrainCorpusAllowlistParseResult {
  let data: unknown;
  try {
    data = JSON.parse(jsonText) as unknown;
  } catch {
    return failure([{ code: "JSON_PARSE_ERROR", message: "Input is not valid JSON." }]);
  }
  return parseBrainCorpusAllowlistUnknown(data);
}

/**
 * Validate an already-parsed JSON value (object graph).
 */
export function parseBrainCorpusAllowlistUnknown(data: unknown): BrainCorpusAllowlistParseResult {
  const zr = rawBrainCorpusAllowlistSchema.safeParse(data);
  if (!zr.success) {
    return failure(zodToSchemaIssues(zr.error));
  }

  const row = zr.data;
  const normalizedSubtrees: string[] = [];
  const issues: BrainCorpusAllowlistIssue[] = [];

  row.subtrees.forEach((st, i) => {
    const norm = normalizeVaultSubtreePath(st);
    if (!norm.ok) {
      issues.push({ ...norm.issue, path: ["subtrees", i] });
      return;
    }
    normalizedSubtrees.push(norm.value);
  });

  if (issues.length) {
    return failure(issues);
  }

  const deduped = dedupePreserveOrder(normalizedSubtrees);
  if (deduped.length === 0) {
    return failure([
      {
        code: "POLICY_EMPTY_ALLOWLIST",
        message: "At least one valid subtree is required.",
        path: ["subtrees"],
      },
    ]);
  }

  const pake = normalizePakeTypes(row.pake_types);
  if (!pake.ok) {
    return failure(pake.issues);
  }

  const hasProtected = deduped.some(isUnderProtectedPrefix);
  if (hasProtected) {
    const opt = row.protected_corpora_opt_in;
    if (!opt || opt.enabled !== true || opt.acknowledged_risks !== true) {
      return failure([
        {
          code: "POLICY_PROTECTED_PATH",
          message:
            "Subtrees under AI-Context or _meta require protected_corpora_opt_in with enabled true and acknowledged_risks true.",
          path: ["protected_corpora_opt_in"],
        },
      ]);
    }
    const rationale = opt.rationale.trim();
    if (rationale.length === 0) {
      return failure([
        {
          code: "POLICY_PROTECTED_PATH",
          message: "protected_corpora_opt_in.rationale must be non-empty after trimming.",
          path: ["protected_corpora_opt_in", "rationale"],
        },
      ]);
    }
  }

  const value: BrainCorpusAllowlist = {
    schema_version: BRAIN_CORPUS_ALLOWLIST_SCHEMA_VERSION,
    subtrees: deduped,
    pake_types: pake.value,
    inbox: row.inbox ?? { enabled: false },
    protected_corpora_opt_in: row.protected_corpora_opt_in,
  };

  return { ok: true, value };
}
