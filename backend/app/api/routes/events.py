import json
from collections.abc import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from app.core.config import settings
from app.core.db import SessionLocal
from app.core.security import decode_access_token
from app.events import event_bus
from app.models import Store, User

router = APIRouter(prefix="/events", tags=["events"])


async def _resolve_allowed_store_names(token: str | None) -> set[str] | None:
    """None 表示不限制（管理员或鉴权关闭）；空集合表示不可见任何事件。"""
    if not settings.auth_enabled:
        return None
    if not token:
        return set()
    async with SessionLocal() as db:
        try:
            payload = decode_access_token(token)
            user = await db.get(User, int(payload["sub"]))
        except Exception:  # noqa: BLE001
            return set()
        if not user or not user.is_active:
            return set()
        if user.role == "admin":
            return None
        names = (await db.scalars(select(Store.name).where(Store.owner_id == user.id))).all()
        return set(names)


async def _filtered_stream(allowed_names: set[str] | None) -> AsyncGenerator[str, None]:
    async for message in event_bus.stream():
        if allowed_names is None:
            yield message
            continue
        try:
            obj = json.loads(message[len("data: ") :].strip())
        except Exception:  # noqa: BLE001
            continue
        if obj.get("store_name") in allowed_names:
            yield message


@router.get("/stream")
async def stream_events(token: str | None = None) -> StreamingResponse:
    allowed_names = await _resolve_allowed_store_names(token)
    return StreamingResponse(_filtered_stream(allowed_names), media_type="text/event-stream")
