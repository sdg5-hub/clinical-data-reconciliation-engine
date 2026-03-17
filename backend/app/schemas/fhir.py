from pydantic import BaseModel


class FhirBundleIngestRequest(BaseModel):
    bundle: dict


class FhirSnapshotResponse(BaseModel):
    case_id: str
    raw_bundle: dict
    normalized_records: dict
