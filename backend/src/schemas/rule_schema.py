from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field
from src.models.rule import RuleStatus, RuleSeverity


class TargetScopeSchema(BaseModel):
    entity_type: Optional[str] = Field(None, description="e.g. AHU, Meter, IAQ_Sensor")
    site_id: Optional[str] = Field(None, description="e.g. Site UUID or all")
    entity_ids: Optional[List[str]] = Field(None, description="Specific target entity IDs")
    tags: Optional[Dict[str, Any]] = None


class FaultLogicSchema(BaseModel):
    condition_expr: str = Field(..., description="Condition expression e.g. 'abs(supply_air_temp - temp_setpoint) > 3.0'")
    duration_seconds: int = Field(900, description="Fault duration threshold in seconds (default 15 mins = 900s)")
    metrics: List[str] = Field(..., description="List of required metric names")
    parameters: Optional[Dict[str, Any]] = Field(default_factory=dict, description="e.g. {'tolerance': 3.0}")


class RuleBase(BaseModel):
    code: str = Field(..., description="Unique business rule identifier (e.g. 'RULE_AHU_SUPPLY_TEMP_DEV')")
    name: str
    description: Optional[str] = None
    target_scope: TargetScopeSchema
    fault_logic: FaultLogicSchema
    severity: RuleSeverity = RuleSeverity.MEDIUM


class RuleCreate(RuleBase):
    pass


class RuleUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    target_scope: Optional[TargetScopeSchema] = None
    fault_logic: Optional[FaultLogicSchema] = None
    severity: Optional[RuleSeverity] = None
    is_active: Optional[bool] = None
    status: Optional[RuleStatus] = None


class RuleResponse(RuleBase):
    id: str
    is_active: bool
    status: RuleStatus
    created_by: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AIDraftRuleRequest(BaseModel):
    prompt: str = Field(..., description="Natural language prompt describing fault rule")
    target_site_id: Optional[str] = None
    target_equipment_type: Optional[str] = "AHU"
