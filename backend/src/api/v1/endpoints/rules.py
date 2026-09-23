from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.db.session import get_db
from src.crud.crud_rule import crud_rule
from src.models.rule import RuleStatus
from src.schemas.common_schema import ApiResponse
from src.schemas.rule_schema import RuleCreate, RuleUpdate, RuleResponse

router = APIRouter()


@router.post("/", response_model=ApiResponse[RuleResponse], status_code=status.HTTP_201_CREATED)
async def create_rule(
    payload: RuleCreate, db: AsyncSession = Depends(get_db)
):
    """
    Creates an AFDD Rule (Defaults to is_active=False).
    """
    existing = await crud_rule.get_rule(db, payload.code)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Rule with code '{payload.code}' already exists",
        )
    created = await crud_rule.create_rule(db, payload)
    return ApiResponse(success=True, data=created, message="Rule created successfully")


from src.schemas.common_schema import ApiResponse, PaginationMeta


@router.get("/", response_model=ApiResponse[List[RuleResponse]])
async def list_rules(
    status_filter: Optional[RuleStatus] = Query(None, alias="status"),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None, description="Search by code, name, description"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(100, ge=1, le=1000, description="Items per page"),
    offset: Optional[int] = Query(None, description="Direct offset override"),
    db: AsyncSession = Depends(get_db),
):
    """
    Lists AFDD rules with optional filtering and pagination.
    """
    actual_offset = offset if offset is not None else (page - 1) * limit
    rules, total_count = await crud_rule.list_rules(
        db,
        status=status_filter,
        is_active=is_active,
        search=search,
        limit=limit,
        offset=actual_offset,
    )
    total_pages = (total_count + limit - 1) // limit if limit > 0 else 1

    pagination = PaginationMeta(
        total=total_count,
        limit=limit,
        offset=actual_offset,
        current_page=page,
        total_pages=total_pages,
    )
    return ApiResponse(
        success=True, 
        data=rules, 
        pagination=pagination, 
        message=f"Retrieved {len(rules)} rules (page {page} of {total_pages})"
    )



@router.get("/{rule_id}", response_model=ApiResponse[RuleResponse])
async def get_rule(
    rule_id: str, db: AsyncSession = Depends(get_db)
):
    rule = await crud_rule.get_rule(db, rule_id)
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rule '{rule_id}' not found",
        )
    return ApiResponse(success=True, data=rule, message="Rule retrieved successfully")


@router.patch("/{rule_id}", response_model=ApiResponse[RuleResponse])
async def update_rule(
    rule_id: str, payload: RuleUpdate, db: AsyncSession = Depends(get_db)
):
    """
    Updates rule configuration, approvals, and activation state.
    """
    rule = await crud_rule.update_rule(db, rule_id, payload)
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rule '{rule_id}' not found",
        )
    return ApiResponse(success=True, data=rule, message="Rule updated successfully")


@router.delete("/{rule_id}", response_model=ApiResponse[None], status_code=status.HTTP_200_OK)
async def delete_rule(
    rule_id: str, db: AsyncSession = Depends(get_db)
):
    success = await crud_rule.delete_rule(db, rule_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rule '{rule_id}' not found",
        )
    return ApiResponse(success=True, data=None, message=f"Rule '{rule_id}' deleted successfully")
