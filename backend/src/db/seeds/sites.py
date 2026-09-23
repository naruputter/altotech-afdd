import uuid
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.site import Site

logger = logging.getLogger("seed.sites")

DEFAULT_SITES = [
    {
        "code": "SITE_CAMPUS_A",
        "name": "Building A (Commercial Office Tower)",
        "description": "Prime commercial office facility with 4 tenant floors."
    },
    {
        "code": "SITE_CAMPUS_B",
        "name": "Building B (Enterprise Corporate Tower)",
        "description": "High-efficiency corporate headquarters with dedicated HVAC zones."
    },
    {
        "code": "SITE_CAMPUS_C",
        "name": "Building C (Hospitality & Hotel)",
        "description": "Luxury hotel and mixed-use hospitality building."
    }
]


async def seed_sites(db: AsyncSession) -> dict[str, Site]:
    """Seeds default sites / campuses."""
    logger.info("--- 1. Seeding Sites / Campuses ---")
    site_map: dict[str, Site] = {}

    for s in DEFAULT_SITES:
        site = Site(
            id=str(uuid.uuid4()),
            code=s["code"],
            name=s["name"],
            description=s["description"]
        )
        db.add(site)
        site_map[s["code"]] = site

    await db.flush()
    logger.info(f"Loaded {len(site_map)} default sites.")
    return site_map
