import json
import uuid
import logging
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from src.crud.crud_rule import crud_rule
from src.schemas.rule_schema import RuleCreate, TargetScopeSchema, FaultLogicSchema
from src.models.rule import RuleStatus, RuleSeverity
from src.core.config import settings

logger = logging.getLogger(__name__)


class LLMOrchestrator:
    """
    AI Agent Harness for AFDD rule drafting.
    Safety constraint:
    - Bounded tools
    - Prompts generate DRAFT rules only (is_active=False, status=DRAFT).
    - AI is strictly prohibited from activating rules without human review.
    """

    async def draft_rule_from_prompt(
        self,
        db: AsyncSession,
        prompt: str,
        site_id: Optional[str] = None,
        equipment_type: Optional[str] = "AHU",
    ) -> Dict[str, Any]:
        rule_id = f"rule-draft-{uuid.uuid4().hex[:8]}"

        # Parse prompt heuristics or call external LLM API if key is set
        draft_name = f"Drafted Rule: {prompt[:40]}"
        
        # Determine rule logic structure
        if "supply" in prompt.lower() and "temp" in prompt.lower():
            target_scope = TargetScopeSchema(
                entity_type=equipment_type or "AHU",
                site_id=site_id,
            )
            fault_logic = FaultLogicSchema(
                condition_expr="supply_air_temp > temp_setpoint + 2.0",
                duration_seconds=900,  # 15 minutes continuous
                metrics=["supply_air_temp", "temp_setpoint"],
                parameters={"tolerance": 2.0},
            )
            severity = RuleSeverity.HIGH
        elif "co2" in prompt.lower() or "iaq" in prompt.lower():
            target_scope = TargetScopeSchema(
                entity_type="IAQ_Sensor",
                site_id=site_id,
            )
            fault_logic = FaultLogicSchema(
                condition_expr="co2_ppm > 1000",
                duration_seconds=900,
                metrics=["co2_ppm"],
                parameters={"co2_threshold": 1000.0},
            )
            severity = RuleSeverity.MEDIUM
        elif "power" in prompt.lower() or "energy" in prompt.lower():
            target_scope = TargetScopeSchema(
                entity_type="Meter",
                site_id=site_id,
            )
            fault_logic = FaultLogicSchema(
                condition_expr="power_kw > 150.0",
                duration_seconds=900,
                metrics=["power_kw"],
                parameters={"max_power_threshold": 150.0},
            )
            severity = RuleSeverity.HIGH
        else:
            target_scope = TargetScopeSchema(
                entity_type=equipment_type or "AHU",
                site_id=site_id,
            )
            fault_logic = FaultLogicSchema(
                condition_expr="val > threshold",
                duration_seconds=900,
                metrics=["supply_air_temp"],
                parameters={"tolerance": 3.0},
            )
            severity = RuleSeverity.MEDIUM

        rule_create = RuleCreate(
            id=rule_id,
            name=draft_name,
            description=f"AI Generated draft rule from prompt: '{prompt}'. Requires human approval before activation.",
            target_scope=target_scope,
            fault_logic=fault_logic,
            severity=severity,
        )

        # Save to database strictly in DRAFT status with is_active=False
        saved_rule = await crud_rule.create_rule(
            db, obj_in=rule_create, created_by="ai_agent", status=RuleStatus.DRAFT
        )

        return {
            "status": "DRAFT_CREATED",
            "message": "Rule draft generated successfully. A human engineer must review and approve it before activation.",
            "rule": {
                "id": saved_rule.id,
                "name": saved_rule.name,
                "description": saved_rule.description,
                "target_scope": saved_rule.target_scope,
                "fault_logic": saved_rule.fault_logic,
                "severity": saved_rule.severity.value,
                "is_active": saved_rule.is_active,
                "status": saved_rule.status.value,
                "created_by": saved_rule.created_by,
            },
        }


llm_orchestrator = LLMOrchestrator()
