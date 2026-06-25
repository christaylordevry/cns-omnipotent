"""CNS Brain Recall — A4-0 pre_llm_call inject probe stub (ADR-HERMES-015).

Production recall wiring lands in Story 79-5. This stub proves the mutation
contract: returning {"context": "..."} from pre_llm_call reaches the API user
message for the current turn only.
"""

PROBE_MARKER = "[brain-recall:probe]"


def recall_probe_hook(**_kwargs):
    """Inject probe marker on every turn (A4-0 gate)."""
    return {"context": PROBE_MARKER}


def register(ctx):
    ctx.register_hook("pre_llm_call", recall_probe_hook)
