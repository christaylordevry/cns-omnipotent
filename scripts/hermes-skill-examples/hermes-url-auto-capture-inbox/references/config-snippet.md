# Config snippet: `#general` URL auto-capture (Story 28.3)

Install the skill at:

- `~/.hermes/skills/cns/hermes-url-auto-capture-inbox/`

Bind `#general` only to the capture skill, and keep existing `#hermes` bindings unchanged:

```yaml
discord:
  allowed_channels: "1500733488897462382,1484880486785486951"
  free_response_channels: "1500733488897462382,1484880486785486951"
  channel_prompts:
    "1500733488897462382": |
      CNS Hermes channel: route by exact CNS skill trigger before casual replies.
      URL-only messages use hermes-url-ingest-vault. /triage, /approve, and /execute-approved use triage. /session-close and /session-close --dry-run use session-close.
      Do not route /session-close through URL ingest.
      Use vault-lint for /vault-lint.
      Use vault-think for /challenge, /emerge, /ideas, /trace, /connect, /ghost, /drift.
    "1484880486785486951": |
      CNS #general auto-capture channel. For any message containing an http:// or https:// URL substring, use hermes-url-auto-capture-inbox.
      Capture only to 00-Inbox/. Do not route, move, approve, synthesize, update AGENTS, or update NotebookLM.
  channel_skill_bindings:
    - id: "1500733488897462382"
      skills:
        - hermes-url-ingest-vault
        - triage
        - session-close
        - vault-lint
        - vault-think
    - id: "1484880486785486951"
      skills:
        - hermes-url-auto-capture-inbox
```

`#hermes` keeps governed URL ingest to `03-Resources/` through Vault IO. `#general` uses capture-only Inbox writes for later manual triage.
