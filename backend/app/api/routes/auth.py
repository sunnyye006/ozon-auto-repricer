from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import ROLE_ADMIN, ROLE_USER
from app.core.config import settings
from app.core.db import get_db
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.models import User
from app.schemas import AuthMeOut, LoginIn, RegisterIn, TokenOut, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _role_for(email: str) -> str:
    admin_email = (settings.super_admin_email or "").strip().lower()
    return ROLE_ADMIN if admin_email and email == admin_email else ROLE_USER


@router.post("/register", response_model=TokenOut)
async def register(payload: RegisterIn, db: AsyncSession = Depends(get_db)) -> TokenOut:
    email = _normalize_email(payload.email)
    existed = await db.scalar(select(User).where(User.email == email))
    if existed:
        raise HTTPException(status_code=409, detail="该邮箱已注册")

    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        role=_role_for(email),
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user_id=user.id, email=user.email, role=user.role)
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenOut)
async def login(payload: LoginIn, db: AsyncSession = Depends(get_db)) -> TokenOut:
    email = _normalize_email(payload.email)
    user = await db.scalar(select(User).where(User.email == email))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="账号已被禁用")

    # 若该邮箱被配置为超级管理员但历史角色不是 admin，登录时补正。
    expected_role = _role_for(email)
    if expected_role == ROLE_ADMIN and user.role != ROLE_ADMIN:
        user.role = ROLE_ADMIN
        await db.commit()
        await db.refresh(user)

    token = create_access_token(user_id=user.id, email=user.email, role=user.role)
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=AuthMeOut)
async def me(request: Request, db: AsyncSession = Depends(get_db)) -> AuthMeOut:
    if not settings.auth_enabled:
        return AuthMeOut(authenticated=False, auth_enabled=False)

    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return AuthMeOut(authenticated=False, auth_enabled=True)
    try:
        payload = decode_access_token(header[7:].strip())
        user = await db.get(User, int(payload["sub"]))
    except Exception:  # noqa: BLE001
        return AuthMeOut(authenticated=False, auth_enabled=True)

    if not user or not user.is_active:
        return AuthMeOut(authenticated=False, auth_enabled=True)
    return AuthMeOut(
        authenticated=True,
        auth_enabled=True,
        id=user.id,
        email=user.email,
        role=user.role,
    )
