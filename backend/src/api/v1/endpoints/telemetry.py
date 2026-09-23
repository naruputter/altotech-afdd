from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.db.session import get_db
from src.crud.crud_telemetry import crud_telemetry
from src.services.ingestion_service import ingestion_service
from src.schemas.common_schema import ApiResponse, PaginationMeta
from src.schemas.telemetry_schema import (
    TelemetryBatchCreate,
    TelemetryResponse,
    IngestionResult,
)

router = APIRouter()


@router.post("/ingest", response_model=ApiResponse[IngestionResult], status_code=status.HTTP_200_OK)
async def ingest_telemetry(
    payload: TelemetryBatchCreate, db: AsyncSession = Depends(get_db)
):
    """
    Ingests batch of telemetry points from Simulator, IoT Gateways, or Building BMS.
    Performs validation, deduplication, and stores into TimescaleDB hypertable.
    """
    result = await ingestion_service.process_batch(db, payload.points)
    return ApiResponse(
        success=True, 
        data=result, 
        message=f"Ingested {result.accepted_count} points ({result.rejected_count} rejected, {result.duplicate_count} duplicates)"
    )


@router.get("/history", response_model=ApiResponse[List[TelemetryResponse]])
async def get_telemetry_history(
    site_id: Optional[str] = Query(None, description="Filter by site ID"),
    entity_id: Optional[str] = Query(None, description="Optional filter by equipment or sensor ID"),
    metric_name: Optional[str] = Query(None, description="Optional metric filter"),
    search: Optional[str] = Query(None, description="Search term for entity, metric, unit"),
    start_time: Optional[datetime] = Query(None, description="Start time filter (UTC)"),
    end_time: Optional[datetime] = Query(None, description="End time filter (UTC)"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=5000, description="Records per page"),
    offset: Optional[int] = Query(None, ge=0, description="Optional manual offset override"),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieves time-series history for a site or specific entity with server-side pagination.
    """
    actual_offset = offset if offset is not None else (page - 1) * limit
    records, total_count = await crud_telemetry.get_history_paginated(
        db,
        site_id=site_id,
        entity_id=entity_id,
        metric_name=metric_name,
        search=search,
        start_time=start_time,
        end_time=end_time,
        limit=limit,
        offset=actual_offset,
    )
    total_pages = (total_count + limit - 1) // limit if limit > 0 else 1

    pagination = PaginationMeta(
        total=total_count,
        limit=limit,
        offset=actual_offset,
        current_page=page,
        total_pages=total_pages,
    )
    return ApiResponse(
        success=True, 
        data=records, 
        pagination=pagination, 
        message=f"Retrieved {len(records)} telemetry history points (page {page} of {total_pages})"
    )


@router.get("/device-status", response_model=ApiResponse[List[dict]])
async def get_device_status(
    site_id: str = Query(..., description="Site ID"),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieves the latest telemetry timestamp and status for all devices in a site.
    Used by UI to determine realtime Online / Offline status.
    """
    statuses = await crud_telemetry.get_site_device_status(db, site_id)
    return ApiResponse(success=True, data=statuses, message="Device telemetry statuses retrieved")


@router.get("/latest/{entity_id}", response_model=ApiResponse[List[TelemetryResponse]])
async def get_latest_telemetry(
    entity_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieves the most recent telemetry readings for an entity.
    """
    records = await crud_telemetry.get_history(db, entity_id=entity_id, limit=50)
    return ApiResponse(success=True, data=records, message=f"Retrieved {len(records)} latest metrics")

