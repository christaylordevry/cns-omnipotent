import type { OperatorContext } from "../../src/agents/operator-context.js";

function repeatSentence(sentence: string, count: number): string {
  return Array.from({ length: count }, () => sentence).join(" ");
}

export const NO_VAULT_CONTEXT_WARNING =
  "> [!warning] No vault context found — this synthesis is grounded in external research only.";

export function validPakeSynthesisBody(
  operatorContext: OperatorContext,
  topic = "AI agents",
): string {
  const trackA = operatorContext.tracks[0]?.name ?? "Escape Job";
  const trackB = operatorContext.tracks[1]?.name ?? "Build Agency";
  const whatWeKnow = [
    `The source set points toward ${topic} as the practical layer where research becomes action for [[note-a]], [[note-b]], [[note-c]], and [[real-note]].`,
    repeatSentence(
      "The important pattern is that operators do not need a generic summary; they need a connected readout that explains what changed, why it matters, where confidence is uneven, and which vault notes should shape the next move.",
      10,
    ),
  ].join(" ");
  const leverage = [
    `Chris Taylor is operating from ${operatorContext.location} as a ${operatorContext.positioning}, which makes the research useful only if it can be turned into a visible asset and a decision in the same session.`,
    `${trackA} and ${trackB} should both be named because the same intelligence stream can serve employment escape velocity and agency proof at once.`,
    repeatSentence(
      `${trackA} benefits when the synthesis clarifies the fastest path to runway, while ${trackB} benefits when the same analysis becomes public evidence of taste, systems thinking, and execution quality.`,
      8,
    ),
  ].join(" ");

  return [
    "## What We Know",
    whatWeKnow,
    "",
    "> [!note] Signal vs Noise",
    "> Strong sources agree on orchestration, but they differ on how much autonomy is durable.",
    "",
    "| Claim | Agree | Disagree | Implication |",
    "| --- | --- | --- | --- |",
    "| Agents need tools | Multiple sources show tool use | Some sources frame chat as enough | Prioritize workflows, not summaries |",
    "| Planning matters | Architectures emphasize decomposition | Simple tasks may not need it | Match complexity to task size |",
    "| Evaluation is hard | Reliability is repeatedly flagged | Benchmarks stay shallow | Keep decisions reversible |",
    "",
    "## The Gap Map",
    "",
    "| Known | Unknown | Why it matters |",
    "| --- | --- | --- |",
    "| Agents can call tools | Which tools matter first | Tool choice determines operator leverage |",
    "| Research can be filed | Which notes compound | Vault links shape reuse |",
    "| Prompt rules guide output | Which rules fail live | Validation protects quality |",
    "| Decisions can be listed | Which decision blocks action | Open questions should be practical |",
    "",
    "> [!warning] Blind Spots",
    "> The sources still understate cost, latency, failure recovery, and the amount of operator judgment required.",
    "",
    "## Where Chris Has Leverage",
    leverage,
    "",
    "> [!tip] Highest-Leverage Move",
    "> Turn the synthesis into one time-boxed decision memo connected to [[note-a]] and ship it before starting another research sweep.",
    "",
    "## Connected Vault Notes",
    "",
    "| Note | Why relevant | Status |",
    "| --- | --- | --- |",
    "| [[note-a]] | Source evidence | active |",
    "| [[note-b]] | Architecture signal | active |",
    "| [[note-c]] | Comparison point | active |",
    "| [[real-note]] | Fixture-backed note | active |",
    "| [[Operator-Profile]] | Operator constraints | active |",
    "",
    "## Decisions Needed",
    "",
    "### Decision: pick architecture",
    "- **Option A:** ReAct loop",
    "- **Option B:** Planner-executor",
    "- **Downstream consequence:** The choice changes latency, observability, and failure handling.",
    "",
    "### Decision: pick cadence",
    "- **Option A:** Weekly synthesis",
    "- **Option B:** Per-brief synthesis",
    "- **Downstream consequence:** The choice changes workload and compounding cadence.",
    "",
    "### Decision: pick distribution",
    "- **Option A:** Public memo",
    "- **Option B:** Private vault note",
    "- **Downstream consequence:** The choice changes proof creation and feedback speed.",
    "",
    "### Decision: pick validation gate",
    "- **Option A:** Strict PAKE++ validation",
    "- **Option B:** Prompt-only guidance",
    "- **Downstream consequence:** The choice changes rejection rate and output consistency.",
    "",
    "## Open Questions",
    "1. Which source should drive the first operator decision?",
    "2. Which vault note should become the canonical reference?",
    "3. Which next action is blocked by missing evidence?",
    "",
    "## Version / Run Metadata",
    "",
    "| Date | Brief topic | Sources ingested | Queries run |",
    "| --- | --- | --- | --- |",
    `| 2026-04-22 | ${topic} | 3 | 2 |`,
    "",
    "> [!abstract]",
    "> The synthesis shows that agent orchestration matters most when it becomes an operator decision, not a generic summary.",
    "> The highest-leverage action is to turn the research into one connected decision memo before running another sweep.",
    NO_VAULT_CONTEXT_WARNING,
  ].join("\n");
}
