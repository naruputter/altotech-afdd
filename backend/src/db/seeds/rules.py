import uuid
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.rule import Rule, RuleStatus, RuleSeverity

logger = logging.getLogger("seed.rules")

CORE_AFDD_RULES = [
    {
        "code": "RULE_AHU_SUPPLY_TEMP_DEV",
        "name": "AHU Supply Air Temperature Deviation Fault",
        "description": "Opens a Critical issue when AHU is ON and supply air temperature deviates from setpoint by > 3.0°C continuously for 15 minutes.",
        "target_scope": {
            "entity_type": "AHU",
            "site_id": "all",
            "property_types": ["Office"]
        },
        "fault_logic": {
            "condition_expr": "abs(supply_air_temperature_c - supply_air_temperature_setpoint_c) > 3.0",
            "duration_seconds": 900,
            "metrics": ["supply_air_temperature_c", "supply_air_temperature_setpoint_c", "run_status"],
            "parameters": {
                "tolerance": 3.0,
                "require_run_status_on": True
            }
        },
        "severity": RuleSeverity.CRITICAL,
        "is_active": True,
        "status": RuleStatus.APPROVED,
        "created_by": "system_engineer"
    },
    {
        "code": "RULE_IAQ_CO2_HIGH",
        "name": "High Indoor CO2 Alert",
        "description": "Triggers when occupied space CO2 exceeds 1000 ppm continuously for more than 10 minutes.",
        "target_scope": {
            "entity_type": "IAQ_Sensor",
            "site_id": "all"
        },
        "fault_logic": {
            "condition_expr": "co2_ppm > 1000",
            "duration_seconds": 600,
            "metrics": ["co2_ppm"],
            "parameters": {
                "co2_threshold": 1000.0
            }
        },
        "severity": RuleSeverity.MEDIUM,
        "is_active": True,
        "status": RuleStatus.APPROVED,
        "created_by": "system_engineer"
    },
    {
        "code": "RULE_METER_PEAK_DEMAND",
        "name": "Floor Electricity Peak Demand Warning",
        "description": "Alerts when active electrical demand exceeds 30 kW during operating hours.",
        "target_scope": {
            "entity_type": "Meter",
            "site_id": "all"
        },
        "fault_logic": {
            "condition_expr": "active_power_kw > 30.0",
            "duration_seconds": 900,
            "metrics": ["active_power_kw"],
            "parameters": {
                "max_power_threshold": 30.0
            }
        },
        "severity": RuleSeverity.HIGH,
        "is_active": True,
        "status": RuleStatus.APPROVED,
        "created_by": "system_engineer"
    },
    {
        "code": "RULE_SIMULTANEOUS_HEAT_COOL_DRAFT",
        "name": "Simultaneous Heating & Cooling (AI Draft)",
        "description": "AI agent detected inefficient valve modulation behavior on mixed air units.",
        "target_scope": {
            "entity_type": "AHU",
            "site_id": "all"
        },
        "fault_logic": {
            "condition_expr": "chw_valve > 50 AND reheat_valve > 30",
            "duration_seconds": 1200,
            "metrics": ["chw_valve", "reheat_valve"],
            "parameters": {}
        },
        "severity": RuleSeverity.CRITICAL,
        "is_active": False,
        "status": RuleStatus.DRAFT,
        "created_by": "ai_agent"
    }
]


async def seed_rules(db: AsyncSession) -> list[Rule]:
    """Seeds out-of-the-box core AFDD rules."""
    logger.info("--- 2. Seeding Core AFDD & Diagnostic Rules ---")
    created_rules = []

    for r_data in CORE_AFDD_RULES:
        rule = Rule(
            id=str(uuid.uuid4()),
            code=r_data["code"],
            name=r_data["name"],
            description=r_data["description"],
            target_scope=r_data["target_scope"],
            fault_logic=r_data["fault_logic"],
            severity=r_data["severity"],
            is_active=r_data["is_active"],
            status=r_data["status"],
            created_by=r_data["created_by"]
        )
        db.add(rule)
        created_rules.append(rule)

    await db.flush()
    logger.info(f"Loaded {len(created_rules)} AFDD diagnostic rules.")
    return created_rules
