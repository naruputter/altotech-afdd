from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.db.session import get_db
from src.crud.crud_site import crud_site
from src.schemas.site_schema import SiteCreate, SiteUpdate, SiteResponse
from src.schemas.common_schema import ApiResponse, PaginationMeta

router = APIRouter()


@router.post("/", response_model=ApiResponse[SiteResponse], status_code=status.HTTP_201_CREATED)
async def create_site(
    payload: SiteCreate, db: AsyncSession = Depends(get_db)
):
    """
    Creates a new Site / Campus.
    """
    existing = await crud_site.get_site_by_code(db, payload.code)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Site with code '{payload.code}' already exists",
        )
    created = await crud_site.create_site(db, payload)
    return ApiResponse(success=True, data=created, message="Site created successfully")


@router.get("/", response_model=ApiResponse[List[SiteResponse]])
async def list_sites(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(100, ge=1, le=1000, description="Items per page"),
    offset: Optional[int] = Query(None, description="Direct offset override"),
    db: AsyncSession = Depends(get_db),
):
    """
    Lists all registered sites / campuses.
    """
    actual_offset = offset if offset is not None else (page - 1) * limit
    sites, total_count = await crud_site.list_sites(db, limit=limit, offset=actual_offset)
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
        data=sites,
        pagination=pagination,
        message=f"Retrieved {len(sites)} sites",
    )


@router.get("/{site_id}", response_model=ApiResponse[SiteResponse])
async def get_site(site_id: str, db: AsyncSession = Depends(get_db)):
    site = await crud_site.get_site(db, site_id)
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Site '{site_id}' not found",
        )
    return ApiResponse(success=True, data=site, message="Site retrieved successfully")


@router.patch("/{site_id}", response_model=ApiResponse[SiteResponse])
async def update_site(
    site_id: str, payload: SiteUpdate, db: AsyncSession = Depends(get_db)
):
    site = await crud_site.update_site(db, site_id, payload)
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Site '{site_id}' not found",
        )
    return ApiResponse(success=True, data=site, message="Site updated successfully")


@router.delete("/{site_id}", response_model=ApiResponse[None], status_code=status.HTTP_200_OK)
async def delete_site(site_id: str, db: AsyncSession = Depends(get_db)):
    success = await crud_site.delete_site(db, site_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Site '{site_id}' not found",
        )
    return ApiResponse(success=True, data=None, message=f"Site '{site_id}' deleted successfully")
