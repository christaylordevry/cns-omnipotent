# Discord reply template (render from close-report.json)

Use the close report at `.session-close/close-report.json` as the only source of truth for what ran and what succeeded.

Notes:

- `close-report.json` contains `mode`, `failure_class`, and a `steps` object. Most human-friendly fields below are derived from `steps.*`.
- Keep the reply short. Do not paste raw vault export content, sprint YAML, or AGENTS text.

```markdown
## Session close complete

- **mode:** {{mode}}
- **agents_sync:** {{agents_sync}} (derive from steps.section8 / steps.apply_section8 if present)
- **section8_version:** {{section8_version}} (derive from steps.section8 output if present)
- **export:** {{export}} (derive from steps.export status + path/bytes if present)
- **notebooklm:** {{notebooklm}} (derive from notebooklm_targets or steps.notebooklm if present)
- **vault_fast_scan:** {{vault_fast_scan}} (derive from steps.fast_scan if present)
- **daily_rhythm:** {{daily_rhythm}} (derive from steps.daily_rhythm if present)
- **failure_class:** {{failure_class}}

### NotebookLM targets

{{notebooklm_targets_lines}}
```

Rules:

- Do not paste vault export bodies, story bodies, sprint YAML, or AGENTS text.
- Summarize failures with short classes only.
