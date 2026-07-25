# Trigger pattern: `awareness-sync` (Story 77-4)

## Surfaces

- **Discord `#hermes`** — explicit token or natural-language cockpit questions (operator binding in `~/.hermes/config.yaml`; see `config-snippet.md`)
- **Hermes Desktop** — same triggers and natural-language equivalents

## Canonical explicit triggers (case-sensitive first token)

| Trigger | Behavior |
|---------|----------|
| `awareness-sync` | Pull (refresh) + cockpit digest (§5 in task-prompt) |
| `awareness-sync --cache-only` | Read cache only — no terminal pull (use when cron refreshed within ~3 min) |
| `awareness-sync --no-pull` | Alias for `--cache-only` |
| `awareness-sync --json` | Pull + post envelope JSON (operator debug — warn about size) |

### Bare trigger example

```text
awareness-sync
```

### Cache-only example

```text
awareness-sync --cache-only
```

### With follow-up question (same message)

```text
awareness-sync
What's the run-chain status?
```

Or natural language when skill is bound (no `awareness-sync` prefix required):

```text
What's the run-chain status?
```

## Prefix discipline

- Explicit triggers: first token must be **`awareness-sync`** (case-sensitive).
- Do **not** conflict with `investigate-trend keyword:` (line 1) or `morning-digest` line-1 tokens.
- Binding order in `#hermes`: `awareness-sync` sits after `investigate-trend`, before `morning-digest`.

## Failure modes

| Situation | Behavior |
|-----------|----------|
| `OMNIPOTENT_REPO` unset | Skip terminal; export instructions (task-prompt §1) |
| `awareness-pull.env` missing | Skip pull; copy template instructions |
| Pull fails, cache exists | STALE summary with `pulledAt` age |
| Pull fails, no cache | Unavailable message — no fabricated state |

## Operator-visible notes

- Posts back to the **same Discord thread** or **Desktop session** that invoked the skill.
- No vault mutations. Read-only cockpit awareness.
- 3-min cron (`scripts/run-awareness-pull-cron.sh`) may keep cache warm; skill adds on-demand refresh.
