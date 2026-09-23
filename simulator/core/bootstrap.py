import os
import json
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
    fixtures_path = config.FIXTURES_PATH
    if not os.path.exists(fixtures_path):
        logger.warning(f"Fixtures file not found at {fixtures_path}")
        return

    try:
        with open(fixtures_path, "r") as f:
            data = json.load(f)
    except Exception as e:
        logger.error(f"Failed to read fixtures JSON: {e}")
        return

    async with httpx.AsyncClient(timeout=10.0) as client:
        # 1. Create Entities
        for entity in data.get("entities", []):
            try:
                res = await client.post(f"{config.API_BASE_URL}/ontology/entities", json=entity)
                if res.status_code in (201, 409):
                    logger.debug(f"Entity {entity['id']} synced")
            except Exception as e:
                logger.error(f"Failed to bootstrap entity {entity.get('id')}: {e}")

        # 2. Create Relationships
        for rel in data.get("relationships", []):
            try:
                res = await client.post(f"{config.API_BASE_URL}/ontology/relationships", json=rel)
                if res.status_code == 201:
                    logger.debug(f"Relationship {rel['subject_id']} -{rel['predicate']}-> {rel['object_id']} synced")
            except Exception as e:
                logger.error(f"Failed to bootstrap relationship: {e}")

    logger.info("Ontology fixtures synced successfully.")
