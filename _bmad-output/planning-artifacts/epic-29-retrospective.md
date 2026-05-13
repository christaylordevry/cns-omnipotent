# Epic 29 retrospective — Knowledge Quality + Agent Memory

**Epic:** 29 — Knowledge Quality + Agent Memory  
**Phase:** 6 (first epic)  
**Sprint tracker:** `_bmad-output/implementation-artifacts/sprint-status.yaml` (all keys `29-0` … `29-10` and story rows marked **done** at retrospective time)  
**Story records:** `_bmad-output/implementation-artifacts/29-*-*.md` (29-0 through 29-10)  
**Planning source:** `_bmad-output/planning-artifacts/epic-29-knowledge-quality-agent-memory-brief-and-story-cards.md`

---

## Facilitation excerpt (psychological safety, systems focus)

Bob (Scrum Master): "Epic 29 is closed on the board: eleven stories, one theme: memory that stays cheap, quality that stays honest, and cognition that stays on-demand."

Alice (Product Owner): "We shipped bounded cold-start memory, lint without auto-fix risk, and a disambiguation escape hatch. That is a coherent product story, not a grab bag."

Charlie (Senior Dev): "The recurring engineering lesson is write-class boundaries: operator filesystem for MEMORY, fast-scan, lint reports, versus WriteGate for governed PAKE notes. We kept that discipline."

Dana (QA Engineer): "29-3 is a manual gate by design. I am comfortable calling that out: the value is operator-attested cold-start behavior, not another green CI tile pretending to be Hermes."

---

## Epic completion snapshot

| Story | Title | What shipped (summary) |
|-------|--------|-------------------------|
| **29-0** | Token audit + MCP always-on cleanup | Read-only baseline: cold-start ordering, caps, MCP inventory, always-on vs session-enabled recommendations; artifact `29-0-token-audit-and-mcp-always-on-cleanup.audit.md`. No production mutations in-story. |
| **29-1** | USER.md — write and wire operator identity | Canonical `AI-Context/USER.md` (LF, under 1,200 characters), Hermes `~/.hermes/memories/USER.md` symlink to vault; scope guard: no MEMORY or AGENTS edits in-story. |
| **29-2** | MEMORY.md schema + session-close integration | Deterministic Step 6.5: full overwrite of canonical `MEMORY.md` from `sprint-status.yaml` + AGENTS §8 slices; `< 2,000` characters; dry-run skips write; live + repo session-close mirrors updated; Operator Guide updated for new behavior. |
| **29-3** | Cold-start verification | Manual verification record: fresh gateway, SOUL.md hygiene, prompts for epic state and gateway procedure answered without re-orientation; PASS. |
| **29-4** | Vault lint rules spec | Normative four-rule spec (duplicate `source_uri`, orphans, stale pending >14 days, PAKE frontmatter), Discord + `_meta/reports/` templates, machine JSON; module `specs/cns-vault-contract/modules/vault-lint.md`. Spec-only. |
| **29-5** | `/vault-lint` Hermes skill | Read-only Vault IO scan, spec-exact Discord post, on-disk report via operator FS; `#hermes` binding; repo mirror under `scripts/hermes-skill-examples/vault-lint/`. |
| **29-6** | Dedup guard at ingest time | MCP `vault_create_note` pre-flight aligned with `src/ingest/duplicate.ts`; normalized URI comparison (trailing slash, `http`→`https`); warning JSON on duplicate without write or create audit; tests + Operator Guide note. |
| **29-7** | CLAUDE.md shim + token budget in AGENTS | Deploy shim updated (tool count trajectory, Epic 29 summary, vault-lint link); **§6.5 Token Budget Policy** in constitution; version/changelog; dual-synced AGENTS mirrors; verify gate green. |
| **29-8** | `vault_request_disambiguation` | New MCP tool: Discord poll, JSON choice or timeout; no vault mutations, no audit; constitution and specs bumped (e.g. v1.9.8); tool surface at 10. |
| **29-9** | Fast-scan index + session-close | `vault-fast-scan-index.md` generator, Step 6.6, token cap `ceil(chars/4) ≤ 2000`, row cap logic; constitution §9 grounding; `npm run vault:fast-scan`; Operator Guide. |
| **29-10** | Hermes thinking commands (`vault-think`) | On-demand `/challenge`, `/emerge`, `/ideas` (read-only `vault_search` + `vault_read`); v1.1 stubs documented; channel bindings; zero always-on reference from AGENTS/session-close; Operator Guide §15.6. |

**Normative corrections vs early epic brief text:** Vault lint on-disk path shipped as **`_meta/reports/vault-lint-YYYY-MM-DD.md`** (29-4 authority), not the older `_meta/logs/` wording still present in one epic success-criteria line. Treat the spec module and story 29-4 as source of truth.

---

## Token efficiency principle — carry forward for future epics

Epic 29 elevated **token efficiency** from preference to **acceptance criteria** wherever context is injected. The standing constraint from planning (and reinforced in implementation) is:

1. **Testable budgets:** Every story that adds or regenerates cold-start or injected context must state measurable limits (characters, Hermes caps, or explicit token proxies such as `ceil(utf16_length / 4)` for the fast-scan index).
2. **On-demand by default:** Hermes skills that add cognition (`vault-lint`, `vault-think`) load via channel bindings, not via always-on AGENTS or session-close preamble, unless the operator explicitly opts in elsewhere.
3. **Progressive disclosure:** Prefer compact indexes (`vault-fast-scan-index.md`) and bounded MEMORY over full vault scans or large static blocks in every turn.
4. **MCP surface discipline:** 29-0 classified always-on vs session-enabled MCP servers; future epics should treat that classification as a **design review input**, not optional hygiene.

**Institutionalization:** Constitution **§6.5 Token Budget Policy** (29-7) and §9 session-start guidance (29-9) encode this for agents reading `AGENTS.md`. Future epics should extend §6.5 or add module rows if new always-on artifacts appear, rather than silently growing prompts.

---

## Known limitation: cross-device symlink posture for MEMORY.md (non-blocking)

**Observation:** Hermes loads `MEMORY.md` and `USER.md` from **`~/.hermes/memories/`** via **machine-local symlinks** into the canonical vault path (WSL example: `/mnt/c/Users/.../Knowledge-Vault-ACTIVE/AI-Context/MEMORY.md`).

**Implication:** Obsidian sync or mobile read stacks give **file replication and editor access**, not automatic replication of **Hermes `MemoryStore` wiring**. Another machine, a fresh WSL profile, or mobile-only workflows do not inherit the same cold-start memory injection unless the operator reproduces symlink + config parity.

**Posture:** Documented as **known and non-blocking** for Phase 6: the primary operator path is the configured Hermes gateway on the workstation where symlinks and `memory_enabled` are set. Phase 2 mobile journey (Tailscale + Blink, constitution pointers) remains the right place to revisit if “memory everywhere” becomes a requirement rather than “memory on the Hermes host.”

---

## Obsidian Local REST API — prerequisite for `/trace` and `/connect` activation

Story **29-10** shipped **`vault-think`** with v1.0 commands and **v1.1 stubs** in `SKILL.md` and `references/task-prompt.md`.

- **`/trace` and `/connect`** are explicitly **not-yet-active** at v1.0.
- **`/connect`** is documented as depending on the **Obsidian Local REST API** for graph-style operations that Vault IO MCP v1.0 does not expose; until that API is available and governed, the command remains a stub.

**Retro takeaway:** Epic 30 and later work that needs graph-native or Obsidian-plugin-adjacent behavior should treat **Local REST** (or an approved alternative) as an explicit **spike or dependency story**, not an implied stretch goal inside a thinking-command follow-up.

---

## Next epic: Epic 30 — Research Pipeline Auto-Synthesis (pre-scoped)

From `_bmad-output/planning-artifacts/epic-29-knowledge-quality-agent-memory-brief-and-story-cards.md`:

- **Theme:** Research Pipeline Auto-Synthesis.  
- **Trigger model (planning level):** Approval-time trigger.  
- **Target locus:** `03-Resources/` notes with **`verification_status: pending`**.  
- **Status:** Pre-scoped only; explicitly **out of scope** for Epic 29 delivery.

**Dependencies Epic 29 leaves ready:** bounded operator memory, fast-scan orientation, ingest dedup at `vault_create_note`, vault lint reporting, disambiguation tool, and read-only thinking commands. Epic 30 can assume **quality signals and operator approval hooks** exist; it should still define its own WriteGate and audit posture before any automated synthesis writes.

---

## Strengths (what worked well)

- **Clear write-class taxonomy:** Operator FS for MEMORY, fast-scan, lint reports vs MCP mutators for governed notes reduced constitution and security ambiguity.
- **Spec-before-implement for lint:** 29-4 as a spec-only story gave 29-5 a straight implementation line.
- **MCP-layer dedup:** Closing the `vault_create_note` bypass (29-6) fixed a real multi-caller gap vs pipeline-only dedup.
- **Manual cold-start gate (29-3):** Honest about what CI cannot prove for Hermes.
- **Disambiguation (29-8):** Surfaces operator choice without mutating vault or audit, matching trust goals.

---

## Challenges and growth areas (no blame)

- **Hermes-adjacent verification cost:** Cold-start proof remains operator-heavy; if regression sensitivity increases, consider small automated checks that do **not** pretend to replace 29-3 (for example, static checks on session-close prompt ordering) as a separate story class.
- **Documentation drift:** Keep epic brief success criteria aligned with superseded paths (`_meta/reports` vs `_meta/logs`) when copying forward to Epic 30 planning.
- **Story header vs board:** Ensure story file `Status` headers stay aligned with `sprint-status.yaml` during closeout to avoid confusion for the next dev agent.

---

## Continuity from Epic 28

Epic 28 delivered session-close automation, NotebookLM in Hermes, and `#general` capture. Epic 29 **built on** that closure loop by adding MEMORY regeneration, fast-scan, and token policy without forking a second session-close product. No separate `epic-28-retro-*.md` was loaded for line-by-line action follow-up; continuity is assessed from shipped 28-1–28-3 themes reflected in 29-2, 29-9, and Operator Guide updates.

---

## Action items (SMART, no duration predictions)

| # | Action | Owner | Success criteria |
|---|--------|--------|------------------|
| 1 | Confirm `sprint-status.yaml` shows `epic-29: done` and `epic-29-retrospective: done` after merge (updated with this retrospective closeout) | Operator / SM | Keys present; no accidental regression to `in-progress` |
| 2 | When scoping Epic 30, add an explicit dependency row for any Obsidian Local REST or graph work if `/connect` or `/trace` are in scope | PM / Architect | Epic 30 story cards name prerequisites and failure modes |
| 3 | Optional: one-line note in Operator Guide or mobile module on **Hermes memory symlink locality** if operators report cross-device confusion | Tech writer / Operator | Doc PR reviewed; no change to WriteGate |
| 4 | Align epic brief “success criteria” lint path wording with `vault-lint.md` on next edit | SM | Single canonical path string in planning artifacts |

---

## Significant discovery assessment (impact on Epic 30)

No finding from Epic 29 **invalidates** the pre-scoped Epic 30 direction. The main **forward** signals are: (a) approval-gated synthesis fits the existing `verification_status` vocabulary; (b) quality tooling (lint, dedup) should be consulted before bulk synthesis jobs; (c) token policy should cap any new “always-on” synthesis summaries if they are injected into AGENTS or MEMORY.

---

## Readiness statement

Epic 29 is **complete** relative to story acceptance: verify gates were run where required by stories; 29-3 is intentionally a **manual** cold-start certificate. Epic 30 may proceed from planning when the operator promotes it from pre-scoped to active, with prerequisites above captured in story cards.

---

## References

- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/29-0-token-audit-and-mcp-always-on-cleanup.md` (+ `.audit.md`)
- `_bmad-output/implementation-artifacts/29-1-user-md-write-and-wire-operator-identity.md`
- `_bmad-output/implementation-artifacts/29-2-memory-md-schema-and-session-close-integration.md`
- `_bmad-output/implementation-artifacts/29-3-cold-start-verification.md`
- `_bmad-output/implementation-artifacts/29-4-vault-lint-rules-spec-and-output-format.md`
- `_bmad-output/implementation-artifacts/29-5-vault-lint-hermes-skill-and-vault-log-write.md`
- `_bmad-output/implementation-artifacts/29-6-dedup-guard-at-ingest-time.md`
- `_bmad-output/implementation-artifacts/29-7-claude-md-shim-update-and-token-budget-policy-in-agents-md.md`
- `_bmad-output/implementation-artifacts/29-8-vault-request-disambiguation-mcp-tool.md`
- `_bmad-output/implementation-artifacts/29-9-fast-scan-index-and-session-close-integration.md`
- `_bmad-output/implementation-artifacts/29-10-hermes-thinking-commands.md`
- `_bmad-output/planning-artifacts/epic-29-knowledge-quality-agent-memory-brief-and-story-cards.md`
