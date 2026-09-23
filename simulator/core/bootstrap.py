import logging
import asyncio
import httpx
from config import config

logger = logging.getLogger("Simulator_Bootstrap")


async def wait_for_backend():
    health_url = config.API_BASE_URL.replace("/api/v1", "/health")
    logger.info(f"Checking API health at {health_url}...")
    async with httpx.AsyncClient(timeout=10.0) as client:
        for attempt in range(30):
            try:
                res = await client.get(health_url)
                if res.status_code == 200:
                    logger.info("FastAPI backend is ready!")
                    return True
            except Exception:
                pass
            await asyncio.sleep(2)
    logger.warning("Could not verify health check; continuing anyway...")
    return False


async def bootstrap_ontology():
    """
    Simulator only ensures backend is ready. Backend handles its own ontology seeding.
    """
    logger.info("Ontology seeding is managed directly by Backend service.")
