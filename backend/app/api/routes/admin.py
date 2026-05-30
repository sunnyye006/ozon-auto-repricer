from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, require_admin
from app.core.db import get_db
from app.models import Store, User
from app.schemas import AdminStoreOut, AssignStoreIn, UserOut

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
) -> list[User]:
    rows = await db.scalars(select(User).order_by(User.id.asc()))
    return rows.all()


@router.get("/stores", response_model=list[AdminStoreOut])
async def list_all_stores(
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
) -> list[AdminStoreOut]:
    stores = (await db.scalars(select(Store).order_by(Store.id.desc()))).all()
    users = (await db.scalars(select(User))).all()
    email_by_id = {u.id: u.email for u in users}
    return [
        AdminStoreOut(
            id=s.id,
            name=s.name,
            owner_id=s.owner_id,
            owner_email=email_by_id.get(s.owner_id) if s.owner_id else None,
            is_active=s.is_active,
            auto_reprice_enabled=s.auto_reprice_enabled,
        )
        for s in stores
    ]


@router.patch("/stores/{store_id}/assign", response_model=AdminStoreOut)
async def assign_store(
    store_id: int,
    payload: AssignStoreIn,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
) -> AdminStoreOut:
    store = await db.get(Store, store_id)
    if not store:
        raise HTTPException(status_code=404, detail="店铺不存在")

    owner_email: str | None = None
    if payload.user_id is not None:
        target = await db.get(User, payload.user_id)
        if not target:
            raise HTTPException(status_code=404, detail="目标用户不存在")
        owner_email = target.email

    store.owner_id = payload.user_id
    await db.commit()
    await db.refresh(store)
    return AdminStoreOut(
        id=store.id,
        name=store.name,
        owner_id=store.owner_id,
        owner_email=owner_email,
        is_active=store.is_active,
        auto_reprice_enabled=store.auto_reprice_enabled,
    )
