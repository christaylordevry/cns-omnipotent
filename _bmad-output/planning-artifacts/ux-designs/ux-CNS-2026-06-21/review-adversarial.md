# Adversarial Review — Epic 73 Entity Intelligence UX

**Lens:** cynical operator / trust criterion (CAP-4, CAP-5)

## Verdict

The read-only contract is well defended. Two trust risks remain if implementation follows the spines literally without resolving flagged assumptions.

## Findings

### **[high]** Save saves a *signal*, not an *entity* (ASSUMPTION A3)

EXPERIENCE.md says Save reuses `addSignalToInvestigationBoard` against the entity's **top evidence signal**. An operator who saves "Andrej Karpathy" may believe they saved the *entity watch context*, then find only one GitHub title on the investigation board. That erodes CAP-4 ("understand why without reading code") if the board card doesn't show entity name/momentum.

*Fix:* In 73-6, either (a) board card shows entity display name + momentum in note/metadata, or (b) rename action to **Save top signal** until entity-scoped save exists. Spine should note visible board labeling expectation.

### **[medium]** "Manually track" for `account` and `org` entities vs people-only YAML

Emerging lane can surface `account` and `org` types (architecture ADR-E73-003). Deep-link to `nexus-people.yaml` is correct for `person` but misleading for `org:github:ggml-org` — the YAML cannot track orgs in v1.

*Fix:* EXPERIENCE.md gates Manually track by entityType — shown for `person` and `account`; hidden for `org`. *(Patched at finalize.)*

### **[medium]** Collapsed evidence traces vs FR4 "supporting source traces on card"

FR4 requires source traces on the card. Collapsed "5 source traces ▸" is technically present but easy to miss on mobile; operator may think traces are inspector-only.

*Fix:* mock shows collapsed default; spine already requires expand. Acceptable if expand is one tap and inspector is one click — document that FR4 satisfied by collapsed summary + expand, not title-only.

### **[low]** Compare deferred — operator may still expect parity with topic inspector

Topic inspector has Compare in the action grid. Entity cards omit Compare with no on-surface explanation (only DESIGN Do's and Don'ts).

*Fix:* optional footnote in module header: "Entity compare not in v1" — probably overkill; deferral in DESIGN is enough for internal consumers.

### **[low]** Digest line grammar uses markdown bold; Discord mobile strips formatting unpredictably

CAP-8 success depends on one-line clarity without bold. EXPERIENCE examples use `**name**` — fine for dashboard markdown; Discord may render plain.

*Fix:* lead with name before punctuation; bold is enhancement not dependency (already true in examples).

## What would actually break trust

- Shipping any Approve or auto-YAML write (correctly excluded).
- Shipping Compare with undefined behavior (correctly deferred).
- Silent Save that doesn't show what was saved (needs 73-6 labeling).
