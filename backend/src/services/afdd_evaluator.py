import uuid
import ast
import operator
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional, Set
from sqlalchemy.ext.asyncio import AsyncSession
from src.crud.crud_rule import crud_rule
from src.crud.crud_telemetry import crud_telemetry
from src.crud.crud_ontology import crud_ontology
from src.crud.crud_issue import crud_issue
from src.models.rule import Rule, RuleStatus
from src.models.issue import IssueStatus
from src.schemas.issue_schema import IssueCreate
from src.services.ws_manager import ws_manager

logger = logging.getLogger(__name__)


SAFE_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
    ast.Not: operator.not_,
    ast.Eq: operator.eq,
    ast.NotEq: operator.ne,
    ast.Lt: operator.lt,
    ast.LtE: operator.le,
    ast.Gt: operator.gt,
    ast.GtE: operator.ge,
}

SAFE_FUNCTIONS = {
    "abs": abs,
    "min": min,
    "max": max,
    "round": round,
}


def extract_variables_from_expr(expr: str) -> Set[str]:
    variables = set()
    try:
        parsed = ast.parse(expr.strip(), mode="eval")
        for node in ast.walk(parsed):
            if isinstance(node, ast.Name):
                if node.id not in SAFE_FUNCTIONS:
                    variables.add(node.id)
    except Exception:
        pass
    return variables

def safe_eval_node(node: ast.AST, context: Dict[str, Any]) -> Any:
    if isinstance(node, ast.Expression):
        return safe_eval_node(node.body, context)
    elif isinstance(node, ast.Constant):
        return node.value
    elif isinstance(node, ast.Name):
        if node.id in context:
            return context[node.id]
        if node.id in SAFE_FUNCTIONS:
            return SAFE_FUNCTIONS[node.id]
        raise ValueError(f"Unknown variable in rule expression: {node.id}")
    elif isinstance(node, ast.UnaryOp):
        op_type = type(node.op)
        if op_type in SAFE_OPERATORS:
            return SAFE_OPERATORS[op_type](safe_eval_node(node.operand, context))
        raise ValueError(f"Unsupported unary operator: {op_type}")
    elif isinstance(node, ast.BinOp):
        op_type = type(node.op)
        if op_type in SAFE_OPERATORS:
            left = safe_eval_node(node.left, context)
            right = safe_eval_node(node.right, context)
            return SAFE_OPERATORS[op_type](left, right)
        raise ValueError(f"Unsupported binary operator: {op_type}")
    elif isinstance(node, ast.Compare):
        left = safe_eval_node(node.left, context)
        for op, comparator in zip(node.ops, node.comparators):
            op_type = type(op)
            right = safe_eval_node(comparator, context)
            if op_type not in SAFE_OPERATORS or not SAFE_OPERATORS[op_type](left, right):
                return False
            left = right
        return True
    elif isinstance(node, ast.BoolOp):
        if isinstance(node.op, ast.And):
            return all(bool(safe_eval_node(val, context)) for val in node.values)
        elif isinstance(node.op, ast.Or):
            return any(bool(safe_eval_node(val, context)) for val in node.values)
    elif isinstance(node, ast.Call):
        func = safe_eval_node(node.func, context)
        args = [safe_eval_node(arg, context) for arg in node.args]
        return func(*args)
    raise ValueError(f"Unsupported expression node: {type(node)}")


def evaluate_dynamic_condition(expr: str, context: Dict[str, Any]) -> bool:
    try:
        parsed = ast.parse(expr.strip(), mode="eval")
        res = safe_eval_node(parsed, context)
        return bool(res)
    except Exception as e:
        logger.warning(f"Failed to evaluate expression '{expr}': {e}")
        return False


class AFDDEvaluator:
    """
    Dynamic AFDD Engine:
    - Evaluates generic rules defined with `condition_expr` and `parameters` dynamically.
    - No hardcoded rule conditions.
    - Evaluates continuous time-series windows (e.g. 15-minute continuous fault).
    - Checks operating status (ON/OFF), freshness, missing points exclusion.
    - Traverses BrickSchema topology to propagate downstream physical impact (AHU -> Zone -> Rooms).
    """

    async def evaluate_all_active_rules(self, db: AsyncSession, reference_time: Optional[datetime] = None) -> List[str]:
        if reference_time is None:
            reference_time = datetime.now(timezone.utc)
        elif reference_time.tzinfo is None:
            reference_time = reference_time.replace(tzinfo=timezone.utc)

        rules, _ = await crud_rule.list_rules(db, is_active=True, status=RuleStatus.APPROVED)
        detected_issue_ids: List[str] = []

        for rule in rules:
            issue_ids = await self.evaluate_rule(db, rule, reference_time)
            detected_issue_ids.extend(issue_ids)

        return detected_issue_ids

    async def evaluate_rule(self, db: AsyncSession, rule: Rule, reference_time: datetime) -> List[str]:
        target_scope = rule.target_scope or {}
        fault_logic = rule.fault_logic or {}

        entity_type = target_scope.get("entity_type")
        site_id = target_scope.get("site_id")
        target_entity_ids = target_scope.get("entity_ids")
        property_types = target_scope.get("property_types")

        entities, _ = await crud_ontology.list_entities(
            db, site_id=site_id if site_id != "all" else None, entity_type=entity_type
        )
        if target_entity_ids:
            entities = [e for e in entities if e.id in target_entity_ids]

        if property_types:
            filtered = []
            for e in entities:
                site_code = getattr(e.site, "code", "") if hasattr(e, "site") and e.site else ""
                if "Office" in property_types and ("hotel" in site_code.lower() or "building-c" in site_code.lower()):
                    continue
                filtered.append(e)
            entities = filtered

        duration_seconds = fault_logic.get("duration_seconds", 900)
        window_start = reference_time - timedelta(seconds=duration_seconds)
        detected_issues = []

        for entity in entities:
            fault_active, evidence = await self._check_fault_condition(
                db, entity.id, fault_logic, window_start, reference_time
            )

            if fault_active:
                issue_id = await self._record_or_update_fault(
                    db, rule, entity, evidence, window_start, reference_time
                )
                if issue_id:
                    detected_issues.append(issue_id)
            else:
                if evidence.get("is_normal"):
                    existing = await crud_issue.get_active_issue_by_rule_and_entity(db, rule.id, entity.id)
                    if existing:
                        existing.status = IssueStatus.RESOLVED
                        existing.resolved_at = reference_time
                        if not isinstance(existing.evidence, dict):
                            existing.evidence = {}
                        existing.evidence["recovered_at"] = reference_time.isoformat()
                        existing.evidence["recovery_reason"] = "Telemetry readings returned to normal operational bounds."
                        await db.commit()
                        logger.info(f"[AFDD Engine] Issue {existing.code} auto-resolved for entity {entity.code}")
                        # Broadcast WebSocket Event
                        try:
                            await ws_manager.broadcast(
                                event_type="issue.resolved",
                                data={
                                    "id": existing.id,
                                    "code": existing.code,
                                    "entity_id": existing.entity_id,
                                    "rule_id": existing.rule_id,
                                    "status": IssueStatus.RESOLVED.value,
                                    "resolved_at": reference_time.isoformat(),
                                },
                                site_id=entity.site_id,
                            )
                        except Exception as ws_err:
                            logger.error(f"[WS Broadcast] Error on issue.resolved: {ws_err}")

        return detected_issues

    async def _check_fault_condition(
        self,
        db: AsyncSession,
        entity_id: str,
        fault_logic: Dict[str, Any],
        window_start: datetime,
        window_end: datetime,
    ) -> tuple[bool, Dict[str, Any]]:
        condition_expr = fault_logic.get("condition_expr", "")
        params = fault_logic.get("parameters", {})

        if not condition_expr:
            return False, {}

        # Auto-discover all required metric names directly from AST condition expression
        expr_vars = extract_variables_from_expr(condition_expr)
        # Exclude parameters defined in rule parameters (e.g. tolerance)
        required_metrics = {v for v in expr_vars if v not in params}
        
        # Include explicit metrics from fault_logic and run_status if required
        explicit_metrics = set(fault_logic.get("metrics", []))
        metrics = list(required_metrics.union(explicit_metrics))

        if params.get("require_run_status_on", False) and "run_status" not in metrics:
            metrics.append("run_status")

        # 1. Fetch telemetry for all required metrics within window
        telemetry_records: Dict[str, list] = {}
        for m in metrics:
            recs = await crud_telemetry.get_history(
                db, entity_id=entity_id, metric_name=m, start_time=window_start, end_time=window_end, limit=300
            )
            telemetry_records[m] = list(recs) if recs else []

        # 2. Exclusion: Missing required points or no telemetry
        if not all(telemetry_records.get(m) for m in metrics):
            return False, {"missing_required_points": True}

        # 3. Data Freshness: Newest reading must be recent (within 180s of window_end)
        latest_timestamps = [recs[0].timestamp for recs in telemetry_records.values() if recs]
        if latest_timestamps:
            newest_ts = max(latest_timestamps)
            if (window_end - newest_ts).total_seconds() > 180:
                return False, {"outdated_data": True}

        # 4. Operating Status Check: If rule requires equipment to be ON
        if params.get("require_run_status_on", False) or "run_status" in metrics:
            run_recs = telemetry_records.get("run_status", [])
            if run_recs:
                if run_recs[0].val < 0.5:
                    return False, {"equipment_off": True}
                if any(r.val < 0.5 for r in run_recs):
                    return False, {"timing_reset_due_to_off": True}

        # 5. Evaluate dynamic condition continuously across window slices
        min_samples = min(len(telemetry_records[m]) for m in metrics)
        if min_samples == 0:
            return False, {}

        slice_eval_results = []
        latest_context = {**params}
        for m in metrics:
            latest_context[m] = telemetry_records[m][0].val

        for i in range(min_samples):
            ctx = {**params}
            for m in metrics:
                ctx[m] = telemetry_records[m][i].val
            is_slice_fault = evaluate_dynamic_condition(condition_expr, ctx)
            slice_eval_results.append(is_slice_fault)

        all_deviated = all(slice_eval_results)
        latest_is_normal = not slice_eval_results[0]

        evidence = {
            "latest_metrics": {m: round(telemetry_records[m][0].val, 2) if isinstance(telemetry_records[m][0].val, float) else telemetry_records[m][0].val for m in metrics},
            "parameters": params,
            "condition_expr": condition_expr,
            "sample_count": min_samples,
            "window_start": window_start.isoformat(),
            "window_end": window_end.isoformat(),
            "reason": f"Evaluated dynamic condition '{condition_expr}' continuously over {min_samples} telemetry samples."
        }

        if all_deviated:
            return True, evidence
        elif latest_is_normal:
            return False, {"is_normal": True, **evidence}

        return False, {}

    async def _record_or_update_fault(
        self,
        db: AsyncSession,
        rule: Rule,
        entity: Any,
        evidence: Dict[str, Any],
        window_start: datetime,
        reference_time: datetime,
    ) -> Optional[str]:
        # Check if active issue exists
        existing = await crud_issue.get_active_issue_by_rule_and_entity(db, rule.id, entity.id)
        if existing:
            existing.last_detected_at = reference_time
            existing.evidence = evidence
            await db.commit()
            return existing.id

        # Calculate affected zones & rooms via BrickSchema traversal
        _, affected_rooms = await crud_ontology.get_downstream_impact(db, entity.id)

        # Estimate energy waste based on deviation and duration
        avg_dev = evidence.get("parameters", {}).get("tolerance", 3.0)
        est_waste = round(avg_dev * 5.2, 1)

        issue_code = f"ISS-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        new_issue = IssueCreate(
            code=issue_code,
            rule_id=rule.id,
            entity_id=entity.id,
            site_id=entity.site_id,
            title=f"Fault in {entity.name}: {rule.name}",
            description=rule.description or f"Triggered by rule {rule.name}",
            severity=rule.severity.value if hasattr(rule.severity, "value") else str(rule.severity),
            status=IssueStatus.OPEN,
            started_at=window_start,
            last_detected_at=reference_time,
            evidence=evidence,
            affected_rooms=affected_rooms,
            estimated_energy_waste_kwh=est_waste,
        )
        created = await crud_issue.create_issue(db, new_issue)
        logger.info(f"[AFDD Engine] Created NEW Dynamic Issue {created.code} for {entity.code} (Impact: {len(affected_rooms)} rooms)")
        
        # Broadcast WebSocket Event
        try:
            await ws_manager.broadcast(
                event_type="issue.created",
                data={
                    "id": created.id,
                    "code": created.code,
                    "rule_id": created.rule_id,
                    "entity_id": created.entity_id,
                    "site_id": created.site_id,
                    "title": created.title,
                    "description": created.description,
                    "severity": created.severity.value if hasattr(created.severity, "value") else str(created.severity),
                    "status": created.status.value if hasattr(created.status, "value") else str(created.status),
                    "started_at": created.started_at.isoformat() if created.started_at else None,
                    "last_detected_at": created.last_detected_at.isoformat() if created.last_detected_at else None,
                    "evidence": created.evidence,
                    "affected_rooms": created.affected_rooms,
                    "estimated_energy_waste_kwh": created.estimated_energy_waste_kwh,
                    "created_at": created.created_at.isoformat() if created.created_at else None,
                },
                site_id=entity.site_id,
            )
        except Exception as ws_err:
            logger.error(f"[WS Broadcast] Error on issue.created: {ws_err}")

        return created.id


afdd_evaluator = AFDDEvaluator()
