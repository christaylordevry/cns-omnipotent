# Claude Code shim (Obsidian vault root)

Deploy: copy this file to `Knowledge-Vault-ACTIVE/CLAUDE.md` at the **vault root** (not the CNS implementation repository root).

Per `CNS-Phase-1-Spec.md` Deliverable 2, Claude Code loads the constitution via a file reference to `AI-Context/AGENTS.md`. Use the following line so sessions pull the live constitution without pasting it into chat:

@AI-Context/AGENTS.md

If your Claude Code build uses a different attachment or include syntax for project files, substitute it while keeping the vault-relative path `AI-Context/AGENTS.md`.

