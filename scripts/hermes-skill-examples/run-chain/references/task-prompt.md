# Task: `run-chain` (Story 75-3 / FR8)

## Hard constraints (must follow)

1. **CLI only**: invoke **`scripts/run-chain.ts`** via **`terminal()`** — never import `runChain()` or protect-list adapter modules.
2. **Same-shell env**: `source .env.live-chain` must run in the **same** shell as `npx tsx` (inline command string).
3. **No vault mutations** in the default path — terminal + bounded report only (contrast triage Story 30-2).
4. **Bounded Discord/Desktop output** — no full `ChainRunResult` JSON unless operator passed `--raw-json` and explicitly requested verbose output.
5. **Secrets policy**: cite env var **names** only; never echo key values in skill output.
6. **SSOT**: stage order, env, CLI flags, failure modes — `AI-Context/modules/run-chain.md` (do not re-derive from engine source).

## 0) REFERENCE ONLY — invocation already confirmed

> **You have already been invoked.** The `config.yaml` trigger matched the incoming Discord message or Desktop session request. Do not re-check or re-evaluate the Hermes skill binding.
> Proceed directly to **§1 Preconditions**.

For documentation purposes only (do not re-evaluate at runtime):

- Payload messages start with `run-chain topic:` (see `references/trigger-pattern.md`).
- Binding mismatch is **not** your job — only parse the operator brief and run the CLI.

## 1) Preconditions

### Resolve repo root

```
resolved_repo_root = OMNIPOTENT_REPO when set to a non-empty absolute path
else stop — do not guess cwd
```

If `OMNIPOTENT_REPO` is unset or empty, reply exactly:

```markdown
## Run-chain skipped

Set the repo root, then re-run:

`export OMNIPOTENT_REPO=/absolute/path/to/Omnipotent.md`

Documented operator fallback (WSL): `/home/christ/ai-factory/projects/Omnipotent.md`

Do not guess cwd.
```

Stop. Do not run `terminal()`.

### Parse operator brief

Let **`raw`** be the incoming message text. Parse per `references/trigger-pattern.md`:

| Field | Required | Maps to CLI |
|-------|----------|-------------|
| `topic` | Yes | `--topic "<topic>"` |
| `query` | Yes (≥1) | `--query "<query>"` (repeat per line) |
| `depth` | No (default `deep`) | `--depth shallow\|standard\|deep` |
| `evidence` | No | `--evidence-file "<path>"` |

On parse error (missing topic, missing query, invalid depth), reply exactly:

```text
run-chain: bad-payload (expected run-chain topic: "..." plus query: "..." lines; optional depth: shallow|standard|deep; optional evidence: <path>)
```

Then stop. Do not run `terminal()`.

## 2) Terminal invocation (canonical)

Invoke **one** `terminal()` call with `workdir=resolved_repo_root` and a **single** chained command:

**Shell safety:** Before building the command string, apply shell quoting
to all operator-supplied values (topic, each query, evidence path).
Reject any value that contains backtick, $( , or unbalanced quotes — reply
with run-chain: bad-payload and do not invoke terminal(). Mirror the
shellQuote rule from scripts/hermes-skill-examples/notebook-query/references/task-prompt.md.

```bash
cd "${OMNIPOTENT_REPO}" && \
  set -a && source .env.live-chain && set +a && \
  npx tsx scripts/run-chain.ts \
    --topic "<topic>" \
    --query "<query>" \
    --depth <depth> \
    --evidence-file "<optional>" \
    --raw-json
```

Rules:

- Omit `--evidence-file` and its value when the operator did not supply `evidence:`.
- Include **`--raw-json`** so success handling can parse `synthesis.insight_note.vault_path` from stdout when exit code is `0`.
- Repeat `--query` for each parsed query line.
- Use a generous timeout (chain may run several minutes); on Hermes timeout, report timeout with partial stderr if any.
- **Do not** call `runChain()` or import from `src/agents/run-chain.ts`.

## 3) Interpret results (any exit code)

Capture **exit code**, **stdout**, and **stderr**. Classify:

| Class | Detection | Template |
|-------|-----------|----------|
| Preflight env | Throws before chain catch; stderr contains `Missing required environment variables` | §3a |
| Anthropic 401 | stderr/stdout mentions `401` with Anthropic context, or synthesis/hook/boss auth failure | §3b |
| Success | Exit `0` | §3c |
| Chain stage error | Non-zero exit, not preflight-only | §3d |

### §3a — Preflight env failure

```markdown
## Run-chain failed (preflight)

- **exit:** 1
- **topic:** <topic>
- **cause:** Missing required environment variables: <names from stderr>
- **action:** Fix `.env.live-chain`, `source .env.live-chain` in the same shell as the CLI, rerun. SSOT: `AI-Context/modules/run-chain.md`
```

### §3b — Anthropic 401 (known dormant blocker)

```markdown
## Run-chain failed (credentials)

- **exit:** <code>
- **topic:** <topic>
- **cause:** Anthropic API returned 401 — `ANTHROPIC_API_KEY` dead (dormant since ~2026-05-24)
- **action:** Run Story **75-4** key validation/rotation (`scripts/validate-anthropic-key.ts`). Do **not** edit protect-list adapters.
```

### §3c — Success (exit 0)

Parse stdout for CLI summary `Result:` line when present. With `--raw-json`, parse JSON for `synthesis.insight_note.vault_path` when valid.

```markdown
## Run-chain complete

- **topic:** <topic>
- **exit:** 0
- **result:** PASS (or CLI summary Result line verbatim)
- **synthesis:** <vault_path or "see evidence file">
- **evidence:** <path if --evidence-file set, else "—">
```

### §3d — Chain stage error (non-401)

```markdown
## Run-chain failed

- **exit:** <code>
- **topic:** <topic>
- **hint:** <one line from stderr / evidence — stage name if visible>
- **action:** See `AI-Context/modules/run-chain.md` § Known failure modes
```

## 4) Output caps

- Do **not** paste more than **30 lines** of raw log unless operator explicitly requested verbose `--raw-json` dump.
- Never include API key values in the reply.

## Explicit non-goals

- Do **not** call Vault IO mutators (`vault_create_note`, `vault_update_frontmatter`, etc.) in this skill.
- Do **not** create or run `scripts/validate-anthropic-key.ts` (Story **75-4**).
- Do **not** produce live E2E proof artifacts (Story **75-5**).
