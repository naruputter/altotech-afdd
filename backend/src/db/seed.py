import asyncio
import logging
from sqlalchemy import delete
from src.db.session import AsyncSessionLocal, engine
from src.db.base import Base
from src.models.site import Site
from src.models.entity import Entity, EntityRelationship
from src.models.rule import Rule
from src.models.issue import Issue
from src.models.telemetry import Telemetry

from src.db.seeds import (
    seed_sites,
    seed_rules,
    seed_spaces_and_equipment,
    seed_sample_telemetry,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed")


async def run_seed(include_telemetry: bool = True):
    logger.info("==========================================")
    logger.info("Starting Database Seeding Process (Modular Seeds)...")
    logger.info("==========================================")

    # Re-initialize tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        logger.info("Cleaning old database records...")
        await db.execute(delete(Telemetry))
        await db.execute(delete(Issue))
        await db.execute(delete(EntityRelationship))
        await db.execute(delete(Entity))
        await db.execute(delete(Rule))
        await db.execute(delete(Site))
        await db.commit()

        # 1. Seed Core Sites (Code-based constants)
        site_map = await seed_sites(db)

        # 2. Seed Core AFDD Rules (Code-based constants)
        await seed_rules(db)

        # 3. Seed Spatial & Equipment Entities (CSV-based / Imported Assets)
        entity_code_map = await seed_spaces_and_equipment(db, site_map)

        # 4. Seed Telemetry (Time-series data)
        if include_telemetry and entity_code_map:
            await seed_sample_telemetry(db, site_map, entity_code_map)

        await db.commit()
        logger.info("✅ Database Seeding Completed Successfully!")


if __name__ == "__main__":
    asyncio.run(run_seed())
