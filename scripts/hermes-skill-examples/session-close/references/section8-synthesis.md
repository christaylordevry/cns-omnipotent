# Section 8 synthesis (section8-input only, bounded)

## Inputs (read only)

- `.session-close/section8-input.json`

Do not read sprint YAML, story artifacts, `AGENTS.md`, the vault export, or `.session-close/context-pack.json`. The section8 input artifact is the only allowed content input.

## Output (write only)

Write `.session-close/section8-draft.md` as a **fragment only**. Do not include a `## 8.` heading. The apply script wraps it under `## 8. Current Focus` and handles version bump plus sync.

Token budget: **≤ 1,500** tokens (estimate via `ceil(chars/4)`).

## Required fragment shape

```markdown
### Project Status

- <bullet lines from input.sprint.active_epics>

### Current Priorities

1. <priority 1>
2. <priority 2>
3. <priority 3>

### Recent Session Context

- <bullet 1>
- <bullet 2>
- <bullet 3>
```

## Rules

- Use only facts present in `section8-input.json`.
- Do not invent epics, stories, or statuses that are not in `input.sprint.active_epics` or `input.recent_stories`.
- Keep each bullet short. Prefer concrete next actions and story keys.
