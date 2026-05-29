import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { getDomainKeywordTokens } from "../scripts/session-close/lib/infer-notebook-domain.mjs";
import {
  f1,
  scoreNotebooks,
  tokenizeForScoring,
} from "../scripts/session-close/lib/notebook-scorer.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("tokenizeForScoring", () => {
  it("lowercases and splits on non-alphanumeric runs", () => {
    assert.deepEqual(tokenizeForScoring("CNS Vault Architecture"), [
      "cns",
      "vault",
      "architecture",
    ]);
  });

  it("drops tokens shorter than 2 characters", () => {
    assert.deepEqual(tokenizeForScoring("a bb ccc"), ["bb", "ccc"]);
  });
});

describe("f1", () => {
  it("returns 0 when either set is empty", () => {
    assert.equal(f1([], ["a"]), 0);
    assert.equal(f1(["a"], []), 0);
    assert.equal(f1([], []), 0);
  });

  it("computes overlap coefficient for non-empty sets", () => {
    assert.equal(f1(["vault", "architecture"], ["cns", "vault", "architecture"]), 0.8);
  });
});

describe("getDomainKeywordTokens", () => {
  it("mirrors DOMAIN_RULES for cns-brain", () => {
    const tokens = getDomainKeywordTokens("cns-brain");
    assert.ok(tokens.includes("pake"));
    assert.ok(tokens.includes("vault"));
    assert.ok(tokens.includes("cns"));
    assert.ok(tokens.includes("brain"));
  });

  it("returns no extra lexicon for general", () => {
    assert.deepEqual(getDomainKeywordTokens("general"), []);
  });
});

describe("scoreNotebooks", () => {
  const cnsNotebook = {
    id: "nb-cns-1",
    title: "CNS Vault Architecture",
    watch: false,
    domain: "cns-brain",
    last_updated: null,
  };

  const weakTitleCns = {
    id: "nb-cns-2",
    title: "Random Notes",
    watch: false,
    domain: "cns-brain",
    last_updated: null,
  };

  const learningNotebook = {
    id: "nb-learn-1",
    title: "Misc",
    watch: false,
    domain: "learning",
    last_updated: null,
  };

  it("strong title match returns OK with score >= 0.75", () => {
    const result = scoreNotebooks("vault architecture", [cnsNotebook]);
    assert.equal(result.status, "OK");
    assert.equal(result.matches.length, 1);
    assert.equal(result.matches[0].id, "nb-cns-1");
    assert.ok(result.matches[0].score >= 0.75);
  });

  it("domain-only match when domain axis clears threshold", () => {
    const result = scoreNotebooks("pake vault brain", [weakTitleCns]);
    assert.equal(result.status, "OK");
    assert.equal(result.matches[0].id, "nb-cns-2");
    assert.ok(result.matches[0].score >= 0.75);
  });

  it("learning domain lexicon routes when domain axis clears threshold", () => {
    const result = scoreNotebooks(
      "notebooklm cursor claude code tech tina huang",
      [learningNotebook],
    );
    assert.equal(result.status, "OK");
    assert.equal(result.matches[0].id, "nb-learn-1");
  });

  it("below-threshold query returns NO_ROUTE", () => {
    const result = scoreNotebooks("cooking recipes", [cnsNotebook]);
    assert.deepEqual(result, { status: "NO_ROUTE", matches: [] });
  });

  it("empty topic returns NO_ROUTE", () => {
    assert.deepEqual(scoreNotebooks("", [cnsNotebook]), {
      status: "NO_ROUTE",
      matches: [],
    });
    assert.deepEqual(scoreNotebooks("   \t", [cnsNotebook]), {
      status: "NO_ROUTE",
      matches: [],
    });
  });

  it("empty registry returns NO_ROUTE", () => {
    assert.deepEqual(scoreNotebooks("vault", []), {
      status: "NO_ROUTE",
      matches: [],
    });
  });

  it("skips malformed registry rows", () => {
    const result = scoreNotebooks("vault architecture", [
      { id: "", title: "No id" },
      {
        id: "ok",
        title: "CNS Vault Architecture",
        domain: "cns-brain",
        watch: false,
        last_updated: null,
      },
    ]);
    assert.equal(result.status, "OK");
    assert.equal(result.matches.length, 1);
    assert.equal(result.matches[0].id, "ok");
  });

  it("returns two matches ranked by score descending for ambiguous top scores", () => {
    const secondTitleMatch = {
      id: "nb-cns-3",
      title: "Architecture Vault Guide",
      watch: false,
      domain: "cns-brain",
      last_updated: null,
    };
    const result = scoreNotebooks("vault architecture", [cnsNotebook, secondTitleMatch]);
    assert.equal(result.status, "OK");
    assert.equal(result.matches.length, 2);
    assert.ok(result.matches[0].score >= result.matches[1].score);
    assert.ok(result.matches.every((m) => m.score >= 0.75));
  });

  it("tie-breaks equal scores by title then id", () => {
    const a = {
      id: "z-id",
      title: "Beta Vault Architecture",
      watch: false,
      domain: "cns-brain",
      last_updated: null,
    };
    const b = {
      id: "a-id",
      title: "Alpha Vault Architecture",
      watch: false,
      domain: "cns-brain",
      last_updated: null,
    };
    const result = scoreNotebooks("vault architecture", [a, b]);
    assert.equal(result.status, "OK");
    assert.equal(result.matches[0].title, "Alpha Vault Architecture");
    assert.equal(result.matches[1].title, "Beta Vault Architecture");
    assert.equal(result.matches[0].score, result.matches[1].score);
  });

  it("uses conservative max(title, domain) not average", () => {
    const weakBoth = {
      id: "nb-weak",
      title: "Unrelated Topic",
      watch: false,
      domain: "general",
      last_updated: null,
    };
    const result = scoreNotebooks("vault", [weakBoth]);
    assert.equal(result.status, "NO_ROUTE");
  });

  it("loads optional fixture registry when present", async () => {
    const fixturePath = join(__dirname, "fixtures", "notebook-registry-scorer.json");
    const raw = await readFile(fixturePath, "utf8");
    const registry = JSON.parse(raw);
    const result = scoreNotebooks("ai factory blueprint", registry);
    assert.equal(result.status, "OK");
    assert.equal(result.matches[0].id, "fixture-ai-factory");
  });

  it("rounds scores to four decimal places", () => {
    const result = scoreNotebooks("vault architecture", [cnsNotebook]);
    const score = result.matches[0].score;
    assert.equal(score, Math.round(score * 10_000) / 10_000);
  });
});
