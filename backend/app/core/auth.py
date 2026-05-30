from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import get_db
from app.core.security import decode_access_token
from app.models import Store, User

ROLE_ADMIN = "admin"
ROLE_USER = "user"


@dataclass
class CurrentUser:
    id: int | None
    email: str
    role: str

    @property
    def is_admin(self) -> bool:
        return self.role == ROLE_ADMIN


# 鉴权关闭时使用的系统级管理员上下文：行为等同单租户，可见全部数据。
SYSTEM_ADMIN = CurrentUser(id=None, email="system", role=ROLE_ADMIN)


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> CurrentUser:
    if not settings.auth_enabled:
        return SYSTEM_ADMIN

    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未登录")
    token = header[7:].strip()
    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=401, detail="登录已失效，请重新登录") from exc

    user = await db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="账号不存在或已被禁用")
    return CurrentUser(id=user.id, email=user.email, role=user.role)


async def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="需要超级管理员权限")
    return user


async def accessible_store_ids(db: AsyncSession, user: CurrentUser) -> list[int] | None:
    """返回该用户可访问的店铺 id 列表；返回 None 表示不限制（管理员可见全部）。"""
    if user.is_admin:
        return None
    rows = await db.scalars(select(Store.id).where(Store.owner_id == user.id))
    return list(rows.all())


async def ensure_store_access(db: AsyncSession, user: CurrentUser, store: Store) -> None:
    if user.is_admin:
        return
    if store.owner_id != user.id:
        raise HTTPException(status_code=404, detail="店铺不存在或无权访问")
