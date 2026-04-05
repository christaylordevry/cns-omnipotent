# PRD - CNS (Central Nervous System)

Canonical product requirements:

- `_bmad-output/planning-artifacts/prd.md`

BMAD `project_name` is **CNS** (see `_bmad/bmm/config.yaml`). The repository folder name is not the product name.

---

## Phase 2.0 Scope (approved 2026-04-03)

Phase 2.0 delivers four epics sequenced for additive, non-compounding expansion on the Phase 1 substrate. **Epic A** (Nexus coexistence documentation): acknowledge Nexus as a trusted write surface in `AGENTS.md`, update directory `_README.md` manifests where Nexus creates notes, amend Spec §8 to reflect the dual-path model — no code changes to vault-io or Nexus. **Epic B** (foundation hardening from deferred-work): deduplicate the shared PAKE schema module inside the MCP server, implement vault root at `/` rejection with tests, and document or resolve the wikilink repair O(n) strategy. **Epic C** (NotebookLM ingestion pipeline): export cited synthesis from notebooks into PAKE-compliant vault notes (SourceNote or SynthesisNote), with a module entry in `AI-Context/modules/` governing the ingestion policy. **Epic D** (Obsidian Bases control panels): `.base` files in `_meta/bases/` providing filtered views for Inbox triage, project status, and research source tracking. Three operator decisions are locked: (1) Epic C delivers NotebookLM first — embeddings and RAG infrastructure are deferred to Phase 2.1 where they can draw on Phase 2.0 learnings; (2) Nexus is P3 permanent — documented dual-path with no refactoring planned, convergence is the escape hatch not the plan; (3) Bases ships in 2.0 and mobile access (Blink Shell + tmux + Tailscale) is deferred to Phase 2.1 where Bases infrastructure supports it.

Explicitly out of Phase 2.0: embeddings/RAG (Phase 2.1), mobile access (Phase 2.1), multi-model routing (Phase 3), Nexus refactoring (not planned), and non-stdio MCP transport. The execution sequence is A → B → C → D: Epic A unblocks all documentation prerequisites, Epic B hardens the foundation before feature work begins, Epics C and D are the heavier builds. See `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-03.md` for the full decision record.
