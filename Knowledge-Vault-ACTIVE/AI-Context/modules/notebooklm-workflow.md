# Module: NotebookLM workflow

Load this file when performing NotebookLM work: querying notebooks, adding sources, converting cited answers into PAKE notes, or exporting vault content back into NotebookLM.

This module assumes the vault constitution is loaded from `AI-Context/AGENTS.md`. If anything here conflicts with `AGENTS.md`, the constitution wins.

## Prerequisite: pick the right notebook

Always start by reading:

- `03-Resources/NotebookLM-Project-Map.md`

If the project you are working on is unmapped, stop and ask the operator to map or create the notebook before continuing.

## Tooling surfaces

- **NotebookLM MCP**: tools like `notebook_query`, `cross_notebook_query`, `source_add`, `research_start`, `download_artifact`, plus note and studio helpers.
- **Vault IO MCP**: for governed writes into the vault (`vault_create_note`, `vault_search`, `vault_read_frontmatter`), including audit log lines on successful mutations.

If MCP tools are not available in the current session, do not invent tool output. Provide the intended tool calls and the expected shapes, then stop.

## Workflow A: query a notebook (with citations)

1. Read `03-Resources/NotebookLM-Project-Map.md` and identify the notebook name for the target project.
2. Use `notebook_query` when you know the notebook.
3. Use `cross_notebook_query` only when the research must span multiple projects.
4. Parse the response as strict JSON.
5. Extract:
   - The natural language answer text
   - The citations list, with titles and any available URLs or source identifiers

### Citation handling rule

Do not treat NotebookLM citations as verified facts by default. Use `verification_status: pending` unless you have independently validated the claims from primary sources that exist in the vault.

## Workflow B: convert an answer into an InsightNote

Create a PAKE-compliant `InsightNote` under `03-Resources/` (project-scoped subfolder when applicable).

Minimum requirements:

- **Frontmatter**: valid PAKE fields per `AGENTS.md`
- **source_uri**: `notebooklm://<notebook name>`
- **Citations**:
  - Prefer wikilinks: `[[Exact Source Title]]` when a corresponding SourceNote exists in the vault
  - If a source is not yet in the vault, keep the citation label in backticks and add a short note that it should be ingested and linked later

Recommended InsightNote skeleton:

- Title
- Question
- Answer (from NotebookLM, do not fabricate)
- Citations (wikilinks or placeholders)
- Open questions or follow-up tasks (optional)

## Workflow C: add sources to a notebook

Use `source_add` to add new material to the mapped notebook. Supported patterns depend on the connector, but generally include:

- `source_type: "url"` for web pages and YouTube URLs
- `source_type: "file"` for local PDFs or documents
- `source_type: "text"` for pasted excerpts when a URL is unavailable
- `source_type: "drive"` for Google Drive content (if supported by your connector)

Rules:

- Prefer adding sources by URL or file path, not by pasted paraphrases.
- Never paste secrets, tokens, or private credentials as source text.

## Workflow D: Perplexity fallback (source discovery)

When `research_start` or NotebookLM sources are missing key references:

1. Use Perplexity Deep Research to collect high quality citation links.
2. Add those citations into NotebookLM with `source_add(source_type="url", url=...)`.
3. Re-run `notebook_query` after sources finish ingesting.

## Workflow E: audio overviews (optional)

If the NotebookLM connector supports audio artifact generation:

- Create or request an audio overview for the mapped notebook.
- Use `download_artifact` with `artifact_type: "audio"`.
- Store outputs under a project-scoped path, for example:
  - `03-Resources/<Project>/audio/`

Keep filenames deterministic and include the date.

## Workflow F: export vault content back to NotebookLM

Use the export script in the CNS implementation repo:

- `bash scripts/export-vault-for-notebooklm.sh`

Notes:

- Override the vault root with `CNS_VAULT_ROOT` when needed.
- The script outputs: `scripts/output/vault-export-for-notebooklm.md`
- Before uploading, check file size against current NotebookLM source limits in the product UI.

## End to end smoke test (recommended)

For one mapped project:

1. Query the notebook with a specific research question.
2. Create one InsightNote in the vault with citations.
3. Verify PAKE frontmatter validity.
4. Verify the Vault IO audit log line exists for the create (when using Vault IO MCP).

