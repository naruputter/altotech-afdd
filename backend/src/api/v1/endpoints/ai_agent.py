from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.db.session import get_db
from src.services.llm_orchestrator import llm_orchestrator
from src.schemas.common_schema import ApiResponse
from src.schemas.rule_schema import AIDraftRuleRequest

router = APIRouter()


@router.post("/draft-rule", response_model=ApiResponse[dict], status_code=status.HTTP_201_CREATED)
async def draft_rule_with_ai(
    payload: AIDraftRuleRequest, db: AsyncSession = Depends(get_db)
):
    """
    AI Agent endpoint for drafting an AFDD rule from natural language prompt.
    Human-in-the-loop guarantee:
    - AI is bounded and only creates rules with is_active=False and status=DRAFT.
    - Requires human engineer approval via PATCH /api/v1/rules/{id} before activation.
    """
    result = await llm_orchestrator.draft_rule_from_prompt(
        db,
        prompt=payload.prompt,
        site_id=payload.target_site_id,
        equipment_type=payload.target_equipment_type,
    )
    return ApiResponse(success=True, data=result, message="Rule drafted by AI agent successfully")
