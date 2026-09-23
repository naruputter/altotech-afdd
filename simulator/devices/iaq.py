import random
from typing import List, Dict, Any, Optional
from devices.base import BaseDeviceSimulator


class IAQSimulator(BaseDeviceSimulator):
    """
    Indoor Air Quality (IAQ) Sensor Simulator.
    Simulates room temperature, relative humidity, CO2 ppm, PM2.5, and TVOC.
    Supports fault simulation (e.g. High CO2 / Poor Ventilation spike > 1200 ppm).
    """

    def __init__(
        self,
        device_id: str,
        site_id: str,
        device_code: Optional[str] = None,
        base_co2: float = 650.0,
        base_humidity: float = 55.0,
        base_temp: float = 23.5,
        interval: int = 60,
        simulate_fault: bool = False,
    ):
        super().__init__(
            device_id=device_id,
            site_id=site_id,
            device_type="IAQ_Sensor",
            device_code=device_code,
            interval=interval,
        )
        self.base_co2 = base_co2
        self.base_humidity = base_humidity
        self.base_temp = base_temp
        self.simulate_fault = simulate_fault

    async def generate_datapoints(self) -> List[Dict[str, Any]]:
        now = self.now_iso()

        if self.simulate_fault:
            # Fault: High CO2 spike (> 1250 ppm) due to poor ventilation / damper minimum limit
            co2 = 1280.0 + random.uniform(-20, 60)
            pm25 = max(5.0, 38.0 + random.uniform(-4, 8))
            tvoc = max(20.0, 320.0 + random.uniform(-20, 40))
        else:
            co2 = self.base_co2 + random.uniform(-25, 35)
            pm25 = max(2.0, 12.0 + random.uniform(-4, 6))
            tvoc = max(10.0, 85.0 + random.uniform(-15, 20))

        humidity = self.base_humidity + random.uniform(-2, 2)
        room_temp = self.base_temp + random.uniform(-0.3, 0.3)

        points = [
            {"timestamp": now, "entity_id": self.device_id, "metric_name": "co2_ppm", "val": round(co2, 1), "unit": "ppm", "site_id": self.site_id},
            {"timestamp": now, "entity_id": self.device_id, "metric_name": "temperature_c", "val": round(room_temp, 2), "unit": "degC", "site_id": self.site_id},
            {"timestamp": now, "entity_id": self.device_id, "metric_name": "relative_humidity_pct", "val": round(humidity, 1), "unit": "percent", "site_id": self.site_id},
            {"timestamp": now, "entity_id": self.device_id, "metric_name": "pm25_ug_m3", "val": round(pm25, 1), "unit": "ug/m3", "site_id": self.site_id},
            {"timestamp": now, "entity_id": self.device_id, "metric_name": "tvoc_ppb", "val": round(tvoc, 1), "unit": "ppb", "site_id": self.site_id},
        ]

        self.last_published_at = now
        self.last_values = {p["metric_name"]: p["val"] for p in points}
        self.total_messages_sent += 1
        return points
