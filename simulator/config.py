import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class SimulatorSettings(BaseSettings):
    API_BASE_URL: str = "http://localhost:8000/api/v1"
    MQTT_BROKER_HOST: str = "localhost"
    MQTT_BROKER_PORT: int = 1883
    MQTT_CLIENT_ID: str = "afdd-simulator-service"
    MQTT_USERNAME: Optional[str] = None
    MQTT_PASSWORD: Optional[str] = None

    SIMULATION_INTERVAL_AHU: int = 15
    SIMULATION_INTERVAL_IAQ: int = 60
    SIMULATION_INTERVAL_METERS: int = 60
    ACCELERATION_FACTOR: float = 1.0

    FIXTURES_PATH: str = os.path.join(os.path.dirname(__file__), "fixtures", "buildings.json")

    model_config = SettingsConfigDict(env_file=".env", extra="allow")


config = SimulatorSettings()
