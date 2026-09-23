from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone


class BaseDeviceSimulator(ABC):
    """
    Abstract base class for all building device simulators.
    """

    def __init__(
        self,
        device_id: str,
        site_id: str,
        device_type: str,
        device_code: Optional[str] = None,
        interval: int = 15,
    ):
        self.device_id = device_id
        self.device_code = device_code or device_id
        self.site_id = site_id
        self.device_type = device_type
        self.interval = interval
        self.last_published_at: Optional[str] = None
        self.last_values: Dict[str, Any] = {}
        self.total_messages_sent: int = 0
        self.is_active: bool = True

    def get_topic(self) -> str:
        """Returns standard MQTT topic for this device"""
        return f"telemetry/{self.site_id}/{self.device_id}"

    @abstractmethod
    async def generate_datapoints(self) -> List[Dict[str, Any]]:
        """
        Generates telemetry points for this device at current timestamp.
        """
        pass

    def now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()

