import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any

import aiomqtt
from src.core.config import settings
from src.db.session import AsyncSessionLocal
from src.services.ingestion_service import ingestion_service
from src.services.afdd_evaluator import afdd_evaluator
from src.schemas.telemetry_schema import TelemetryPoint

logger = logging.getLogger("MQTT_Consumer")


def _parse_telemetry_payload(payload_data: Any, topic: str) -> List[TelemetryPoint]:
    """
    Parses various JSON payloads into a list of validated TelemetryPoint objects.
    Extracts site_id / entity_id from topic if not present in payload.
    Topic pattern: telemetry/{site_id}/{entity_id}
    """
    topic_parts = topic.strip("/").split("/")
    topic_site_id = topic_parts[1] if len(topic_parts) >= 2 else "default"
    topic_entity_id = topic_parts[2] if len(topic_parts) >= 3 else "unknown"

    raw_points = []
    if isinstance(payload_data, list):
        raw_points = payload_data
    elif isinstance(payload_data, dict):
        if "points" in payload_data and isinstance(payload_data["points"], list):
            raw_points = payload_data["points"]
        else:
            raw_points = [payload_data]

    points: List[TelemetryPoint] = []
    for item in raw_points:
        if not isinstance(item, dict):
            continue

        ts = item.get("timestamp")
        if not ts:
            ts = datetime.now(timezone.utc)

        point = TelemetryPoint(
            timestamp=ts,
            entity_id=item.get("entity_id") or topic_entity_id,
            metric_name=item.get("metric_name", "unknown"),
            val=float(item.get("val", 0.0)),
            unit=item.get("unit"),
            site_id=item.get("site_id") or topic_site_id,
        )
        points.append(point)

    return points


async def start_mqtt_consumer():
    """
    Background worker that connects to NanoMQ MQTT broker,
    subscribes to telemetry topics, ingests incoming data,
    and runs AFDD rule evaluation.
    """
    reconnect_interval = 3
    logger.info(
        f"Starting MQTT Consumer for broker {settings.MQTT_BROKER_HOST}:{settings.MQTT_BROKER_PORT} topic {settings.MQTT_TELEMETRY_TOPIC}"
    )

    while True:
        try:
            client_kwargs: Dict[str, Any] = {
                "hostname": settings.MQTT_BROKER_HOST,
                "port": settings.MQTT_BROKER_PORT,
                "identifier": settings.MQTT_CLIENT_ID,
            }
            if settings.MQTT_USERNAME and settings.MQTT_PASSWORD:
                client_kwargs["username"] = settings.MQTT_USERNAME
                client_kwargs["password"] = settings.MQTT_PASSWORD

            async with aiomqtt.Client(**client_kwargs) as client:
                logger.info(f"Connected to MQTT Broker at {settings.MQTT_BROKER_HOST}:{settings.MQTT_BROKER_PORT}")
                await client.subscribe(settings.MQTT_TELEMETRY_TOPIC)
                logger.info(f"Subscribed to topic: {settings.MQTT_TELEMETRY_TOPIC}")

                async for message in client.messages:
                    topic = str(message.topic)
                    try:
                        payload_str = message.payload.decode("utf-8")
                        payload_json = json.loads(payload_str)
                        points = _parse_telemetry_payload(payload_json, topic)

                        if points:
                            async with AsyncSessionLocal() as session:
                                res = await ingestion_service.process_batch(session, points)
                                logger.debug(
                                    f"[MQTT Ingest] Topic: {topic} | Points: {len(points)} | Result: {res.message}"
                                )
                                # Trigger AFDD evaluation for newly ingested readings
                                try:
                                    detected = await afdd_evaluator.evaluate_all_active_rules(session)
                                    if detected:
                                        logger.info(f"[AFDD Engine] Issues updated/detected: {detected}")
                                except Exception as eval_err:
                                    logger.error(f"[AFDD Engine] Error during rule evaluation: {eval_err}")

                    except json.JSONDecodeError:
                        logger.warning(f"Received invalid JSON on topic {topic}: {message.payload[:100]}")
                    except Exception as msg_err:
                        logger.error(f"Error processing MQTT message on topic {topic}: {msg_err}")

        except asyncio.CancelledError:
            logger.info("MQTT Consumer task cancelled. Shutting down cleanly...")
            break
        except aiomqtt.MqttError as mqtt_err:
            logger.warning(f"MQTT connection lost or failed ({mqtt_err}). Reconnecting in {reconnect_interval}s...")
            await asyncio.sleep(reconnect_interval)
        except Exception as e:
            logger.error(f"Unexpected MQTT consumer error: {e}. Retrying in {reconnect_interval}s...")
            await asyncio.sleep(reconnect_interval)
