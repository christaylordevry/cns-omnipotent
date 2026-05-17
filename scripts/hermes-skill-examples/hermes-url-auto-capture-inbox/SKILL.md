---
name: hermes-url-auto-capture-inbox
description: "Capture-only Hermes skill for Discord #general URL messages. Detect http(s) URL substrings, apply SSRF guardrails, fetch bounded extracts when safe, and write unstructured markdown captures under 00-Inbox for later manual triage."
version: 1.0.0
author: CNS Operator
license: MIT
metadata:
  hermes:
    tags: [cns, hermes, discord, url-capture, inbox, triage]
    related_skills: [triage, hermes-url-ingest-vault]
---

# CNS Hermes #general URL auto-capture (Story 28.3)

## Overview

This skill applies only in Discord **`#general`** (channel ID `1484880486785486951` on the CNS server) when loaded through `~/.hermes/config.yaml` `discord.channel_skill_bindings`.

It is **capture only**. It writes unstructured markdown files under **`00-Inbox/`** so the operator can later use the existing manual triage workflow: `/triage` -> `/triage-approve` -> `/triage-execute`.

## When to use

- A new user message arrives in `#general` while this skill is auto-loaded.
- The message contains at least one `http://` or `https://` URL substring.

## When not to use

- Message is not from `#general`.
- Message contains no `http://` or `https://` URL substring.
- Message only contains non-http(s) schemes such as `ftp://`.
- Message only contains bare domains without scheme.
- The operator asks for routing, filing, synthesis, approval, moving, deletion, NotebookLM updates, or AGENTS updates.

## Non-goals

- This skill must not call `vault_create_note`.
- This skill must not call `vault_move`.
- This skill must not call `/triage-approve` or `/triage-execute`.
- This skill must not create governed notes in `03-Resources/`, `01-Projects/`, or `02-Areas/`.
- This skill must not infer routing or add PAKE frontmatter.

## Task Contract

Follow `references/capture-prompt.md` exactly.

## Configuration

Use `references/config-snippet.md` as the operator-facing binding example. Preserve the existing `#hermes` binding for `hermes-url-ingest-vault`, `triage`, and `session-close`.
