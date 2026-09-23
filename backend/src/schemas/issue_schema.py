from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field
from src.models.issue import IssueStatus


class IssueBase(BaseModel):
    code: str = Field(..., description="Business reference code (e.g. 'ISS-2026-0001')")
    rule_id: Optional[str] = None
    entity_id: str
    site_id: str
    title: str
    description: Optional[str] = None
    severity: str = "MEDIUM"
    status: IssueStatus = IssueStatus.OPEN
    started_at: datetime
    last_detected_at: datetime
    resolved_at: Optional[datetime] = None
    evidence: Dict[str, Any] = Field(default_factory=dict)
    affected_rooms: List[str] = Field(default_factory=list)
    estimated_energy_waste_kwh: Optional[float] = None


class IssueCreate(IssueBase):
    pass


class IssueUpdate(BaseModel):
    status: Optional[IssueStatus] = None
    description: Optional[str] = None
    resolved_at: Optional[datetime] = None


class IssueResponse(IssueBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
