### Phase 1: The Cross-Platform Infrastructure (The Central Nervous System)

To build a universally synced, conflict-free "Single Source of Truth," we must move away from proprietary databases and rely entirely on local, plain-text Markdown files. This ensures absolute data sovereignty and future-proofs your knowledge base.

**Physical Storage and Synchronization Strategy:** The most robust, conflict-free method to sync a massive directory of `.md` files across Windows, iOS, and AI agents is **Git-based version control**. AI agents are native to developer environments and understand Git logs, file structures, and branching natively.

1. **Initialize a Private Git Repository:** Host your master vault on a private GitHub or GitLab repository. This acts as your remote backup and synchronization server. Git prevents data corruption through strict versioning and allows AI agents to read the commit history to understand how your knowledge has evolved over time.
2. **Device-Level Sync:**
    - **On Windows:** Clone the repository locally. You can use standard Git commands or a UI client (like GitHub Desktop) to push and pull changes.
    - **On iOS:** Use a Git-compatible Markdown client (like Working Copy integrated with your text editor) or securely sync the local repository via iCloud Drive for seamless mobile access.

**The Human-Readable Interface:** The absolute best software stack to act as the human interface for this system is **Obsidian**. Obsidian operates entirely on local `.md` folders, natively supports deep bidirectional linking, and is highly extensible. Furthermore, there is an actively maintained **Obsidian MCP (Model Context Protocol) server** that allows AI agents to directly search, fetch, create, update, and manage your Obsidian pages programmatically.

### Phase 2: Architecting the Markdown Data (Structuring for AI Ingestion)

AI agents—whether Claude Code, Cursor, or CLI tools—struggle when their context windows are bloated with irrelevant information. To achieve "omnipotence," your Markdown ontology must be optimized for **Progressive Disclosure**, meaning the AI only loads the information it strictly needs at that exact moment.

**The Master Folder Hierarchy & File Structure:** Your vault should be structured to map relationships naturally, as AI agents use native bash commands (like `ls`, `find`, and `grep`) to navigate folder structures and pattern-match contents.

- **`manifest.md` (The Master Index):** Located at the root, this file dictates how the AI should navigate your brain. It must classify your folders into three tiers: Tier 1 (files the model must always load as a source of truth), Tier 2 (files to load only on demand), and Tier 3 (archived data to ignore unless specifically asked).
- **`agents.md` (The Universal Standard):** Also at the root, this is the new industry-standard context file recognized by OpenAI, Gemini, Cursor, and other tools. It contains the overarching rules, persona guidelines, and working style preferences for any AI accessing the vault.
- **`/Knowledge_Base` (Tier 2):** Subdivided into domains (e.g., `/Workflows`, `/Concepts`, `/Projects`).
- **`/Active_Projects` (Tier 1):** For active execution. Every project folder must utilize **Structured Note-Taking**. Instead of one massive file, use distinct tracking files:
    - `project_brief.md`: The core objective and requirements.
    - `system_patterns.md`: The architectural and structural patterns of your ideas.
    - `progress.md`: A persistent log of completed tasks and next steps, updated by the AI after every run.
    - `decisions.md`: A log of conceptual or architectural decisions to prevent the AI from repeating past mistakes.

By using this highly granular structure, the AI can read the `manifest.md`, understand the hierarchical relationships, and retrieve precise documents without blowing out its context window.

### Phase 3: The "Omnipotence" Protocol (AI & RAG Integration)

To grant your AI models (like Cursor IDE, Claude Code, and Windsurf) "omnipotence" over your second brain without overwhelming their working memory, we will leverage the **Model Context Protocol (MCP)** combined with advanced RAG architectures. MCP acts as the universal "USB-C cable" for AI models, allowing them to securely connect to your local files and external tools.

**Core Integration Stack:**

1. **Archon (The Vector RAG Knowledge Base):** For true omnipotence over a massive vault, simple text search is insufficient. **Archon** is a context engineering knowledge base that uses a Supabase-powered vector database. You will ingest your `.md` vault into Archon. When you query Cursor or Claude, the Archon MCP will execute a semantic search (RAG), convert your text into vector embeddings, and retrieve only the highly specific, accurate paragraphs needed for the task at hand.
2. **NotebookLM as an AI "Second Brain":** Google's NotebookLM can be integrated into your workflow via its CLI/MCP. You can pipe your complex research and `/Knowledge_Base` Markdown files into NotebookLM. Instead of your coding agent manually reading 50 scattered `.md` files, it will query the NotebookLM MCP, which acts as an active RAG pipeline to synthesize answers and return structured intelligence back to your IDE.
3. **The Open Memory / Mem0 Layer:** To ensure your AI brain is universally persistent across different tools (e.g., brainstorming in Claude Desktop, coding in Cursor IDE), you must deploy the **Open Memory MCP**. This acts as a universal memory chip for your agents. Every time an agent synthesizes a new idea or finishes a workflow, it pushes that data to Open Memory. When you switch devices or platforms, the new agent simply queries the Open Memory MCP to instantly regain total context.
4. **The Obsidian MCP:** For direct file manipulation, connect the Obsidian MCP to your agents. This gives the AI the specific tools required to read, update, and append your daily notes or `progress.md` files programmatically, ensuring your human-readable vault stays in perfect sync with the AI's actions.

### Phase 4: The 7-Day Execution Roadmap

**Day 1: Storage & Interface Initialization**

- [ ] Install Obsidian on Windows and iOS.
- [ ] Create a local folder named `Master_Brain` and initialize it as an Obsidian Vault.
- [ ] Initialize a Git repository inside `Master_Brain` and push it to a private GitHub repository.
- [ ] Set up Git sync automation (or use Working Copy on iOS) to ensure cross-device consistency.

**Day 2: Constructing the Markdown Ontology**

- [ ] Create the root `manifest.md` file and explicitly define Tier 1, Tier 2, and Tier 3 routing instructions for AI agents.
- [ ] Create the `agents.md` file at the root, defining your universal AI working style, response formatting, and identity rules.
- [ ] Build the core directory structure: `/Knowledge_Base`, `/Active_Projects`, `/Journal`, and `/Templates`.
- [ ] Inside `/Templates`, create boilerplate files for `progress.md`, `decisions.md`, and `project_brief.md`.

**Day 3: Preparing the RAG Backend (Archon & Supabase)**

- [ ] Create a free project on Supabase to act as the PostgreSQL/Vector database backend.
- [ ] Clone the Archon repository locally and run the provided SQL migration scripts in your Supabase SQL editor to set up the database tables.
- [ ] Add your Supabase URL and Service Role API key to your local `.env` file.

**Day 4: Deploying the Universal Memory Layer**

- [ ] Clone the Mem0/Open Memory repository locally.
- [ ] Run `make build` and `make up` to deploy the Docker containers required for the local Open Memory server.
- [ ] Retrieve the Open Memory MCP URL/configuration and inject it into your Cursor and Claude Desktop settings.
- [ ] Configure automatic rules in Cursor (`.cursorrules`) instructing the agent to actively push project summaries and updates to the Supermemory MCP.

**Day 5: Installing the Integration MCPs**

- [ ] Install the Obsidian MCP server and configure it in your IDEs (Cursor/Windsurf) so the agents can directly query and write to your Markdown vault.
- [ ] Connect the Archon MCP server to Cursor, allowing the agent to perform semantic searches across your Markdown files when it detects uncertainty.
- [ ] (Optional) Authenticate the NotebookLM CLI via Google (`nlmn auth`) and link it to your Claude context for deep research synthesis.

**Day 6: Context Engineering & Rule Enforcement**

- [ ] Open Cursor IDE and navigate to Cursor Settings > General > Rules for AI.
- [ ] Paste a global instruction directing Cursor to _always_ read `manifest.md` first upon opening the vault, and to utilize the Obsidian and Archon MCPs for data retrieval rather than hallucinating.
- [ ] Run a test: Ask your IDE to create a new active project. Verify that it independently generates a `project_brief.md`, `system_patterns.md`, and `progress.md` based on your templates.

**Day 7: Global Testing & The "Omnipotence" Verification**

- [ ] Add several test notes and ideas into your Obsidian vault from your iOS device. Sync via Git.
- [ ] Open Claude Desktop, call the Archon/Obsidian MCP, and ask it to synthesize the ideas you just added on mobile.
- [ ] Have Claude Desktop push a finalized workflow to Open Memory.
- [ ] Open Cursor IDE, prompt the agent to "Fetch the latest workflow from Open Memory and execute it in the `/Active_Projects` folder".
- [ ] Verify the AI executes the tasks, successfully reads your synced data, and documents its outcome in `progress.md`.