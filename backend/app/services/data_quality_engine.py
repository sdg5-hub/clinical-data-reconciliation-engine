from datetime import date, datetime

from ...data_validator import validate_data_quality
from ..schemas.data_quality import (
    DataQualityRequest,
    DataQualityResponse,
    FieldDiagnostic,
    IssueDetected,
)


def _group_issues(issues: list[IssueDetected]) -> dict[str, list[IssueDetected]]:
    groups = {
        "completeness": [],
        "accuracy": [],
        "timeliness": [],
        "plausibility": [],
    }
    for issue in issues:
        if issue.field in {"allergies", "medications", "conditions", "demographics.name", "demographics.gender"}:
            groups["completeness"].append(issue)
        elif issue.field == "last_updated":
            groups["timeliness"].append(issue)
        elif issue.field.startswith("vital_signs"):
            groups["plausibility"].append(issue)
        else:
            groups["accuracy"].append(issue)
    return groups


def _issue_payloads(issues: list[IssueDetected]) -> list[dict]:
    return [issue.model_dump() if hasattr(issue, "model_dump") else dict(issue) for issue in issues]


def _enrich_issue(issue: IssueDetected) -> IssueDetected:
    domain = getattr(issue, "domain", "accuracy")
    if domain == "accuracy" and issue.field == "last_updated":
        domain = "timeliness"
    elif domain == "accuracy" and issue.field.startswith("vital_signs"):
        domain = "plausibility"
    elif domain == "accuracy" and issue.field in {"allergies", "medications", "conditions", "demographics.name", "demographics.gender"}:
        domain = "completeness"

    blocking = False
    remediation = "Review the field and confirm the chart value before clinical action."
    approval_impact = "advisory"

    if issue.field.startswith("vital_signs") or "physiologically implausible" in issue.issue.lower():
        blocking = True
        domain = "plausibility"
        remediation = "Confirm the measurement or repeat vitals before clinical action."
        approval_impact = "blocking"
    elif issue.field in {"last_updated", "demographics.dob"} and (
        "invalid" in issue.issue.lower() or "future" in issue.issue.lower()
    ):
        blocking = True
        domain = "timeliness" if issue.field == "last_updated" else "accuracy"
        remediation = "Correct the date value and verify source-system provenance."
        approval_impact = "blocking"
    elif issue.field == "medications" and "empty" in issue.issue.lower():
        blocking = True
        domain = "completeness"
        remediation = "Obtain an active medication list before approving the case."
        approval_impact = "blocking"
    elif issue.field == "last_updated":
        domain = "timeliness"
        remediation = "Refresh stale chart data or confirm the most recent trusted source."
    elif issue.field == "allergies":
        domain = "completeness"
        remediation = "Confirm whether allergies are truly absent or simply undocumented."
    elif issue.field.startswith("demographics"):
        domain = "accuracy"
        remediation = "Verify the demographic field against the patient registration record."
    elif issue.field == "conditions":
        domain = "completeness"
        remediation = "Confirm the active problem list with the current clinician note."

    return IssueDetected(
        field=issue.field,
        issue=issue.issue,
        severity=issue.severity,
        domain=domain,
        blocking=blocking,
        remediation=remediation,
        approval_impact=approval_impact,
    )


def run_data_quality(request: DataQualityRequest) -> DataQualityResponse:
    base_response = validate_data_quality(request)
    enriched_issues = [_enrich_issue(issue) for issue in base_response.issues_detected]
    groups = _group_issues(enriched_issues)

    recommended_follow_up = []
    if groups["completeness"]:
        recommended_follow_up.append("Complete missing allergies, demographics, or medication list fields.")
    if groups["timeliness"]:
        recommended_follow_up.append("Refresh stale chart data before approving downstream workflows.")
    if groups["plausibility"]:
        recommended_follow_up.append("Validate implausible vital signs or physiologic observations with a clinician.")
    if not recommended_follow_up:
        recommended_follow_up.append("No urgent remediation required based on the current quality rules.")

    freshness = "unknown"
    try:
        days_old = (date.today() - datetime.strptime(request.last_updated, "%Y-%m-%d").date()).days
        freshness = f"{days_old} day(s) old"
    except ValueError:
        freshness = "invalid date"

    diagnostics = [
        FieldDiagnostic(
            field=issue.field,
            detail=issue.issue,
            category=issue.domain,
        )
        for issue in enriched_issues
    ]

    base_payload = base_response.model_dump()
    base_payload.pop("issues_detected", None)

    return DataQualityResponse(
        **base_payload,
        issues_detected=enriched_issues,
        issue_groups={category: _issue_payloads(items) for category, items in groups.items()},
        recommended_follow_up=recommended_follow_up,
        record_freshness=freshness,
        field_diagnostics=diagnostics,
    )
