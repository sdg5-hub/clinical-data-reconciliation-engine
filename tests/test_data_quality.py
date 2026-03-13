from datetime import date, timedelta

from backend.data_validator import validate_data_quality
from backend.schemas import DataQualityRequest, Demographics, VitalSigns


def build_request(**overrides) -> DataQualityRequest:
    payload = {
        "demographics": Demographics(name="Jane Doe", dob="1980-01-01", gender="F"),
        "medications": ["Lisinopril"],
        "allergies": ["Penicillin"],
        "conditions": ["Hypertension"],
        "vital_signs": VitalSigns(blood_pressure="120/80", heart_rate=80),
        "last_updated": str(date.today() - timedelta(days=15)),
    }
    payload.update(overrides)
    return DataQualityRequest(**payload)


def test_detects_missing_core_fields():
    request = build_request(
        demographics=Demographics(name="", dob="1980-01-01", gender=""),
        medications=[],
        allergies=[],
        conditions=[],
    )

    result = validate_data_quality(request)

    fields = {issue.field for issue in result.issues_detected}
    assert "demographics.name" in fields
    assert "demographics.gender" in fields
    assert "medications" in fields
    assert "conditions" in fields
    assert "allergies" in fields
    assert result.breakdown.completeness < 60
    assert result.summary.startswith("Detected ")


def test_detects_implausible_vitals_and_stale_record():
    request = build_request(
        vital_signs=VitalSigns(blood_pressure="350/200", heart_rate=10),
        last_updated=str(date.today() - timedelta(days=400)),
    )

    result = validate_data_quality(request)

    fields = {issue.field for issue in result.issues_detected}
    assert "vital_signs.blood_pressure" in fields
    assert "vital_signs.heart_rate" in fields
    assert "last_updated" in fields
    assert result.breakdown.clinical_plausibility <= 5
    assert result.breakdown.timeliness <= 55
    assert "highest severity is high" in result.summary


def test_detects_invalid_dates():
    request = build_request(
        demographics=Demographics(name="Jane Doe", dob="1980/01/01", gender="F"),
        last_updated="not-a-date",
    )

    result = validate_data_quality(request)

    fields = {issue.field for issue in result.issues_detected}
    assert "demographics.dob" in fields
    assert "last_updated" in fields
    assert result.breakdown.accuracy < 100
    assert result.breakdown.timeliness < 100
