from typing import List, Optional, Sequence
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc
from sqlalchemy.dialects.postgresql import insert
from src.models.telemetry import Telemetry
from src.schemas.telemetry_schema import TelemetryPoint


class CRUDTelemetry:
    async def insert_telemetry_batch(
        self, db: AsyncSession, points: List[TelemetryPoint]
    ) -> tuple[int, int]:
        """
        Inserts points with deduplication (ON CONFLICT DO NOTHING).
        Returns (inserted_count, duplicate_count).
        """
        if not points:
            return 0, 0

        values = [
            {
                "timestamp": p.timestamp,
                "entity_id": p.entity_id,
                "metric_name": p.metric_name,
                "val": p.val,
                "unit": p.unit,
                "site_id": p.site_id,
                "tags": p.tags,
            }
            for p in points
        ]

        stmt = insert(Telemetry).values(values)
        stmt = stmt.on_conflict_do_nothing(
            index_elements=["timestamp", "entity_id", "metric_name"]
        )

        result = await db.execute(stmt)
        await db.commit()
        inserted_count = result.rowcount if result.rowcount is not None and result.rowcount >= 0 else len(points)
        duplicate_count = max(0, len(points) - inserted_count)
        return inserted_count, duplicate_count

    async def get_history(
        self,
        db: AsyncSession,
        site_id: Optional[str] = None,
        entity_id: Optional[str] = None,
        metric_name: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 500,
    ) -> Sequence[Telemetry]:
        stmt = select(Telemetry)
        if site_id:
            stmt = stmt.where(Telemetry.site_id == site_id)
        if entity_id:
            stmt = stmt.where(Telemetry.entity_id == entity_id)
        if metric_name:
            stmt = stmt.where(Telemetry.metric_name == metric_name)
        if start_time:
            stmt = stmt.where(Telemetry.timestamp >= start_time)
        if end_time:
            stmt = stmt.where(Telemetry.timestamp <= end_time)

        stmt = stmt.order_by(desc(Telemetry.timestamp)).limit(limit)
        result = await db.execute(stmt)
        return result.scalars().all()

    async def get_history_paginated(
        self,
        db: AsyncSession,
        site_id: Optional[str] = None,
        entity_id: Optional[str] = None,
        metric_name: Optional[str] = None,
        search: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[Sequence[Telemetry], int]:
        from sqlalchemy import func, or_, String as SQLString, cast
        from src.models.entity import Entity
        from src.models.site import Site

        stmt = select(Telemetry).outerjoin(Entity, Telemetry.entity_id == Entity.id).outerjoin(Site, Telemetry.site_id == Site.id)
        count_stmt = select(func.count()).select_from(Telemetry).outerjoin(Entity, Telemetry.entity_id == Entity.id).outerjoin(Site, Telemetry.site_id == Site.id)

        if site_id and site_id.lower() != "all":
            site_filter = or_(Telemetry.site_id == site_id, Site.code == site_id, Site.name == site_id)
            stmt = stmt.where(site_filter)
            count_stmt = count_stmt.where(site_filter)

        if entity_id:
            entity_filter = or_(Telemetry.entity_id == entity_id, Entity.code == entity_id)
            stmt = stmt.where(entity_filter)
            count_stmt = count_stmt.where(entity_filter)

        if metric_name:
            stmt = stmt.where(Telemetry.metric_name == metric_name)
            count_stmt = count_stmt.where(Telemetry.metric_name == metric_name)

        if search and search.strip():
            search_str = f"%{search.strip()}%"
            search_filter = or_(
                Telemetry.metric_name.ilike(search_str),
                Telemetry.unit.ilike(search_str),
                Telemetry.entity_id.ilike(search_str),
                Entity.code.ilike(search_str),
                Entity.name.ilike(search_str),
                Entity.brick_class.ilike(search_str),
                cast(Entity.entity_type, SQLString).ilike(search_str),
                cast(Entity.metadata_json, SQLString).ilike(search_str),
                Site.name.ilike(search_str),
                Site.code.ilike(search_str),
            )
            stmt = stmt.where(search_filter)
            count_stmt = count_stmt.where(search_filter)

        if start_time:
            stmt = stmt.where(Telemetry.timestamp >= start_time)
            count_stmt = count_stmt.where(Telemetry.timestamp >= start_time)

        if end_time:
            stmt = stmt.where(Telemetry.timestamp <= end_time)
            count_stmt = count_stmt.where(Telemetry.timestamp <= end_time)

        total_res = await db.execute(count_stmt)
        total_count = total_res.scalar() or 0

        stmt = stmt.order_by(desc(Telemetry.timestamp)).offset(offset).limit(limit)
        result = await db.execute(stmt)
        return result.scalars().all(), total_count

    async def get_site_device_status(
        self, db: AsyncSession, site_id: str
    ) -> List[dict]:
        """
        Retrieves the latest timestamp and reading count for all entities in a site.
        Used to determine realtime Online/Offline status.
        """
        from sqlalchemy import func
        stmt = (
            select(
                Telemetry.entity_id,
                func.max(Telemetry.timestamp).label("last_seen"),
                func.count().label("reading_count")
            )
            .where(Telemetry.site_id == site_id)
            .group_by(Telemetry.entity_id)
        )
        result = await db.execute(stmt)
        rows = result.all()
        return [
            {
                "entity_id": row.entity_id,
                "last_seen": row.last_seen.isoformat() if row.last_seen else None,
                "reading_count": row.reading_count
            }
            for row in rows
        ]


crud_telemetry = CRUDTelemetry()
