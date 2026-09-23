from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.db.session import get_db
from src.crud.crud_issue import crud_issue
from src.services.afdd_evaluator import afdd_evaluator
from src.models.issue import IssueStatus
from src.schemas.common_schema import ApiResponse
from src.schemas.issue_schema import IssueResponse, IssueUpdate

router = APIRouter()


from src.schemas.common_schema import ApiResponse, PaginationMeta


@router.get("/", response_model=ApiResponse[List[IssueResponse]])
async def list_issues(
    site_id: Optional[str] = Query(None, description="Filter by Site / Building"),
    status_filter: Optional[IssueStatus] = Query(None, alias="status"),
    entity_id: Optional[str] = Query(None, description="Filter by Entity ID"),
    search: Optional[str] = Query(None, description="Search query for code, title, description, equipment"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(100, ge=1, le=1000, description="Items per page"),
    offset: Optional[int] = Query(None, description="Direct offset override"),
    db: AsyncSession = Depends(get_db),
):
    """
    Lists detected AFDD issues with evidence and affected downstream rooms with pagination.
    """
    actual_offset = offset if offset is not None else (page - 1) * limit
    issues, total_count = await crud_issue.list_issues(
        db,
        site_id=site_id,
        status=status_filter,
        entity_id=entity_id,
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
        data=issues, 
        pagination=pagination, 
        message=f"Retrieved {len(issues)} issues (page {page} of {total_pages})"
    )



@router.get("/{issue_id}", response_model=ApiResponse[IssueResponse])
async def get_issue(
    issue_id: str, db: AsyncSession = Depends(get_db)
):
    issue = await crud_issue.get_issue(db, issue_id)
    if not issue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Issue '{issue_id}' not found",
        )
    return ApiResponse(success=True, data=issue, message="Issue retrieved successfully")


@router.patch("/{issue_id}", response_model=ApiResponse[IssueResponse])
async def update_issue(
    issue_id: str, payload: IssueUpdate, db: AsyncSession = Depends(get_db)
):
    """
    Updates issue status (ACKNOWLEDGED / RESOLVED / MUTED).
    """
    issue = await crud_issue.update_issue(db, issue_id, payload)
    if not issue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Issue '{issue_id}' not found",
        )
    return ApiResponse(success=True, data=issue, message="Issue updated successfully")


@router.post("/trigger-evaluation", response_model=ApiResponse[dict], status_code=status.HTTP_200_OK)
async def trigger_afdd_evaluation(db: AsyncSession = Depends(get_db)):
    """
    Triggers AFDD fault condition evaluation on current telemetry windows.
    """
    detected = await afdd_evaluator.evaluate_all_active_rules(db)
    return ApiResponse(
        success=True,
        data={
            "status": "SUCCESS",
            "evaluated": True,
            "detected_issues_count": len(detected),
            "issue_ids": detected,
        },
        message=f"Evaluation completed. {len(detected)} active issues detected."
    )
