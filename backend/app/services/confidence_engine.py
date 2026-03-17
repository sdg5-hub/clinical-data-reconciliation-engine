from ..schemas.reconciliation import ConfidenceBreakdown


def build_confidence_breakdown(
    reliability_score: int,
    freshness_score: int,
    plausibility_score: int,
    fill_verification_score: int,
    conflict_penalty: int,
) -> ConfidenceBreakdown:
    total = max(1, reliability_score + freshness_score + plausibility_score + fill_verification_score + abs(conflict_penalty))

    return ConfidenceBreakdown(
        source_reliability=round(reliability_score / total, 2),
        recency_weighting=round(freshness_score / total, 2),
        clinical_plausibility=round(plausibility_score / total, 2),
        fill_verification=round(fill_verification_score / total, 2),
        conflict_penalty=round(conflict_penalty / total, 2),
    )
