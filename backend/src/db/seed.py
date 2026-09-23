import csv
import json
import os
import uuid
import logging
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.site import Site
from src.models.entity import Entity, EntityRelationship, EntityType, RelationshipType

logger = logging.getLogger("DB_Seeder")

BRICK_CLASS_MAP = {
    "Building": "brick:Building",
    "Floor": "brick:Floor",
    "HVAC Zone": "brick:HVAC_Zone",
    "Room": "brick:Room",
    "AHU": "brick:Air_Handling_Unit",
    "Electricity Meter": "brick:Electric_Meter",
    "IAQ Sensor": "brick:Air_Quality_Sensor",
}

ENTITY_TYPE_MAP = {
    "Building": EntityType.BUILDING,
    "Floor": EntityType.FLOOR,
    "HVAC Zone": EntityType.HVAC_ZONE,
    "Room": EntityType.ROOM,
    "AHU": EntityType.AHU,
    "Electricity Meter": EntityType.METER,
    "IAQ Sensor": EntityType.IAQ_SENSOR,
}


async def seed_database(db: AsyncSession, quiz_dir: str):
    """
    Seeds full dataset (Sites, Spaces, Equipments, Relationships) from quiz CSV files.
    """
    spaces_csv = os.path.join(quiz_dir, "building-and-equipment", "spaces.csv")
    equipment_csv = os.path.join(quiz_dir, "building-and-equipment", "equipment.csv")

    if not os.path.exists(spaces_csv) or not os.path.exists(equipment_csv):
        logger.warning(f"Seed CSV files not found in {quiz_dir}. Skipping auto-seeding.")
        return

    # Check if DB is already seeded
    existing_entities = (await db.execute(select(Entity))).scalars().first()
    if existing_entities:
        logger.info("Database already contains entity records. Skipping seeding.")
        return

    logger.info("Starting Full Database Seeding from quiz CSVs...")

    # 1. Define & Seed Sites (Properties)
    site_records = [
        {"code": "building-a", "name": "Building A", "description": "Office Building A (4 Floors + Lobby + Plant Room)"},
        {"code": "building-b", "name": "Building B", "description": "Office Building B (4 Floors + Lobby + Plant Room)"},
        {"code": "building-c", "name": "Building C", "description": "Hotel Building C (4 Floors + Lobby + Plant Room)"},
    ]

    site_map = {} # code -> Site.id
    for s_data in site_records:
        site = Site(
            id=str(uuid.uuid4()),
            code=s_data["code"],
            name=s_data["name"],
            description=s_data["description"],
        )
        db.add(site)
        site_map[s_data["code"]] = site.id

    await db.flush()
    logger.info(f"Seeded {len(site_records)} Sites.")

    # 2. Read & Seed Spaces
    entity_code_to_id = {}
    relationships_to_create = [] # (subject_id, predicate, object_id)

    with open(spaces_csv, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            space_id = row["space_id"].strip()
            name = row["name"].strip()
            space_type_str = row["space_type"].strip()
            parent_id = row["parent_space_id"].strip() if row.get("parent_space_id") else None
            usage_type = row.get("usage_type", "").strip()

            # Determine site
            site_code = "building-a"
            if "building-b" in space_id:
                site_code = "building-b"
            elif "building-c" in space_id:
                site_code = "building-c"

            ent_id = str(uuid.uuid4())
            entity_code_to_id[space_id] = ent_id

            ent = Entity(
                id=ent_id,
                code=space_id,
                name=name,
                entity_type=ENTITY_TYPE_MAP[space_type_str],
                site_id=site_map[site_code],
                brick_class=BRICK_CLASS_MAP.get(space_type_str, "brick:Space"),
                metadata_json={"usage_type": usage_type, "space_type": space_type_str},
            )
            db.add(ent)

            if parent_id:
                # Spatial hierarchy: parent hasPart child OR child isPartOf parent
                if space_type_str in ("Floor", "Room") and "building" in parent_id:
                    relationships_to_create.append((parent_id, RelationshipType.HAS_PART, space_id))
                else:
                    relationships_to_create.append((space_id, RelationshipType.IS_PART_OF, parent_id))

    await db.flush()
    logger.info(f"Seeded {len(entity_code_to_id)} Spaces.")

    # 3. Read & Seed Equipments
    equipment_count = 0
    with open(equipment_csv, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            eq_id = row["equipment_id"].strip()
            name = row["name"].strip()
            eq_type_str = row["equipment_type"].strip()
            prop_id = row["property_id"].strip()
            installed_space = row["installed_space_id"].strip() if row.get("installed_space_id") else None
            served_space = row["served_space_id"].strip() if row.get("served_space_id") else None
            scope_space = row["measurement_scope_id"].strip() if row.get("measurement_scope_id") else None

            ent_id = str(uuid.uuid4())
            entity_code_to_id[eq_id] = ent_id
            equipment_count += 1

            ent = Entity(
                id=ent_id,
                code=eq_id,
                name=name,
                entity_type=ENTITY_TYPE_MAP[eq_type_str],
                site_id=site_map[prop_id],
                brick_class=BRICK_CLASS_MAP.get(eq_type_str, "brick:Equipment"),
                metadata_json={
                    "installed_space": installed_space,
                    "served_space": served_space,
                    "measurement_scope": scope_space,
                },
            )
            db.add(ent)

            # Build Relationships
            if installed_space:
                relationships_to_create.append((eq_id, RelationshipType.LOCATED_IN, installed_space))
            if served_space:
                relationships_to_create.append((eq_id, RelationshipType.FEEDS, served_space))
            if scope_space:
                relationships_to_create.append((eq_id, RelationshipType.MEASURES, scope_space))

    await db.flush()
    logger.info(f"Seeded {equipment_count} Equipment entities.")

    # 4. Create Entity Relationships
    rel_count = 0
    for subj_code, pred, obj_code in relationships_to_create:
        subj_id = entity_code_to_id.get(subj_code)
        obj_id = entity_code_to_id.get(obj_code)
        if subj_id and obj_id:
            rel = EntityRelationship(
                id=str(uuid.uuid4()),
                subject_id=subj_id,
                predicate=pred,
                object_id=obj_id,
                properties={"source": "quiz_fixtures"},
            )
            db.add(rel)
            rel_count += 1

    await db.commit()
    logger.info(f"Database successfully seeded! Created {len(entity_code_to_id)} total entities and {rel_count} relationships.")
