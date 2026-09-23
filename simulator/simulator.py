import asyncio
import json
import logging
from typing import Dict, Any, List
from aiohttp import web

import aiomqtt
from config import config
from core.bootstrap import wait_for_backend, bootstrap_ontology
from core.discovery import discover_and_build_fleet
from core.server import create_web_app
from devices.base import BaseDeviceSimulator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s"
)
logger = logging.getLogger("AFDD_Simulator")


async def run_device_loop(device: BaseDeviceSimulator, client: aiomqtt.Client, state: Dict[str, Any]):
    """
    Continuous publication loop for a single simulated device.
    """
    topic = device.get_topic()
    interval = max(1.0, device.interval / config.ACCELERATION_FACTOR)

    while True:
        try:
            if not state.get("is_paused", False):
                points = await device.generate_datapoints()
                if points:
                    payload = json.dumps({"points": points})
                    await client.publish(topic, payload=payload, qos=1)
                    logger.debug(f"[{device.device_type} Stream] {device.device_code} published {len(points)} points to {topic}")
        except Exception as err:
            logger.error(f"Error in device stream {device.device_code} ({device.device_id}): {err}")

        await asyncio.sleep(interval)


async def main():
    logger.info("Starting Modular Dynamic Multi-Site AFDD Simulator Service...")
    await wait_for_backend()
    await bootstrap_ontology()

    devices = await discover_and_build_fleet()
    if not devices:
        logger.warning("No devices discovered via API. Retrying in 10s...")
        await asyncio.sleep(10)
        devices = await discover_and_build_fleet()

    logger.info(f"Initialized fleet of {len(devices)} simulated equipment streams across Sites.")

    sim_state: Dict[str, Any] = {"is_paused": False}

    # 1. Start internal aiohttp status web server on port 3333
    web_app = create_web_app(devices, sim_state)
    runner = web.AppRunner(web_app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", 3333)
    await site.start()
    logger.info("Simulator Web Dashboard running at http://0.0.0.0:3333")

    # 2. Start MQTT publishing tasks
    client_kwargs: Dict[str, Any] = {
        "hostname": config.MQTT_BROKER_HOST,
        "port": config.MQTT_BROKER_PORT,
        "identifier": config.MQTT_CLIENT_ID,
    }
    if config.MQTT_USERNAME and config.MQTT_PASSWORD:
        client_kwargs["username"] = config.MQTT_USERNAME
        client_kwargs["password"] = config.MQTT_PASSWORD

    while True:
        try:
            logger.info(f"Connecting to MQTT Broker at {config.MQTT_BROKER_HOST}:{config.MQTT_BROKER_PORT}...")
            async with aiomqtt.Client(**client_kwargs) as client:
                logger.info(f"Connected to MQTT Broker. Spawning {len(devices)} concurrent streaming workers...")
                tasks = [run_device_loop(dev, client, sim_state) for dev in devices]
                await asyncio.gather(*tasks)

        except asyncio.CancelledError:
            logger.info("Simulator task cancelled. Shutting down gracefully...")
            await runner.cleanup()
            break
        except aiomqtt.MqttError as err:
            logger.warning(f"MQTT connection error: {err}. Reconnecting in 5 seconds...")
            await asyncio.sleep(5)
        except Exception as err:
            logger.error(f"Unexpected error in simulator runner: {err}. Retrying in 5 seconds...")
            await asyncio.sleep(5)


if __name__ == "__main__":
    asyncio.run(main())

