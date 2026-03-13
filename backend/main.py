from datetime import datetime, timezone

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

try:
    from .config import get_settings
    from .schemas import (
        ReconcileMedicationRequest,
        ReconcileMedicationResponse,
        DataQualityRequest,
        DataQualityResponse,
    )
    from .reconciliation_service import reconcile_medication
    from .data_validator import validate_data_quality
except ImportError:
    from config import get_settings
    from schemas import (
        ReconcileMedicationRequest,
        ReconcileMedicationResponse,
        DataQualityRequest,
        DataQualityResponse,
    )
    from reconciliation_service import reconcile_medication
    from data_validator import validate_data_quality

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "message": f"{settings.app_name} API is running",
        "version": settings.app_version,
        "environment": settings.environment,
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
    }


def verify_api_key(x_api_key: str = Header(default="")):
    if x_api_key != settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )


@app.post("/api/reconcile/medication", response_model=ReconcileMedicationResponse)
def reconcile_medication_endpoint(
    payload: ReconcileMedicationRequest,
    _: None = Depends(verify_api_key),
):
    return reconcile_medication(payload)


@app.post("/api/validate/data-quality", response_model=DataQualityResponse)
def validate_data_quality_endpoint(
    payload: DataQualityRequest,
    _: None = Depends(verify_api_key),
):
    return validate_data_quality(payload)
