from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models import AppSetting
from app.schemas import ScanIntervalSettingsOut, ScanIntervalSettingsUpdate
from app.services.app_settings_service import SCAN_INTERVAL_KEY, get_scan_interval_minutes
from app.services.scheduler_service import scheduler_service

router = APIRouter(prefix="/settings", tags=["settings"])

PRESET_OPTIONS = [5, 10, 20]


@router.get("", response_model=ScanIntervalSettingsOut)
async def get_settings(db: AsyncSession = Depends(get_db)) -> ScanIntervalSettingsOut:
    minutes = await get_scan_interval_minutes(db)
    return ScanIntervalSettingsOut(scan_interval_minutes=minutes, preset_options=PRESET_OPTIONS)


@router.put("/scan-interval", response_model=ScanIntervalSettingsOut)
async def update_scan_interval(
    payload: ScanIntervalSettingsUpdate,
    db: AsyncSession = Depends(get_db),
) -> ScanIntervalSettingsOut:
    row = await db.get(AppSetting, SCAN_INTERVAL_KEY)
    if row:
        row.value = str(payload.minutes)
    else:
        db.add(AppSetting(key=SCAN_INTERVAL_KEY, value=str(payload.minutes)))
    await db.commit()

    scheduler_service.update_interval(payload.minutes)
    return ScanIntervalSettingsOut(scan_interval_minutes=payload.minutes, preset_options=PRESET_OPTIONS)
