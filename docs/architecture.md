# Architecture Overview

## Objective

The application supports two analyst-facing healthcare workflows:

1. Medication reconciliation across conflicting source systems
2. Clinical data-quality review for a single patient record

The design favors deterministic, explainable behavior over black-box automation so that reviewers can understand why the system produced a given result.

## System Components

### Frontend

- Stack: React + TypeScript + Vite
- Responsibility: provide a browser-based workspace for entering or editing JSON payloads, invoking backend workflows, and presenting structured results
- Design goal: make the demo self-contained with seeded cases and clear outputs

### Backend

- Stack: Python + FastAPI + Pydantic
- Responsibility: validate incoming request payloads, execute workflow heuristics, and return structured JSON responses
- Design goal: keep business logic explicit, testable, and easy to reason about
- Security: protected write endpoints require an API key in the `X-API-Key` header

### Testing

- Backend: `pytest`
- Frontend: `Vitest` + React Testing Library
- Goal: cover workflow behavior rather than only snapshot rendering

## Request Flow

### Medication Reconciliation

1. The frontend submits a `ReconcileMedicationRequest`
2. FastAPI validates the payload through Pydantic schemas and API key dependency
3. The reconciliation service scores each source by:
   - source reliability
   - source recency
   - cross-source agreement
   - hold/discontinue language
4. The service optionally calls the LLM layer to transform structured findings into concise human-readable reasoning
5. The service returns:
   - reconciled medication
   - confidence score
   - reasoning
   - recommended actions
   - clinical safety status

### Data Quality Validation

1. The frontend submits a `DataQualityRequest`
2. FastAPI validates the payload through Pydantic schemas and API key dependency
3. The validator evaluates:
   - completeness of required patient fields
   - date format and staleness
   - physiologic plausibility of vitals
   - internal record consistency
4. The service optionally calls the LLM layer to produce a concise summary, with deterministic fallback if the provider is unavailable
5. The service returns:
   - overall score
   - category breakdown
   - issue list with severity labels

## Design Decisions

### Why FastAPI

- clear schema-driven API design
- automatic OpenAPI docs
- low overhead for a take-home scope
- good alignment with Python-based clinical heuristics

### Why React + TypeScript

- fast delivery of a polished demo interface
- strong typing for request and response contracts
- straightforward testing for interaction flows

### Why Deterministic Heuristics

For a take-home assessment, explainability matters more than chasing speculative model sophistication. Deterministic rules are easier to defend, easier to test, and safer for healthcare-adjacent workflows.

### Why The LLM Is Not The Source Of Truth

The assignment asks for LLM integration, but using a model to make the underlying reconciliation decision would make the system harder to test and defend. This implementation keeps ranking and safety logic deterministic while using the model to improve explanations and summaries.

## Current Limitations

- no authentication or PHI-grade security controls
- no persistent data store
- no FHIR adapters or real EHR integrations yet
- no true clinical decision support approval or medical validation
- AI module remains a stub and is intentionally not in the critical path

## Production-Grade Next Steps

1. Introduce normalized medication parsing and terminology mapping
2. Add FHIR-compatible ingestion models
3. Persist audit trails for reconciliation events
4. Add role-based access control and secure secrets handling
5. Expand test coverage with API-level and browser-level integration tests
6. Add deployment configuration and environment-specific settings
