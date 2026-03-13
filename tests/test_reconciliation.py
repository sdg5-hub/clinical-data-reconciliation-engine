from backend.reconciliation_service import reconcile_medication
from backend.schemas import PatientContext, MedicationSource, ReconcileMedicationRequest


def build_request(*sources: MedicationSource) -> ReconcileMedicationRequest:
    return ReconcileMedicationRequest(
        patient_context=PatientContext(
            age=67,
            conditions=["Hypertension"],
            recent_labs={"creatinine": 1.0},
        ),
        sources=list(sources),
    )


def test_prefers_authoritative_recent_source_when_records_conflict():
    payload = build_request(
        MedicationSource(
            system="Epic EHR",
            medication="Lisinopril 10mg daily",
            last_updated="2026-03-10",
            source_reliability="high",
        ),
        MedicationSource(
            system="Retail pharmacy",
            medication="Lisinopril 5mg daily",
            last_filled="2026-03-08",
            source_reliability="medium",
        ),
    )

    result = reconcile_medication(payload)

    assert result.reconciled_medication == "Lisinopril 10mg daily"
    assert result.clinical_safety_check == "PASSED"
    assert result.confidence_score >= 0.7
    assert result.selected_source_system == "Epic EHR"
    assert result.source_rankings[0].rank == 1


def test_flags_conflicting_medications_for_review():
    payload = build_request(
        MedicationSource(
            system="Epic EHR",
            medication="Metformin 1000mg BID",
            last_updated="2026-03-10",
            source_reliability="high",
        ),
        MedicationSource(
            system="External note",
            medication="Insulin glargine 10 units nightly",
            last_updated="2026-03-09",
            source_reliability="medium",
        ),
    )

    result = reconcile_medication(payload)

    assert result.clinical_safety_check == "REQUIRES_REVIEW"
    assert any("discrepancy" in action.lower() for action in result.recommended_actions)
    assert "disagreement" in result.reasoning.lower()
    assert "conflicting_medication_names" in result.review_flags


def test_flags_metformin_with_ckd_context():
    payload = ReconcileMedicationRequest(
        patient_context=PatientContext(
            age=71,
            conditions=["Chronic kidney disease", "Type 2 diabetes"],
            recent_labs={"creatinine": 1.9},
        ),
        sources=[
            MedicationSource(
                system="Epic EHR",
                medication="Metformin 1000mg BID",
                last_updated="2026-03-10",
                source_reliability="high",
            ),
            MedicationSource(
                system="Retail pharmacy",
                medication="Metformin 1000mg BID",
                last_filled="2026-03-09",
                source_reliability="medium",
            ),
        ],
    )

    result = reconcile_medication(payload)

    assert result.clinical_safety_check == "REQUIRES_REVIEW"
    assert any("renal function" in action.lower() for action in result.recommended_actions)
    assert "chronic kidney disease" in result.reasoning.lower()
    assert "metformin_with_ckd_context" in result.review_flags
