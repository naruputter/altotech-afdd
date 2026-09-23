import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from src.services.afdd_evaluator import (
    evaluate_dynamic_condition,
    AFDDEvaluator,
)
from src.models.rule import Rule, RuleStatus, RuleSeverity
from src.models.issue import Issue, IssueStatus


class MockRecord:
    def __init__(self, val, timestamp):
        self.val = val
        self.timestamp = timestamp


# =========================================================================
# 1. Dynamic Safe Expression Evaluation Tests
# =========================================================================

def test_dynamic_evaluator_sat_deviation():
    """Test standard AHU Supply Air Temp vs Setpoint deviation condition."""
    expr = "abs(supply_air_temp - supply_air_temp_setpoint) > tolerance"
    
    # Within tolerance (21.5 - 20.0 = 1.5 <= 3.0) -> False
    ctx_normal = {"supply_air_temp": 21.5, "supply_air_temp_setpoint": 20.0, "tolerance": 3.0}
    assert evaluate_dynamic_condition(expr, ctx_normal) is False

    # Exceeds tolerance (24.0 - 20.0 = 4.0 > 3.0) -> True
    ctx_fault = {"supply_air_temp": 24.0, "supply_air_temp_setpoint": 20.0, "tolerance": 3.0}
    assert evaluate_dynamic_condition(expr, ctx_fault) is True


def test_dynamic_evaluator_meter_and_iaq():
    """Test Meter active power and IAQ CO2 expressions."""
    # Meter active power threshold
    expr_meter = "active_power_kw > max_power_kw"
    assert evaluate_dynamic_condition(expr_meter, {"active_power_kw": 25.0, "max_power_kw": 30.0}) is False
    assert evaluate_dynamic_condition(expr_meter, {"active_power_kw": 34.2, "max_power_kw": 30.0}) is True

    # IAQ CO2 threshold
    expr_iaq = "co2_ppm > max_co2"
    assert evaluate_dynamic_condition(expr_iaq, {"co2_ppm": 850, "max_co2": 1000}) is False
    assert evaluate_dynamic_condition(expr_iaq, {"co2_ppm": 1200, "max_co2": 1000}) is True


# =========================================================================
# 2. AFDD Timing Window, State & Exclusion Tests
# =========================================================================

@pytest.mark.asyncio
async def test_normal_data_creates_no_issue():
    """Scenario 1: Normal continuous data within tolerance produces no issue."""
    evaluator = AFDDEvaluator()
    now = datetime.now(timezone.utc)
    fault_logic = {
        "metrics": ["supply_air_temp", "supply_air_temp_setpoint", "run_status"],
        "condition_expr": "abs(supply_air_temp - supply_air_temp_setpoint) > tolerance",
        "parameters": {"tolerance": 3.0, "require_run_status_on": True},
        "duration_seconds": 900
    }

    # 15 samples (15 mins), normal deviation (1.0 deg C)
    normal_history = [MockRecord(21.0, now - timedelta(minutes=i)) for i in range(15)]
    setpoint_history = [MockRecord(20.0, now - timedelta(minutes=i)) for i in range(15)]
    run_history = [MockRecord(1.0, now - timedelta(minutes=i)) for i in range(15)]

    mock_db = AsyncMock()
    with patch("src.services.afdd_evaluator.crud_telemetry.get_history") as mock_hist:
        def get_hist_side_effect(db, entity_id, metric_name, **kwargs):
            if metric_name == "supply_air_temp": return normal_history
            if metric_name == "supply_air_temp_setpoint": return setpoint_history
            if metric_name == "run_status": return run_history
            return []
        mock_hist.side_effect = get_hist_side_effect

        fault_active, evidence = await evaluator._check_fault_condition(
            mock_db, "ahu-01", fault_logic, now - timedelta(minutes=15), now
        )

        assert fault_active is False
        assert evidence.get("is_normal") is True


@pytest.mark.asyncio
async def test_sustained_deviation_triggers_fault():
    """Scenario 2: Sustained deviation >= 15 minutes continuously while ON triggers fault."""
    evaluator = AFDDEvaluator()
    now = datetime.now(timezone.utc)
    fault_logic = {
        "metrics": ["supply_air_temp", "supply_air_temp_setpoint", "run_status"],
        "condition_expr": "abs(supply_air_temp - supply_air_temp_setpoint) > tolerance",
        "parameters": {"tolerance": 3.0, "require_run_status_on": True},
        "duration_seconds": 900
    }

    # 15 samples (15 mins), sustained deviation (25.0 - 20.0 = 5.0 > 3.0 deg C)
    fault_history = [MockRecord(25.0, now - timedelta(minutes=i)) for i in range(15)]
    setpoint_history = [MockRecord(20.0, now - timedelta(minutes=i)) for i in range(15)]
    run_history = [MockRecord(1.0, now - timedelta(minutes=i)) for i in range(15)]

    mock_db = AsyncMock()
    with patch("src.services.afdd_evaluator.crud_telemetry.get_history") as mock_hist:
        def get_hist_side_effect(db, entity_id, metric_name, **kwargs):
            if metric_name == "supply_air_temp": return fault_history
            if metric_name == "supply_air_temp_setpoint": return setpoint_history
            if metric_name == "run_status": return run_history
            return []
        mock_hist.side_effect = get_hist_side_effect

        fault_active, evidence = await evaluator._check_fault_condition(
            mock_db, "ahu-01", fault_logic, now - timedelta(minutes=15), now
        )

        assert fault_active is True
        assert evidence["condition_expr"] == fault_logic["condition_expr"]
        assert evidence["sample_count"] == 15


@pytest.mark.asyncio
async def test_short_deviation_creates_no_issue():
    """Scenario 3: Short deviation (e.g. only 5 of 15 samples deviated) does not trigger fault."""
    evaluator = AFDDEvaluator()
    now = datetime.now(timezone.utc)
    fault_logic = {
        "metrics": ["supply_air_temp", "supply_air_temp_setpoint", "run_status"],
        "condition_expr": "abs(supply_air_temp - supply_air_temp_setpoint) > tolerance",
        "parameters": {"tolerance": 3.0, "require_run_status_on": True},
        "duration_seconds": 900
    }

    # Recent 5 samples deviated, earlier 10 samples normal
    sat_values = [25.0]*5 + [21.0]*10
    sat_history = [MockRecord(val, now - timedelta(minutes=i)) for i, val in enumerate(sat_values)]
    setpoint_history = [MockRecord(20.0, now - timedelta(minutes=i)) for i in range(15)]
    run_history = [MockRecord(1.0, now - timedelta(minutes=i)) for i in range(15)]

    mock_db = AsyncMock()
    with patch("src.services.afdd_evaluator.crud_telemetry.get_history") as mock_hist:
        def get_hist_side_effect(db, entity_id, metric_name, **kwargs):
            if metric_name == "supply_air_temp": return sat_history
            if metric_name == "supply_air_temp_setpoint": return setpoint_history
            if metric_name == "run_status": return run_history
            return []
        mock_hist.side_effect = get_hist_side_effect

        fault_active, evidence = await evaluator._check_fault_condition(
            mock_db, "ahu-01", fault_logic, now - timedelta(minutes=15), now
        )

        assert fault_active is False


@pytest.mark.asyncio
async def test_equipment_off_or_turned_off_resets_evaluation():
    """Scenario 4: When equipment is OFF or turned OFF during the window, fault is suppressed."""
    evaluator = AFDDEvaluator()
    now = datetime.now(timezone.utc)
    fault_logic = {
        "metrics": ["supply_air_temp", "supply_air_temp_setpoint", "run_status"],
        "condition_expr": "abs(supply_air_temp - supply_air_temp_setpoint) > tolerance",
        "parameters": {"tolerance": 3.0, "require_run_status_on": True},
        "duration_seconds": 900
    }

    sat_history = [MockRecord(25.0, now - timedelta(minutes=i)) for i in range(15)]
    setpoint_history = [MockRecord(20.0, now - timedelta(minutes=i)) for i in range(15)]
    # Turned off halfway
    run_values = [1.0]*10 + [0.0]*5
    run_history = [MockRecord(val, now - timedelta(minutes=i)) for i, val in enumerate(run_values)]

    mock_db = AsyncMock()
    with patch("src.services.afdd_evaluator.crud_telemetry.get_history") as mock_hist:
        def get_hist_side_effect(db, entity_id, metric_name, **kwargs):
            if metric_name == "supply_air_temp": return sat_history
            if metric_name == "supply_air_temp_setpoint": return setpoint_history
            if metric_name == "run_status": return run_history
            return []
        mock_hist.side_effect = get_hist_side_effect

        fault_active, evidence = await evaluator._check_fault_condition(
            mock_db, "ahu-01", fault_logic, now - timedelta(minutes=15), now
        )

        assert fault_active is False
        assert evidence.get("timing_reset_due_to_off") is True or evidence.get("equipment_off") is True


@pytest.mark.asyncio
async def test_missing_required_points_excluded():
    """Scenario 5: Equipment missing a required telemetry point is excluded from evaluation."""
    evaluator = AFDDEvaluator()
    now = datetime.now(timezone.utc)
    fault_logic = {
        "metrics": ["supply_air_temp", "supply_air_temp_setpoint"],
        "condition_expr": "abs(supply_air_temp - supply_air_temp_setpoint) > tolerance",
        "parameters": {"tolerance": 3.0},
        "duration_seconds": 900
    }

    mock_db = AsyncMock()
    with patch("src.services.afdd_evaluator.crud_telemetry.get_history") as mock_hist:
        # Returns telemetry for SAT, but empty for setpoint
        def get_hist_side_effect(db, entity_id, metric_name, **kwargs):
            if metric_name == "supply_air_temp":
                return [MockRecord(25.0, now - timedelta(minutes=i)) for i in range(15)]
            return []
        mock_hist.side_effect = get_hist_side_effect

        fault_active, evidence = await evaluator._check_fault_condition(
            mock_db, "ahu-01", fault_logic, now - timedelta(minutes=15), now
        )

        assert fault_active is False
        assert evidence.get("missing_required_points") is True


@pytest.mark.asyncio
async def test_outdated_data_excluded():
    """Scenario 6: Data older than freshness threshold (180s) is excluded."""
    evaluator = AFDDEvaluator()
    now = datetime.now(timezone.utc)
    fault_logic = {
        "metrics": ["supply_air_temp", "supply_air_temp_setpoint"],
        "condition_expr": "abs(supply_air_temp - supply_air_temp_setpoint) > tolerance",
        "parameters": {"tolerance": 3.0},
        "duration_seconds": 900
    }

    # Data is 10 minutes old
    old_time = now - timedelta(minutes=10)
    sat_history = [MockRecord(25.0, old_time - timedelta(minutes=i)) for i in range(15)]
    setpoint_history = [MockRecord(20.0, old_time - timedelta(minutes=i)) for i in range(15)]

    mock_db = AsyncMock()
    with patch("src.services.afdd_evaluator.crud_telemetry.get_history") as mock_hist:
        def get_hist_side_effect(db, entity_id, metric_name, **kwargs):
            if metric_name == "supply_air_temp": return sat_history
            if metric_name == "supply_air_temp_setpoint": return setpoint_history
            return []
        mock_hist.side_effect = get_hist_side_effect

        fault_active, evidence = await evaluator._check_fault_condition(
            mock_db, "ahu-01", fault_logic, now - timedelta(minutes=15), now
        )

        assert fault_active is False
        assert evidence.get("outdated_data") is True


@pytest.mark.asyncio
async def test_auto_resolution_when_normal():
    """Scenario 7: When telemetry returns to normal, active issue is marked as RESOLVED."""
    evaluator = AFDDEvaluator()
    now = datetime.now(timezone.utc)

    rule = Rule(
        id="rule-01",
        code="RULE-SAT-DEV",
        name="SAT Deviation Rule",
        target_scope={"entity_type": "AHU", "site_id": "all"},
        fault_logic={
            "metrics": ["supply_air_temp", "supply_air_temp_setpoint"],
            "condition_expr": "abs(supply_air_temp - supply_air_temp_setpoint) > tolerance",
            "parameters": {"tolerance": 3.0},
            "duration_seconds": 900
        },
        severity=RuleSeverity.CRITICAL,
        status=RuleStatus.APPROVED,
        is_active=True
    )

    mock_entity = MagicMock(id="ahu-01", code="AHU-01", site_id="site-a")
    existing_issue = Issue(
        id="issue-01",
        code="ISS-20260115-0001",
        rule_id="rule-01",
        entity_id="ahu-01",
        site_id="site-a",
        status=IssueStatus.OPEN,
        evidence={}
    )

    mock_db = AsyncMock()
    with patch("src.services.afdd_evaluator.crud_ontology.list_entities", return_value=([mock_entity], 1)), \
         patch.object(evaluator, "_check_fault_condition", return_value=(False, {"is_normal": True})), \
         patch("src.services.afdd_evaluator.crud_issue.get_active_issue_by_rule_and_entity", return_value=existing_issue), \
         patch("src.services.afdd_evaluator.ws_manager.broadcast", new_callable=AsyncMock) as mock_ws:
        
        detected = await evaluator.evaluate_rule(mock_db, rule, now)

        assert len(detected) == 0
        assert existing_issue.status == IssueStatus.RESOLVED
        assert existing_issue.resolved_at == now
        assert "recovery_reason" in existing_issue.evidence
        assert mock_ws.called
        assert mock_ws.call_args.kwargs["event_type"] == "issue.resolved"
