from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException

from ...db.session import dumps_json, get_connection
from ...schemas.fhir import FhirBundleIngestRequest, FhirSnapshotResponse
from ...schemas.reconciliation import MedicationSource
from ...services.audit_service import create_audit_event
from ...services.case_service import get_case, update_case_outputs
from ...services.fhir_adapter import normalize_bundle

router = APIRouter(prefix="/api/cases/{case_id}/fhir", tags=["fhir"])
compat_router = APIRouter(prefix="/api/cases/{case_id}", tags=["fhir"])


def _ingest(case_id: str, payload: FhirBundleIngestRequest) -> FhirSnapshotResponse:
    try:
        case = get_case(case_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Case not found") from exc

    normalized = normalize_bundle(payload.bundle)
    snapshot_id = str(uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO fhir_snapshots (id, case_id, raw_bundle, normalized_records, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                snapshot_id,
                case_id,
                dumps_json(payload.bundle),
                dumps_json(normalized),
                created_at,
            ),
        )

    if normalized.get("medications"):
        case_request = case.reconciliation_request.model_copy(
            update={
                "sources": [
                    MedicationSource(
                        system=medication["system"],
                        medication=medication["medication"],
                        last_updated=medication["effective"],
                        source_reliability="medium",
                    )
                    for medication in normalized["medications"]
                ]
            }
        )
        quality_request = case.quality_request.model_copy(
            update={
                "medications": [item["medication"] for item in normalized["medications"]],
                "allergies": normalized.get("allergies", case.quality_request.allergies),
                "conditions": normalized.get("conditions", case.quality_request.conditions),
            }
        )
        update_case_outputs(case_id)
        with get_connection() as connection:
            connection.execute(
                """
                UPDATE cases SET reconciliation_request = ?, quality_request = ?, status = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    dumps_json(case_request.model_dump()),
                    dumps_json(quality_request.model_dump()),
                    "ingested",
                    created_at,
                    case_id,
                ),
            )

    create_audit_event(
        case_id,
        "fhir_ingested",
        "FHIR bundle ingested",
        "Mock FHIR resources were normalized into case records.",
        payload={"snapshot_id": snapshot_id},
        actor="system",
        summary="FHIR bundle ingested",
        metadata={
            "snapshot_id": snapshot_id,
            "resource_count": len(payload.bundle.get("entry", [])),
            "medication_count": len(normalized.get("medications", [])),
        },
    )
    return FhirSnapshotResponse(case_id=case_id, raw_bundle=payload.bundle, normalized_records=normalized)


@router.post("/ingest", response_model=FhirSnapshotResponse)
def ingest_fhir_bundle(case_id: str, payload: FhirBundleIngestRequest) -> FhirSnapshotResponse:
    return _ingest(case_id, payload)


@compat_router.post("/ingest-fhir", response_model=FhirSnapshotResponse, include_in_schema=False)
def ingest_fhir_bundle_compat(case_id: str, payload: FhirBundleIngestRequest) -> FhirSnapshotResponse:
    return _ingest(case_id, payload)


@router.get("/source-records", response_model=FhirSnapshotResponse)
def latest_raw_fhir(case_id: str) -> FhirSnapshotResponse:
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
        raise HTTPException(status_code=404, detail="No FHIR snapshot found")
    import json
    return FhirSnapshotResponse(case_id=case_id, raw_bundle=json.loads(row["raw_bundle"]), normalized_records=json.loads(row["normalized_records"]))


@router.get("/normalized-records", response_model=dict)
def latest_normalized_fhir(case_id: str) -> dict:
    snapshot = latest_raw_fhir(case_id)
    return snapshot.normalized_records
