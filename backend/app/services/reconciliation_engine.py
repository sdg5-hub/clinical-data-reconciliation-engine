from ...reconciliation_service import reconcile_medication
from ..schemas.reconciliation import (
    EvidenceCard,
    MedicationChange,
    ReasoningTraceStep,
    ReconcileMedicationRequest,
    ReconcileMedicationResponse,
)
from .clinical_safety_engine import build_conflict_severity
from .confidence_engine import build_confidence_breakdown


def _build_rule_hits(
    request: ReconcileMedicationRequest,
    base_response: ReconcileMedicationResponse,
) -> list[str]:
    rule_hits: list[str] = []
    selected = next(
        (ranking for ranking in base_response.source_rankings if ranking.rank == 1),
        None,
    )
    if selected and selected.system.lower().startswith("primary care"):
        rule_hits.append("primary_care_more_recent")
    if any("pharmacy" in source.system.lower() for source in request.sources):
        rule_hits.append("pharmacy_fill_verified")
    if any("supported_by_multiple_sources" in ranking.review_flags for ranking in base_response.source_rankings):
        rule_hits.append("cross_source_agreement_detected")
    if "metformin_with_ckd_context" in base_response.review_flags:
        rule_hits.append("metformin_ckd_dose_review")
    if any("status_term_detected" in ranking.review_flags for ranking in base_response.source_rankings):
        rule_hits.append("status_term_lowers_confidence")
    if any("pharmacy" in source.system.lower() and source.last_filled for source in request.sources):
        rule_hits.append("pharmacy_fill_outdated")
    return rule_hits


def _build_disposition(
    base_response: ReconcileMedicationResponse,
    conflict_level: str,
) -> str:
    if base_response.clinical_safety_check != "PASSED" and conflict_level == "HIGH":
        return "manual_review_recommended"
    if base_response.review_flags or base_response.clinical_safety_check != "PASSED":
        return "requires_review"
    return "safe_to_approve"


def run_reconciliation(request: ReconcileMedicationRequest) -> ReconcileMedicationResponse:
    base_response = reconcile_medication(request)

    selected_source = next(
        (ranking for ranking in base_response.source_rankings if ranking.rank == 1),
        None,
    )
    reliability_score = selected_source.score if selected_source else 40
    freshness_score = 25 if selected_source and selected_source.freshness_evidence else 10
    plausibility_score = 20 if base_response.clinical_safety_check == "PASSED" else 12
    fill_verification_score = 8 if any("pharmacy" in source.system.lower() for source in request.sources) else 4
    conflict_penalty = -10 if base_response.review_flags else -2

    confidence_breakdown = build_confidence_breakdown(
        reliability_score=reliability_score,
        freshness_score=freshness_score,
        plausibility_score=plausibility_score,
        fill_verification_score=fill_verification_score,
        conflict_penalty=conflict_penalty,
    )

    reasoning_trace = [
        ReasoningTraceStep(
            label="source_reliability",
            detail=", ".join(
                f"{source.system}: {(source.score / 100):.2f}" for source in base_response.source_rankings
            ),
        ),
        ReasoningTraceStep(
            label="recency",
            detail=", ".join(
                f"{source.system} updated {source.freshness_evidence}"
                for source in base_response.source_rankings[:2]
            ),
        ),
        ReasoningTraceStep(
            label="clinical_plausibility",
            detail=base_response.reasoning,
        ),
        ReasoningTraceStep(
            label="final_decision",
            detail=f"Selected {base_response.reconciled_medication} with confidence {base_response.confidence_score:.2f}.",
        ),
    ]

    conflict_severity = build_conflict_severity(
        request=request,
        reconciled_medication=base_response.reconciled_medication,
        review_flags=base_response.review_flags,
    )

    what_changed = [
        MedicationChange(
            system=source.system,
            source_medication=source.medication,
            reconciled_medication=base_response.reconciled_medication,
            changed=source.medication != base_response.reconciled_medication,
            explanation=(
                "Matches the final decision"
                if source.medication == base_response.reconciled_medication
                else "Source differs from the reconciled recommendation"
            ),
        )
        for source in request.sources
    ]

    rule_hits = _build_rule_hits(request, base_response)
    evidence_cards = [
        EvidenceCard(
            system=ranking.system,
            reliability=round(ranking.score / 100, 2),
            recency=ranking.freshness_evidence,
            safety_notes=(
                ["Renal dosing aligned with current recommendation"]
                if "metformin_with_ckd_context" in base_response.review_flags and ranking.rank == 1
                else ["Safety review required"]
                if "metformin_with_ckd_context" in base_response.review_flags
                else ["No active safety override detected"]
            ),
            conflict_notes=ranking.review_flags or ["No ranking-specific conflicts"],
        )
        for ranking in base_response.source_rankings
    ]
    disposition = _build_disposition(base_response, conflict_severity.level)

    return ReconcileMedicationResponse(
        **base_response.model_dump(),
        confidence_breakdown=confidence_breakdown,
        reasoning_trace=reasoning_trace,
        conflict_severity=conflict_severity,
        what_changed=what_changed,
        rule_hits=rule_hits,
        recommendation_disposition=disposition,
        evidence_cards=evidence_cards,
    )
