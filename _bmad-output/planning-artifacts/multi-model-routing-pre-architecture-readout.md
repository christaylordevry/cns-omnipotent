---
title: Multi-model routing pre-architecture readout
date: 2026-04-13
tags:
  - cns
  - routing
  - multi-model
  - architecture
status: final
source: Cursor
---

[!abstract]
This readout defines *where* and *how* CNS should make model-selection decisions in Phase 3 without violating the existing security posture: secrets never logged/echoed, audit trails are summaries, and routing stays policy-driven (not vendor-driven). It enumerates the in-scope “surfaces” (Cursor, Claude Code, future CLI/daemon placeholders), assigns routing granularity per surface (session/task/tool), proposes configuration boundaries and secret placement options, defines policy dimensions (defaults, allowlists, overrides, failure handling), **compares LLM-mediated vs deterministic routing mechanisms** (design options only — no chosen architecture), discusses **latency and cost tradeoffs** at a qualitative level, states **stack placement** relative to Vault IO and Brain without implying Phase 1 MCP semantic changes, explicitly states dependencies on Brain/Mobile work, and ends with an ordered epic/story breakdown that is sliceable and staged.

## Overview

Phase 1 established a vault contract and Vault IO tool surface; Phase 2.x planning introduces Brain (retrieval + context) and mobile access journeys. Phase 3 will likely introduce multi-model routing so that different tasks/tools can use different LLMs (or providers) under operator policy.

### Assumptions (AC 1)

This readout assumes **Phase 1 is complete** and **Phase 2.0 is stable** in the specific sense used by Story 14.1: the **vault folder contract + manifests** and the **Vault IO read/write/search/move tool surface** are treated as stable enough that Phase 3 routing work should not need to retrofit fundamental vault IO semantics.

This document is **planning-only** and presents **design options** (pros/cons, fit, failure modes) so Phase 3 stories can be sliced — **not** a single mandated architecture or vendor choice.

It intentionally **does not** ship:
- Any always-on daemon (“OpenClaw”) implementation
- Any router service implementation
- Any new MCP transports or tool surfaces
- Any vendor-specific SDK binding as a dependency

### Scope boundary note (AC 6)

“Repository code may remain untouched” is interpreted here as **no Phase 3 router/daemon implementation** and **no new product/runtime surfaces** in this story. **BMAD tracking files** (for example `_bmad-output/implementation-artifacts/sprint-status.yaml`) may still be updated as part of normal story workflow.

## Appendix: terminology

- **Model alias**: a stable name like `default-reasoning` that maps to a vendor model id in a *non-secret* registry or host config, depending on policy.
- **Surface**: an execution environment (Cursor agent, Claude Code, MCP tool runner).
- **Granularity**: the scope at which routing may change (session/task/tool).

## In-scope surfaces and routing granularity (AC 1)

Routing is defined as a decision: “Given a request + context + policy, which model profile do we use?” The granularity indicates how often that decision can change.

### Surface matrix

| Surface | Routing granularity (session/task/tool) | Configuration source(s) | Audit/logging constraints |
|---|---|---|---|
| Cursor (IDE agent) | **Per-task** (default), optionally per-tool for high-risk tools | Repo defaults + env + operator override | Never log prompts/responses; log only routing *decision summary* (model alias, policy version hash, reason code) |
| Claude Code (terminal agent) | **Per-task** | Env + operator override; repo defaults for non-secret policy | Never echo secrets to terminal; never log raw tool payloads; audit is truncated summaries only |
| Vault IO MCP (Phase 1 tools) | **N/A today** (Vault IO is not an LLM router); **future** host integration *may* treat selection as **per-tool** at the MCP host boundary | Policy config (non-secret) + env/host secret store | Tool audit already exists; routing audit must not add payload content; no key material |
| Future CLI (placeholder) | **Per-session** with per-task override | Env + OS keychain + optional vault-stored encrypted config (future) | Same as terminal: never echo keys; structured decision logs only |
| Future daemon (placeholder) | **Per-tool** (service boundary), optionally per-task internally | Host secret store + env; operator policy config | Structured metrics only; never store full prompts; enforce redaction at boundaries |

**Notes:**
- “Future CLI/daemon” are **placeholders only**; they are not commitments to ship in Phase 3, and are listed only so boundaries are not retrofitted later.
- Routing granularity is a *control* to reduce accidental cross-task leakage and improve reproducibility.

## Secrets + policy placement (AC 2)

### What is a “secret” in routing

Secrets are anything that would allow unauthorized access or reveal protected operational details if disclosed:
- API keys / tokens (provider keys, gateway keys)
- Organization IDs, project IDs when they grant access
- Internal policy override tokens, break-glass credentials
- Unredacted prompts/responses that may contain user data
- Any tool payloads that can contain private note content (vault text), attachments, or extracted data

### Placement options

- **Environment variables**
  - **Use for**: tokens/keys in local dev and CI; non-secret toggles (routing enabled/disabled).
  - **Pros**: simple, standard, fits Phase 1 env-root policy patterns.
  - **Cons**: easy to leak via process listing, crash dumps, or debug prints if careless.

- **OS keychain / secret manager**
  - **Use for**: long-lived keys on developer workstations; operator credentials.
  - **Pros**: better security boundary; can support rotation.
  - **Cons**: requires platform abstraction; varies by host OS.

- **Vault-stored encrypted config (future work; not Phase 3 requirement)**
  - **Use for**: encrypted policy bundles that travel with vault (e.g., team policy profiles).
  - **Pros**: portable; aligns with “vault as source of truth.”
  - **Cons**: introduces encryption/key-management scope; must be explicitly phased and threat-modeled.

- **Repo config (non-secret)**
  - **Use for**: default policy profiles, model aliases, allow/deny lists that do not embed credentials.
  - **Pros**: reviewable, versioned, supports reproducibility.
  - **Cons**: cannot contain secrets; must be robust to fork exposure.

### Org / tenant policy placement (AC 2)

“Org policies” here means **non-secret governance rules** (allowed models, data handling rules, retention posture, export constraints), not API keys.

- **Repo-managed policy files (preferred default)**: versioned, reviewable policy bundles (allow/deny lists, routing defaults, escalation rules).
- **Environment variables**: coarse feature flags and deployment-specific policy *pointers* (e.g., policy profile name), not the full policy text.
- **OS keychain / secret manager**: generally **not** for org policy text; use for credentials and break-glass override tokens only.
- **Vault-stored policy bundles (often encrypted in future)**: portable “policy travels with vault” mode; must be treated as sensitive-at-rest even when not “API-key secret,” because it can encode compliance posture.

### Never log / never echo list (aligned to Phase 1 posture)

**Must never be logged or echoed (including debug logs, exceptions, telemetry, CLI output):**
- Any API key/token or header value that contains credentials
- Raw prompts, tool payload bodies, or model responses
- Vault note contents (full text), attachments, or extracted snippets beyond minimal non-sensitive identifiers
- Any “policy override” secret (break-glass tokens, admin override credentials)
- Full provider error payloads if they may include request/response echoes

**Allowed to log (structured, minimal, and non-sensitive):**
- Model **alias** only (never log raw vendor model IDs; if needed for diagnostics, log a **one-way hash** of the resolved id with explicit operator approval)
- Policy version identifier (hash or semantic version)
- Routing **reason code** (e.g., `DEFAULT`, `FALLBACK_RATE_LIMIT`, `OPERATOR_OVERRIDE`)
- Coarse request metadata: tool name, task id, surface id (no content)
- Truncated hashes of payloads *only if already approved by audit posture* (never reversible; never raw)

## Policy-driven routing dimensions (AC 3)

Routing policy is a set of constraints and decision rules; providers/models are *inputs* to those rules.

### Required policy dimensions

- **Default model selection rule**
  - Choose a default model alias per surface + task category (e.g., “coding”, “writing”, “analysis”) with a safe baseline.
  - Default should be stable and reproducible; changes require policy version bump.

- **Allowed model list / deny list**
  - An explicit allowlist per surface (and optionally per tool) is preferred.
  - Deny list can exist for known-bad models (e.g., missing tool-use support, known data retention risks).

- **Operator override rules**
  - Operator override must be explicit, auditable, and scope-limited:
    - **Scope**: per-session or per-task; avoid “global forever” toggles without expiry.
    - **Mechanism**: env var override or host secret store flag; repo config may define *allowed override targets* but not secrets.
    - **Audit**: log override used + reason code; never log the secret enabling it.

- **Failure-handling strategy**
  - **Rate limit**: fallback to a lower-cost / higher-availability alias; backoff; optionally degrade features (e.g., reduce context length) without changing surfaces.
  - **Outage**: provider-level failover if permitted by policy; otherwise fail closed with actionable error.
  - **Degraded mode**: limit tool use, reduce max tokens, or require explicit operator confirmation for risky tools.
  - **Cost cap exceeded**: choose cheaper alias or halt; must be deterministic and auditable.

### Minimal decision record (audit-friendly)

Every routing decision should be expressible as a compact record:
- `surface`: `cursor|claude-code|vault-io|...`
- `scope`: `session|task|tool`
- `policy_version`: `vX` or hash
- `selected_model_alias`: string
- `reason_code`: enum-like string
- `fallback_chain`: list of aliases attempted (names only), **capped** (recommend max **16** entries) with tail summarization (`…+N more`) if exceeded
- `operator_override`: boolean

No content fields.

## Routing mechanism design options: LLM-mediated vs deterministic (AC 7)

Phase 3 can route model selection in more than one way. The two patterns below are **alternatives and complements** — future epics may combine them (for example, deterministic baseline with an optional LLM assist path behind policy gates).

### LLM-mediated routing (“LLM-as-router”)

A model (often small or specialized) **classifies** task intent, risk, or context class, or **chooses** among candidate model aliases based on natural-language or unstructured inputs.

| Dimension | Notes |
|---|---|
| **Strengths** | Handles fuzzy or novel task descriptions; can adapt when taxonomies change less often than rules; may reduce manual rule sprawl if evaluation is strong. |
| **Failure modes** | Non-determinism and drift across model versions; misclassification under edge prompts; potential for **prompt-injection** or manipulation of the router if inputs are attacker-controlled; harder to prove “always routes X to Y” for compliance. |
| **Auditability** | Weaker unless the router emits a **structured decision record** (alias, reason code, policy version) and **never** relies on chain-of-thought or raw rationale for compliance proof. |
| **Operational complexity** | Higher: separate eval harness, versioning, monitoring for routing quality, and guardrails so router output stays within allowlists. |

### Deterministic / rules-based routing (policy engine)

Decisions come from **explicit rules**: allow/deny lists, static fallback chains, task-category mappings, feature flags, and policy version — without an LLM in the loop for the routing decision itself.

| Dimension | Notes |
|---|---|
| **Strengths** | Reproducible, unit-testable, reviewable in PR; audit trail maps cleanly to policy artifacts; predictable cost (no extra model call for routing). |
| **Failure modes** | Coverage gaps when new surfaces or task types appear; ordering bugs between rules; maintenance burden as rule sets grow. |
| **Auditability** | Strong: decisions are explainable from policy + inputs without opaque steps. |
| **Operational complexity** | Lower for the **decision engine** itself; higher for **governance** as rules proliferate (needs discipline and tooling). |

### When each pattern tends to fit (non-prescriptive)

- **Rules-first** fits when policy must be **strict**, **provable**, and **stable** (regulated contexts, fixed allowlists, cost caps).
- **LLM-assisted routing** may fit when task boundaries are **fluid** and **human-language-heavy**, provided outputs are **constrained** (hard allowlist post-check, reason codes, no free-form “pick any vendor id”).
- **Hybrid** is common in practice: deterministic defaults and fallbacks, with an optional classifier only for **labeling** tasks into buckets that map to policy — still resolved by rules.

This readout **does not** select a single approach; it requires that any Phase 3 design preserve **policy primacy** (vendor models are inputs to policy, not the definition of policy).

## Latency and cost tradeoffs (AC 7, qualitative)

No benchmarks here — only **design-level** relationships operators should plan for.

- **Extra hop**: An LLM-based router adds at least one additional round-trip (router call) before the **primary** model call, increasing tail latency versus a single-hop rules evaluation.
- **Decision caching**: Repeated routing for the same **(surface, task class or hash bucket, policy version)** can cache the selected alias and reason code — reducing repeated router expense and latency **if** cache keys do not embed sensitive content (use coarse labels or approved hashes only).
- **Cheap vs expensive paths**: A **small** model or lightweight classifier may be used only to assign a **task bucket** that maps to policy; the expensive model runs once routing is fixed — versus routing with a **capable** model, which increases cost and may be unnecessary if rules suffice.
- **Failure and retry amplification**: Fallback chains (rate limit → secondary alias) multiply calls in worst cases; policy should cap chain depth (aligned with **minimal decision record** limits elsewhere in this doc) to avoid cost explosions.

## Stack placement: Vault IO, Brain, and Phase 1 boundaries (AC 7)

### Above the Vault IO tool boundary

- **Vault IO MCP (Phase 1)** exposes **vault read/write/search/move** — it is **not** an LLM and does **not** perform model routing. Any future “which model runs this agent?” decision is made in the **host** (IDE agent runtime, CLI wrapper, future daemon) **before or alongside** calls into Vault IO tools.
- **Audit separation**: Vault IO continues to log **tool-level** audit per existing Phase 1 posture (summaries, no payload secrets). **Routing** audit (model alias, reason code, policy version) is a **separate concern** and must **not** smuggle vault note content into routing logs — same “no content fields” rule as the minimal decision record.
- **Phase 1 MCP semantics**: This readout does **not** require or assume **new MCP tools**, new transport, or **changed tool contracts** for routing. Routing remains **out of band** from Vault IO until a future epic explicitly proposes host/MCP integration with a full spec.

### Brain (Epic 12) as optional input — not a router dependency

- **Brain** may supply **labels or scores** that **inform** policy inputs: e.g., retrieval-heavy task, estimated context size class, sensitivity or PAKE quality hints. Routing **can** consume those as **features** when present.
- **Dependency remains soft** (see below): routing can be specified and tested **without** Brain; when Brain exists, policies may grow richer **without** changing the core rule that policy — not the model vendor — owns allowlists and fallbacks.

### Mobile (Epic 13) as optional input

- Device class, connectivity, or UI surface constraints may justify different **defaults** or **degraded mode** — still expressed as **policy dimensions**, not ad hoc per-device vendor logic.

Together, this stack picture keeps **Vault IO** as the **data plane** boundary for vault operations and **routing** as **control-plane** logic in execution hosts — **without** retrofits to Phase 1 vault tool semantics in this planning story.

## Dependencies and boundaries (AC 4, AC 6)

**Placement context:** For how routing sits **above** Vault IO and how **Brain** may feed **optional** inputs without changing Phase 1 MCP contracts, see **Stack placement: Vault IO, Brain, and Phase 1 boundaries** above.

### Dependency summary (AC 4)

- **Hard dependency**: **none** (routing does not require Brain or Mobile to exist)
- **Soft dependency — Brain (Epic 12)**: optional enrichment of routing *inputs* (retrieval-heavy task, context size class, sensitivity score)
- **Soft dependency — Mobile (Epic 13)**: optional enrichment via device class / connectivity constraints

### Dependency on Brain (Epic 12)
- **Dependency level**: **Soft**
- **Rationale**: Routing can be designed and shipped without Brain. However, Brain may influence *inputs* to policy (e.g., “retrieval-heavy task”, “context size class”, “sensitivity score”), which could refine routing later.

### Dependency on Mobile (Epic 13)
- **Dependency level**: **Soft**
- **Rationale**: Mobile may inform device-class constraints (bandwidth, offline mode, UI surfaces) that could motivate different defaults. Routing does not require mobile to exist, but should reserve a policy dimension for “surface/device class.”

### Explicit boundaries for this story
- **Planning-only**: This story produces a document, not code.
- **No new MCP tools**: No additional Vault IO surface changes.
- **No daemon/router implementation**: Any always-on agent or routing service is explicitly out of scope.
- **Vendor-neutral**: Use model aliases and policy dimensions, not provider SDK shapes.

### Vault-stored encrypted config: minimum threat-model notes (AC 2)

If encrypted policy bundles live in the vault, Phase 3 needs explicit decisions for:
- **Key custody** (who can decrypt; where master keys live; rotation cadence)
- **Fork/leak semantics** (cloned repos / shared vault copies)
- **Auditability** (policy changes must be versioned; decryption attempts should not leak content into logs)

## Recommended Phase 3 epic/story breakdown (AC 5)

Ordered, sliceable candidates (each can ship independently if its acceptance tests pass).

1) **Phase 3 Epic: Policy schema + model alias registry (no secrets)**
   - **Objective**: Define a repo-stored policy schema (defaults, allowlists, reason codes) and a model alias registry.
   - **Key risks**: accidentally encoding vendor assumptions; config drift across surfaces.
   - **Acceptance-test idea**: load policy + validate schema; ensure deny/allow rules resolve deterministically.

2) **Phase 3 Epic: Routing decision engine (pure function)**
   - **Objective**: Implement a deterministic routing function that consumes (surface, task/tool metadata, policy) and outputs a decision record.
   - **Key risks**: hidden side effects; leaking secrets into logs.
   - **Acceptance-test idea**: golden tests for reason codes + fallback chains; ensure decision record contains no content.

3) **Phase 3 Epic: Surface adapters (Cursor / Claude Code)**
   - **Objective**: Wire the decision engine into each surface without changing existing security posture.
   - **Key risks**: inconsistent granularity; accidental prompt logging.
   - **Acceptance-test idea**: integration tests verify selected alias applied per task and audit record emitted with no content.

4) **Phase 3 Epic: Failure-handling + fallback orchestration**
   - **Objective**: Standardize retry/backoff/fallback behavior and degraded mode semantics.
   - **Key risks**: cascading retries; unpredictable user experience.
   - **Acceptance-test idea**: simulated rate-limit/outage produces expected fallback chain and safe error messaging.

5) **Phase 3 Epic: Operator override + governance controls**
   - **Objective**: Provide scoped overrides with explicit audit reason codes and expiry.
   - **Key risks**: bypassing policy permanently; secret leakage in override mechanism.
   - **Acceptance-test idea**: override enabled → decision record includes `operator_override=true`; override secret never appears in logs.