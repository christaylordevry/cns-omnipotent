# HANDOFF — vault-lint remediation (fresh session)

**Purpose:** get the canonical vault's governed frontmatter back in order — fix the 13 lint errors. This is the **first real use of the gated vault-write path** stood up 2026-07-10. Read `reference_claude_desktop_vault_io_mcp_config` + `feedback_operate_as_elite_engineer_agi` in memory first.

## Roles for THIS task (operator-directed 2026-07-10)
**Cursor does the grunt work** (the governed frontmatter writes via its now-wired `cns_vault_io` MCP); **Claude Code verifies** (re-run lint, review `git diff`, confirm `Errors=0`, spot-check). Cursor now has full vault awareness + governed writes = at/above the Nexus-bot bar.

## Preconditions (verify at session start)
- **Cursor `cns_vault_io` wired to canonical** — added to `~/.cursor/mcp.json` 2026-07-10 (WSL node + `CNS_VAULT_ROOT=/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE`, dry-launch verified). **Requires a Cursor restart to load**; then Cursor may need the server enabled in its MCP settings. Confirm by having Cursor `vault_list "."` — expect the full 708-file vault incl `.git` (not the 35-file fixture).
- **Writes are governed + reviewable** — Cursor's own MCP tool-approval gates each call (operator approves in Cursor); WriteGate still blocks `AI-Context/`; PAKE Zod validates every write.
- **Rollback net** — canonical vault is a git repo, baseline commit **`227b490`**. Any bad write: `cd '/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE' && git diff` / `git checkout -- <file>`.

## Step 1 — re-run the lint (state may have drifted)
```bash
# WSL, from repo root; script points VAULT at canonical already
python3 - <<'PY'
g={}; exec(open("scripts/hermes-skill-examples/vault-lint/scripts/bulk_scan.py").read(), g)
for rel,errs,c,m in g['errors_r4']: print(rel, "->", ", ".join(errs))
PY
```
Baseline as of 2026-07-10: **145 scanned, 116 clean, 13 errors, 31 warnings** (R1 dup=0).

## Step 2 — fix the 13 errors (governed, gated, one at a time)
Use `vault_update_frontmatter` (each write prompts you). **Confirm the mapping with the operator before starting** — these are data-shape decisions:

| Error class | Count | Fix |
|---|---|---|
| `invalid_status: reference` | 7 | set `status: reviewed` (same call the 87-lane made for `stable→reviewed`; these are completed research/analysis notes) |
| `invalid_verification_status: unverified` | 5 | set `verification_status: pending` (valid enum: pending/verified/disputed; "unverified" ≈ pending) |
| missing `created` | 5 (overlap) | copy the note's own `modified` value into `created` (best on-disk proxy; git was just init'd so git dates are useless) |

Known offenders (2026-07-10 — re-confirm from Step 1):
- `reference` status: `03-Resources/AI-Native-Infrastructure/loop-engineering-anthropic-cns-gap-analysis.md`, `.../Research/{Cheap-Compute-Patterns-HF-Spaces-and-Self-Hosted-Inference, Hermes-Cost-Reduction-AI-Labs-vs-CNS-Setup, Hermes-Desktop-Tutorial-Wanderloots-vs-CNS, HyAtlas-Memory-vs-Honcho-Comparison, Mission-Control-Agent-Orchestration-Dashboard}.md`, `03-Resources/notebooklm-mcp-cli-gap-analysis.md`
- `unverified` status: `01-Projects/Brain - Central Nervous System Build/Hermes/Hermes-Agent-Wake-Agent-Multi-Profile-2026-06-Gap-Analysis.md`, `03-Resources/AI-Native-Infrastructure/{bmad-web-bundles-v680-analysis-and-adoption-plan, langchain-repo-analysis-and-cns-fit, metagpt-repo-analysis-and-cns-fit, stitch-mcp-and-agent-browser-analysis}.md`
- missing `created`: `02-Areas/Mission-Control-Evaluation-Task.md`, `03-Resources/Research/{Cheap-Compute-Patterns-HF-Spaces-and-Self-Hosted-Inference, HyAtlas-Memory-vs-Honcho-Comparison, Mission-Control-Agent-Orchestration-Dashboard}.md` (some overlap the `reference` set — one call can fix both fields)

Tip: notes with BOTH a bad `status` AND missing `created` (the Research ones) → fix in a single `vault_update_frontmatter` call with both keys.

## Step 3 — verify
Re-run Step 1's lint → **expect `Errors=0`**. Spot-check 1–2 fixed notes via `vault_read_frontmatter`. Then `git diff` in the vault to review exactly what changed before it's considered done.

## Separate / optional (do NOT bundle unless operator asks)
- **14 stale-pending** (`verification_status: pending` >14d, incl. `API-Keys-and-Credentials-Registry`, `North Star`, `rate-card-2026`) — triage: bulk → `verified` if effectively accepted, or leave. Operator decides.
- **9 orphans** (no inbound wikilinks) — low priority; link or ignore.
- **Vault line-ending normalization** — pre-existing `.gitattributes` + CRLF files cause phantom `git status` churn in the vault repo (no content change). One-time normalization pass if the noise annoys.

## Execution flow (Cursor grunt / Claude verify)
1. **Cursor** (paste-ready prompt below or a `/bmad-dev-story`): re-run the lint, confirm the mapping with the operator, then apply the fixes via `cns_vault_io.vault_update_frontmatter` — one call per note (fix both `status` + `created` in a single call where they overlap). Operator approves each in Cursor.
2. **Claude Code (me)**: after Cursor reports done, re-run `bulk_scan.py` (expect `Errors=0`), review the vault `git diff` against the mapping (no unintended fields changed, `modified` auto-bumped as expected), spot-check 1–2 notes via `vault_read_frontmatter`, and confirm rollback is available. Flag any deviation before it's called done.

Paste-ready Cursor prompt lives with the operator (repo `Omnipotent.md`, branch `hermes-consolidation`). The `git diff` in the canonical vault is the review surface — nothing is "done" until Claude Code has verified `Errors=0` and eyeballed the diff.
