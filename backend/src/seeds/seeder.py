import json
import os
import uuid
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.site import Site
from src.models.entity import Entity, EntityRelationship, EntityType, RelationshipType
from src.models.rule import Rule, RuleStatus, RuleSeverity

logger = logging.getLogger("DB_Seeder")


async def seed_database_from_json(db: AsyncSession, json_path: str = None):
    """
    Seeds full dataset (Sites, Spaces, Equipments, Relationships, Core AFDD Rules) from ontology_seed.json.
    """
    if not json_path:
        json_path = os.path.join(os.path.dirname(__file__), "ontology_seed.json")

    if not os.path.exists(json_path):
        logger.warning(f"Seed file not found at {json_path}. Skipping database seed.")
        return

    # Check if DB is already seeded
    existing_entities = (await db.execute(select(Entity))).scalars().first()
    if existing_entities:
        logger.info("Database already contains entity records. Skipping seeding.")
        return

    logger.info(f"Starting Database Auto-Seed from {json_path}...")

    try:
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        logger.error(f"Failed to read seed JSON file: {e}")
        return

    # 1. Seed Sites
    site_map = {} # site_code -> Site.id
    for s_data in data.get("sites", []):
        site = Site(
            id=str(uuid.uuid4()),
            code=s_data["code"],
            name=s_data["name"],
            description=s_data.get("description"),
        )
        db.add(site)
        site_map[s_data["code"]] = site.id

    await db.flush()
    logger.info(f"Seeded {len(site_map)} Sites.")

    # 2. Seed Entities
    entity_code_to_id = {}
    for ent_data in data.get("entities", []):
        ent_id = str(uuid.uuid4())
        code = ent_data["code"]
        site_code = ent_data.get("site_code")
        site_id = site_map.get(site_code)

        entity_code_to_id[code] = ent_id
        ent = Entity(
            id=ent_id,
            code=code,
            name=ent_data["name"],
            entity_type=EntityType(ent_data["entity_type"]),
            site_id=site_id,
            brick_class=ent_data["brick_class"],
            metadata_json=ent_data.get("metadata_json"),
        )
        db.add(ent)

    await db.flush()
    logger.info(f"Seeded {len(entity_code_to_id)} Entities (Spaces & Equipments).")

    # 3. Seed Relationships
    rel_count = 0
    for rel_data in data.get("relationships", []):
        subj_code = rel_data["subject_code"]
        pred_str = rel_data["predicate"]
        obj_code = rel_data["object_code"]

        subj_id = entity_code_to_id.get(subj_code)
        obj_id = entity_code_to_id.get(obj_code)

        if subj_id and obj_id:
            rel = EntityRelationship(
                id=str(uuid.uuid4()),
                subject_id=subj_id,
                predicate=RelationshipType(pred_str),
                object_id=obj_id,
                properties=rel_data.get("properties"),
            )
            db.add(rel)
            rel_count += 1

    await db.flush()

    # 4. Seed Core AFDD Rules (Specified in required-behaviors.md)
    rules_count = 0
    for rule_data in data.get("rules", []):
        rule = Rule(
            id=str(uuid.uuid4()),
            code=rule_data["code"],
            name=rule_data["name"],
            description=rule_data.get("description"),
            severity=RuleSeverity(rule_data.get("severity", "CRITICAL")),
            is_active=rule_data.get("is_active", True),
            status=RuleStatus(rule_data.get("status", "APPROVED")),
            created_by=rule_data.get("created_by", "system_seed"),
            target_scope=rule_data["target_scope"],
            fault_logic=rule_data["fault_logic"],
        )
        db.add(rule)
        rules_count += 1

    await db.commit()
    logger.info(f"Database successfully seeded with {len(entity_code_to_id)} entities, {rel_count} relationships, and {rules_count} AFDD rules.")
