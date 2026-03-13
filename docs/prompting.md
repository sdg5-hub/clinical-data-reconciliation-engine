# Prompt Engineering Notes

## Goals

The LLM layer is intentionally narrow:

- generate concise human-readable reasoning for reconciliation decisions
- summarize structured data-quality findings
- never replace deterministic scoring or safety flags

## Design Principles

1. Deterministic logic first
   The backend always computes the selection, scores, and safety flags before any LLM call.

2. LLM as explanation layer
   The LLM is used to improve readability and clinician-facing explanation, not to decide the underlying truth.

3. Low-variance prompts
   Prompts explicitly forbid invention and ask for concise, structured reasoning.

4. Safe fallback behavior
   If the API key is missing, rate-limited, or the provider call fails, the system returns deterministic fallback text.

5. Cost control
   Prompt-response pairs are cached in memory by a hash of model + prompt payload to avoid repeated identical calls.

## Reconciliation Prompt Shape

- System prompt:
  Explain why the selected source is most likely correct and mention safety concerns without overstating certainty.
- User payload:
  Patient context, selected source, review flags, and ranked source metadata.

## Data Quality Prompt Shape

- System prompt:
  Summarize the most important quality concerns in 1-2 sentences based only on structured findings.
- User payload:
  Overall score, breakdown, and issue list.

## Why This Approach

This keeps the system explainable and testable. The LLM improves readability while the deterministic rules remain the source of truth for scoring and safety decisions.
