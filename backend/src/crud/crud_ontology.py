import uuid
from typing import List, Optional, Set
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, or_, func
from sqlalchemy.orm import selectinload
from src.models.entity import Entity, EntityRelationship, EntityType, RelationshipType
from src.schemas.ontology_schema import EntityCreate, EntityRelationshipCreate, EntityUpdate


class CRUDOntology:
    async def create_entity(self, db: AsyncSession, obj_in: EntityCreate) -> Entity:
        db_obj = Entity(
            id=str(uuid.uuid4()),
            code=obj_in.code,
            name=obj_in.name,
            entity_type=obj_in.entity_type,
            site_id=obj_in.site_id,
            brick_class=obj_in.brick_class,
            metadata_json=obj_in.metadata_json,
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def get_entity(self, db: AsyncSession, entity_id: str) -> Optional[Entity]:
        result = await db.execute(
            select(Entity).where(or_(Entity.id == entity_id, Entity.code == entity_id))
        )
        return result.scalars().first()

    async def update_entity(self, db: AsyncSession, entity_id: str, obj_in: any) -> Optional[Entity]:
        db_obj = await self.get_entity(db, entity_id)
        if not db_obj:
            return None
        update_data = obj_in.model_dump(exclude_unset=True) if hasattr(obj_in, "model_dump") else (
            obj_in.dict(exclude_unset=True) if hasattr(obj_in, "dict") else obj_in
        )
        for field, value in update_data.items():
            if hasattr(db_obj, field) and value is not None:
                setattr(db_obj, field, value)
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def list_entities(
        self,
        db: AsyncSession,
        site_id: Optional[str] = None,
        entity_type: Optional[EntityType] = None,
        search: Optional[str] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> tuple[List[Entity], int]:
        from sqlalchemy import cast, String as SQLString
        stmt = select(Entity)
        count_stmt = select(func.count(Entity.id))
        
        if site_id:
            stmt = stmt.where(Entity.site_id == site_id)
            count_stmt = count_stmt.where(Entity.site_id == site_id)
        if entity_type:
            stmt = stmt.where(Entity.entity_type == entity_type)
            count_stmt = count_stmt.where(Entity.entity_type == entity_type)
        if search and search.strip():
            search_str = f"%{search.strip()}%"
            from sqlalchemy.orm import aliased
            TargetSpace = aliased(Entity)

            space_match_subq = (
                select(EntityRelationship.subject_id)
                .join(TargetSpace, EntityRelationship.object_id == TargetSpace.id)
                .where(
                    or_(
                        TargetSpace.code.ilike(search_str),
                        TargetSpace.name.ilike(search_str),
                    )
                )
            )

            search_filter = or_(
                Entity.code.ilike(search_str),
                Entity.name.ilike(search_str),
                Entity.brick_class.ilike(search_str),
                cast(Entity.metadata_json, SQLString).ilike(search_str),
                Entity.id.in_(space_match_subq),
            )
            stmt = stmt.where(search_filter)
            count_stmt = count_stmt.where(search_filter)

        total_res = await db.execute(count_stmt)
        total_count = total_res.scalar_one_or_none() or 0

        if offset is not None:
            stmt = stmt.offset(offset)
        if limit is not None:
            stmt = stmt.limit(limit)

        result = await db.execute(stmt.order_by(Entity.name))
        return list(result.scalars().all()), total_count

    async def create_relationship(self, db: AsyncSession, obj_in: EntityRelationshipCreate) -> EntityRelationship:
        db_obj = EntityRelationship(
            id=str(uuid.uuid4()),
            subject_id=obj_in.subject_id,
            predicate=obj_in.predicate,
            object_id=obj_in.object_id,
            properties=obj_in.properties,
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def list_relationships(
        self,
        db: AsyncSession,
        subject_id: Optional[str] = None,
        predicate: Optional[RelationshipType] = None,
        object_id: Optional[str] = None,
    ) -> List[EntityRelationship]:
        stmt = select(EntityRelationship)
        if subject_id:
            stmt = stmt.where(EntityRelationship.subject_id == subject_id)
        if predicate:
            stmt = stmt.where(EntityRelationship.predicate == predicate)
        if object_id:
            stmt = stmt.where(EntityRelationship.object_id == object_id)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def delete_relationships(
        self,
        db: AsyncSession,
        subject_id: Optional[str] = None,
        predicate: Optional[RelationshipType] = None,
        object_id: Optional[str] = None,
    ) -> int:
        stmt = delete(EntityRelationship)
        if subject_id:
            stmt = stmt.where(EntityRelationship.subject_id == subject_id)
        if predicate:
            stmt = stmt.where(EntityRelationship.predicate == predicate)
        if object_id:
            stmt = stmt.where(EntityRelationship.object_id == object_id)
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount or 0

    async def get_downstream_impact(self, db: AsyncSession, source_entity_id: str) -> tuple[List[str], List[str]]:
        """
        Traverse BrickSchema relationships to find affected HVAC Zones and Rooms.
        """
        source = await self.get_entity(db, source_entity_id)
        if not source:
            return [], []

        resolved_id = source.id
        affected_zones: Set[str] = set()
        affected_rooms: Set[str] = set()

        if source.entity_type == EntityType.AHU:
            # 1. Find Zones fed by AHU
            stmt_zones = select(EntityRelationship.object_id).where(
                EntityRelationship.subject_id == resolved_id,
                EntityRelationship.predicate == RelationshipType.FEEDS,
            )
            res_zones = await db.execute(stmt_zones)
            zone_ids = [row[0] for row in res_zones.all()]
            affected_zones.update(zone_ids)

            # 2. Find Rooms in those Zones
            for z_id in zone_ids:
                stmt_rooms_part = select(EntityRelationship.subject_id).where(
                    EntityRelationship.object_id == z_id,
                    EntityRelationship.predicate == RelationshipType.IS_PART_OF,
                )
                res_rooms = await db.execute(stmt_rooms_part)
                affected_rooms.update([row[0] for row in res_rooms.all()])

                stmt_zone_has = select(EntityRelationship.object_id).where(
                    EntityRelationship.subject_id == z_id,
                    EntityRelationship.predicate == RelationshipType.HAS_PART,
                )
                res_zone_has = await db.execute(stmt_zone_has)
                affected_rooms.update([row[0] for row in res_zone_has.all()])

        elif source.entity_type == EntityType.HVAC_ZONE:
            affected_zones.add(resolved_id)
            stmt_rooms_part = select(EntityRelationship.subject_id).where(
                EntityRelationship.object_id == resolved_id,
                EntityRelationship.predicate == RelationshipType.IS_PART_OF,
            )
            res_rooms = await db.execute(stmt_rooms_part)
            affected_rooms.update([row[0] for row in res_rooms.all()])

        # Convert UUIDs to Codes or Names for readable impact presentation
        room_entities = await db.execute(select(Entity).where(Entity.id.in_(list(affected_rooms)))) if affected_rooms else None
        zone_entities = await db.execute(select(Entity).where(Entity.id.in_(list(affected_zones)))) if affected_zones else None
        
        room_labels = [r.name for r in (room_entities.scalars().all() if room_entities else [])] or list(affected_rooms)
        zone_labels = [z.name for z in (zone_entities.scalars().all() if zone_entities else [])] or list(affected_zones)

        return zone_labels, room_labels

    async def delete_entity(self, db: AsyncSession, entity_id: str) -> bool:
        entity = await self.get_entity(db, entity_id)
        if not entity:
            return False
        resolved_id = entity.id
        await db.execute(
            delete(EntityRelationship).where(
                (EntityRelationship.subject_id == resolved_id) | (EntityRelationship.object_id == resolved_id)
            )
        )
        result = await db.execute(delete(Entity).where(Entity.id == resolved_id))
        await db.commit()
        return True


crud_ontology = CRUDOntology()
