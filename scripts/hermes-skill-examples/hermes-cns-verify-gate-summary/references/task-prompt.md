# Task: Run Omnipotent `scripts/verify.sh` and summarise

## Preconditions

1. Environment variable **`OMNIPOTENT_REPO`** is set to the **absolute** path of the Omnipotent.md repository root (the directory that contains `scripts/verify.sh`).
2. If unset: output exactly:

```markdown
## Verify gate skipped

Set the repo root, then re-run:

`export OMNIPOTENT_REPO=/absolute/path/to/Omnipotent.md`

Do not guess cwd.
```

Stop. Do not run shell.

## Execute (happy path)

1. `cd` to `"$OMNIPOTENT_REPO"` (use the env value verbatim).
2. Run: `bash scripts/verify.sh`
3. Capture exit code (0 = pass, non-zero = fail).

## Output schema (reply to operator)

Always use this structure (fill sections; omit “Failed step” line if pass):

```markdown
## CNS verification gate

- **Repo:** `$OMNIPOTENT_REPO` (path only; no secrets)
- **Result:** PASS | FAIL
- **Exit code:** `<n>`
- **Failed step:** `<lint | typecheck | tests | constitution-mirror | other>` (FAIL only; one line)
- **Notes:** `<=3 short bullets; paraphrase last error line if FAIL, no wall of log>`
```

## Failure classes

| Situation | Behaviour |
|-----------|-----------|
| `cd` fails (bad path) | Result FAIL, Failed step: `other`, note “OMNIPOTENT_REPO not a directory”. |
| Script missing | Result FAIL, Failed step: `other`, note “scripts/verify.sh not found”. |
| Script runs, non-zero exit | Result FAIL; infer step from stderr/stdout tail (e.g. “Tests” if Vitest failed). |

## Explicit non-goals

- Do **not** paste more than **20 lines** of raw log total.
- Do **not** call Vault IO MCP tools as part of this task.
- Optional Agent Log append via `vault_append_daily` is **out of scope** for this skill unless the operator enables MCP and asks in a separate message.
