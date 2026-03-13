from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)
AUTH_HEADERS = {"X-API-Key": "clinical-demo-key"}


def test_root_and_health_endpoints_expose_operational_metadata():
    root_response = client.get("/")
    assert root_response.status_code == 200
    assert root_response.json()["version"] == "1.0.0"

    health_response = client.get("/health")
    assert health_response.status_code == 200
    payload = health_response.json()
    assert payload["status"] == "ok"
    assert payload["service"] == "Clinical Data Reconciliation Engine"
    assert payload["environment"] == "development"
    assert "timestamp_utc" in payload


def test_protected_endpoints_require_api_key():
    response = client.post(
        "/api/reconcile/medication",
        json={"patient_context": {"age": 67, "conditions": []}, "sources": []},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid API key"


def test_reconcile_endpoint_returns_explainable_rankings():
    response = client.post(
        "/api/reconcile/medication",
        json={
            "patient_context": {
                "age": 67,
                "conditions": ["Chronic kidney disease"],
                "recent_labs": {"creatinine": 1.9},
            },
            "sources": [
                {
                    "system": "Epic EHR",
                    "medication": "Metformin 1000mg BID",
                    "last_updated": "2026-03-10",
                    "source_reliability": "high",
                },
                {
                    "system": "Retail pharmacy",
                    "medication": "Metformin 1000mg BID",
                    "last_filled": "2026-03-09",
                    "source_reliability": "medium",
                },
            ],
        },
        headers=AUTH_HEADERS,
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["selected_source_system"] == "Epic EHR"
    assert payload["clinical_safety_check"] == "REQUIRES_REVIEW"
    assert payload["review_flags"] == ["metformin_with_ckd_context"]
    assert len(payload["source_rankings"]) == 2
    assert payload["source_rankings"][0]["rank"] == 1


def test_data_quality_endpoint_returns_summary():
    response = client.post(
        "/api/validate/data-quality",
        json={
            "demographics": {"name": "", "dob": "1980-01-01", "gender": ""},
            "medications": [],
            "allergies": [],
            "conditions": [],
            "vital_signs": {"blood_pressure": "350/200", "heart_rate": 10},
            "last_updated": "2024-01-01",
        },
        headers=AUTH_HEADERS,
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["overall_score"] < 60
    assert payload["summary"].startswith("Detected ")
    assert len(payload["issues_detected"]) >= 5
