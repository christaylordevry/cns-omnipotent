# Personas — role configurations for specialized tasks

Personas are **on-demand role briefs** for delegated or adversarial work. They live under `AI-Context/personas/` and complement constitution modules (`AI-Context/modules/`).

## When to load

- The task names a specialized reviewer, hunter, or auditor role.
- A workflow skill (for example `/bmad-code-review`) spawns parallel subagents with distinct postures.
- An operator or story references a persona file by name.

## Conventions

- One persona per file; kebab-case filename matching the role slug.
- Personas refine behavior for a **narrow task**; they do not override `AGENTS.md`.
- Repo mirror: `specs/cns-vault-contract/personas/` (Omnipotent.md implementation repo).
- Canonical vault copy: `Knowledge-Vault-ACTIVE/AI-Context/personas/` (synced with repo mirror).

## Catalog

| Persona file | Role | Primary workflow |
|--------------|------|------------------|
| `code-review-adversarial-layers.md` | Blind Hunter, Edge Case Hunter, Acceptance Auditor | `/bmad-code-review` three-layer adversarial review |
