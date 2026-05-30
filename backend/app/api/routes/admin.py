from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, require_admin
from app.core.db import get_db
from app.core.security import hash_password
from app.models import Store, User
from app.schemas import (
    AdminStoreOut,
    AdminUserUpdateIn,
    AssignStoreIn,
    ResetPasswordIn,
    UserOut,
    UserStatusIn,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
) -> list[User]:
    rows = await db.scalars(select(User).order_by(User.id.asc()))
    return rows.all()


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    payload: AdminUserUpdateIn,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
) -> User:
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    user.username = payload.username.strip()
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/users/{user_id}/status", response_model=UserOut)
async def set_user_status(
    user_id: int,
    payload: UserStatusIn,
    db: AsyncSession = Depends(get_db),
    admin: CurrentUser = Depends(require_admin),
) -> User:
    if admin.id is not None and admin.id == user_id:
        raise HTTPException(status_code=400, detail="不能停用 / 启用自己的账号")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    user.is_active = payload.is_active
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/users/{user_id}/password", response_model=UserOut)
async def reset_user_password(
    user_id: int,
    payload: ResetPasswordIn,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
) -> User:
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    user.password_hash = hash_password(payload.password)
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: CurrentUser = Depends(require_admin),
) -> None:
    if admin.id is not None and admin.id == user_id:
        raise HTTPException(status_code=400, detail="不能删除自己的账号")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    # 先把该用户名下的店铺解除归属，避免依赖数据库外键级联（跨方言更稳妥）
    await db.execute(update(Store).where(Store.owner_id == user_id).values(owner_id=None))
    await db.delete(user)
    await db.commit()


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
