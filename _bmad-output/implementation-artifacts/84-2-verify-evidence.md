# Story 84-2 — Verify dry-run evidence (Decision 4a)

**Date:** 2026-07-06  
**Story:** `84-2-adversarial-verify-wiring`  
**Operator decision:** #1B — one Verify dry-run against 84-1 committed diff  
**Diff scope:** `git diff 3f5d4af..1d6d77e` (commit `1d6d77e`, 14 files, ~1400 insertions)

## 4a posture (locked)

Verify proven **once** via this dry-run. Capability is **dormant** after proof — documented in skill mirror, **not** wired to recurring schedule or cron. Paid review skills require explicit operator action on `unified-loop approve-build` handoff only.

---

## Invocation summary

| Order | Skill ID | Invocation path | Surface |
|-------|----------|-----------------|---------|
| 1 | `bmad-code-review` | `/bmad-code-review` — `Diff: branch changes` (`3f5d4af..1d6d77e`) | Cursor (dev-story session) |
| 2 | `bmad-review-adversarial-general` | Skill attached; content = 84-1 diff | Cursor (dev-story session) |
| 3 | `bmad-review-edge-case-hunter` | Skill attached; content = 84-1 diff | Cursor (dev-story session) |

**Diff command used:**

```bash
git diff 3f5d4af..1d6d77e
git show 1d6d77e --stat
```

**Protect-list audit (zero diffs expected):**

```bash
git diff --name-only 3f5d4af..1d6d77e -- \
  src/agents/synthesis-adapter-llm.ts \
  src/agents/hook-adapter-llm.ts \
  src/agents/boss-adapter-llm.ts \
  src/agents/run-chain.ts \
  scripts/run-chain.ts
```

**Result:** _(empty — AC1 satisfied for review scope)_

---

## Skill 1 — `bmad-code-review` output

**Triage summary (84-1 unified-loop shell diff):**

| Category | Count | Top items |
|----------|-------|-----------|
| **Must fix** | 2 | Hardcoded `DEFAULT_REPO_ROOT` in artifact writer; cron runner requires `.env.live-chain` without documented fallback for smoke-only installs |
| **Should fix** | 4 | SKILL.md version not bumped when behavior changes; contract tests don't assert artifact writer exit codes; install script lacks `--dry-run`; governance module still PENDING session-close |
| **Consider** | 3 | Duplicate trigger docs between task-prompt and trigger-pattern; `pickTopStory` uses `title` as storyKey; cron dummy schedule `0 0 1 1 *` easy to misread as yearly |
| **Nit** | 2 | Long line in task-prompt §3a bash block; evidence file path uses Windows vault default in multiple places |

**Structured findings:**

1. **[Must fix]** `write-discover-artifact.mjs` embeds operator-specific `DEFAULT_REPO_ROOT` — breaks portability for other checkouts unless `OMNIPOTENT_REPO` always set.
2. **[Must fix]** `run-unified-loop-discover-cron.sh` hard-fails without `.env.live-chain` — document in cron-snippet or allow test-only bypass.
3. **[Should fix]** Contract tests cover file existence but not `resolveDiscoverPaths()` with env overrides.
4. **[Should fix]** `buildDiscoverPayload` does not validate `items.length` against `COLLECTOR_ITEM_CAP` before write.
5. **[Should fix]** No test that cron runner exports `UNIFIED_LOOP_TRIGGER=cron:discover`.
6. **[Should fix]** Governance draft in 84-1 evidence still shows Verify as "Placeholder" — 84-2 session-close delta required.
7. **[Consider]** Trigger negative examples duplicated across three reference files — maintenance burden.
8. **[Consider]** `formatIso8601WithOffset` hand-rolled — acceptable for artifact but no unit test for DST edge.
9. **[Consider]** Install scripts use rsync without verifying Hermes CLI present.
10. **[Nit]** Story file frontmatter mixes YAML and markdown heading on same line in some artifacts.

---

## Skill 2 — `bmad-review-adversarial-general` output

Cynical Review findings (84-1 diff):

1. The artifact writer silently falls back to a single developer's absolute repo path — this will produce wrong `repoRoot` in discover.json on any machine that forgets one env var.
2. Discover cron aborts when gateway is down but leaves no retry or alerting hook — operator discovers stale artifacts days later.
3. Contract tests assert string presence in markdown but never execute the artifact writer against a temp home directory — "green tests, broken cron" is likely.
4. Task-prompt claims Discover is read-only yet the writer creates directories under `~/.hermes` — technically a write; not vault but contradicts "read-only" marketing in SKILL frontmatter tags.
5. Forbidden-action table lists seven rows but nothing verifies Hermes actually blocks those MCP calls — documentation theater until 84-3 E2E.
6. `pickTopStory` returns empty storyKey when items lack `title` — Build handoff (84-3) will get garbage without validation.
7. Cron install script references dummy schedule `0 0 1 1 *` — easy to assume "disabled" when Hermes still registers a job id file operators must manage.
8. No checksum or schema validation on discover.json after write — corrupt JSON possible on partial write / disk full.
9. Governance evidence draft path uses broken relative vault path in diff example — copy-paste footgun for session-close.
10. Fourteen files added in one commit with zero integration test that runs `write-discover-artifact.mjs` end-to-end from Hermes terminal() path.
11. Protect-list audit documented but not enforced in CI — regression could touch run-chain silently.
12. Skill version 1.0.0 shipped with "Build/Verify/Persist placeholders" while task-prompt already names future BMAD skills — version semver lies about capability.

---

## Skill 3 — `bmad-review-edge-case-hunter` output

```json
[
  {
    "location": "write-discover-artifact.mjs:30-35",
    "trigger_condition": "UNIFIED_LOOP_DISCOVER_ARTIFACT set to relative path",
    "guard_snippet": "if (!path.isAbsolute(override)) throw new Error('artifact path must be absolute');",
    "potential_consequence": "Artifact written outside intended Hermes home directory"
  },
  {
    "location": "write-discover-artifact.mjs:136-147",
    "trigger_condition": "collectInternalDevState throws or returns non-array",
    "guard_snippet": "if (!Array.isArray(items)) throw new TypeError('collector must return array');",
    "potential_consequence": "Malformed discover.json breaks Build stage reader"
  },
  {
    "location": "write-discover-artifact.mjs:61-66",
    "trigger_condition": "items array empty after collector run",
    "guard_snippet": "topPick fallback already exists; document empty-items operator message in task-prompt",
    "potential_consequence": "Operator approves Build with no ranked work item"
  },
  {
    "location": "run-unified-loop-discover-cron.sh:9-12",
    "trigger_condition": ".env.live-chain missing on fresh clone",
    "guard_snippet": "exit 1 with install doc link — already present; add cron-snippet troubleshooting row",
    "potential_consequence": "Silent cron failure until operator reads stderr log"
  },
  {
    "location": "run-unified-loop-discover-cron.sh:19-23",
    "trigger_condition": "Gateway stopped between status check and cron run",
    "guard_snippet": "retry gateway check or wrap hermes cron run with exit-code handling",
    "potential_consequence": "Discover skipped without Discord notification"
  },
  {
    "location": "run-unified-loop-discover-cron.sh:38-42",
    "trigger_condition": "JOB_ID file whitespace-only or corrupted",
    "guard_snippet": "validate JOB_ID format before hermes cron run",
    "potential_consequence": "hermes cron run fails with opaque CLI error"
  },
  {
    "location": "task-prompt.md:76-81",
    "trigger_condition": "OMNIPOTENT_REPO unset and DEFAULT_REPO_ROOT wrong machine",
    "guard_snippet": "writer should fail fast when repoRoot path missing collect-internal-dev-state.ts",
    "potential_consequence": "Terminal error after partial operator briefing expectation"
  },
  {
    "location": "install-unified-loop-discover-cron.sh:hunk",
    "trigger_condition": "crontab already contains duplicate cns-unified-loop-discover line",
    "guard_snippet": "idempotent install checks for existing tag before append",
    "potential_consequence": "Double Discover runs same schedule"
  },
  {
    "location": "write-discover-artifact.mjs:175-196",
    "trigger_condition": "CLI invoked without trigger argv and empty UNIFIED_LOOP_TRIGGER",
    "guard_snippet": "defaults to 'manual' — document in task-prompt artifact trigger field",
    "potential_consequence": "Mislabeled trigger in discover.json audit trail"
  },
  {
    "location": "tests/hermes-unified-loop-skill.test.mjs:hunk",
    "trigger_condition": "Reference file renamed without updating test paths",
    "guard_snippet": "tests only check existence — add verify-handoff path in 84-2 extension",
    "potential_consequence": "Verify wiring regression undetected until manual Hermes run"
  }
]
```

---

## AC5 checklist

| Requirement | Evidence |
|-------------|----------|
| Evidence doc exists | This file |
| All three skills invoked | Sections above with real outputs |
| Diff scope 84-1 (`1d6d77e`) | Invocation summary + git commands |
| 4a dormant posture recorded | Header + skill mirror docs |
| Protect-list clean on review scope | Empty protect-list diff |

---

## Governance delta — Verify section (session-close WriteGate)

**Status:** Draft for session-close apply — **NOT** direct vault edit (NFR-GOV-1)

Apply delta to `AI-Context/modules/unified-loop.md` via `/session-close` (both vault copies identical per AGENTS.md sync rule):

```markdown
## Verify stage (Story 84-2)

**Trigger:** Only within `unified-loop approve-build` path — **never** on Discover, cron, or `unified-loop cron:discover`.

**Composition (exact skill IDs, operator-run in IDE):**

1. `bmad-code-review` — structured adversarial triage
2. `bmad-review-adversarial-general` — Cynical Review findings
3. `bmad-review-edge-case-hunter` — JSON edge-case report

Hermes **STOPs** after Build placeholder ack and posts Verify handoff (`references/verify-handoff.md`). No inline Hermes review. No CLI wrapper.

**Cost posture (4a):** One prove-once dry-run (`84-2-verify-evidence.md`); capability **dormant** afterward — not on recurring schedule or WSL cron tag `cns-unified-loop-discover`.

**Stage table update:**

| Stage | Status after 84-2 |
|-------|-------------------|
| Verify | Documented + handoff (84-2) |
| Build | Placeholder (84-3) |
| Persist | Placeholder (84-3) |
```

### Post-apply `diff -q` (fill after session-close)

```bash
diff -q \
  /mnt/c/Users/Christopher\ Taylor/Knowledge-Vault-ACTIVE/AI-Context/modules/unified-loop.md \
  specs/cns-vault-contract/../../../Knowledge-Vault-ACTIVE/AI-Context/modules/unified-loop.md
```

**Result:** _PENDING session-close apply_

---

## References

- Handoff SSOT: `scripts/hermes-skill-examples/unified-loop/references/verify-handoff.md`
- Story 84-2: `_bmad-output/implementation-artifacts/84-2-adversarial-verify-wiring.md`
- 84-1 evidence pattern: `_bmad-output/implementation-artifacts/84-1-governance-evidence.md`
- DDR: `_bmad-output/planning-artifacts/ddr-e84-001-unified-loop.md`
