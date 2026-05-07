---
name: hermes-url-ingest-vault
description: "Use when handling Discord #hermes messages for CNS URL capture: validate trigger shape, SSRF-safe URL, fetch via Hermes browser, summarize per ingest contract, then vault_create_note (SourceNote) or short in-channel error."
version: 1.0.0
author: CNS Operator
license: MIT
metadata:
  hermes:
    tags: [cns, hermes, discord, url-ingest, vault-io, mcp, pake]
    related_skills: [native-mcp]
---

# CNS Hermes URL ingest to governed vault (HI-6)

## Overview

This skill applies **only** in Discord channel **`#hermes`** (channel ID `1500733488897462382` on the CNS server; if your deployment differs, update `~/.hermes/config.yaml` `discord.channel_skill_bindings` and this paragraph together). It defines when Hermes may fetch a URL, how to fetch safely, how to shape model output, and how to persist via **Vault IO MCP** `vault_create_note` with **`pake_type: SourceNote`**. Governed vault writes **never** use Hermes `file` tools for paths outside `00-Inbox/`.

## When to use

- A new user message arrives in `#hermes` while this skill is auto-loaded (via `discord.channel_skill_bindings`).

## When not to use (no vault write, minimal or no reply)

Skip `vault_create_note` and **do not treat the message as an ingest request** when **any** of the following hold:

- **Multi-line** message body (more than one line separated by newline).
- **Multiple** `http://` or `https://` URLs in the body.
- **Bare URL inside other text** without matching the allowed shapes below.
- **Slash commands** other than the literal `/ingest ` prefix form (for example `/start` alone is not ingest).

## Trigger contract (must match before fetch)

After trimming **leading and trailing ASCII whitespace** on the full message body:

| Shape | Allowed |
|-------|---------|
| **A** | Body is **exactly one** `http://` or `https://` URL and **no other non-whitespace characters**. |
| **B** | Body **starts with** the case-sensitive prefix `/ingest ` (slash, `ingest`, single ASCII space) followed immediately by a single `http://` or `https://` URL; **only** optional trailing ASCII whitespace after the URL. |

**URL parse rules:** scheme must be `http` or `https`. Host must be non-empty. Reject if URL length exceeds **2048** characters. If any rule fails, reply in-channel with a **short** error class (for example `ingest: invalid-url`) and **stop** (no fetch, no `vault_create_note`).

## SSRF and localhost rejection (before fetch)

**Before** any network or browser fetch, parse the URL host. Reject **without** `vault_create_note` (short in-channel error class, for example `ingest: blocked-host`) if the host is any of:

- `localhost`, `127.0.0.1`, `::1`
- **RFC1918** private IPv4 literals (`10.*`, `172.16.` through `172.31.*`, `192.168.*`)
- **IPv6 link-local** (`fe80:` prefix) or **unique local** (`fc` or `fd` prefix) literals
- Obvious cloud metadata hostnames if your policy lists them (optional blocklist; document if unused)

Hermes **browser** and **security** settings already set `allow_private_urls: false`; still perform the host checks above so you never hand a blocked URL to tools.

## Primary fetch path

**Primary:** Hermes **browser** tool (built-in remote browser / extraction stack). Hermes `browser.command_timeout` is **30s** wall clock; treat that as connect+read budget for this workflow.

On fetch failure (timeout, HTTP 4xx/5xx, empty body, or no safe text extraction path): reply in `#hermes` with a **short** error class only (for example `ingest: fetch-failed` or `ingest: http-403`). **Do not** paste raw HTML. **Do not** call `vault_create_note`.

## Ingest prompt (model body)

After a successful text extraction, apply the verbatim contract in:

`~/.hermes/skills/cns/hermes-url-ingest-vault/references/ingest-prompt-block.md`

## Vault IO: `vault_create_note` mapping

Call **`vault_create_note` only** (Hermes tool name is typically prefixed, for example `mcp_cns_vault_io_vault_create_note`). Arguments:

| Argument | Value |
|----------|--------|
| `pake_type` | `SourceNote` |
| `title` | Human title from page `<title>` or first clear heading if available; else `hostname + path` truncated to **120** characters; strip characters unsafe for filenames per Vault IO behavior. |
| `source_uri` | **Exact** URL string from the Discord trigger (normalize **only** by trimming outer ASCII whitespace). |
| `tags` | Must include `hermes-ingest`, `url-ingest`, and one slug from the **registrable domain**: lowercase, dots replaced with hyphen (example: `example.com` -> `domain-example-com`). |
| `confidence_score` | `0.55` unless operator policy documents a different default. |
| `content` | Markdown **body** only (output from the ingest prompt block). **No** YAML frontmatter inside `content`. |

**Optional:** one line via `vault_append_daily` under `## Agent Log` summarizing Hermes URL ingest and the returned `file_path` (standing CNS practice).

**Duplicate filename / conflict:** if the tool returns an existence or conflict class error, reply in `#hermes` with short class `ingest: duplicate` and **do not** create a second note.

## Negative manual tests (operator checklist)

Perform in `#hermes` with gateway running:

1. Random chat that **mentions** a URL inside a sentence (not shape A or B) -> **no** governed note.
2. Message with **two** HTTPS URLs -> **no** ingest.
3. `/ingest` with no URL -> **no** ingest.

## Verification

- Successful run: new file under `03-Resources/` (or spec-correct subpath returned), `vault_read_frontmatter` on returned path shows valid PAKE including `source_uri` matching the trigger URL (trimmed).
- `_meta/logs/agent-log.md` gains a line for `vault_create_note` whose `target_path` matches the created file.

## Regression (HI-3 / HI-4 / HI-5)

- No direct Hermes filesystem writes to governed vault paths outside `00-Inbox/`.
- `~/.hermes/memories/MEMORY.md` and `USER.md` remain symlinks to vault `AI-Context/` targets.
- Do not recreate `SOUL.md` under `~/.hermes/`.
