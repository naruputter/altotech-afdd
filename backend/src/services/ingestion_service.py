import logging
from typing import List
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from src.crud.crud_telemetry import crud_telemetry
from src.crud.crud_ontology import crud_ontology
from src.schemas.telemetry_schema import TelemetryPoint, IngestionResult
from src.services.ws_manager import ws_manager
from src.services.device_watchdog import device_watchdog

logger = logging.getLogger(__name__)


class IngestionService:
    async def process_batch(
        self, db: AsyncSession, points: List[TelemetryPoint]
    ) -> IngestionResult:
        if not points:
            return IngestionResult(
                received=0,
                accepted=0,
                duplicates_skipped=0,
                invalid_skipped=0,
                message="No telemetry points provided",
            )

        valid_points: List[TelemetryPoint] = []
        invalid_count = 0

        # Validate timestamps & structure
        now = datetime.now(timezone.utc)
        for p in points:
            # Timestamp sanity check (not years into the future)
            if p.timestamp.tzinfo is None:
                p.timestamp = p.timestamp.replace(tzinfo=timezone.utc)

            # Check if timestamp is reasonable
            diff_seconds = (now - p.timestamp).total_seconds()
            if diff_seconds < -86400:  # > 1 day in the future
                invalid_count += 1
                continue

            valid_points.append(p)

        if not valid_points:
            return IngestionResult(
                received=len(points),
                accepted=0,
                duplicates_skipped=0,
                invalid_skipped=invalid_count,
                message="All telemetry points failed validation",
            )

        # Ingest with DB deduplication
        inserted, duplicates = await crud_telemetry.insert_telemetry_batch(
            db, valid_points
        )

        # Broadcast WebSocket events only after successful persistence
        if inserted > 0:
            try:
                for pt in valid_points:
                    device_watchdog.mark_online(pt.entity_id)
                    await ws_manager.broadcast(
                        event_type="telemetry.new",
                        data={
                            "entity_id": pt.entity_id,
                            "metric_name": pt.metric_name,
                            "val": pt.val,
                            "unit": pt.unit,
                            "timestamp": pt.timestamp.isoformat() if hasattr(pt.timestamp, "isoformat") else str(pt.timestamp),
                            "site_id": pt.site_id,
                        },
                        site_id=pt.site_id,
                    )
                    await ws_manager.broadcast(
                        event_type="device.status",
                        data={
                            "entity_id": pt.entity_id,
                            "status": "ONLINE",
                            "last_seen": pt.timestamp.isoformat() if hasattr(pt.timestamp, "isoformat") else str(pt.timestamp),
                        },
                        site_id=pt.site_id,
                    )
            except Exception as ws_err:
                logger.error(f"[WS Broadcast] Error broadcasting telemetry in IngestionService: {ws_err}")

        return IngestionResult(
            received=len(points),
            accepted=inserted,
            duplicates_skipped=duplicates,
            invalid_skipped=invalid_count,
            message=f"Successfully ingested {inserted} points, {duplicates} duplicates ignored, {invalid_count} invalid rejected.",
        )


ingestion_service = IngestionService()
