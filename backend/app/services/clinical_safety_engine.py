from ..schemas.reconciliation import ConflictSeverity, ReconcileMedicationRequest


def build_conflict_severity(
    request: ReconcileMedicationRequest,
    reconciled_medication: str,
    review_flags: list[str],
) -> ConflictSeverity:
    conditions = {condition.lower() for condition in request.patient_context.conditions}
    has_ckd = "chronic kidney disease" in conditions or "ckd" in conditions
    has_metformin = "metformin" in reconciled_medication.lower()

    if has_ckd and has_metformin:
        return ConflictSeverity(
            level="HIGH",
            explanation="Metformin was selected while CKD context is present. Renal dosing review is required before approval.",
        )
    if review_flags:
        return ConflictSeverity(
            level="MEDIUM",
            explanation=f"Reviewer-visible flags were triggered: {', '.join(review_flags)}.",
        )
    return ConflictSeverity(
        level="LOW",
        explanation="No high-severity drug-disease conflict was detected in the selected recommendation.",
    )
