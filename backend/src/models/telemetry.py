from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, DateTime, Float, JSON, Index, PrimaryKeyConstraint, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.db.base import Base


class Telemetry(Base):
    """
    Time-series Telemetry table.
    Designed for TimescaleDB hypertable conversion on `timestamp`.
    Composite PK: (timestamp, entity_id, metric_name) ensures uniqueness and hypertable compatibility.
    """
    __tablename__ = "telemetries"

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    entity_id: Mapped[str] = mapped_column(ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    metric_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    val: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    site_id: Mapped[str] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"), nullable=False, index=True)
    tags: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    entity: Mapped["Entity"] = relationship("Entity", foreign_keys=[entity_id])
    site: Mapped["Site"] = relationship("Site", foreign_keys=[site_id])

    __table_args__ = (
        PrimaryKeyConstraint("timestamp", "entity_id", "metric_name", name="pk_telemetry"),
        Index("idx_telemetry_entity_metric_time", "entity_id", "metric_name", "timestamp"),
        Index("idx_telemetry_site_time", "site_id", "timestamp"),
    )
