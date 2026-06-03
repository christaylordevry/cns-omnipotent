import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { renderDiscordReply } from "../scripts/session-close/render-discord-reply.mjs";

describe("Story 59-1 render-discord-reply", () => {
  it("renders close-report summary without vault or AGENTS bodies", () => {
    const report = {
      mode: "real",
      failure_class: null,
      steps: {
        export: { status: "ok", message: "export complete" },
        fast_scan: { status: "ok", message: "fast-scan complete" },
        daily_rhythm: { status: "ok", message: "daily rhythm AUTO blocks updated" },
      },
      deterministic: {
        export_path: "/repo/scripts/output/vault-export-for-notebooklm.md",
        export_bytes: 1800000,
      },
      notebooklm_fanout_mode: "drive-sync",
      notebooklm_targets: [
        {
          notebook_id: "00000000-0000-4000-8000-000000000001",
          title: "My Knowledge Base",
          fanout_status: "ok",
        },
        {
          notebook_id: "00000000-0000-4000-8000-000000000002",
          title: "CNS Ops",
          fanout_status: "failed",
          error_class: "size_limit",
          export_bytes: 1900000,
        },
      ],
      nlm_auth: {
        status: "authenticated",
        reason: "ok",
        message: "nlm auth ok",
      },
    };

    const reply = renderDiscordReply(report);
    assert.match(reply, /^## Session close complete/);
    assert.match(reply, /\*\*mode:\*\* real/);
    assert.match(reply, /drive-sync — 1 ok, 1 failed \(size_limit\)/);
    assert.match(reply, /\*\*My Knowledge Base\*\*/);
    assert.match(reply, /error_class: size_limit/);
    assert.ok(!reply.includes("AGENTS.md"));
    assert.ok(!reply.includes("vault-export-for-notebooklm"));
  });

  it("surfaces phase B token ABORT without treating as section8 failure_class", () => {
    const reply = renderDiscordReply({
      mode: "real",
      failure_class: null,
      phase_b_token_check: { status: "ABORTED", tokens: 2000 },
      steps: {},
      notebooklm_targets: [],
    });
    assert.match(reply, /skipped \(phase B token ABORT\)/);
  });
});
