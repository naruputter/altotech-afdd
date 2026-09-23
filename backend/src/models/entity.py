import uuid
from datetime import datetime, timezone
import enum
from typing import List, Optional
from sqlalchemy import String, DateTime, ForeignKey, Enum as SQLEnum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.db.base import Base


class EntityType(str, enum.Enum):
    BUILDING = "Building"
    FLOOR = "Floor"
    HVAC_ZONE = "HVAC_Zone"
    ROOM = "Room"
    AHU = "AHU"
    METER = "Meter"
    IAQ_SENSOR = "IAQ_Sensor"
    EQUIPMENT = "Equipment"


class RelationshipType(str, enum.Enum):
    FEEDS = "feeds"                  # e.g., AHU feeds HVAC_Zone
    HAS_PART = "hasPart"            # e.g., Building hasPart Floor
    IS_PART_OF = "isPartOf"          # e.g., Room isPartOf HVAC_Zone
    LOCATED_IN = "locatedIn"        # e.g., Meter locatedIn Room / Floor
    MEASURES = "measures"           # e.g., Meter measures AHU


class Entity(Base):
    __tablename__ = "entities"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True
    )
    code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)  # e.g. "building-a", "ahu-a-f01-east"
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    entity_type: Mapped[EntityType] = mapped_column(SQLEnum(EntityType), nullable=False, index=True)
    site_id: Mapped[str] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"), nullable=False, index=True)
    brick_class: Mapped[str] = mapped_column(String(128), nullable=False)  # e.g. "brick:Air_Handling_Unit"
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationship to Site
    site: Mapped["Site"] = relationship("Site", back_populates="entities")

    # Relationships outgoing & incoming
    outgoing_relationships: Mapped[List["EntityRelationship"]] = relationship(
        "EntityRelationship",
        foreign_keys="EntityRelationship.subject_id",
        back_populates="subject",
        cascade="all, delete-orphan",
    )
    incoming_relationships: Mapped[List["EntityRelationship"]] = relationship(
        "EntityRelationship",
        foreign_keys="EntityRelationship.object_id",
        back_populates="object",
        cascade="all, delete-orphan",
    )


class EntityRelationship(Base):
    __tablename__ = "entity_relationships"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True
    )
    subject_id: Mapped[str] = mapped_column(ForeignKey("entities.id", ondelete="CASCADE"), index=True)
    predicate: Mapped[RelationshipType] = mapped_column(SQLEnum(RelationshipType), nullable=False, index=True)
    object_id: Mapped[str] = mapped_column(ForeignKey("entities.id", ondelete="CASCADE"), index=True)
    properties: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    subject: Mapped["Entity"] = relationship("Entity", foreign_keys=[subject_id], back_populates="outgoing_relationships")
    object: Mapped["Entity"] = relationship("Entity", foreign_keys=[object_id], back_populates="incoming_relationships")
