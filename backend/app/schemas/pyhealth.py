from typing import Optional

from pydantic import BaseModel, Field


class PyHealthEventResponse(BaseModel):
    table: str
    code: str
    vocabulary: str
    visit_id: str
    patient_id: str
    timestamp: Optional[str] = None
    attributes: dict = Field(default_factory=dict)


class PyHealthVisitResponse(BaseModel):
    visit_id: str
    encounter_time: Optional[str] = None
    discharge_time: Optional[str] = None
    discharge_status: Optional[str] = None
    event_count: int
    tables: list[str] = Field(default_factory=list)


class PyHealthPatientResponse(BaseModel):
    patient_id: str
    gender: Optional[str] = None
    birth_datetime: Optional[str] = None
    available_tables: list[str] = Field(default_factory=list)
    visit_count: int
    event_count: int
    visits: list[PyHealthVisitResponse] = Field(default_factory=list)
    events: list[PyHealthEventResponse] = Field(default_factory=list)
    source_summary: dict = Field(default_factory=dict)
