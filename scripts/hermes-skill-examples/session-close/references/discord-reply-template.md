# Discord reply template (render from close-report.json)

Use the close report at `.session-close/close-report.json` as the only source of truth for what ran and what succeeded.

```markdown
## Session close complete

- **mode:** {{mode}}
- **agents_sync:** {{agents_sync}}
- **section8_version:** {{section8_version}}
- **export:** {{export}}
- **notebooklm:** {{notebooklm}}
- **vault_fast_scan:** {{vault_fast_scan}}
- **daily_rhythm:** {{daily_rhythm}}
- **failure_class:** {{failure_class}}

### NotebookLM targets

{{notebooklm_targets_lines}}
```

Rules:

- Do not paste vault export bodies, story bodies, sprint YAML, or AGENTS text.
- Summarize failures with short classes only.
