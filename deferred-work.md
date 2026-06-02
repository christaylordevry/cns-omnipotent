
## session-close: replace vault export source instead of adding new one
- Priority: P2
- Class: ops reliability
- Detail: each session-close adds a duplicate vault-export-for-notebooklm.md
  source to NotebookLM instead of replacing the existing one. Notebooks fill
  up over time. Fix: delete old source by name before source_add, or use
  nlm update if available.

## session-close: show not
