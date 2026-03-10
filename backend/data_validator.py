from datetime import datetime
from schemas import (
    DataQualityRequest,
    DataQualityResponse,
    DataQualityBreakdown,
    IssueDetected,
)


def validate_data_quality(data: DataQualityRequest) -> DataQualityResponse:
    issues = []

    completeness = 100
    accuracy = 100
    timeliness = 100
    clinical_plausibility = 100

    if not data.allergies:
        issues.append(
            IssueDetected(
                field="allergies",
                issue="No allergies documented - likely incomplete",
                severity="medium",
            )
        )
        completeness -= 20

    bp = data.vital_signs.blood_pressure
    if bp:
        try:
            systolic, diastolic = map(int, bp.split("/"))
            if systolic > 300 or diastolic > 180:
                issues.append(
                    IssueDetected(
                        field="vital_signs.blood_pressure",
                        issue=f"Blood pressure {bp} is physiologically implausible",
                        severity="high",
                    )
                )
                accuracy -= 30
                clinical_plausibility -= 60
        except Exception:
            issues.append(
                IssueDetected(
                    field="vital_signs.blood_pressure",
                    issue="Blood pressure format is invalid",
                    severity="high",
                )
            )
            accuracy -= 25

    try:
        updated_date = datetime.strptime(data.last_updated, "%Y-%m-%d")
        days_old = (datetime.now() - updated_date).days
        if days_old > 180:
            issues.append(
                IssueDetected(
                    field="last_updated",
                    issue="Data is 6+ months old",
                    severity="medium",
                )
            )
            timeliness -= 30
    except Exception:
        issues.append(
            IssueDetected(
                field="last_updated",
                issue="Date format is invalid; expected YYYY-MM-DD",
                severity="high",
            )
        )
        timeliness -= 40

    overall_score = max(
        0,
        int((completeness + accuracy + timeliness + clinical_plausibility) / 4)
    )

    return DataQualityResponse(
        overall_score=overall_score,
        breakdown=DataQualityBreakdown(
            completeness=max(0, completeness),
            accuracy=max(0, accuracy),
            timeliness=max(0, timeliness),
            clinical_plausibility=max(0, clinical_plausibility),
        ),
        issues_detected=issues,
    )
