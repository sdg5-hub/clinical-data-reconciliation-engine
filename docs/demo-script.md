# Demo Script

## Goal

Show the evaluator that the project satisfies the take-home scope quickly and clearly.

## Setup

1. Start the backend on port `8000`
2. Start the frontend on port `5173`
3. Open the UI and the FastAPI docs in separate tabs

## Walkthrough

### 1. Reconciliation workflow

- Show the seeded medication payload
- Explain that the system compares conflicting records from EHR, pharmacy, and care-management sources
- Click `Run Reconciliation`
- Call out:
  - selected medication
  - confidence score
  - source rankings
  - review flags
  - recommended actions
- Use the approve/reject controls to show reviewer workflow support

### 2. Data quality workflow

- Show the seeded patient record
- Click `Validate Data Quality`
- Call out:
  - overall score
  - dimension breakdown
  - flagged issues
  - summary text

### 3. Technical credibility

- Mention protected endpoints via `X-API-Key`
- Mention optional OpenAI-backed explanation layer with deterministic fallback
- Mention automated tests and CI
- Mention architecture and prompt-engineering documents

## Close

State that the project intentionally keeps deterministic logic as the source of truth, while using the LLM only to improve explanation quality and reviewer usability.
