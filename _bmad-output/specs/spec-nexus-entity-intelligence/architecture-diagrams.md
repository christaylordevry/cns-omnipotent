# Architecture Diagrams

Conceptual data flow from source PRD. Implementation details deferred to architecture (Q1–Q5).

## Nexus signal model (existing)

```
sources -> raw signals -> classified entities -> scored events -> dashboard feeds -> actions
```

## Entity intelligence insertion point

This feature inserts between scored signals and product presentation as an entity-intelligence analysis stage.

```
1. Existing sources produce normalized signals.
2. The entity-intelligence stage reads author/profile/entity-adjacent fields and signal metadata.
3. It builds candidate entities and tracked-entity activity summaries over defined windows.
4. It scores them for emergence or acceleration.
5. It emits two output sets: tracked entities in motion, and emerging entities to review.
6. The dashboard and digest render those outputs with evidence and reasoning.
```

## Dual-lane product model

```mermaid
flowchart TB
  subgraph ingest [Existing pipeline — no new adapters]
    S[19+ digest sources]
    R[Raw signals]
    N[Normalized / scored signals]
    S --> R --> N
  end

  subgraph entityIntel [Entity Intelligence — Epic 73 analysis stage]
    E[Entity extraction from structured fields]
    T[Tracked lane: acceleration vs baseline]
    M[Emerging lane: traction + cold-start rules]
    E --> T
    E --> M
  end

  subgraph outputs [Read-only v1 outputs]
    TIM[Tracked Entities in Motion]
    EER[Emerging Entities to Review]
    T --> TIM
    M --> EER
  end

  subgraph surfaces [Product surfaces]
    D[Nexus dashboard modules]
    G[Morning digest sections]
    TIM --> D
    EER --> D
    TIM --> G
    EER --> G
  end

  N --> E
```

## Epic boundary

```mermaid
flowchart LR
  E72[Epic 72 — source adapters] -->|NOT this feature| Adapters[New external sources]
  E73[Epic 73 — entity intelligence] -->|Analysis only| Existing[Existing signal store]
```

## Strategic phases

| Phase | Scope |
|---|---|
| v1 | Emergence from inbound signals + tracked-entity monitoring |
| v2 | Richer free-text extraction; better company/product coverage |
| v3 | Topic-driven outbound discovery beyond current signal set |
