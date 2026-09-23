import uuid
from datetime import datetime, timezone
import enum
from typing import Optional, List
from sqlalchemy import String, DateTime, ForeignKey, JSON, Text, Enum as SQLEnum, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.db.base import Base


class IssueStatus(str, enum.Enum):
    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"
    MUTED = "MUTED"


class Issue(Base):
    __tablename__ = "issues"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True
    )
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)  # e.g. "ISS-2026-0001"
    rule_id: Mapped[Optional[str]] = mapped_column(ForeignKey("rules.id", ondelete="SET NULL"), nullable=True, index=True)
    entity_id: Mapped[str] = mapped_column(ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    site_id: Mapped[str] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"), nullable=False, index=True)
    
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[IssueStatus] = mapped_column(SQLEnum(IssueStatus), default=IssueStatus.OPEN, index=True)
    severity: Mapped[str] = mapped_column(String(32), default="MEDIUM")

    # Time tracking (Continuous fault window)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    last_detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Evidence and Impact
    evidence: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    affected_rooms: Mapped[List[str]] = mapped_column(JSON, nullable=False, default=list)

    estimated_energy_waste_kwh: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    entity: Mapped["Entity"] = relationship("Entity", foreign_keys=[entity_id])
    rule: Mapped[Optional["Rule"]] = relationship("Rule", foreign_keys=[rule_id])
    site: Mapped["Site"] = relationship("Site", foreign_keys=[site_id])
