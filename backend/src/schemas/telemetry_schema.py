from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field


class TelemetryPoint(BaseModel):
    timestamp: datetime = Field(..., description="Device timestamp in ISO8601 / UTC")
    entity_id: str
    metric_name: str
    val: float
    unit: Optional[str] = None
    site_id: str
    tags: Optional[Dict[str, Any]] = None


class TelemetryBatchCreate(BaseModel):
    points: List[TelemetryPoint]


class TelemetryQuery(BaseModel):
    entity_id: str
    metric_name: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    limit: int = 500


class TelemetryResponse(TelemetryPoint):
    ingested_at: datetime

    class Config:
        from_attributes = True


class IngestionResult(BaseModel):
    received: int
    accepted: int
    duplicates_skipped: int
    invalid_skipped: int
    message: str
