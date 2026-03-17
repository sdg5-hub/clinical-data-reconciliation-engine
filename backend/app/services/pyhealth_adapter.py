import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from ..db.session import get_connection
from ..schemas.case import CaseDetail
from ..schemas.pyhealth import (
    PyHealthEventResponse,
    PyHealthPatientResponse,
    PyHealthVisitResponse,
)


def _prepare_pyhealth_import() -> None:
    runtime_home = Path(__file__).resolve().parents[3] / ".pyhealth-runtime"
    runtime_home.mkdir(parents=True, exist_ok=True)
    os.environ["HOME"] = str(runtime_home)


_prepare_pyhealth_import()

from pyhealth.data import Event, Patient, Visit  # noqa: E402


def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    for parser in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(value, parser)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _latest_fhir_snapshot(case_id: str) -> tuple[Optional[dict], Optional[dict]]:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT raw_bundle, normalized_records
            FROM fhir_snapshots
            WHERE case_id = ?
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (case_id,),
        ).fetchone()
    if row is None:
        return None, None
    return json.loads(row["raw_bundle"]), json.loads(row["normalized_records"])


def _build_case_visit(case: CaseDetail) -> Visit:
    encounter_time = _parse_datetime(case.quality_request.last_updated)
    return Visit(
        visit_id=f"{case.id}-case-review",
        patient_id=case.id,
        encounter_time=encounter_time,
        discharge_status=case.status,
        source="case_workflow",
    )


def _build_fhir_visit(case: CaseDetail, normalized_records: dict) -> Visit:
    encounter_time = None
    encounters = normalized_records.get("encounters", [])
    if encounters:
        encounter_time = _parse_datetime(encounters[0].get("period", {}).get("start"))
    return Visit(
        visit_id=f"{case.id}-fhir-snapshot",
        patient_id=case.id,
        encounter_time=encounter_time,
        discharge_status="normalized_fhir",
        source="mock_fhir",
    )


def _case_events(case: CaseDetail, visit_id: str) -> list[Event]:
    events = []
    for source in case.reconciliation_request.sources:
        events.append(
            Event(
                code=source.medication,
                table="MEDICATION_SOURCE",
                vocabulary=source.source_reliability.upper(),
                visit_id=visit_id,
                patient_id=case.id,
                timestamp=_parse_datetime(source.last_updated or source.last_filled),
                system=source.system,
                source_reliability=source.source_reliability,
            )
        )

    for condition in case.quality_request.conditions:
        events.append(
            Event(
                code=condition,
                table="CONDITION_LIST",
                vocabulary="TEXT",
                visit_id=visit_id,
                patient_id=case.id,
                timestamp=_parse_datetime(case.quality_request.last_updated),
                source="case_quality_payload",
            )
        )

    for allergy in case.quality_request.allergies:
        events.append(
            Event(
                code=allergy,
                table="ALLERGY_LIST",
                vocabulary="TEXT",
                visit_id=visit_id,
                patient_id=case.id,
                timestamp=_parse_datetime(case.quality_request.last_updated),
                source="case_quality_payload",
            )
        )

    for medication in case.quality_request.medications:
        events.append(
            Event(
                code=medication,
                table="MEDICATION_LIST",
                vocabulary="TEXT",
                visit_id=visit_id,
                patient_id=case.id,
                timestamp=_parse_datetime(case.quality_request.last_updated),
                source="case_quality_payload",
            )
        )

    if case.quality_request.vital_signs.blood_pressure:
        events.append(
            Event(
                code=case.quality_request.vital_signs.blood_pressure,
                table="VITAL_SIGNS",
                vocabulary="BLOOD_PRESSURE",
                visit_id=visit_id,
                patient_id=case.id,
                timestamp=_parse_datetime(case.quality_request.last_updated),
                measurement="blood_pressure",
            )
        )

    if case.quality_request.vital_signs.heart_rate is not None:
        events.append(
            Event(
                code=str(case.quality_request.vital_signs.heart_rate),
                table="VITAL_SIGNS",
                vocabulary="HEART_RATE",
                visit_id=visit_id,
                patient_id=case.id,
                timestamp=_parse_datetime(case.quality_request.last_updated),
                measurement="heart_rate",
            )
        )

    return events


def _normalized_fhir_events(case: CaseDetail, visit_id: str, normalized_records: dict) -> list[Event]:
    events = []

    for medication in normalized_records.get("medications", []):
        events.append(
            Event(
                code=medication.get("medication", "Unknown medication"),
                table="FHIR_MEDICATION",
                vocabulary=medication.get("status", "unknown").upper(),
                visit_id=visit_id,
                patient_id=case.id,
                timestamp=_parse_datetime(medication.get("effective")),
                system=medication.get("system"),
                source="normalized_fhir",
            )
        )

    for condition in normalized_records.get("conditions", []):
        events.append(
            Event(
                code=condition,
                table="FHIR_CONDITION",
                vocabulary="TEXT",
                visit_id=visit_id,
                patient_id=case.id,
                timestamp=None,
                source="normalized_fhir",
            )
        )

    for allergy in normalized_records.get("allergies", []):
        events.append(
            Event(
                code=allergy,
                table="FHIR_ALLERGY",
                vocabulary="TEXT",
                visit_id=visit_id,
                patient_id=case.id,
                timestamp=None,
                source="normalized_fhir",
            )
        )

    for observation in normalized_records.get("observations", []):
        events.append(
            Event(
                code=str(observation.get("value", "unknown")),
                table="FHIR_OBSERVATION",
                vocabulary=observation.get("name", "TEXT"),
                visit_id=visit_id,
                patient_id=case.id,
                timestamp=None,
                observation_name=observation.get("name"),
                source="normalized_fhir",
            )
        )

    return events


def build_pyhealth_patient(case: CaseDetail) -> PyHealthPatientResponse:
    _, normalized_records = _latest_fhir_snapshot(case.id)
    patient = Patient(
        patient_id=case.id,
        birth_datetime=_parse_datetime(case.quality_request.demographics.dob),
        gender=case.quality_request.demographics.gender,
        case_name=case.name,
        case_risk=case.risk,
    )

    case_visit = _build_case_visit(case)
    patient.add_visit(case_visit)
    for event in _case_events(case, case_visit.visit_id):
        patient.add_event(event)

    if normalized_records:
        fhir_visit = _build_fhir_visit(case, normalized_records)
        patient.add_visit(fhir_visit)
        for event in _normalized_fhir_events(case, fhir_visit.visit_id, normalized_records):
            patient.add_event(event)

    serialized_visits = []
    serialized_events = []
    total_events = 0
    for visit in patient:
        tables = visit.available_tables
        visit_events = []
        for table in tables:
            visit_events.extend(visit.get_event_list(table))
        total_events += len(visit_events)
        serialized_visits.append(
            PyHealthVisitResponse(
                visit_id=visit.visit_id,
                encounter_time=visit.encounter_time.isoformat() if visit.encounter_time else None,
                discharge_time=visit.discharge_time.isoformat() if visit.discharge_time else None,
                discharge_status=visit.discharge_status,
                event_count=len(visit_events),
                tables=tables,
            )
        )
        for event in visit_events:
            serialized_events.append(
                PyHealthEventResponse(
                    table=event.table or "UNKNOWN",
                    code=str(event.code),
                    vocabulary=str(event.vocabulary),
                    visit_id=event.visit_id,
                    patient_id=event.patient_id,
                    timestamp=event.timestamp.isoformat() if event.timestamp else None,
                    attributes=event.attr_dict,
                )
            )

    return PyHealthPatientResponse(
        patient_id=patient.patient_id,
        gender=patient.gender,
        birth_datetime=patient.birth_datetime.isoformat() if patient.birth_datetime else None,
        available_tables=patient.available_tables,
        visit_count=len(patient),
        event_count=total_events,
        visits=serialized_visits,
        events=serialized_events,
        source_summary={
            "case_conditions": len(case.quality_request.conditions),
            "case_allergies": len(case.quality_request.allergies),
            "case_medication_sources": len(case.reconciliation_request.sources),
            "has_normalized_fhir": bool(normalized_records),
        },
    )
