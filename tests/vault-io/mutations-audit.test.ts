import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { vaultCreateNote } from "../../src/tools/vault-create-note.js";
import { vaultUpdateFrontmatter } from "../../src/tools/vault-update-frontmatter.js";
import { vaultAppendDaily } from "../../src/tools/vault-append-daily.js";
import { vaultLogAction } from "../../src/tools/vault-log-action.js";

const FAKE_UTC_DAY = "2026-06-15";

const validDailyFm = `---
pake_id: "550e8400-e29b-41d4-a716-446655440000"
pake_type: WorkflowNote
title: "Daily Note ${FAKE_UTC_DAY}"
created: "${FAKE_UTC_DAY}"
modified: "${FAKE_UTC_DAY}"
status: in-progress
confidence_score: 0.5
verification_status: pending
creation_method: ai
tags:
  - daily
---

# ${FAKE_UTC_DAY}

## Log


## Agent Log


## Reflections

`;

const validSourceFm = `---
pake_id: "550e8400-e29b-41d4-a716-446655440000"
pake_type: SourceNote
title: "Minimal"
created: "2026-04-02"
modified: "2026-04-02"
status: draft
confidence_score: 0.5
verification_status: pending
creation_method: ai
tags: []
---

# Body
`;

describe("mutation audit lines (Story 5.2)", () => {
  it("vaultCreateNote logs tool and omits raw body content", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-audit-mut-"));
    await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });

    // Credential-shaped placeholder (does not match bundled secret regexes; must not appear in audit file)
    const bodySecret =
      "client_secret_would_normally_live_here_7f3c9e2a1b4d8c6e5f0a1b2c3d4e5f6a7b8c9d0e1f2";
    await vaultCreateNote(
      vaultRoot,
      {
        title: "Audit Title",
        content: `# Hi\n\n${bodySecret}`,
        pake_type: "SourceNote",
        tags: [],
      },
      { surface: "vitest" },
    );

    // Entire agent-log.md UTF-8: catches leaks into any pipe field, not only JSON payload column
    const rawLog = await readFile(path.join(vaultRoot, "_meta", "logs", "agent-log.md"), "utf8");
    expect(rawLog).toContain("| vault_create_note |");
    expect(rawLog).toContain("| create |");
    expect(rawLog).toContain("SourceNote");
    expect(rawLog).toContain("Audit Title");
    expect(rawLog).not.toContain(bodySecret);
  });

  it("vaultUpdateFrontmatter logs keys only, not updated values", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-audit-ufm-"));
    await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
    const rel = "03-Resources/note.md";
    await writeFile(path.join(vaultRoot, rel), validSourceFm, "utf8");

    const hidden =
      "bearer_token_placeholder_a1b2c3d4e5f678901234567890abcdef0123456789abcdef012345";
    await vaultUpdateFrontmatter(vaultRoot, rel, { title: hidden }, { surface: "vitest" });

    const rawLog = await readFile(path.join(vaultRoot, "_meta", "logs", "agent-log.md"), "utf8");
    expect(rawLog).toContain("| vault_update_frontmatter |");
    expect(rawLog).toContain("updated_fields");
    expect(rawLog).toContain("title");
    expect(rawLog).not.toContain(hidden);
  });

  describe("vaultAppendDaily", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(`${FAKE_UTC_DAY}T12:00:00.000Z`));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("logs tool and omits appended markdown", async () => {
      const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-audit-daily-"));
      await mkdir(path.join(vaultRoot, "DailyNotes"), { recursive: true });
      const rel = `DailyNotes/${FAKE_UTC_DAY}.md`;
      await writeFile(path.join(vaultRoot, rel), validDailyFm, "utf8");

      const appendSecret =
        "refresh_token_simulation_9e8d7c6b5a4938271605fedcba9876543210fedcba9876543210fedc";
      await vaultAppendDaily(vaultRoot, { content: appendSecret, section: "Agent Log" }, { surface: "vitest" });

      const rawLog = await readFile(path.join(vaultRoot, "_meta", "logs", "agent-log.md"), "utf8");
      expect(rawLog).toContain("| vault_append_daily |");
      expect(rawLog).toContain("Agent Log");
      expect(rawLog).not.toContain(appendSecret);
    });
  });

  it("vaultLogAction returns logged_at aligned with log line timestamp", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-audit-log-action-"));
    await mkdir(path.join(vaultRoot, "_meta", "logs"), { recursive: true });

    const out = await vaultLogAction(
      vaultRoot,
      {
        action: "custom_op",
        tool_used: "operator_script",
        target_path: "03-Resources/x.md",
        details: "safe-details",
      },
      { surface: "vitest" },
    );

    expect(out.logged_at).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    const rawLog = await readFile(path.join(vaultRoot, "_meta", "logs", "agent-log.md"), "utf8");
    expect(rawLog).toContain(`[${out.logged_at}]`);
    expect(rawLog).toContain("| operator_script |");
    expect(rawLog).toContain("| custom_op |");
    expect(rawLog).toContain("safe-details");
  });
});
