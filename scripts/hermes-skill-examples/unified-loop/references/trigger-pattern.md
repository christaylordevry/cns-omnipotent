# Trigger pattern: `unified-loop` (Story 84-1 / 84-2 / 84-3)

## Surfaces

- **Discord `#hermes`** — explicit line-1 tokens (operator binding in `~/.hermes/config.yaml`; see `config-snippet.md`)
- **Hermes Desktop** — same triggers
- **WSL cron** — Discover-only via `scripts/run-unified-loop-discover-cron.sh` (not Discord text)

## Canonical manual trigger grammar (case-sensitive)

After trimming leading/trailing whitespace, the **first non-empty line** is the trigger line. Prefer **single-line** Discord messages for manual triggers.

| Trigger line | Path | Autonomous? |
|--------------|------|-------------|
| `unified-loop` | Discover then **pause** at gate | Partial |
| `unified-loop cron:discover` | Discover-only (manual smoke of cron label) | Yes (read-only) |
| `unified-loop approve-build` | Build handoff only → await `build-complete` | No |
| `unified-loop approve-build <token>` | Same; optional single token e.g. `story:84-3` | No |
| `unified-loop build-complete` | Verify handoff only (Build done) | No |
| `unified-loop build-complete <token>` | Same; optional token e.g. `worktree:branch-name` | No |

### Case rule

- Tokens are **case-sensitive** (mirror `awareness-sync` / `morning-digest` discipline).
- `Unified-Loop`, `UNIFIED-LOOP`, and mixed case **do not** trigger.

### Positive examples

```text
unified-loop
```

```text
unified-loop cron:discover
```

```text
unified-loop approve-build
```

```text
unified-loop approve-build story:84-3
```

```text
unified-loop build-complete
```

```text
unified-loop build-complete worktree:84-3-build
```

### Negative examples (must not run Build, Verify, or wrong skill)

| Message | Why |
|---------|-----|
| `unified-loop continue` | Wrong continuation token — must use `approve-build` |
| `unified-loop build complete` | Space in build-complete — invalid |
| `unified-loop build-done` | Wrong build-complete token |
| `Unified-loop` | Case mismatch |
| `unified-loop build` | Not valid continuation grammar |
| `unified-loop approve-build story:84-2 extra` | Multiple trailing tokens |
| `please run unified-loop` | Substring / wrong line-1 prefix |
| `unified-loop\ncron:discover` | Multi-line manual message |
| `morning-digest` | Different skill prefix |
| `awareness-sync` | Different skill prefix |

## Cron trigger (Hermes + WSL)

- WSL crontab line tagged **`cns-unified-loop-discover`** calls `scripts/run-unified-loop-discover-cron.sh`.
- Hermes job uses `--skill unified-loop` with dummy schedule `0 0 1 1 *`.
- Cron **never** enters full-loop / Build / Verify / Persist path — Discover-only (`cron:discover` pseudo-label).
- Cron does **not** use Discord line-1 grammar.
- **Build/Verify/Persist forbidden on cron:** `unified-loop cron:discover`, `cns-unified-loop-discover`, and all Discover-only paths must **never** invoke `bmad-dev-story`, `bmad-code-review`, `bmad-review-adversarial-general`, `bmad-review-edge-case-hunter`, or `vault_log_action`. Paid stages run **only** after `unified-loop approve-build` (Build) and `unified-loop build-complete` (Verify). Build/Verify/Persist are **not** on recurring schedule (DDR 4a dormant-after-proof).

Pseudo-trigger label for logs: `cron:discover`.

## Failure modes

| Situation | Behavior |
|-----------|----------|
| `OMNIPOTENT_REPO` unset | Skip terminal; export instructions |
| Trigger line invalid | Do not run Discover |
| Pre-approval forbidden action attempted | **Skill failure** (see task-prompt §5) |
| Operator posts `unified-loop continue` | Do **not** trigger Build |

## Operator-visible notes

- Discover posts bounded `#hermes` summary + writes `~/.hermes/artifacts/unified-loop/discover.json`.
- Full loop manual path pauses after Discover until `unified-loop approve-build`.
- On `approve-build`: Build handoff → **STOP** until `unified-loop build-complete`.
- On `build-complete`: Verify handoff → operator runs three BMAD skills in IDE → Persist handoff (#2B).
- Build/Verify/Persist are **never** auto-fired on cron or recurring schedule (4a dormant-after-proof).
- No vault writes on Discover/cron path.
