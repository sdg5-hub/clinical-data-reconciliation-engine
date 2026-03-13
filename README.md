# Clinical Data Reconciliation Engine

Small FastAPI prototype for reconciling medication records across sources and flagging basic clinical data-quality issues.

## Current Status

Implemented:
- FastAPI backend with 2 POST endpoints
- Pydantic request and response schemas
- Deterministic medication reconciliation heuristics with safety review flags
- Deterministic data-quality validation heuristics with score breakdowns
- React + TypeScript frontend workspace for both workflows
- Backend and frontend test coverage for core flows

Still limited:
- AI-generated clinical reasoning remains a stub
- No persistent database or real EHR/FHIR integration
- No authentication or production deployment configuration

## Project Structure

```text
backend/
  main.py
  reconciliation_service.py
  data_validator.py
  schemas.py
frontend/
  src/
tests/
docs/
```

## Setup

From the repository root:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## Run The API

Preferred command from the repository root:

```bash
.venv/bin/uvicorn backend.main:app --reload
```

The API will be available at:

```text
http://127.0.0.1:8000
```

Swagger UI:

```text
http://127.0.0.1:8000/docs
```

Health endpoint:

```text
http://127.0.0.1:8000/health
```

## Run The Frontend

From `frontend/`:

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Frontend UI:

```text
http://127.0.0.1:5173
```

## Environment Configuration

Backend `.env` values:

- `APP_API_KEY`: required by protected POST endpoints
- `OPEN_API_KEY`: optional OpenAI key for explanation generation
- `OPENAI_MODEL`: model name for the explanation layer

Frontend `.env` values:

- `VITE_API_BASE_URL`: backend base URL
- `VITE_APP_API_KEY`: must match `APP_API_KEY`

## Testing

Backend:

```bash
.venv/bin/pytest -q tests
```

Frontend:

```bash
cd frontend
npm test
```

## Endpoints

### `GET /`

Health check response:

```json
{
  "message": "Clinical Data Reconciliation Engine API is running"
}
```

### `POST /api/reconcile/medication`

Sample request:

```json
{
  "patient_context": {
    "age": 45,
    "conditions": ["hypertension"]
  },
  "sources": [
    {
      "system": "ehr",
      "medication": "Lisinopril 10mg",
      "last_updated": "2026-03-01",
      "source_reliability": "high"
    },
    {
      "system": "pharmacy",
      "medication": "Lisinopril 5mg",
      "last_filled": "2026-02-28",
      "source_reliability": "medium"
    }
  ]
}
```

Sample `curl`:

```bash
curl -X POST http://127.0.0.1:8000/api/reconcile/medication \
  -H "Content-Type: application/json" \
  -d '{
    "patient_context": {
      "age": 45,
      "conditions": ["hypertension"]
    },
    "sources": [
      {
        "system": "ehr",
        "medication": "Lisinopril 10mg",
        "last_updated": "2026-03-01",
        "source_reliability": "high"
      },
      {
        "system": "pharmacy",
        "medication": "Lisinopril 5mg",
        "last_filled": "2026-02-28",
        "source_reliability": "medium"
      }
    ]
  }'
```

Response highlights:
- selected source system
- review flags for manual follow-up
- ranked source scoring for explainability
- API key required in `X-API-Key`

### `POST /api/validate/data-quality`

Sample request:

```json
{
  "demographics": {
    "name": "Jane Doe",
    "dob": "1980-01-01",
    "gender": "F"
  },
  "medications": ["Lisinopril"],
  "allergies": [],
  "conditions": ["hypertension"],
  "vital_signs": {
    "blood_pressure": "350/200",
    "heart_rate": 80
  },
  "last_updated": "2025-01-01"
}
```

Sample `curl`:

```bash
curl -X POST http://127.0.0.1:8000/api/validate/data-quality \
  -H "Content-Type: application/json" \
  -d '{
    "demographics": {
      "name": "Jane Doe",
      "dob": "1980-01-01",
      "gender": "F"
    },
    "medications": ["Lisinopril"],
    "allergies": [],
    "conditions": ["hypertension"],
    "vital_signs": {
      "blood_pressure": "350/200",
      "heart_rate": 80
    },
    "last_updated": "2025-01-01"
  }'
```

Response highlights:
- overall score plus category breakdown
- issue list with severities
- summary string suitable for dashboards or logs
- API key required in `X-API-Key`

## Notes

- The reconciliation and validation logic are heuristic only and not clinically authoritative.
- The AI layer is optional and used only for explanation/summarization; deterministic scoring remains the source of truth.
- See `docs/architecture.md` for the system design summary.
- Backend configuration is environment-based through `.env` variables, with examples in `.env.example`.
- Prompt design notes and LLM fallback behavior are documented in `docs/prompting.md`.
