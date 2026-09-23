import random
from typing import List, Dict, Any, Optional
from devices.base import BaseDeviceSimulator


class MeterSimulator(BaseDeviceSimulator):
    """
    Electricity Meter Simulator.
    Simulates instantaneous power (kW) and cumulative energy consumption (kWh).
    Supports fault simulation (e.g. Peak Demand Surge / Abnormal Power Spike).
    """

    def __init__(
        self,
        device_id: str,
        site_id: str,
        device_code: Optional[str] = None,
        base_kw: float = 25.0,
        initial_kwh: float = 10000.0,
        interval: int = 60,
        simulate_fault: bool = False,
    ):
        super().__init__(
            device_id=device_id,
            site_id=site_id,
            device_type="Meter",
            device_code=device_code,
            interval=interval,
        )
        self.base_kw = base_kw
        self.cumulative_kwh = initial_kwh
        self.simulate_fault = simulate_fault

    async def generate_datapoints(self) -> List[Dict[str, Any]]:
        now = self.now_iso()

        if self.simulate_fault:
            # Fault: Power surge / Peak demand spike (e.g. 2.5x normal base_kw)
            kw = max(0.0, (self.base_kw * 2.8) + random.uniform(-4.0, 8.0))
        else:
            kw = max(0.0, self.base_kw + random.uniform(-3.0, 5.0))

        # Energy increment in kWh = Power (kW) * (interval_seconds / 3600)
        energy_inc = kw * (self.interval / 3600.0)
        self.cumulative_kwh += energy_inc

        points = [
            {"timestamp": now, "entity_id": self.device_id, "metric_name": "active_power_kw", "val": round(kw, 2), "unit": "kW", "site_id": self.site_id},
            {"timestamp": now, "entity_id": self.device_id, "metric_name": "total_energy_kwh", "val": round(self.cumulative_kwh, 2), "unit": "kWh", "site_id": self.site_id},
        ]

        self.last_published_at = now
        self.last_values = {p["metric_name"]: p["val"] for p in points}
        self.total_messages_sent += 1
        return points
