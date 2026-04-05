# Epic 8 Retrospective — Nexus coexistence documentation

**Date:** 2026-04-05
**Epic:** 8 (story 8-1)
**Status:** done

## What the epic delivered

Single-story documentation epic making the dual-path model explicit: Nexus as a trusted write surface outside Vault IO (no WriteGate, no PAKE, no vault_* audit append on those writes), while IDE/MCP paths stay governed.

## Systems lesson

This work is as much governance design as prose. The story correctly pins constitution changes on a human operator for AI-Context/** and mirrored AGENTS.md, which avoids automated agents weakening WriteGate-protected surfaces while still landing normative text in spec and vault.

## What to carry forward

Treat docs-only epics that change operator mental models as first-class delivery. Misunderstanding "everything is audit-logged" would have been a higher cost than skipping another code story. Keep verify + constitution tests as the merge gate whenever AGENTS mirrors move.

## For later epics

Epic 8 deliberately touched no src/. Anything that needs enforcement still belongs in code epics (Epic 9+), not in constitution text alone.

## Post-close note

The AGENTS.md v1.3.0 edit (Section 5 Nexus, audit language scoped to Vault IO path) was committed 2026-04-05 as 3ca61d3, three epics after 8-1 was marked done. The story correctly required operator-apply for the constitution mirror but the apply step was missed at close. Verified clean on 2026-04-05 by diffing all three AGENTS.md copies.
