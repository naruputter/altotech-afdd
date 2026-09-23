import uuid
from typing import List, Optional, Sequence
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, or_, func
from src.models.rule import Rule, RuleStatus
from src.schemas.rule_schema import RuleCreate, RuleUpdate


class CRUDRule:
    async def create_rule(
        self, db: AsyncSession, obj_in: RuleCreate, created_by: str = "system", status: RuleStatus = RuleStatus.DRAFT
    ) -> Rule:
        db_obj = Rule(
            id=str(uuid.uuid4()),
            code=obj_in.code,
            name=obj_in.name,
            description=obj_in.description,
            target_scope=obj_in.target_scope.model_dump() if hasattr(obj_in.target_scope, "model_dump") else obj_in.target_scope,
            fault_logic=obj_in.fault_logic.model_dump() if hasattr(obj_in.fault_logic, "model_dump") else obj_in.fault_logic,
            severity=obj_in.severity,
            is_active=False,
            status=status,
            created_by=created_by,
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def get_rule(self, db: AsyncSession, rule_id: str) -> Optional[Rule]:
        result = await db.execute(
            select(Rule).where(or_(Rule.id == rule_id, Rule.code == rule_id))
        )
        return result.scalars().first()

    async def list_rules(
        self,
        db: AsyncSession,
        status: Optional[RuleStatus] = None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> tuple[Sequence[Rule], int]:
        stmt = select(Rule)
        count_stmt = select(func.count(Rule.id))

        if status:
            stmt = stmt.where(Rule.status == status)
            count_stmt = count_stmt.where(Rule.status == status)
        if is_active is not None:
            stmt = stmt.where(Rule.is_active == is_active)
            count_stmt = count_stmt.where(Rule.is_active == is_active)
        if search and search.strip():
            search_str = f"%{search.strip()}%"
            search_filter = or_(
                Rule.code.ilike(search_str),
                Rule.name.ilike(search_str),
                Rule.description.ilike(search_str),
            )
            stmt = stmt.where(search_filter)
            count_stmt = count_stmt.where(search_filter)

        total_res = await db.execute(count_stmt)
        total_count = total_res.scalar_one_or_none() or 0

        if offset is not None:
            stmt = stmt.offset(offset)
        if limit is not None:
            stmt = stmt.limit(limit)

        result = await db.execute(stmt.order_by(Rule.name))
        return list(result.scalars().all()), total_count

    async def update_rule(
        self, db: AsyncSession, rule_id: str, obj_in: RuleUpdate
    ) -> Optional[Rule]:
        rule = await self.get_rule(db, rule_id)
        if not rule:
            return None

        update_data = obj_in.model_dump(exclude_unset=True) if hasattr(obj_in, "model_dump") else (
            obj_in.dict(exclude_unset=True) if hasattr(obj_in, "dict") else obj_in
        )
        if "target_scope" in update_data and update_data["target_scope"] is not None:
            if hasattr(update_data["target_scope"], "model_dump"):
                update_data["target_scope"] = update_data["target_scope"].model_dump()
        if "fault_logic" in update_data and update_data["fault_logic"] is not None:
            if hasattr(update_data["fault_logic"], "model_dump"):
                update_data["fault_logic"] = update_data["fault_logic"].model_dump()

        for field, value in update_data.items():
            setattr(rule, field, value)

        await db.commit()
        await db.refresh(rule)
        return rule

    async def delete_rule(self, db: AsyncSession, rule_id: str) -> bool:
        rule = await self.get_rule(db, rule_id)
        if not rule:
            return False
        await db.delete(rule)
        await db.commit()
        return True


crud_rule = CRUDRule()
