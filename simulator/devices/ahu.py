import random
from typing import List, Dict, Any, Optional
from devices.base import BaseDeviceSimulator


class AHUSimulator(BaseDeviceSimulator):
    """
    Air Handling Unit (AHU) Simulator.
    Simulates supply/return air temperatures, setpoint, valve position, and running status.
    """

    def __init__(
        self,
        device_id: str,
        site_id: str,
        device_code: Optional[str] = None,
        setpoint: float = 22.0,
        interval: int = 15,
        simulate_fault: bool = False,
        is_on: bool = True,
    ):
        super().__init__(
            device_id=device_id,
            site_id=site_id,
            device_type="AHU",
            device_code=device_code,
            interval=interval,
        )
        self.setpoint = setpoint
        self.simulate_fault = simulate_fault
        self.is_on = is_on

    async def generate_datapoints(self) -> List[Dict[str, Any]]:
        now = self.now_iso()

        if not self.is_on:
            points = [
                {"timestamp": now, "entity_id": self.device_id, "metric_name": "run_status", "val": 0.0, "unit": "binary", "site_id": self.site_id},
                {"timestamp": now, "entity_id": self.device_id, "metric_name": "supply_air_temperature_setpoint_c", "val": self.setpoint, "unit": "degC", "site_id": self.site_id},
                {"timestamp": now, "entity_id": self.device_id, "metric_name": "supply_air_temperature_c", "val": round(28.0 + random.uniform(-0.5, 0.5), 2), "unit": "degC", "site_id": self.site_id},
                {"timestamp": now, "entity_id": self.device_id, "metric_name": "chw_valve_command_pct", "val": 0.0, "unit": "percent", "site_id": self.site_id},
            ]
        else:
            if self.simulate_fault:
                # Continuous Supply Temp Deviation (> 3.0 degC above setpoint)
                supply_temp = self.setpoint + 3.8 + random.uniform(-0.2, 0.4)
                valve_pos = 100.0
            else:
                supply_temp = self.setpoint + random.uniform(-0.4, 0.4)
                valve_pos = 55.0 + random.uniform(-5, 5)

            return_temp = supply_temp + 4.2 + random.uniform(-0.3, 0.3)
            fan_speed = 80.0 + random.uniform(-2, 2)

            points = [
                {"timestamp": now, "entity_id": self.device_id, "metric_name": "run_status", "val": 1.0, "unit": "binary", "site_id": self.site_id},
                {"timestamp": now, "entity_id": self.device_id, "metric_name": "supply_air_temperature_setpoint_c", "val": round(self.setpoint, 1), "unit": "degC", "site_id": self.site_id},
                {"timestamp": now, "entity_id": self.device_id, "metric_name": "supply_air_temperature_c", "val": round(supply_temp, 2), "unit": "degC", "site_id": self.site_id},
                {"timestamp": now, "entity_id": self.device_id, "metric_name": "return_air_temperature_c", "val": round(return_temp, 2), "unit": "degC", "site_id": self.site_id},
                {"timestamp": now, "entity_id": self.device_id, "metric_name": "chw_valve_command_pct", "val": round(valve_pos, 1), "unit": "percent", "site_id": self.site_id},
                {"timestamp": now, "entity_id": self.device_id, "metric_name": "supply_fan_speed_pct", "val": round(fan_speed, 1), "unit": "percent", "site_id": self.site_id},
            ]

        self.last_published_at = now
        self.last_values = {p["metric_name"]: p["val"] for p in points}
        self.total_messages_sent += 1
        return points

