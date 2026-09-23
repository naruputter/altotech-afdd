import os
import csv
import uuid
import logging
from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.site import Site
from src.models.entity import Entity
from src.models.telemetry import Telemetry

logger = logging.getLogger("seed.telemetry")

# Check if running in Docker container (/quiz mounted) or local workspace
CONTAINER_QUIZ = Path("/quiz")
LOCAL_QUIZ = Path(__file__).resolve().parent.parent.parent.parent.parent / "quiz"
QUIZ_DIR = CONTAINER_QUIZ if CONTAINER_QUIZ.exists() else LOCAL_QUIZ
TELEMETRY_DIR = QUIZ_DIR / "sample-telemetry"



def parse_iso_or_standard_datetime(dt_str: str) -> datetime:
    try:
        if dt_str.endswith("Z"):
            dt_str = dt_str[:-1] + "+00:00"
        return datetime.fromisoformat(dt_str)
    except Exception:
        return datetime.now(timezone.utc)


async def seed_sample_telemetry(
    db: AsyncSession,
    site_map: dict[str, Site],
    entity_code_map: dict[str, Entity],
    limit_per_file: int = 500,
    telemetry_dir: Path | None = None
):
    """Seeds sample time-series telemetry data."""
    data_dir = telemetry_dir or TELEMETRY_DIR
    logger.info(f"--- 5. Seeding Sample Telemetry Snapshots (First {limit_per_file} rows/file) ---")
    if not data_dir.exists():
        logger.warning(f"Telemetry folder not found: {data_dir}")
        return

    # 1. AHU Telemetry
    ahu_file = data_dir / "ahu_telemetry.csv"
    if ahu_file.exists():
        count = 0
        with open(ahu_file, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if count >= limit_per_file:
                    break
                eq_code = row.get("equipment_id", "").strip()
                entity = entity_code_map.get(eq_code)
                if not entity:
                    continue

                ts = parse_iso_or_standard_datetime(row.get("timestamp", ""))
                metric_mappings = [
                    ("supply_air_temperature_c", "degC"),
                    ("supply_air_temperature_setpoint_c", "degC"),
                    ("return_air_temperature_c", "degC"),
                    ("outdoor_air_temperature_c", "degC"),
                    ("chw_valve_command_pct", "percent"),
                    ("heating_valve_command_pct", "percent"),
                    ("supply_fan_speed_pct", "percent"),
                    ("run_status", "binary"),
                    ("static_pressure_pa", "Pa"),
                    ("static_pressure_setpoint_pa", "Pa"),
                ]

                for metric_name, unit in metric_mappings:
                    val_str = row.get(metric_name)
                    if val_str is not None and val_str != "":
                        try:
                            val = float(val_str)
                        except ValueError:
                            continue

                        db.add(Telemetry(
                            id=str(uuid.uuid4()),
                            entity_id=entity.id,
                            metric_name=metric_name,
                            timestamp=ts,
                            value_numeric=val,
                            unit=unit,
                            site_id=entity.site_id
                        ))
                count += 1
        logger.info(f"Ingested {count} AHU telemetry snapshots")

    # 2. IAQ Telemetry
    iaq_file = data_dir / "iaq_telemetry.csv"
    if iaq_file.exists():
        count = 0
        with open(iaq_file, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if count >= limit_per_file:
                    break
                sensor_code = row.get("sensor_id", "").strip()
                entity = entity_code_map.get(sensor_code)
                if not entity:
                    continue

                ts = parse_iso_or_standard_datetime(row.get("timestamp", ""))
                metrics = [
                    ("co2_ppm", "ppm"),
                    ("temperature_c", "degC"),
                    ("relative_humidity_pct", "percent"),
                    ("pm25_ug_m3", "ug/m3"),
                    ("tvoc_ppb", "ppb")
                ]
                for metric_name, unit in metrics:
                    val_str = row.get(metric_name)
                    if val_str is not None and val_str != "":
                        try:
                            val = float(val_str)
                        except ValueError:
                            continue

                        db.add(Telemetry(
                            id=str(uuid.uuid4()),
                            entity_id=entity.id,
                            metric_name=metric_name,
                            timestamp=ts,
                            value_numeric=val,
                            unit=unit,
                            site_id=entity.site_id
                        ))
                count += 1
        logger.info(f"Ingested {count} IAQ Sensor snapshots")

    # 3. Meter Telemetry
    meter_file = data_dir / "meter_telemetry.csv"
    if meter_file.exists():
        count = 0
        with open(meter_file, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if count >= limit_per_file:
                    break
                meter_code = row.get("meter_id", "").strip()
                entity = entity_code_map.get(meter_code)
                if not entity:
                    continue

                ts = parse_iso_or_standard_datetime(row.get("timestamp", ""))
                power_kw_str = row.get("active_power_kw")
                energy_kwh_str = row.get("total_energy_kwh")

                if power_kw_str:
                    db.add(Telemetry(
                        id=str(uuid.uuid4()),
                        entity_id=entity.id,
                        metric_name="active_power_kw",
                        timestamp=ts,
                        value_numeric=float(power_kw_str),
                        unit="kW",
                        site_id=entity.site_id
                    ))
                if energy_kwh_str:
                    db.add(Telemetry(
                        id=str(uuid.uuid4()),
                        entity_id=entity.id,
                        metric_name="total_energy_kwh",
                        timestamp=ts,
                        value_numeric=float(energy_kwh_str),
                        unit="kWh",
                        site_id=entity.site_id
                    ))
                count += 1
        logger.info(f"Ingested {count} Power Meter snapshots")

    await db.flush()
