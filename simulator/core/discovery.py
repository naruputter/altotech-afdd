import logging
from typing import List, Dict, Any
import httpx
from config import config
from devices.base import BaseDeviceSimulator
from devices.ahu import AHUSimulator
from devices.iaq import IAQSimulator
from devices.meter import MeterSimulator

logger = logging.getLogger("Simulator_Discovery")


async def discover_and_build_fleet() -> List[BaseDeviceSimulator]:
    """
    Queries the Backend Ontology API (/api/v1/ontology/entities) to dynamically
    fetch all registered equipment (AHU, Meter, IAQ_Sensor) across all sites,
    and instantiates simulation workers for each.
    """
    fleet: List[BaseDeviceSimulator] = []
    ahu_interval = config.SIMULATION_INTERVAL_AHU
    iaq_interval = config.SIMULATION_INTERVAL_IAQ
    meter_interval = config.SIMULATION_INTERVAL_METERS

    api_url = f"{config.API_BASE_URL}/ontology/entities"
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(api_url, params={"limit": 500})
            if resp.status_code != 200:
                logger.error(f"Failed to fetch entities from {api_url}: HTTP {resp.status_code}")
                return fleet

            data = resp.json()
            entities = data.get("data", []) if isinstance(data, dict) else []

            for ent in entities:
                ent_id = ent.get("id")
                ent_code = ent.get("code")
                ent_type = ent.get("entity_type")
                site_id = ent.get("site_id")
                metadata = ent.get("metadata_json") or {}

                if not ent_id or not site_id:
                    continue

                if ent_type == "AHU":
                    # Simulate fault if flagged in metadata or specific AHUs (e.g. ahu-a-f01-east)
                    is_faulty = metadata.get("simulate_fault", False) or "ahu-a-f01" in ent_code.lower()
                    fleet.append(
                        AHUSimulator(
                            device_id=ent_id,
                            device_code=ent_code,
                            site_id=site_id,
                            setpoint=22.0,
                            interval=ahu_interval,
                            simulate_fault=is_faulty,
                        )
                    )
                elif ent_type in ("IAQ_Sensor", "IAQ"):
                    is_faulty = metadata.get("simulate_fault", False)
                    fleet.append(
                        IAQSimulator(
                            device_id=ent_id,
                            device_code=ent_code,
                            site_id=site_id,
                            base_co2=metadata.get("base_co2", 600.0),
                            interval=iaq_interval,
                            simulate_fault=is_faulty,
                        )
                    )
                elif ent_type in ("Meter", "METER"):
                    is_faulty = metadata.get("simulate_fault", False)
                    fleet.append(
                        MeterSimulator(
                            device_id=ent_id,
                            device_code=ent_code,
                            site_id=site_id,
                            base_kw=metadata.get("base_kw", 25.0),
                            interval=meter_interval,
                            simulate_fault=is_faulty,
                        )
                    )

        logger.info(f"Dynamically discovered {len(fleet)} devices from Ontology API for simulation fleet.")
    except Exception as e:
        logger.error(f"Error during dynamic entity discovery: {e}")

    return fleet
