from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class SiteBase(BaseModel):
    code: str = Field(..., description="Unique human-readable identifier (e.g. 'SITE_CAMPUS_A')")
    name: str = Field(..., description="Display name of the site or campus")
    description: Optional[str] = None


class SiteCreate(SiteBase):
    pass


class SiteUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None


class SiteResponse(SiteBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
