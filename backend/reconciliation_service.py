from collections import Counter
from datetime import date, datetime
import re
from typing import Optional

try:
    from .ai_engine import generate_clinical_reasoning
    from .schemas import MedicationSourceRanking, ReconcileMedicationRequest, ReconcileMedicationResponse
except ImportError:
    from ai_engine import generate_clinical_reasoning
    from schemas import MedicationSourceRanking, ReconcileMedicationRequest, ReconcileMedicationResponse

RELIABILITY_SCORES = {
    "high": 60,
    "medium": 40,
    "low": 20,
}

STOPWORDS = {
    "mg",
    "mcg",
    "g",
    "ml",
    "po",
    "bid",
    "tid",
    "qid",
    "daily",
    "nightly",
    "tablet",
    "tab",
    "capsule",
    "cap",
    "prn",
}

STATUS_TERMS = ("hold", "held", "stop", "stopped", "discontinue", "discontinued")


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def _normalized_medication_name(value: str) -> str:
    tokens = re.findall(r"[a-zA-Z]+", value.lower())
    significant = [token for token in tokens if token not in STOPWORDS]
    if not significant:
        return value.strip().lower()
    return " ".join(significant[:3])


def _freshness_score(*dates: Optional[date]) -> int:
    usable_dates = [candidate for candidate in dates if candidate is not None]
    if not usable_dates:
        return 0

    days_old = (date.today() - max(usable_dates)).days
    if days_old <= 30:
        return 25
    if days_old <= 90:
        return 15
    if days_old <= 180:
        return 8
    return 0


def _contains_status_term(value: str) -> bool:
    lowered = value.lower()
    return any(term in lowered for term in STATUS_TERMS)


def reconcile_medication(data: ReconcileMedicationRequest) -> ReconcileMedicationResponse:
    if not data.sources:
        return ReconcileMedicationResponse(
            reconciled_medication="Unknown",
            confidence_score=0.2,
            reasoning="No source medication records were provided, so a reconciled medication could not be selected.",
            recommended_actions=[
                "Obtain medication records from at least one authoritative source",
                "Confirm the active medication list with the treating clinician",
            ],
            clinical_safety_check="REQUIRES_REVIEW",
            selected_source_system="Unknown",
            review_flags=["no_sources_provided"],
            source_rankings=[],
        )

    normalized_names = [_normalized_medication_name(source.medication) for source in data.sources]
    name_counts = Counter(normalized_names)
    scored_sources = []

    for source, normalized_name in zip(data.sources, normalized_names):
        score = RELIABILITY_SCORES.get(source.source_reliability.lower(), 10)
        last_updated = _parse_date(source.last_updated)
        last_filled = _parse_date(source.last_filled)
        score += _freshness_score(last_updated, last_filled)
        review_flags = []

        if name_counts[normalized_name] > 1:
            score += 15
            review_flags.append("supported_by_multiple_sources")
        if _contains_status_term(source.medication):
            score -= 20
            review_flags.append("status_term_detected")

        freshness_evidence = source.last_updated or source.last_filled or "No recent date available"

        scored_sources.append(
            {
                "score": score,
                "source": source,
                "normalized_name": normalized_name,
                "freshness_evidence": freshness_evidence,
                "review_flags": review_flags,
            }
        )

    scored_sources.sort(key=lambda item: item["score"], reverse=True)
    best = scored_sources[0]
    top_score = best["score"]
    best_source = best["source"]
    best_name = best["normalized_name"]
    second_score = scored_sources[1]["score"] if len(scored_sources) > 1 else max(0, top_score - 20)

    conflicting_names = len(set(normalized_names)) > 1
    conditions = {condition.lower() for condition in data.patient_context.conditions}
    renal_risk = "chronic kidney disease" in conditions
    metformin_selected = "metformin" in best_name
    requires_review = conflicting_names or _contains_status_term(best_source.medication) or (renal_risk and metformin_selected)
    review_flags = []
    if conflicting_names:
        review_flags.append("conflicting_medication_names")
    if _contains_status_term(best_source.medication):
        review_flags.append("selected_record_contains_status_term")
    if renal_risk and metformin_selected:
        review_flags.append("metformin_with_ckd_context")

    margin = max(0, top_score - second_score)
    confidence = min(0.97, round(0.45 + (top_score / 120) * 0.3 + (margin / 60) * 0.2, 2))
    if requires_review:
        confidence = max(0.35, round(confidence - 0.12, 2))

    reasoning_parts = [
        f"Selected {best_source.system} because it had the strongest combined reliability and recency score."
    ]
    if name_counts[best_name] > 1:
        reasoning_parts.append("Multiple sources supported the same underlying medication name.")
    if conflicting_names:
        reasoning_parts.append("Source records still contain clinically relevant disagreement that should be reviewed.")
    if _contains_status_term(best_source.medication):
        reasoning_parts.append("The selected record includes a hold or discontinuation term, so it may not represent an active medication.")
    if renal_risk and metformin_selected:
        reasoning_parts.append("Patient context includes chronic kidney disease while the selected medication contains metformin.")

    recommended_actions = []
    if conflicting_names:
        recommended_actions.append("Resolve the discrepancy between conflicting source medication records before finalizing the active list")
    else:
        recommended_actions.append("Confirm the reconciled medication against the latest clinician-authored note")

    if _contains_status_term(best_source.medication):
        recommended_actions.append("Verify whether the medication is active, held, or discontinued")
    else:
        recommended_actions.append("Validate dose and frequency with the dispensing pharmacy if this drives downstream clinical decisions")

    if renal_risk and metformin_selected:
        recommended_actions.append("Review renal function and confirm whether metformin remains appropriate for this patient")
    else:
        recommended_actions.append("Document the reconciliation rationale in the patient record")

    source_rankings = [
        MedicationSourceRanking(
            system=item["source"].system,
            medication=item["source"].medication,
            normalized_medication=item["normalized_name"],
            score=item["score"],
            rank=index,
            reliability=item["source"].source_reliability,
            freshness_evidence=item["freshness_evidence"],
            review_flags=item["review_flags"],
        )
        for index, item in enumerate(scored_sources, start=1)
    ]

    heuristic_reasoning = " ".join(reasoning_parts)
    ai_reasoning = generate_clinical_reasoning(
        system_prompt=(
            "You are a clinical data reconciliation assistant. "
            "Given structured patient context and conflicting medication sources, "
            "write a concise explanation for why the selected source is most likely correct, "
            "mentioning any safety concerns. Do not claim certainty."
        ),
        user_payload={
            "patient_context": data.patient_context.model_dump(),
            "selected_source": {
                "system": best_source.system,
                "medication": best_source.medication,
                "score": top_score,
            },
            "review_flags": review_flags,
            "source_rankings": [ranking.model_dump() for ranking in source_rankings],
        },
        fallback=heuristic_reasoning,
    )

    return ReconcileMedicationResponse(
        reconciled_medication=best_source.medication,
        confidence_score=confidence,
        reasoning=ai_reasoning,
        recommended_actions=recommended_actions,
        clinical_safety_check="REQUIRES_REVIEW" if requires_review else "PASSED",
        selected_source_system=best_source.system,
        review_flags=review_flags,
        source_rankings=source_rankings,
    )
