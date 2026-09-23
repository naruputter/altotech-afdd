import uuid
from typing import List, Optional, Sequence
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_, func
from src.models.issue import Issue, IssueStatus
from src.schemas.issue_schema import IssueCreate, IssueUpdate


class CRUDIssue:
    async def create_issue(self, db: AsyncSession, obj_in: IssueCreate) -> Issue:
        db_obj = Issue(
            id=str(uuid.uuid4()),
            code=obj_in.code,
            rule_id=obj_in.rule_id,
            entity_id=obj_in.entity_id,
            site_id=obj_in.site_id,
            title=obj_in.title,
            description=obj_in.description,
            severity=obj_in.severity,
            status=obj_in.status,
            started_at=obj_in.started_at,
            last_detected_at=obj_in.last_detected_at,
            resolved_at=obj_in.resolved_at,
            evidence=obj_in.evidence,
            affected_rooms=obj_in.affected_rooms,
            estimated_energy_waste_kwh=obj_in.estimated_energy_waste_kwh,
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def get_issue(self, db: AsyncSession, issue_id: str) -> Optional[Issue]:
        result = await db.execute(
            select(Issue).where(or_(Issue.id == issue_id, Issue.code == issue_id))
        )
        return result.scalars().first()

    async def get_active_issue_by_rule_and_entity(
        self, db: AsyncSession, rule_id: str, entity_id: str
    ) -> Optional[Issue]:
        stmt = (
            select(Issue)
            .where(
                Issue.rule_id == rule_id,
                Issue.entity_id == entity_id,
                Issue.status.in_([IssueStatus.OPEN, IssueStatus.ACKNOWLEDGED]),
            )
            .order_by(desc(Issue.started_at))
        )
        result = await db.execute(stmt)
        return result.scalars().first()

    async def list_issues(
        self,
        db: AsyncSession,
        site_id: Optional[str] = None,
        status: Optional[IssueStatus] = None,
        entity_id: Optional[str] = None,
        search: Optional[str] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> tuple[Sequence[Issue], int]:
        from src.models.entity import Entity
        stmt = select(Issue).outerjoin(Entity, Issue.entity_id == Entity.id)
        count_stmt = select(func.count(Issue.id)).outerjoin(Entity, Issue.entity_id == Entity.id)

        if site_id and site_id != "all":
            stmt = stmt.where(Issue.site_id == site_id)
            count_stmt = count_stmt.where(Issue.site_id == site_id)
        if status:
            stmt = stmt.where(Issue.status == status)
            count_stmt = count_stmt.where(Issue.status == status)
        if entity_id:
            stmt = stmt.where(Issue.entity_id == entity_id)
            count_stmt = count_stmt.where(Issue.entity_id == entity_id)
        if search and search.strip():
            search_str = f"%{search.strip()}%"
            search_filter = or_(
                Issue.code.ilike(search_str),
                Issue.title.ilike(search_str),
                Issue.description.ilike(search_str),
                Issue.entity_id.ilike(search_str),
                Entity.code.ilike(search_str),
                Entity.name.ilike(search_str),
            )
            stmt = stmt.where(search_filter)
            count_stmt = count_stmt.where(search_filter)

        total_res = await db.execute(count_stmt)
        total_count = total_res.scalar_one_or_none() or 0

        if offset is not None:
            stmt = stmt.offset(offset)
        if limit is not None:
            stmt = stmt.limit(limit)

        result = await db.execute(stmt.order_by(desc(Issue.started_at)))
        return result.scalars().all(), total_count

    async def update_issue(
        self, db: AsyncSession, issue_id: str, obj_in: IssueUpdate
    ) -> Optional[Issue]:
        issue = await self.get_issue(db, issue_id)
        if not issue:
            return None

        update_data = obj_in.model_dump(exclude_unset=True) if hasattr(obj_in, "model_dump") else (
            obj_in.dict(exclude_unset=True) if hasattr(obj_in, "dict") else obj_in
        )
        for field, value in update_data.items():
            setattr(issue, field, value)

        await db.commit()
        await db.refresh(issue)
        return issue


crud_issue = CRUDIssue()
