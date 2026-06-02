# Discord reply template (render from close-report.json)

Use the close report at `.session-close/close-report.json` as the only source of truth for what ran and what succeeded.

Notes:

- `close-report.json` contains `mode`, `failure_class`, `phase_b_token_check` (when Phase B ran), `nlm_auth` (after NotebookLM fan-out), and a `steps` object. Most human-friendly fields below are derived from `steps.*`.
- If `phase_b_token_check.status` is `ABORTED`, §8 was not applied; mention token count and reason (do not treat as `failure_class: section8`).
- Keep the reply short. Do not paste raw vault export content, sprint YAML, or AGENTS text.

```markdown
## Session close complete

- **mode:** {{mode}}
- **agents_sync:** {{agents_sync}} (derive from steps.section8 / steps.apply_section8 if present)
- **section8_version:** {{section8_version}} (derive from steps.section8 output if present)
- **export:** {{export}} (derive from steps.export status + path/bytes if present)
- **notebooklm:** {{notebooklm}} (derive from `notebooklm_targets`: e.g. `2 ok, 1 failed (size_limit)` when `fanout_status` / `error_class` present; else steps.notebooklm; prefix with `drive-sync` or `legacy (deprecated)` from `notebooklm_fanout_mode` when set)
- **vault_fast_scan:** {{vault_fast_scan}} (derive from steps.fast_scan if present)
- **daily_rhythm:** {{daily_rhythm}} (derive from steps.daily_rhythm if present)
- **nlm_auth:** {{nlm_auth}} (derive from nlm_auth.status + nlm_auth.reason; dry-run says `skipped in dry-run`)
- **failure_class:** {{failure_class}}

### NotebookLM targets

{{notebooklm_targets_lines}}

Per-target line format (from `notebooklm_targets[]` after fan-out merge):

- Success: `**Title** (\`short-id…\`): ok`
- Failure: `**Title** (\`short-id…\`): failed — error_class: <class>` (optional compact export size, e.g. `(1.8 MB)`, and `http_status` when present)
```

Rules:

- Do not paste vault export bodies, story bodies, sprint YAML, or AGENTS text.
- Summarize failures with `error_class` only — never raw stderr or MCP payloads in Discord.
- If `nlm_auth.warning` is present, post exactly that warning separately or include it as a clearly labeled final line. It must contain `nlm auth warning`, one of `missing-cli`, `timeout`, `unauthenticated`, or `check-failed`, and `run nlm login`.
- Never include Google account email, cookies, tokens, raw CLI debug output, or raw env values in the `nlm_auth` line or warning.
