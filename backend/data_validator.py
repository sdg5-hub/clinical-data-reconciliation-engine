from datetime import date, datetime
from typing import Optional

try:
    from .ai_engine import generate_clinical_reasoning
    from .schemas import (
        DataQualityRequest,
        DataQualityResponse,
        DataQualityBreakdown,
        IssueDetected,
    )
except ImportError:
    from ai_engine import generate_clinical_reasoning
    from schemas import (
        DataQualityRequest,
        DataQualityResponse,
        DataQualityBreakdown,
        IssueDetected,
    )

def _parse_date(
    value: str,
    field: str,
    issues: list[IssueDetected],
    timeliness: int,
    accuracy: int,
) -> tuple[Optional[date], int, int]:
    try:
        parsed = datetime.strptime(value, "%Y-%m-%d").date()
        return parsed, timeliness, accuracy
    except ValueError:
        issues.append(
            IssueDetected(
                field=field,
                issue="Date format is invalid; expected YYYY-MM-DD",
                severity="high",
            )
        )
        if field == "last_updated":
            timeliness -= 40
        else:
            accuracy -= 20
        return None, timeliness, accuracy


def validate_data_quality(data: DataQualityRequest) -> DataQualityResponse:
    issues: list[IssueDetected] = []

    completeness = 100
    accuracy = 100
    timeliness = 100
    clinical_plausibility = 100

    if not data.demographics.name.strip():
        issues.append(IssueDetected(field="demographics.name", issue="Patient name is missing", severity="high"))
        completeness -= 20
    if not data.demographics.gender.strip():
        issues.append(IssueDetected(field="demographics.gender", issue="Gender field is missing", severity="medium"))
        completeness -= 10
    if not data.medications:
        issues.append(IssueDetected(field="medications", issue="Medication list is empty", severity="high"))
        completeness -= 25
    if not data.conditions:
        issues.append(IssueDetected(field="conditions", issue="Problem list is empty", severity="medium"))
        completeness -= 10
    if not data.allergies:
        issues.append(
            IssueDetected(
                field="allergies",
                issue="No allergies documented - likely incomplete",
                severity="medium",
            )
        )
        completeness -= 15

    dob, timeliness, accuracy = _parse_date(data.demographics.dob, "demographics.dob", issues, timeliness, accuracy)
    last_updated, timeliness, accuracy = _parse_date(data.last_updated, "last_updated", issues, timeliness, accuracy)

    today = date.today()
    if dob is not None:
        age_years = (today - dob).days / 365.25
        if dob > today:
            issues.append(IssueDetected(field="demographics.dob", issue="Date of birth is in the future", severity="high"))
            accuracy -= 30
            clinical_plausibility -= 30
        elif age_years > 120:
            issues.append(IssueDetected(field="demographics.dob", issue="Patient age exceeds plausible human range", severity="high"))
            accuracy -= 20
            clinical_plausibility -= 25

    if last_updated is not None:
        days_old = (today - last_updated).days
        if last_updated > today:
            issues.append(IssueDetected(field="last_updated", issue="Record last-updated date is in the future", severity="high"))
            timeliness -= 35
            accuracy -= 20
        elif days_old > 365:
            issues.append(IssueDetected(field="last_updated", issue="Data is more than 12 months old", severity="high"))
            timeliness -= 45
        elif days_old > 180:
            issues.append(IssueDetected(field="last_updated", issue="Data is 6+ months old", severity="medium"))
            timeliness -= 25

    bp = data.vital_signs.blood_pressure
    if bp:
        try:
            systolic, diastolic = map(int, bp.split("/"))
            if systolic <= diastolic:
                issues.append(
                    IssueDetected(
                        field="vital_signs.blood_pressure",
                        issue=f"Blood pressure {bp} has systolic less than or equal to diastolic",
                        severity="high",
                    )
                )
                accuracy -= 20
                clinical_plausibility -= 30
            elif systolic > 300 or diastolic > 180 or systolic < 50 or diastolic < 30:
                issues.append(
                    IssueDetected(
                        field="vital_signs.blood_pressure",
                        issue=f"Blood pressure {bp} is physiologically implausible",
                        severity="high",
                    )
                )
                accuracy -= 30
                clinical_plausibility -= 60
        except ValueError:
            issues.append(
                IssueDetected(
                    field="vital_signs.blood_pressure",
                    issue="Blood pressure format is invalid",
                    severity="high",
                )
            )
            accuracy -= 25

    heart_rate = data.vital_signs.heart_rate
    if heart_rate is not None and (heart_rate < 25 or heart_rate > 220):
        issues.append(
            IssueDetected(
                field="vital_signs.heart_rate",
                issue=f"Heart rate {heart_rate} is physiologically implausible",
                severity="high",
            )
        )
        accuracy -= 20
        clinical_plausibility -= 35

    overall_score = max(0, int((completeness + accuracy + timeliness + clinical_plausibility) / 4))
    highest_severity = "high" if any(issue.severity == "high" for issue in issues) else "medium" if issues else "none"
    heuristic_summary = (
        f"Detected {len(issues)} issue(s); highest severity is {highest_severity}. "
        f"Overall data-quality score is {overall_score}/100."
    )
    ai_summary = generate_clinical_reasoning(
        system_prompt=(
            "You are a clinical data quality assistant. "
            "Summarize the most important quality concerns in 1-2 concise sentences based on the structured findings. "
            "Do not invent facts."
        ),
        user_payload={
            "overall_score": overall_score,
            "breakdown": {
                "completeness": max(0, completeness),
                "accuracy": max(0, accuracy),
                "timeliness": max(0, timeliness),
                "clinical_plausibility": max(0, clinical_plausibility),
            },
            "issues_detected": [issue.model_dump() for issue in issues],
        },
        fallback=heuristic_summary,
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
        summary=ai_summary,
    )
