import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Set
from src.db.session import AsyncSessionLocal
from src.services.ws_manager import ws_manager
from src.crud.crud_ontology import crud_ontology
from src.crud.crud_telemetry import crud_telemetry

logger = logging.getLogger("DeviceWatchdog")


class DeviceWatchdog:
    """
    Periodic background service that tracks the online/offline state of all equipment entities.
    Emits 'device.status' WebSocket event with status='OFFLINE' when an entity ceases
    to publish telemetry for longer than `offline_threshold_seconds` (default: 180s = 3 minutes).
    """

    def __init__(self, check_interval_seconds: int = 30, offline_threshold_seconds: int = 180):
        self.check_interval_seconds = check_interval_seconds
        self.offline_threshold_seconds = offline_threshold_seconds
        self._online_entities: Set[str] = set()

    def mark_online(self, entity_id: str):
        """Immediately marks an entity as online (called when telemetry arrives)."""
        self._online_entities.add(entity_id)

    async def run(self):
        logger.info(
            f"Starting DeviceWatchdog background task (Interval: {self.check_interval_seconds}s, "
            f"Threshold: {self.offline_threshold_seconds}s)"
        )
        while True:
            try:
                await asyncio.sleep(self.check_interval_seconds)
                await self._check_devices()
            except asyncio.CancelledError:
                logger.info("DeviceWatchdog cancelled. Shutting down...")
                break
            except Exception as e:
                logger.error(f"Error in DeviceWatchdog cycle: {e}")

    async def _check_devices(self):
        async with AsyncSessionLocal() as db:
            # 1. Fetch all equipment entities
            entities, _ = await crud_ontology.list_entities(db, limit=1000)
            if not entities:
                return

            now = datetime.now(timezone.utc)
            now_ts = now.timestamp()

            # Group entities by site
            site_ids = {e.site_id for e in entities if e.site_id}
            
            for site_id in site_ids:
                status_list = await crud_telemetry.get_site_device_status(db, site_id)
                status_map = {s["entity_id"]: s["last_seen"] for s in status_list}

                site_entities = [e for e in entities if e.site_id == site_id]
                for entity in site_entities:
                    last_seen_str = status_map.get(entity.id)
                    is_online = False
                    if last_seen_str:
                        try:
                            last_seen_dt = datetime.fromisoformat(last_seen_str)
                            if last_seen_dt.tzinfo is None:
                                last_seen_dt = last_seen_dt.replace(tzinfo=timezone.utc)
                            diff = now_ts - last_seen_dt.timestamp()
                            is_online = diff < self.offline_threshold_seconds
                        except Exception:
                            is_online = False

                    if not is_online and entity.id in self._online_entities:
                        # Transition from ONLINE -> OFFLINE
                        self._online_entities.remove(entity.id)
                        logger.info(f"[DeviceWatchdog] Entity {entity.name} ({entity.id}) is now OFFLINE")
                        await ws_manager.broadcast(
                            event_type="device.status",
                            data={
                                "entity_id": entity.id,
                                "status": "OFFLINE",
                                "last_seen": last_seen_str,
                            },
                            site_id=site_id,
                        )
                    elif is_online and entity.id not in self._online_entities:
                        # Initial online registration
                        self._online_entities.add(entity.id)


# Global singleton instance
device_watchdog = DeviceWatchdog()
