import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  normalizeVaultSubtreePath,
  parseBrainCorpusAllowlist,
  parseBrainCorpusAllowlistUnknown,
} from "../../src/brain/corpus-allowlist.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");

describe("parseBrainCorpusAllowlist", () => {
  it("accepts a valid minimal config (charter default-include posture)", () => {
    const raw = JSON.stringify({
      schema_version: 1,
      subtrees: ["03-Resources", "01-Projects", "02-Areas", "DailyNotes"],
    });
    const r = parseBrainCorpusAllowlist(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.subtrees).toEqual(["03-Resources", "01-Projects", "02-Areas", "DailyNotes"]);
      expect(r.value.pake_types).toBeUndefined();
      expect(r.value.inbox).toEqual({ enabled: false });
    }
  });

  it("accepts optional pake_types filter", () => {
    const r = parseBrainCorpusAllowlistUnknown({
      schema_version: 1,
      subtrees: ["03-Resources"],
      pake_types: ["reference", "project"],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.pake_types).toEqual(["reference", "project"]);
    }
  });

  it("rejects protected subtrees without opt-in", async () => {
    const p = path.join(repoRoot, "tests", "fixtures", "brain-corpus-allowlist-invalid-protected.json");
    const raw = await readFile(p, "utf8");
    const r = parseBrainCorpusAllowlist(raw);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((i) => i.code === "POLICY_PROTECTED_PATH")).toBe(true);
      const msg = r.issues.map((i) => i.message).join(" ");
      expect(msg).not.toMatch(/BEGIN[\s\S]*PRIVATE KEY/);
    }
  });

  it("accepts protected subtrees only with complete opt-in block", () => {
    const r = parseBrainCorpusAllowlistUnknown({
      schema_version: 1,
      subtrees: ["AI-Context/modules"],
      protected_corpora_opt_in: {
        enabled: true,
        rationale: "Operator acknowledges governance risk for embedding control-plane excerpts.",
        acknowledged_risks: true,
      },
    });
    expect(r.ok).toBe(true);
  });

  it("rejects protected subtrees when rationale is whitespace only", () => {
    const r = parseBrainCorpusAllowlistUnknown({
      schema_version: 1,
      subtrees: ["_meta/schemas"],
      protected_corpora_opt_in: {
        enabled: true,
        rationale: "   \t  ",
        acknowledged_risks: true,
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues[0]?.code).toBe("POLICY_PROTECTED_PATH");
    }
  });

  it("normalizes trailing slashes and glob suffixes", () => {
    const r = parseBrainCorpusAllowlistUnknown({
      schema_version: 1,
      subtrees: ["03-Resources/", "01-Projects/**", "./02-Areas///"],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.subtrees).toEqual(["03-Resources", "01-Projects", "02-Areas"]);
    }
  });

  it("dedupes subtrees in first-wins order", () => {
    const r = parseBrainCorpusAllowlistUnknown({
      schema_version: 1,
      subtrees: ["03-Resources", "03-Resources/", "01-Projects"],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.subtrees).toEqual(["03-Resources", "01-Projects"]);
    }
  });

  it("rejects traversal segments", () => {
    const r = parseBrainCorpusAllowlistUnknown({
      schema_version: 1,
      subtrees: ["03-Resources/../01-Projects"],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((i) => i.code === "POLICY_PATH_TRAVERSAL")).toBe(true);
    }
  });

  it("rejects absolute POSIX paths", () => {
    const r = parseBrainCorpusAllowlistUnknown({
      schema_version: 1,
      subtrees: ["/etc/passwd"],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((i) => i.code === "POLICY_PATH_ABSOLUTE")).toBe(true);
    }
  });

  it("rejects Windows-style absolute paths", () => {
    const r = parseBrainCorpusAllowlistUnknown({
      schema_version: 1,
      subtrees: ["C:/Users"],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((i) => i.code === "POLICY_PATH_ABSOLUTE")).toBe(true);
    }
  });

  it("returns JSON_PARSE_ERROR without echoing file contents for parse failures", () => {
    const secretLike = "ghp_" + "a".repeat(36);
    const r = parseBrainCorpusAllowlist(`{ "broken": true, "x": "${secretLike}" `);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues[0]?.code).toBe("JSON_PARSE_ERROR");
      expect(JSON.stringify(r.issues)).not.toContain(secretLike);
    }
  });

  it("distinguishes schema errors from policy errors", () => {
    const badShape = parseBrainCorpusAllowlistUnknown({ schema_version: 1, subtrees: "nope" });
    expect(badShape.ok).toBe(false);
    if (!badShape.ok) {
      expect(badShape.issues.every((i) => i.code === "SCHEMA_ERROR")).toBe(true);
    }

    const empty = parseBrainCorpusAllowlistUnknown({ schema_version: 1, subtrees: [] });
    expect(empty.ok).toBe(false);
    if (!empty.ok) {
      expect(empty.issues.some((i) => i.code === "POLICY_EMPTY_ALLOWLIST")).toBe(true);
    }
  });

  it("allows inbox.enabled without listing 00-Inbox (explicit flag)", () => {
    const r = parseBrainCorpusAllowlistUnknown({
      schema_version: 1,
      subtrees: ["03-Resources"],
      inbox: { enabled: true },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.inbox).toEqual({ enabled: true });
    }
  });

  it("rejects empty pake_types entries after trim", () => {
    const r = parseBrainCorpusAllowlistUnknown({
      schema_version: 1,
      subtrees: ["03-Resources"],
      pake_types: ["ok", "   "],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((i) => i.code === "SCHEMA_ERROR")).toBe(true);
    }
  });
});

describe("normalizeVaultSubtreePath", () => {
  it("exposes normalization for unit-level checks", () => {
    expect(normalizeVaultSubtreePath("  foo//bar/ ").ok).toBe(true);
    const n = normalizeVaultSubtreePath("  foo//bar/ ");
    if (n.ok) {
      expect(n.value).toBe("foo/bar");
    }
  });
});
