# Trigger pattern: `hermes-cns-verify-gate-summary`

## Surface

**CLI / operator-invoked Hermes only** — Hermes session started from a terminal where the operator controls the environment (`OMNIPOTENT_REPO`). This example skill is **not** registered in `discord.channel_skill_bindings` by default (reduces untrusted trigger surface).

## Positive triggers

| Trigger | Notes |
|---------|--------|
| Operator messages containing intent to **run verify**, **verification gate**, **`scripts/verify.sh`**, or **Omnipotent verify** in a **CLI** context | Treat as soft match only if `OMNIPOTENT_REPO` is set. |
| Explicit phrase **“Run CNS verify gate summary”** (case-insensitive) | Strong match when combined with `OMNIPOTENT_REPO` set. |

## Negative triggers

| Pattern | Action |
|---------|--------|
| Discord `#hermes` free-text (unless operator later adds an explicit, reviewed binding) | **Do not** auto-run shell from Discord for this skill. |
| Message asks to run verify **without** `OMNIPOTENT_REPO` | Refuse; one-line instruction to export the variable. |
| Multi-step “fix and verify” without clear operator approval to mutate repo | Run verify only; do not mutate unless a separate task says so. |

## Debounce / exclusivity

If multiple CNS skills could apply in a future Discord setup, **URL ingest** (`hermes-url-ingest-vault`) owns `#hermes` URL shapes exclusively per HI-6. This verify skill **must not** register overlapping Discord triggers without documented priority in `SKILL.md` and the Operator Guide.
