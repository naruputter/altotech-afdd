import json
import uuid
import logging
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.site import Site
from src.models.entity import Entity, EntityRelationship, EntityType, RelationshipType

logger = logging.getLogger("seed.assets")

DATA_DIR = Path(__file__).resolve().parent / "data"
ENTITIES_JSON_PATH = DATA_DIR / "entities.json"


async def seed_spaces_and_equipment(
    db: AsyncSession, 
    site_map: dict[str, Site],
    json_path: Path | None = None
) -> dict[str, Entity]:
    """
    Seeds spatial hierarchy and equipment fleet directly from JSON ontology file.
    No CSV dependency or external volume mount required.
    """
    target_path = json_path or ENTITIES_JSON_PATH
    logger.info(f"--- 3. Seeding Spaces & Equipment from {target_path.name} ---")

    if not target_path.exists():
        logger.error(f"Entities JSON file not found at: {target_path}")
        return {}

    with open(target_path, "r", encoding="utf-8") as f:
        entities_data = json.load(f)

    entity_code_map: dict[str, Entity] = {}
    deferred_relationships: list[dict] = []

    # 1. Create Entity instances
    for item in entities_data:
        code = item["code"]
        site_code = item.get("site_code", "SITE_CAMPUS_A")
        site_obj = site_map.get(site_code) or list(site_map.values())[0]

        entity = Entity(
            id=str(uuid.uuid4()),
            code=code,
            name=item["name"],
            entity_type=EntityType[item["entity_type"]],
            site_id=site_obj.id,
            brick_class=item.get("brick_class", "brick:Entity"),
            metadata_json=item.get("metadata")
        )
        db.add(entity)
        entity_code_map[code] = entity

        # Collect relationships to wire up after UUID creation
        for rel in item.get("relationships", []):
            deferred_relationships.append({
                "subject_code": code,
                "predicate": RelationshipType[rel["predicate"]],
                "target_code": rel["target_code"]
            })

    await db.flush()
    logger.info(f"Loaded {len(entity_code_map)} entities into memory.")

    # 2. Wire up Graph Relationships (resolving codes to UUIDs)
    rel_count = 0
    for rel in deferred_relationships:
        subj = entity_code_map.get(rel["subject_code"])
        obj = entity_code_map.get(rel["target_code"])
        if subj and obj:
            db.add(EntityRelationship(
                id=str(uuid.uuid4()),
                subject_id=subj.id,
                predicate=rel["predicate"],
                object_id=obj.id
            ))
            rel_count += 1

    await db.flush()
    logger.info(f"Loaded {rel_count} graph relationships (edges).")
    return entity_code_map
