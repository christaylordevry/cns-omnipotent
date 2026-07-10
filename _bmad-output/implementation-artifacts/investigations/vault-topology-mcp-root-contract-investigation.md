# Investigation: Vault Topology and MCP Root Contract

## Hand-off Brief

1. **What happened.** Confirmed: Vault IO resolves its root from the MCP process environment, Hermes points `cns_vault_io` at the canonical Windows vault, and repo tests intentionally read the in-repo `Knowledge-Vault-ACTIVE/` tree as a fixture; user-provided session evidence says a Claude Code governed write landed in the repo fixture instead of canonical.
2. **Where the case stands.** Proposed decision, stopped before edits: Claude Code and Cursor Vault IO MCPs should point `CNS_VAULT_ROOT` at the canonical runtime vault for operator/live vault sessions; the repo tree should be documented as a frozen CI fixture unless a test story deliberately updates it.
3. **What's needed next.** Create an operator-direct contract update in the spec README plus the repo `CLAUDE.md` pointer so future agents can distinguish live vault writes from fixture-backed tests before using mutators.

## Case Info

| Field | Value |
| --- | --- |
| Ticket | N/A |
| Date opened | 2026-07-10 |
| Status | Proposed, stopped before implementation |
| System | WSL2 repo root `/home/christ/ai-factory/projects/Omnipotent.md`; branch reported by user as `hermes-consolidation` |
| Evidence sources | `src/config.ts`, `src/write-gate.ts`, named Hermes skill tests, `specs/cns-vault-contract/README.md`, `CLAUDE.md`, `~/.hermes/config.yaml`, `~/.cursor/mcp.json`, `~/.claude.json`, `claude mcp list`, repo and canonical `Vault-Intelligence-Discovery-Workflow.md` |

## Problem Statement

The operator needs a decision, not an implementation: governed writes from a Claude Code session hit the repo `Knowledge-Vault-ACTIVE/` CI fixture instead of the live canonical vault, silently. The investigation must recommend what Claude Code and Cursor Vault IO MCP roots should point at, define whether the repo fixture should drift or sync, and propose a repo-visible contract location. No code or config changes were made.

## Evidence Inventory

| Source | Status | Notes |
| --- | --- | --- |
| `src/config.ts` | Available | Confirms stdio `loadRuntimeConfig()` is env-only for vault root and reads `CNS_VAULT_ROOT` from process env. |
| `src/write-gate.ts` | Available | Confirms WriteGate protects paths under the configured vault root but does not distinguish canonical vs fixture roots. |
| `~/.hermes/config.yaml` | Available | Confirms Hermes `mcp_servers.cns_vault_io.env.CNS_VAULT_ROOT` points at `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE`. |
| `~/.cursor/mcp.json` | Available | Visible Cursor user MCP config has no `cns_vault_io` entry, so Cursor Vault IO root is not currently located there. |
| `~/.claude.json` and `claude mcp list` | Partial | Visible Claude global MCP config and active MCP list show no `cns_vault_io` in this repo context; exact prior Claude Code fixture-root configuration was not visible from these sources. |
| Named Hermes skill tests | Available | Confirm several tests hard-code repo-root fixture paths under `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`. |
| Folder contract and fast-scan tests | Available | Confirm the repo fixture is used as a mock vault root and must continue to exist for verify coverage. |
| Repo vs canonical `Vault-Intelligence-Discovery-Workflow.md` | Available | Confirms a known fixture/canonical drift: repo copy still has `status: stable` and unquoted dates while canonical has `status: reviewed` and quoted dates. |
| Existing spec README | Available | Already documents env-only `CNS_VAULT_ROOT`, but does not strongly separate canonical runtime root from repo CI fixture. |

## Investigation Backlog

| # | Path to Explore | Priority | Status | Notes |
| - | --- | --- | --- | --- |
| 1 | Decide live-session `CNS_VAULT_ROOT` target | High | Done | Recommendation below: canonical for Claude Code/Cursor operator sessions. |
| 2 | Decide fixture drift policy | High | Done | Recommendation below: frozen fixture, updated only by deliberate test-fixture stories. |
| 3 | Locate active Claude Code fixture-root MCP config | Medium | Blocked on evidence | Current `claude mcp list` did not expose `cns_vault_io`; prior session may have used a different project/scope or generated per-session config. |
| 4 | Write contract patch | High | Open | Out of scope for this propose-then-stop investigation. |

## Timeline of Events

| Time | Event | Source | Confidence |
| --- | --- | --- | --- |
| 2026-07-10 session | User reports a governed `vault_update_frontmatter` write landed in repo fixture, not canonical. | User-provided established fact | Confirmed for this case by instruction |
| 2026-07-10 investigation | Hermes config shows `cns_vault_io` pointed at canonical vault. | `~/.hermes/config.yaml:723` to `~/.hermes/config.yaml:731` | Confirmed |
| 2026-07-10 investigation | Cursor user MCP config has no visible `cns_vault_io`. | `~/.cursor/mcp.json:1` to `~/.cursor/mcp.json:70` | Confirmed |
| 2026-07-10 investigation | Claude Code active MCP list in repo context has no `cns_vault_io`. | `claude mcp list` read-only command output | Confirmed |
| 2026-07-10 investigation | Repo fixture and canonical `Vault-Intelligence-Discovery-Workflow.md` differ in frontmatter status/date formatting. | `Knowledge-Vault-ACTIVE/03-Resources/Vault-Intelligence-Discovery-Workflow.md:1` to `Knowledge-Vault-ACTIVE/03-Resources/Vault-Intelligence-Discovery-Workflow.md:17`; canonical file lines 1 to 17 | Confirmed |

## Confirmed Findings

### Finding 1: Vault IO stdio root is environment-only

**Evidence:** `src/config.ts:21` to `src/config.ts:24`, `src/config.ts:79` to `src/config.ts:83`

**Detail:** The stdio entrypoint calls `loadRuntimeConfig()` with no host root. The effective vault root is the trimmed `CNS_VAULT_ROOT` env var, falling back only to `vaultRootFromHost` for programmatic/test embedding. This means client MCP configuration controls write destination completely.

### Finding 2: WriteGate protects whichever root was configured, not whether it is canonical

**Evidence:** `src/write-gate.ts:124` to `src/write-gate.ts:142`, `src/write-gate.ts:163` to `src/write-gate.ts:177`

**Detail:** The gate resolves the configured root, checks path containment and protected subtrees, then allows or denies operations. A write under repo `Knowledge-Vault-ACTIVE/` can be fully governed relative to that root while still being wrong for live-vault intent.

### Finding 3: Hermes uses canonical vault for Vault IO MCP

**Evidence:** `~/.hermes/config.yaml:723` to `~/.hermes/config.yaml:731`

**Detail:** Hermes registers `cns_vault_io` with command `node`, args pointing at this repo's `dist/index.js`, and env `CNS_VAULT_ROOT: /mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE`.

### Finding 4: Visible Cursor config does not currently define Vault IO

**Evidence:** `~/.cursor/mcp.json:1` to `~/.cursor/mcp.json:70`

**Detail:** The visible Cursor user MCP config defines Context7, Firecrawl, Perplexity, Apify, Playwright, NotebookLM, Stitch, Scrapling, and Scrape Creators, but not `cns_vault_io`. If Cursor should use Vault IO for live vault operations, it needs an explicit stdio MCP entry with canonical `CNS_VAULT_ROOT`.

### Finding 5: Visible Claude Code config/list does not expose the prior fixture-root Vault IO entry

**Evidence:** `~/.claude.json:1148` to `~/.claude.json:1190`; read-only `claude mcp list` output during this investigation

**Detail:** The global Claude Code MCP config visible at the time of investigation lists no `cns_vault_io`, and `claude mcp list` in the repo context lists no Vault IO server. The prior fixture write is therefore not attributable to the visible active config in this repo context; it may have come from a different Claude Code project scope, an older config, a per-session MCP registration, or another host-specific layer not surfaced by the current command.

### Finding 6: The repo `Knowledge-Vault-ACTIVE/` tree is an intentional CI fixture

**Evidence:** `tests/hermes-triage-skill.test.mjs:7` to `tests/hermes-triage-skill.test.mjs:12`, `tests/hermes-session-close-skill.test.mjs:10` to `tests/hermes-session-close-skill.test.mjs:21`, `tests/hermes-url-auto-capture-inbox-skill.test.mjs:7` to `tests/hermes-url-auto-capture-inbox-skill.test.mjs:12`, `tests/folder-contract-manifests.test.mjs:7` to `tests/folder-contract-manifests.test.mjs:15`, `tests/vault-fast-scan-index.test.mjs:8` to `tests/vault-fast-scan-index.test.mjs:21`

**Detail:** Tests explicitly join repo root with `Knowledge-Vault-ACTIVE` and validate manifests, operator guide text, and fast-scan behavior. This tree must not be deleted or globally replaced with a symlink to canonical without redesigning tests.

### Finding 7: Existing spec README contains a partial MCP root contract

**Evidence:** `specs/cns-vault-contract/README.md:63` to `specs/cns-vault-contract/README.md:68`, `specs/cns-vault-contract/README.md:83` to `specs/cns-vault-contract/README.md:95`

**Detail:** The README already says Cursor and Claude Code should set `CNS_VAULT_ROOT` in the MCP env block, but it uses generic "your vault root" language. It does not add an explicit guard that repo `./Knowledge-Vault-ACTIVE` is a CI fixture, not the live write target.

## Deduced Conclusions

### Deduction 1: Live Claude Code and Cursor Vault IO MCPs should point at canonical

**Based on:** Findings 1, 2, 3, and user-established fact that canonical is runtime truth.

**Reasoning:** Vault IO has no independent canonical-vs-fixture discriminator. Hermes already writes to canonical. Therefore, any Claude Code or Cursor session expected to perform governed live vault writes must configure the MCP process env to the same canonical root. Pointing at fixture is valid only for tests or fixture-maintenance work, because WriteGate will otherwise faithfully govern writes into the wrong tree.

**Conclusion:** Recommended setting for operator/live sessions:

```yaml
CNS_VAULT_ROOT: /mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE
```

Fixture-root MCP config should be opt-in and named/test-scoped, not the default `cns_vault_io` surface for human operator work.

### Deduction 2: The repo fixture should be frozen, not continuously synced to canonical

**Based on:** Findings 6 and 7 plus user-established fact that canonical contains dozens more files than fixture.

**Reasoning:** The tests assert specific seed content and skeleton behavior. Continuous sync would either bloat the repo fixture toward a live corpus snapshot or force tests to chase canonical churn. The safer contract is that fixture files are deliberately small, stable test inputs. Drift from canonical is expected unless a test fixture story says otherwise.

**Conclusion:** Treat repo `Knowledge-Vault-ACTIVE/` as a frozen CI fixture. Keep it small and intentional. Update fixture seed notes only when test expectations need to change.

### Deduction 3: `Vault-Intelligence-Discovery-Workflow.md` should remain frozen unless fixture tests need PAKE-valid status

**Based on:** Finding 6 and the direct frontmatter comparison.

**Reasoning:** If the fixture is frozen, its drift from canonical is not itself a defect. However, known stale PAKE frontmatter can confuse future investigations, especially because the canonical file has already moved to `status: reviewed`.

**Conclusion:** Freeze by policy, but document this specific file as stale fixture content. Only fix it in the repo fixture if a test, lint gate, or explicit fixture hygiene story requires PAKE-valid seed notes.

### Deduction 4: The contract belongs first in `specs/cns-vault-contract/README.md`, with a short pointer in `CLAUDE.md`

**Based on:** Finding 7 and current repo rules.

**Reasoning:** The spec README already owns Vault IO MCP root setup and Cursor/Claude grounding parity. It is the narrowest repo-visible place for the complete contract. Root `CLAUDE.md` is always read in implementation-repo sessions and currently says `Knowledge-Vault-ACTIVE/` is source of truth, which is ambiguous in this topology because the repo has a fixture by that name.

**Conclusion:** Add the normative client-root matrix to `specs/cns-vault-contract/README.md`. Add a concise implementation-repo guardrail to root `CLAUDE.md`: repo `Knowledge-Vault-ACTIVE/` is a CI fixture; live governed Vault IO writes must use canonical unless the task is explicitly fixture maintenance. Do not put the full matrix only in `AGENTS.md`, because this is operator/client setup policy and `AGENTS.md` edits are constitution/operator-direct.

## Hypothesized Paths

### Hypothesis 1: The prior Claude Code session used a project-scoped or transient Vault IO MCP registration pointed at repo fixture

**Status:** Open

**Theory:** The fixture write came from a Claude Code MCP registration outside visible global `~/.claude.json` and not listed by `claude mcp list` in the current repo context, or from a now-removed/older config.

**Supporting indicators:** User-established fact says the write occurred; current visible config does not show the active root.

**Would confirm:** A `claude mcp list` or config dump from the exact session/project/scope that includes `cns_vault_io` with `CNS_VAULT_ROOT=/home/christ/ai-factory/projects/Omnipotent.md/Knowledge-Vault-ACTIVE`.

**Would refute:** Proof that the write was performed by a direct script/tool invocation rather than an MCP server process.

**Resolution:** Open; not needed to make the policy recommendation because env-only root behavior is already confirmed.

## Missing Evidence

| Gap | Impact | How to Obtain |
| --- | --- | --- |
| Exact Claude Code config layer that routed the prior write to repo fixture | Would identify the single config file/command to change | Run `claude mcp list` and any relevant `claude mcp get` equivalent in the exact workspace/session where Vault IO tools appear, or inspect Claude Code project-scope MCP configuration if exposed by the CLI. |
| Cursor Vault IO registration location, if any exists outside `~/.cursor/mcp.json` | Would let the contract point to the exact Cursor config file to edit | Use Cursor MCP settings UI or inspect profile/project MCP storage for a `cns_vault_io` entry. Visible `~/.cursor/mcp.json` has none. |
| Whether fixture lint should reject stale `status: stable` seed notes | Determines whether to freeze `Vault-Intelligence-Discovery-Workflow.md` exactly as-is or repair it as fixture hygiene | Check current `verify.sh` / vault-lint behavior after the proposed contract story, without changing fixture content in this investigation. |

## Source Code Trace

| Element | Detail |
| --- | --- |
| Root origin | `src/config.ts:79` to `src/config.ts:83`, `CNS_VAULT_ROOT` read from MCP process env |
| Trigger | Any Vault IO MCP stdio process launched by Hermes, Cursor, Claude Code, or another host |
| Condition | If the host sets `CNS_VAULT_ROOT` to repo `./Knowledge-Vault-ACTIVE`, governed mutators write to fixture; if set to `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE`, they write to canonical |
| Related files | `src/write-gate.ts`, `specs/cns-vault-contract/README.md`, `CLAUDE.md`, named Hermes skill tests |

## Conclusion

**Confidence:** Medium

The correct default for Claude Code and Cursor Vault IO MCP in operator/live vault sessions is the canonical vault root, matching Hermes: `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE`. The repo `Knowledge-Vault-ACTIVE/` tree is an intentional CI fixture and should not be deleted, symlinked to canonical, or treated as the live vault. The only uncertainty is the exact prior Claude Code config layer that caused the fixture write; the policy recommendation does not depend on that because `src/config.ts` confirms the MCP root is entirely client-env-driven.

## Recommended Next Steps

### Fix direction

Create a small operator-direct documentation story, no runtime code change:

1. Update `specs/cns-vault-contract/README.md` under `Vault IO MCP: vault root (Phase 1)` with a client-root matrix:
   - Hermes `~/.hermes/config.yaml`: `mcp_servers.cns_vault_io.env.CNS_VAULT_ROOT` must be canonical.
   - Claude Code live vault sessions: configure `cns_vault_io` env `CNS_VAULT_ROOT` to canonical.
   - Cursor live vault sessions: configure `cns_vault_io` env `CNS_VAULT_ROOT` to canonical.
   - Tests/fixture maintenance only: may set root to repo `./Knowledge-Vault-ACTIVE`, ideally under an explicit test-scoped server name.
2. Update `specs/cns-vault-contract/README.md` under `Vault folder contract manifests` to say repo `Knowledge-Vault-ACTIVE/` is a frozen CI fixture and operator reference, not a live mirror of canonical.
3. Add a short root `CLAUDE.md` guardrail near System Context or Key References: implementation-repo `Knowledge-Vault-ACTIVE/` is fixture; live governed vault writes must target canonical unless explicitly maintaining fixture tests.
4. Do not change `src/config.ts` or WriteGate for this decision unless later adding an optional startup warning when the root path looks like the repo fixture.

### Diagnostic

Before applying docs, capture the exact current Claude Code and Cursor Vault IO registrations, if present, so the operator can update the right profile/scope. The current investigation found no visible Vault IO entry in `~/.cursor/mcp.json`, `~/.claude.json` global MCP servers, or `claude mcp list` from the repo context.

## Reproduction Plan

1. Start the Vault IO MCP server with `CNS_VAULT_ROOT=/home/christ/ai-factory/projects/Omnipotent.md/Knowledge-Vault-ACTIVE`.
2. Run a governed mutator against a safe fixture path.
3. Observe the write lands under repo `Knowledge-Vault-ACTIVE/`.
4. Start the same server with `CNS_VAULT_ROOT=/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE`.
5. Run the same class of governed mutator against a safe canonical test target.
6. Observe the write lands under canonical while the same WriteGate policy applies.

## Side Findings

- Confirmed: `CLAUDE.md:10` currently says `Knowledge-Vault-ACTIVE/` is source of truth, which is ambiguous inside the implementation repo because that path exists as a fixture.
- Confirmed: `specs/cns-vault-contract/README.md:40` already calls the repo tree a "deployable mock vault tree", but "mock" is not carried into the MCP root instructions at lines 63 to 95.
- Confirmed: The repo fixture `Vault-Intelligence-Discovery-Workflow.md` still has `status: stable`, while canonical has `status: reviewed`; this is acceptable only if the fixture-freeze policy is documented.
