from datetime import datetime, timezone

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes.admin import router as admin_router
from .api.routes.cases import router as cases_router
from .api.routes.data_quality import router as data_quality_router
from .api.routes.fhir import compat_router as fhir_compat_router
from .api.routes.fhir import router as fhir_router
from .api.routes.pyhealth import router as pyhealth_router
from .api.routes.reconciliation import router as reconciliation_router
from .api.routes.reviewer import router as reviewer_router
from .api.routes.scanner import router as scanner_router
from .core.auth import verify_api_key
from .core.config import get_settings
from .db.session import init_db
from .schemas.data_quality import DataQualityRequest, DataQualityResponse
from .schemas.reconciliation import ReconcileMedicationRequest, ReconcileMedicationResponse
from .services.data_quality_engine import run_data_quality
from .services.reconciliation_engine import run_reconciliation


def create_app() -> FastAPI:
    settings = get_settings()
    init_db()

    app = FastAPI(title=settings.app_name, version=settings.app_version)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/")
    def root() -> dict:
        return {
            "message": f"{settings.app_name} API is running",
            "version": settings.app_version,
            "environment": settings.environment,
        }

    @app.get("/health")
    def health() -> dict:
        return {
            "status": "ok",
            "service": settings.app_name,
            "version": settings.app_version,
            "environment": settings.environment,
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        }

    @app.get("/ready")
    def readiness() -> dict:
        return {"status": "ready"}

    @app.post("/api/reconcile/medication", response_model=ReconcileMedicationResponse)
    def reconcile_medication_endpoint(
        payload: ReconcileMedicationRequest,
        _: None = Depends(verify_api_key),
    ) -> ReconcileMedicationResponse:
        return run_reconciliation(payload)

    @app.post("/api/validate/data-quality", response_model=DataQualityResponse)
    def validate_data_quality_endpoint(
        payload: DataQualityRequest,
        _: None = Depends(verify_api_key),
    ) -> DataQualityResponse:
        return run_data_quality(payload)

    app.include_router(cases_router, dependencies=[Depends(verify_api_key)])
    app.include_router(reconciliation_router, dependencies=[Depends(verify_api_key)])
    app.include_router(data_quality_router, dependencies=[Depends(verify_api_key)])
    app.include_router(reviewer_router, dependencies=[Depends(verify_api_key)])
    app.include_router(scanner_router, dependencies=[Depends(verify_api_key)])
    app.include_router(fhir_router, dependencies=[Depends(verify_api_key)])
    app.include_router(fhir_compat_router, dependencies=[Depends(verify_api_key)])
    app.include_router(pyhealth_router, dependencies=[Depends(verify_api_key)])
    app.include_router(admin_router, dependencies=[Depends(verify_api_key)])

    return app
