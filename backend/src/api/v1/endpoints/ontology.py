from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.db.session import get_db
from src.crud.crud_ontology import crud_ontology
from src.models.entity import EntityType
from src.schemas.common_schema import ApiResponse, PaginationMeta
from src.schemas.ontology_schema import (
    EntityCreate,
    EntityUpdate,
    EntityResponse,
    EntityRelationshipCreate,
    EntityRelationshipResponse,
    DownstreamImpactResponse,
)

router = APIRouter()


@router.post("/entities", response_model=ApiResponse[EntityResponse], status_code=status.HTTP_201_CREATED)
async def create_entity(
    payload: EntityCreate, db: AsyncSession = Depends(get_db)
):
    """
    Registers a new BrickSchema entity (Building, Floor, HVAC_Zone, Room, AHU, Meter, IAQ).
    """
    existing = await crud_ontology.get_entity(db, payload.code)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Entity with code '{payload.code}' already exists",
        )
    created = await crud_ontology.create_entity(db, payload)
    return ApiResponse(success=True, data=created, message="Entity created successfully")


@router.get("/entities", response_model=ApiResponse[List[EntityResponse]])
async def list_entities(
    site_id: Optional[str] = Query(None, description="Filter by Site ID"),
    entity_type: Optional[EntityType] = Query(None, description="Filter by Entity Type"),
    search: Optional[str] = Query(None, description="Search query for name, code, brick class"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(100, ge=1, le=1000, description="Items per page"),
    offset: Optional[int] = Query(None, description="Direct offset override"),
    db: AsyncSession = Depends(get_db),
):
    """
    Lists all entities matching optional site and entity type filters with pagination.
    """
    actual_offset = offset if offset is not None else (page - 1) * limit
    entities, total_count = await crud_ontology.list_entities(
        db,
        site_id=site_id,
        entity_type=entity_type,
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
        total_pages=total_pages
    )
    return ApiResponse(
        success=True, 
        data=entities, 
        pagination=pagination, 
        message=f"Retrieved {len(entities)} entities (page {page} of {total_pages})"
    )


@router.get("/entities/{entity_id}", response_model=ApiResponse[EntityResponse])
async def get_entity(
    entity_id: str, db: AsyncSession = Depends(get_db)
):
    entity = await crud_ontology.get_entity(db, entity_id)
    if not entity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Entity '{entity_id}' not found",
        )
    return ApiResponse(success=True, data=entity, message="Entity retrieved successfully")


@router.patch("/entities/{entity_id}", response_model=ApiResponse[EntityResponse])
async def update_entity(
    entity_id: str, payload: EntityUpdate, db: AsyncSession = Depends(get_db)
):
    """
    Updates an entity's name, brick class, or metadata.
    """
    updated = await crud_ontology.update_entity(db, entity_id, payload)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Entity '{entity_id}' not found",
        )
    return ApiResponse(success=True, data=updated, message="Entity updated successfully")


@router.delete("/entities/{entity_id}", response_model=ApiResponse[None], status_code=status.HTTP_200_OK)
async def delete_entity(
    entity_id: str, db: AsyncSession = Depends(get_db)
):
    """
    Deletes an entity and its associated relationships.
    """
    entity = await crud_ontology.get_entity(db, entity_id)
    if not entity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Entity '{entity_id}' not found",
        )
    await crud_ontology.delete_entity(db, entity_id)
    return ApiResponse(success=True, data=None, message=f"Entity '{entity_id}' deleted successfully")


@router.get("/relationships", response_model=ApiResponse[List[EntityRelationshipResponse]])
async def list_relationships(
    subject_id: Optional[str] = Query(None, description="Filter by Subject Entity ID"),
    predicate: Optional[str] = Query(None, description="Filter by Predicate / Relationship Type"),
    object_id: Optional[str] = Query(None, description="Filter by Object Entity ID"),
    db: AsyncSession = Depends(get_db),
):
    """
    Lists all BrickSchema graph relationships (edges) in the digital twin.
    """
    from src.models.entity import RelationshipType
    pred_enum = None
    if predicate:
        try:
            pred_enum = RelationshipType(predicate)
        except ValueError:
            pass

    relationships = await crud_ontology.list_relationships(
        db, subject_id=subject_id, predicate=pred_enum, object_id=object_id
    )
    return ApiResponse(
        success=True,
        data=relationships,
        message=f"Retrieved {len(relationships)} relationships"
    )


@router.post("/relationships", response_model=ApiResponse[EntityRelationshipResponse], status_code=status.HTTP_201_CREATED)
async def create_relationship(
    payload: EntityRelationshipCreate, db: AsyncSession = Depends(get_db)
):
    """
    Creates a BrickSchema relationship between entities (e.g. AHU feeds Zone, Zone hasPart Room).
    Validates topology constraints (e.g. Building cannot be part of Room/Floor, Floor must belong to Building).
    """
    from src.models.entity import RelationshipType

    subject = await crud_ontology.get_entity(db, payload.subject_id)
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subject entity '{payload.subject_id}' not found",
        )

    target_obj = await crud_ontology.get_entity(db, payload.object_id)
    if not target_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target entity '{payload.object_id}' not found",
        )

    if payload.subject_id == payload.object_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An entity cannot establish a relationship to itself.",
        )

    # Validate Spatial Hierarchy constraints (BOT & BrickSchema standards)
    if payload.predicate == RelationshipType.IS_PART_OF:
        if subject.entity_type == EntityType.BUILDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A Building is a top-level root space and cannot be 'isPartOf' any other space.",
            )
        elif subject.entity_type == EntityType.FLOOR:
            if target_obj.entity_type != EntityType.BUILDING:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"A Floor can only be part of a Building (attempted to assign to {target_obj.entity_type.value}).",
                )
        elif subject.entity_type == EntityType.HVAC_ZONE:
            if target_obj.entity_type not in (EntityType.FLOOR, EntityType.BUILDING):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"An HVAC Zone can only be part of a Floor or Building (attempted to assign to {target_obj.entity_type.value}).",
                )
        elif subject.entity_type == EntityType.ROOM:
            if target_obj.entity_type not in (EntityType.HVAC_ZONE, EntityType.FLOOR, EntityType.BUILDING):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"A Room can only be part of an HVAC Zone, Floor, or Building (attempted to assign to {target_obj.entity_type.value}).",
                )
        elif subject.entity_type in (EntityType.AHU, EntityType.METER, EntityType.IAQ_SENSOR, EntityType.EQUIPMENT):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Equipment and sensors cannot use 'isPartOf'; use 'feeds', 'measures', or 'locatedIn' instead.",
            )

    elif payload.predicate == RelationshipType.FEEDS:
        if subject.entity_type not in (EntityType.AHU, EntityType.EQUIPMENT):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Only AHU or equipment can feed spaces (received {subject.entity_type.value}).",
            )
        if target_obj.entity_type not in (EntityType.HVAC_ZONE, EntityType.FLOOR, EntityType.ROOM):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Equipment can only feed an HVAC Zone, Floor, or Room (attempted to feed {target_obj.entity_type.value}).",
            )

    elif payload.predicate == RelationshipType.MEASURES:
        if subject.entity_type not in (EntityType.METER, EntityType.IAQ_SENSOR, EntityType.EQUIPMENT):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Only meters or sensors can measure targets (received {subject.entity_type.value}).",
            )

    rel = await crud_ontology.create_relationship(db, payload)
    return ApiResponse(success=True, data=rel, message="Relationship created successfully")


@router.delete("/relationships", response_model=ApiResponse[None], status_code=status.HTTP_200_OK)
async def delete_relationships(
    subject_id: Optional[str] = Query(None, description="Filter by Subject Entity ID"),
    predicate: Optional[str] = Query(None, description="Filter by Predicate"),
    object_id: Optional[str] = Query(None, description="Filter by Object Entity ID"),
    db: AsyncSession = Depends(get_db),
):
    """
    Deletes relationships matching filter criteria.
    """
    from src.models.entity import RelationshipType
    pred_enum = None
    if predicate:
        try:
            pred_enum = RelationshipType(predicate)
        except ValueError:
            pass

    deleted_count = await crud_ontology.delete_relationships(
        db, subject_id=subject_id, predicate=pred_enum, object_id=object_id
    )
    return ApiResponse(success=True, data=None, message=f"Deleted {deleted_count} relationships")




@router.get("/entities/{entity_id}/downstream-impact", response_model=ApiResponse[DownstreamImpactResponse])
async def get_downstream_impact(
    entity_id: str, db: AsyncSession = Depends(get_db)
):
    """
    Computes all downstream affected HVAC zones and rooms using BrickSchema graph traversal.
    """
    entity = await crud_ontology.get_entity(db, entity_id)
    if not entity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Entity '{entity_id}' not found",
        )
    zones, rooms = await crud_ontology.get_downstream_impact(db, entity_id)
    impact = DownstreamImpactResponse(
        source_entity_id=entity.id,
        source_entity_code=entity.code,
        source_entity_type=entity.entity_type,
        site_id=entity.site_id,
        affected_zones=zones,
        affected_rooms=rooms,
    )
    return ApiResponse(success=True, data=impact, message="Downstream impact computed successfully")
