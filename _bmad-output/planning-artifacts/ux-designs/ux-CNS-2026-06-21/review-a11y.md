# Accessibility Review — Epic 73 Entity Intelligence UX

**Lens:** WCAG 2.2 AA floor + keyboard / SR patterns inherited from Nexus cockpit

## Verdict

**Adequate** for v1 with one **high** DOM-structure requirement and two **medium** contrast checks at implementation time. The spine's Accessibility Floor is directionally sound; implementation must not nest interactive elements.

## Findings

### **[high]** Card click target vs footer actions — nested interactive elements

EXPERIENCE.md states card body is a `<button>` and footer has separate buttons. If implementation wraps footer inside the card `<button>` (common Svelte mistake), SR users get invalid nesting and broken activation.

*Fix:* DOM must be `article.nx-entity-card > button.nx-entity-card-main + footer.nx-entity-footer` (sibling structure, mirroring `NexusDigestSignalFeed` div card with separate main button + footer). *(Patched in EXPERIENCE Interaction Primitives.)*

### **[medium]** Reason chips default non-interactive; tooltips not keyboard-accessible

Chips use `title` for full `reason.detail`. `title` is not keyboard-accessible and inconsistent SR exposure.

*Fix:* use `aria-label` on each chip (spine requires this) **and** ensure inspect drawer repeats full reasons in "Why it's here" — primary path for SR users. Optional: `+N` overflow button already keyboard-accessible.

### **[medium]** Teal chip text on teal-tinted background (`rgba(0,200,170,0.15)`)

`#00c8aa` on ~15% teal wash may fall below 4.5:1 for small 0.6875rem text. Existing anomaly spike chips use same pattern in production cockpit — likely accepted precedent.

*Fix:* at implementation, verify with contrast checker; if fail, use brighter text `#00d4aa` on darker wash or white text on solid teal chip for acceleration only.

### **[low]** Momentum line colour-only direction

Spine requires numeric line as text twin — good. Direction also encoded in colour (teal vs amber). Passes 1.4.1 if numbers present.

### **[low]** Drawer entity mode focus management

Inherited from `NexusInspectorDrawer` — no new risk if extension doesn't add extra focus traps.

### **[low]** Digest markdown section has no accessibility tree (Discord)

Plain text bullets are SR-friendly on Discord clients. No action required.

## Keyboard path checklist (for 73-6)

1. Tab: sidebar → cards (main button) → footer actions per card.
2. Enter on card main → opens inspector.
3. Esc closes inspector, focus returns (existing).
4. Manually track: anchor in tab order with discernible name ("Manually track, opens people watchlist location").
