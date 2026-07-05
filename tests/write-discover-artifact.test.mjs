import assert from "node:assert";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  buildDiscoverPayload,
  formatIso8601WithOffset,
  pickTopStory,
  resolveDiscoverArtifactPath,
  resolveDiscoverPaths,
  writeDiscoverArtifactFile,
} from "../scripts/hermes-skill-examples/unified-loop/scripts/write-discover-artifact.mjs";

describe("Story 84-1 write-discover-artifact", () => {
  it("resolveDiscoverArtifactPath uses absolute home path", () => {
    const p = resolveDiscoverArtifactPath("/tmp/fake-home");
    assert.ok(p.startsWith("/tmp/fake-home/"));
    assert.ok(p.endsWith("unified-loop/discover.json"));
  });

  it("buildDiscoverPayload conforms to schema v1 with PrioritizedItem[]", () => {
    const items = [
      {
        rank: 1,
        rankScore: 12.5,
        title: "84-1-unified-loop-governance-schedule-shell",
        category: "sprint",
        rationale: "in-progress epic gate",
        sourcePath: "_bmad-output/implementation-artifacts/sprint-status.yaml",
      },
    ];
    const payload = buildDiscoverPayload({
      items,
      repoRoot: "/home/christ/ai-factory/projects/Omnipotent.md",
      artifactPath: "/home/christ/.hermes/artifacts/unified-loop/discover.json",
      trigger: "cron:discover",
      generatedAt: "2026-07-06T08:00:00+10:00",
    });

    assert.strictEqual(payload.schemaVersion, 1);
    assert.strictEqual(payload.stage, "discover");
    assert.strictEqual(payload.trigger, "cron:discover");
    assert.strictEqual(payload.repoRoot, "/home/christ/ai-factory/projects/Omnipotent.md");
    assert.strictEqual(
      payload.artifactPath,
      "/home/christ/.hermes/artifacts/unified-loop/discover.json",
    );
    assert.strictEqual(payload.collector.module, "scripts/lib/collect-internal-dev-state.ts");
    assert.strictEqual(payload.collector.itemCap, 20);
    assert.deepStrictEqual(payload.items, items);
    assert.strictEqual(payload.topPick.storyKey, "84-1-unified-loop-governance-schedule-shell");
    assert.strictEqual(payload.buildIntent.status, "awaiting-operator-approval");
    assert.strictEqual(payload.buildIntent.proposedStoryKey, null);
  });

  it("pickTopStory selects lowest rank item", () => {
    const top = pickTopStory([
      { rank: 2, rankScore: 5, title: "b", category: "deferred", rationale: "", sourcePath: "" },
      { rank: 1, rankScore: 10, title: "a", category: "sprint", rationale: "", sourcePath: "" },
    ]);
    assert.strictEqual(top?.storyKey, "a");
  });

  it("formatIso8601WithOffset includes numeric offset", () => {
    const s = formatIso8601WithOffset(new Date("2026-07-06T00:00:00Z"));
    assert.match(s, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  });

  it("resolveDiscoverPaths resolves absolute repoRoot and artifactPath", () => {
    const paths = resolveDiscoverPaths({
      OMNIPOTENT_REPO: "/abs/repo",
      UNIFIED_LOOP_DISCOVER_ARTIFACT: "/abs/custom/discover.json",
    });
    assert.strictEqual(paths.repoRoot, "/abs/repo");
    assert.strictEqual(paths.artifactPath, "/abs/custom/discover.json");
  });

  it("writeDiscoverArtifactFile creates parent dirs and writes JSON", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "discover-artifact-"));
    const artifactPath = join(tmp, "nested", "discover.json");
    const payload = buildDiscoverPayload({
      items: [],
      repoRoot: tmp,
      artifactPath,
      trigger: "manual",
      generatedAt: "2026-07-06T08:00:00+10:00",
    });
    await writeDiscoverArtifactFile(payload, artifactPath);
    const raw = JSON.parse(readFileSync(artifactPath, "utf8"));
    assert.strictEqual(raw.schemaVersion, 1);
    assert.strictEqual(raw.stage, "discover");
  });
});
