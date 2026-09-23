from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field
from src.models.entity import EntityType, RelationshipType


class EntityBase(BaseModel):
    code: str = Field(..., description="Business identifier (e.g. 'building-a-f01', 'ahu-a-f01-east')")
    name: str
    entity_type: EntityType
    site_id: str = Field(..., description="Site UUID")
    brick_class: str
    metadata_json: Optional[Dict[str, Any]] = None


class EntityCreate(EntityBase):
    pass


class EntityUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    site_id: Optional[str] = None
    brick_class: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None


class EntityResponse(EntityBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EntityRelationshipCreate(BaseModel):
    subject_id: str
    predicate: RelationshipType
    object_id: str
    properties: Optional[Dict[str, Any]] = None


class EntityRelationshipResponse(BaseModel):
    id: str
    subject_id: str
    predicate: RelationshipType
    object_id: str
    properties: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DownstreamImpactResponse(BaseModel):
    source_entity_id: str
    source_entity_code: Optional[str] = None
    source_entity_type: EntityType
    site_id: str
    affected_zones: List[str]
    affected_rooms: List[str]
