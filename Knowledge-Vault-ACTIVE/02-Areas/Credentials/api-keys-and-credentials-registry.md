---
pake_id: 7b185104-8552-4515-a945-bb6f3a87a4fe
pake_type: WorkflowNote
title: "API Keys and Credentials Registry"
created: "2026-05-27"
modified: "2026-05-27"
status: draft
confidence_score: 1
verification_status: pending
creation_method: ai
tags:
  - "credentials"
  - "api-keys"
  - "secrets"
  - "registry"
  - "security"
---


> **RULE 1:** This note stores key NAMES, purposes, locations, and rotation dates only. Raw values live in your password manager or `~/.env`.
> **RULE 2:** Never paste live tokens into this table. Use masked references (`sk-...abcd`) or location pointers (`1Password > item name`).
> **RULE 3:** If your vault is under Git, confirm `02-Areas/` is in `.gitignore`.

---

## Environment Variables / Credentials Registry

| Service | Variable Name | Masked / Location | Purpose / Scope | Last Rotated |
| ------------------- | ----------------------------- | --------------------------------- | --------------------------------- | ------------ |
| OpenAI | `OPENAI_API_KEY` | 1Password > OpenAI > API Key | GPT-4 / embedding calls | YYYY-MM-DD |
| Anthropic | `ANTHROPIC_API_KEY` | 1Password > Anthropic > API Key | Claude API calls | YYYY-MM-DD |
| GitHub | `GITHUB_TOKEN` | 1Password > GitHub > PAT | Repo access, Actions | YYYY-MM-DD |
| AWS | `AWS_ACCESS_KEY_ID` | 1Password > AWS > Access Key ID | S3, Lambda | YYYY-MM-DD |
| AWS | `AWS_SECRET_ACCESS_KEY` | 1Password > AWS > Secret | S3, Lambda | YYYY-MM-DD |
| Stripe | `STRIPE_SECRET_KEY` | 1Password > Stripe > Secret | Payment processing | YYYY-MM-DD |
| MongoDB | `MONGODB_URI` | 1Password > MongoDB > URI | Database connection | YYYY-MM-DD |
| SendGrid | `SENDGRID_API_KEY` | 1Password > SendGrid > Key | Email dispatch | YYYY-MM-DD |
| Custom | `MY_SERVICE_KEY` | | | YYYY-MM-DD |

> To add a new key: add a row. Fill the location column before the value column. Never fill value column.

---

## Shell Export Template

Copy from password manager, paste into terminal directly. Never save the expanded version here.

```bash
# Paste from your password manager into a terminal session (not a file)
export OPENAI_API_KEY="<paste here>"
export ANTHROPIC_API_KEY="<paste here>"
export GITHUB_TOKEN="<paste here>"
```

---

## .env File Template

Reference structure only. Keep your actual `.env` outside the vault.

```
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GITHUB_TOKEN=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
STRIPE_SECRET_KEY=
MONGODB_URI=
SENDGRID_API_KEY=
```

---

## Leak Prevention Checklist

- [ ] All real values stored in password manager, not this note
- [ ] `02-Areas/` excluded from Git (`.gitignore`)
- [ ] Obsidian Sync: confirm this folder is excluded or vault is local-only
- [ ] Search exclusions: add `02-Areas/Credentials` to Obsidian excluded files list
- [ ] Rotate keys on a schedule: update `Last Rotated` column above when done
- [ ] No key values in Daily Notes, templates, or Inbox captures

---

## Quick Access

- Open with: `Ctrl+O` then type `API Keys`
- Search tag: `#credentials`
- Password manager: 1Password (primary), Bitwarden (backup)
