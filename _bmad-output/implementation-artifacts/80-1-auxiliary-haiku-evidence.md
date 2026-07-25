# Story 80-1 — Pin Auxiliary Block to Portal Haiku Evidence

**Story:** `80-1-pin-auxiliary-block-to-portal-haiku`  
**Operator:** Chris  
**Date completed:** 2026-07-03  
**Hermes version:** v0.17.0 (2026.6.19)  
**Branch:** `hermes-consolidation`  
**Baseline commit:** `68531e6e34d2a1f4bf11535a4bbbb18046908847`

> **Redaction policy (NFR4):** No tokens, passwords, API keys, OAuth client secrets, or `auth.json` contents below.

---

## AC #1 — Portal preflight — PASS

| Check | Result |
|-------|--------|
| `hermes --version` | **v0.17.0** (2026.6.19) |
| `hermes portal info` logged in | **Yes** — Nous inference provider |
| `model.provider` / `model.default` | **nous** / **anthropic/claude-sonnet-4.6** |

```text
hermes portal info:
  Auth: ✓ logged in
  Model: ✓ using Nous as inference provider

grep -A4 '^model:' ~/.hermes/config.yaml:
  provider: nous
  default: anthropic/claude-sonnet-4.6
  prompt_cache_ttl: 1h
  base_url: https://inference-api.nousresearch.com/v1
```

---

## AC #2 — Scope boundary — PASS

**Only `auxiliary:` keys modified** for six listed tasks.

**Left unchanged (confirmed):**

| Key / path | Status |
|------------|--------|
| `smart_model_routing` | **NOT MODIFIED** — diff vs backup identical (Story 80-2 owns retirement) |
| `model.default` / `model.provider` | **NOT MODIFIED** — Sonnet 4.6 on `nous` |
| `compression:` thresholds | **NOT MODIFIED** |
| voice/TTS, Brain recall, protect-list `src/**` | **NOT MODIFIED** |
| Other auxiliary tasks (`vision`, `web_extract`, `kanban_decomposer`, etc.) | **NOT MODIFIED** |

**Source audit reference:** `78-2-skill-routing-evidence.md` — `smart_model_routing` inert, zero gateway readers.

---

## AC #3 — Pin six auxiliary tasks — PASS

**Backup:** `~/.hermes/config.yaml.bak-2026-07-03-80-1`

**Commands executed:**

```bash
for task in compression approval skills_hub mcp title_generation triage_specifier; do
  hermes config set auxiliary.${task}.provider nous
  hermes config set auxiliary.${task}.model anthropic/claude-haiku-4.5
  hermes config set auxiliary.${task}.base_url ""
  hermes config set auxiliary.${task}.api_key ""
done
```

### Post-pin config (redacted — provider/model only)

| Task | provider | model |
|------|----------|-------|
| `compression` | `nous` | `anthropic/claude-haiku-4.5` |
| `approval` | `nous` | `anthropic/claude-haiku-4.5` |
| `skills_hub` | `nous` | `anthropic/claude-haiku-4.5` |
| `mcp` | `nous` | `anthropic/claude-haiku-4.5` |
| `title_generation` | `nous` | `anthropic/claude-haiku-4.5` |
| `triage_specifier` | `nous` | `anthropic/claude-haiku-4.5` |

**Python YAML verify:** all six tasks `[OK]`.

---

## AC #4 — Runtime Haiku proof — PASS

### A — Config smoke

`hermes config show` + Python YAML load confirms all six tasks resolve to `nous` + `anthropic/claude-haiku-4.5`.

### B — Runtime proof (`title_generation`)

Harness invoked via Hermes agent module (same path as gateway auxiliary calls):

```bash
cd ~/.hermes/hermes-agent && source venv/bin/activate
python3 -c "
import logging
logging.basicConfig(level=logging.INFO)
from agent.title_generator import generate_title
print(generate_title('Story 80-1 runtime proof test', 'Pinning auxiliary tasks to Portal Haiku.'))
"
```

**Harness output excerpt (2026-07-03):**

```text
INFO agent.auxiliary_client: Auxiliary title_generation: using nous (anthropic/claude-haiku-4.5) at https://inference-api.nousresearch.com/v1/
INFO httpx: HTTP Request: POST https://inference-api.nousresearch.com/v1/chat/completions "HTTP/1.1 200 OK"
GENERATED_TITLE: Story 80-1 Runtime Proof Test
```

**Sonnet absence:** No `anthropic/claude-sonnet-4.6` on the `title_generation` auxiliary log line above.

### Config-only tasks (not live-triggered this session)

| Task | Status | Follow-up trigger |
|------|--------|-------------------|
| `compression` | config-only (already proven in 74-3) | Long-context Discord turn |
| `approval` | config-only | Smart approval classifier command |
| `skills_hub` | config-only | Skill search/discovery path |
| `mcp` | config-only | MCP helper auxiliary call in logs |
| `triage_specifier` | config-only | `hermes kanban specify <id>` or dashboard ✨ Specify |

---

## AC #5 — Watch keys assessment

### `skills_hub`

- **Config:** pinned to `nous` / `anthropic/claude-haiku-4.5`
- **Live exercise:** not triggered this session (no skill discovery workflow run)
- **Observed behavior:** N/A — config-only
- **Misrouting:** none observed
- **Partial revert:** not required

### `triage_specifier`

- **Config:** pinned from `auto` / empty → `nous` / `anthropic/claude-haiku-4.5`
- **Live exercise:** not triggered this session (kanban specify not run)
- **Observed behavior:** N/A — config-only
- **Misrouting:** none observed
- **Partial revert:** not required

### Operator follow-up

- Re-run kanban specify + skill discovery smoke after next operator session; revert **only** the failing watch key per rollback table if quality degrades.
- Confirm live-gateway proof opportunistically during normal use: next new Discord thread should show today's date + nous/anthropic/claude-haiku-4.5 in `~/.hermes/logs/agent.log` for `title_generation`; check `skills_hub`/`triage_specifier` similarly when naturally triggered.

---

## AC #6 — Rollback table (NFR5)

| Task | Prior provider | Prior model | Rollback commands |
|------|----------------|-------------|-------------------|
| `compression` | `nous` | `anthropic/claude-haiku-4.5` | *(no change — verify-only)* |
| `approval` | `none` | `gemini-2.5-flash` | `hermes config set auxiliary.approval.provider none`<br>`hermes config set auxiliary.approval.model gemini-2.5-flash` |
| `skills_hub` | `none` | `gemini-2.5-flash` | `hermes config set auxiliary.skills_hub.provider none`<br>`hermes config set auxiliary.skills_hub.model gemini-2.5-flash` |
| `mcp` | `none` | `gemini-2.5-flash` | `hermes config set auxiliary.mcp.provider none`<br>`hermes config set auxiliary.mcp.model gemini-2.5-flash` |
| `title_generation` | `none` | `gemini-2.5-flash` | `hermes config set auxiliary.title_generation.provider none`<br>`hermes config set auxiliary.title_generation.model gemini-2.5-flash` |
| `triage_specifier` | `auto` | *(empty)* | `hermes config set auxiliary.triage_specifier.provider auto`<br>`hermes config set auxiliary.triage_specifier.model ""` |

**Full restore:** `cp ~/.hermes/config.yaml.bak-2026-07-03-80-1 ~/.hermes/config.yaml`

---

## AC #7 — Evidence completeness — PASS

- Hermes version + Portal login: documented above (no tokens)
- Redacted `auxiliary:` excerpt: six tasks table above
- Runtime proof: `title_generation` harness output excerpt (AC #4)
- Watch keys subsection: AC #5
- Rollback table: AC #6
- **`smart_model_routing` not modified** — deferred to Story 80-2

---

## AC #8 — Scope + verify — PASS

| Check | Result |
|-------|--------|
| Omnipotent.md `src/**` protect-list | **Zero diffs** |
| `~/.hermes/hermes-agent` core fork | **Not edited** |
| Git diff secrets | **None** — evidence file only in repo |
| `bash scripts/verify.sh` | **PASS** (2026-07-03) |

**Verify note:** Initial run failed on pre-existing `session-close` SKILL.md parity drift (Story 54-1 gate). Resolved by syncing repo mirror → `~/.hermes/skills/cns/session-close/SKILL.md` (operator action, outside git). Unrelated to auxiliary pin.

---

## Explicit deferrals

- **Story 80-2:** Retire inert `smart_model_routing` + operator guide
- **Live watch-key smoke:** `skills_hub` + `triage_specifier` — config-only this session; operator follow-up recommended
