import uuid
from typing import List, Optional, Tuple
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.site import Site
from src.schemas.site_schema import SiteCreate, SiteUpdate


class CRUDSite:
    async def get_site(self, db: AsyncSession, site_id: str) -> Optional[Site]:
        result = await db.execute(
            select(Site).where(or_(Site.id == site_id, Site.code == site_id))
        )
        return result.scalars().first()

    async def get_site_by_code(self, db: AsyncSession, code: str) -> Optional[Site]:
        result = await db.execute(select(Site).where(Site.code == code))
        return result.scalars().first()

    async def list_sites(
        self,
        db: AsyncSession,
        limit: int = 100,
        offset: int = 0
    ) -> Tuple[List[Site], int]:
        count_stmt = select(func.count()).select_from(Site)
        total_count = (await db.execute(count_stmt)).scalar_one()

        stmt = select(Site).order_by(Site.name).offset(offset).limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all()), total_count

    async def create_site(self, db: AsyncSession, site_in: SiteCreate) -> Site:
        db_site = Site(
            id=str(uuid.uuid4()),
            code=site_in.code,
            name=site_in.name,
            description=site_in.description,
        )
        db.add(db_site)
        await db.commit()
        await db.refresh(db_site)
        return db_site

    async def update_site(
        self, db: AsyncSession, site_id: str, site_in: SiteUpdate
    ) -> Optional[Site]:
        db_site = await self.get_site(db, site_id)
        if not db_site:
            return None

        update_data = site_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_site, field, value)

        await db.commit()
        await db.refresh(db_site)
        return db_site

    async def delete_site(self, db: AsyncSession, site_id: str) -> bool:
        db_site = await self.get_site(db, site_id)
        if not db_site:
            return False
        await db.delete(db_site)
        await db.commit()
        return True


crud_site = CRUDSite()
