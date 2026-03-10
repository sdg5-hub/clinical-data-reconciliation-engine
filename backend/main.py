from fastapi import FastAPI
from schemas import (
    ReconcileMedicationRequest,
    ReconcileMedicationResponse,
    DataQualityRequest,
    DataQualityResponse,
)
from reconciliation_service import reconcile_medication
from data_validator import validate_data_quality

app = FastAPI(
    title="Clinical Data Reconciliation Engine",
    version="1.0.0"
)


@app.get("/")
def root():
    return {"message": "Clinical Data Reconciliation Engine API is running"}


@app.post("/api/reconcile/medication", response_model=ReconcileMedicationResponse)
def reconcile_medication_endpoint(payload: ReconcileMedicationRequest):
    return reconcile_medication(payload)


@app.post("/api/validate/data-quality", response_model=DataQualityResponse)
def validate_data_quality_endpoint(payload: DataQualityRequest):
    return validate_data_quality(payload)
