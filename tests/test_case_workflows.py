from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)
AUTH_HEADERS = {"X-API-Key": "clinical-demo-key"}


def test_seeded_case_is_listed():
    response = client.get("/api/cases", headers=AUTH_HEADERS)

    assert response.status_code == 200
    payload = response.json()
    assert any(case["id"] == "seeded-jane-doe" for case in payload)


def test_can_create_case_and_run_case_workflows():
    create_response = client.post(
        "/api/cases",
        headers=AUTH_HEADERS,
        json={
            "name": "Case API Demo",
            "risk": "medium",
            "reconciliation_request": {
                "patient_context": {
                    "age": 60,
                    "conditions": ["Hypertension"],
                    "recent_labs": {"egfr": 72},
                },
                "sources": [
                    {
                        "system": "Hospital EHR",
                        "medication": "Lisinopril 10mg daily",
                        "last_updated": "2026-03-10",
                        "source_reliability": "high",
                    },
                    {
                        "system": "Retail pharmacy",
                        "medication": "Lisinopril 5mg daily",
                        "last_filled": "2026-03-08",
                        "source_reliability": "medium",
                    },
                ],
            },
            "quality_request": {
                "demographics": {"name": "Case API Demo", "dob": "1965-01-01", "gender": "M"},
                "medications": ["Lisinopril"],
                "allergies": ["Penicillin"],
                "conditions": ["Hypertension"],
                "vital_signs": {"blood_pressure": "120/80", "heart_rate": 80},
                "last_updated": "2026-03-10",
            },
        },
    )

    assert create_response.status_code == 200
    case_id = create_response.json()["id"]

    reconcile_response = client.post(f"/api/cases/{case_id}/reconciliation/run", headers=AUTH_HEADERS)
    assert reconcile_response.status_code == 200
    assert reconcile_response.json()["confidence_breakdown"]["source_reliability"] > 0
    assert reconcile_response.json()["rule_hits"]
    assert reconcile_response.json()["recommendation_disposition"] in {
        "safe_to_approve",
        "requires_review",
        "manual_review_recommended",
    }

    quality_response = client.post(f"/api/cases/{case_id}/data-quality/run", headers=AUTH_HEADERS)
    assert quality_response.status_code == 200
    assert "issue_groups" in quality_response.json()
    if quality_response.json()["issues_detected"]:
        first_issue = quality_response.json()["issues_detected"][0]
        assert "blocking" in first_issue
        assert "remediation" in first_issue

    approve_response = client.post(f"/api/cases/{case_id}/reviewer/approve", headers=AUTH_HEADERS, json={})
    assert approve_response.status_code == 200
    assert approve_response.json()["reviewer_decision"] == "approved"
    assert approve_response.json()["reason_recorded"] is False

    audit_response = client.get(f"/api/cases/{case_id}/audit", headers=AUTH_HEADERS)
    assert audit_response.status_code == 200
    assert len(audit_response.json()) >= 3


def test_scanner_event_writes_audit_entry():
    response = client.post(
        "/api/cases/seeded-jane-doe/scanner-events",
        headers=AUTH_HEADERS,
        json={
            "raw_value": "00069153041",
            "source_type": "manual-entry",
            "inferred_medication": "Metformin 500mg tablet",
            "confidence": 0.98,
            "candidate_count": 2,
            "metadata": {"code_type": "manual-text"},
        },
    )

    assert response.status_code == 200
    audit = client.get("/api/cases/seeded-jane-doe/audit", headers=AUTH_HEADERS)
    assert audit.status_code == 200
    assert any(event["event_type"] == "scanner_event" for event in audit.json())


def test_reviewer_reject_requires_reason():
    response = client.post("/api/cases/seeded-jane-doe/reviewer/reject", headers=AUTH_HEADERS, json={})
    assert response.status_code == 422


def test_manual_review_requires_reason():
    response = client.post("/api/cases/seeded-jane-doe/reviewer/manual-review", headers=AUTH_HEADERS, json={})
    assert response.status_code == 422


def test_data_quality_marks_implausible_vitals_as_blocking():
    response = client.post("/api/cases/seeded-jane-doe/data-quality/run", headers=AUTH_HEADERS)
    assert response.status_code == 200
    issues = response.json()["issues_detected"]
    implausible = next(issue for issue in issues if issue["field"] == "vital_signs.blood_pressure")
    assert implausible["blocking"] is True
    assert implausible["approval_impact"] == "blocking"


def test_can_ingest_mock_fhir_bundle():
    response = client.post(
        "/api/cases/seeded-jane-doe/ingest-fhir",
        headers=AUTH_HEADERS,
        json={
            "bundle": {
                "resourceType": "Bundle",
                "entry": [
                    {
                        "resource": {
                            "resourceType": "Patient",
                            "name": [{"text": "FHIR Jane"}],
                            "gender": "female",
                            "birthDate": "1980-01-01",
                        }
                    },
                    {
                        "resource": {
                            "resourceType": "Condition",
                            "code": {"text": "Type 2 diabetes"},
                        }
                    },
                    {
                        "resource": {
                            "resourceType": "MedicationStatement",
                            "status": "active",
                            "meta": {"source": "FHIR PCP"},
                            "medicationCodeableConcept": {"text": "Metformin 500mg BID"},
                            "effectiveDateTime": "2026-03-12",
                        }
                    },
                ]
            }
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["normalized_records"]["patient"]["name"] == "FHIR Jane"
    assert payload["normalized_records"]["medications"][0]["medication"] == "Metformin 500mg BID"


def test_can_generate_pyhealth_patient_view_from_case_and_fhir():
    ingest_response = client.post(
        "/api/cases/seeded-jane-doe/ingest-fhir",
        headers=AUTH_HEADERS,
        json={
            "bundle": {
                "resourceType": "Bundle",
                "entry": [
                    {
                        "resource": {
                            "resourceType": "Patient",
                            "name": [{"text": "FHIR Jane"}],
                            "gender": "female",
                            "birthDate": "1980-01-01",
                        }
                    },
                    {
                        "resource": {
                            "resourceType": "MedicationStatement",
                            "status": "active",
                            "meta": {"source": "FHIR PCP"},
                            "medicationCodeableConcept": {"text": "Metformin 500mg BID"},
                            "effectiveDateTime": "2026-03-12",
                        }
                    },
                    {
                        "resource": {
                            "resourceType": "Observation",
                            "code": {"text": "eGFR"},
                            "valueQuantity": {"value": 45},
                        }
                    },
                ],
            }
        },
    )
    assert ingest_response.status_code == 200

    patient_response = client.get("/api/cases/seeded-jane-doe/pyhealth/patient", headers=AUTH_HEADERS)
    assert patient_response.status_code == 200
    payload = patient_response.json()
    assert payload["patient_id"] == "seeded-jane-doe"
    assert payload["visit_count"] >= 2
    assert payload["event_count"] >= 4
    assert "MEDICATION_SOURCE" in payload["available_tables"]
    assert payload["source_summary"]["has_normalized_fhir"] is True

    events_response = client.get("/api/cases/seeded-jane-doe/pyhealth/events", headers=AUTH_HEADERS)
    assert events_response.status_code == 200
    events = events_response.json()
    assert any(event["table"] == "FHIR_MEDICATION" for event in events)
    assert any(event["table"] == "VITAL_SIGNS" for event in events)
