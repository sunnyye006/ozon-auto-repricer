from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models import AppSetting
from app.schemas import (
    AutoSyncIntervalUpdate,
    RepricingRulesOut,
    RepricingRulesUpdate,
    ScanIntervalSettingsOut,
    ScanIntervalSettingsUpdate,
)
from app.services.app_settings_service import (
    PRICE_STEP_PRESETS,
    SCAN_INTERVAL_KEY,
    RepricingRules,
    get_auto_sync_interval_minutes,
    get_repricing_rules,
    get_scan_interval_minutes,
    save_auto_sync_interval_minutes,
    save_repricing_rules,
)
from app.services.scheduler_service import scheduler_service

router = APIRouter(prefix="/settings", tags=["settings"])

PRESET_OPTIONS = [5, 10, 20]
AUTO_SYNC_PRESET_OPTIONS = [30, 60, 120, 240]


def _rules_out(rules: RepricingRules) -> RepricingRulesOut:
    return RepricingRulesOut(
        price_step=rules.price_step,
        price_step_presets=PRICE_STEP_PRESETS,
    )


async def _build_response(db: AsyncSession) -> ScanIntervalSettingsOut:
    scan_minutes = await get_scan_interval_minutes(db)
    auto_sync_minutes = await get_auto_sync_interval_minutes(db)
    rules = await get_repricing_rules(db)
    return ScanIntervalSettingsOut(
        scan_interval_minutes=scan_minutes,
        auto_sync_interval_minutes=auto_sync_minutes,
        preset_options=PRESET_OPTIONS,
        auto_sync_preset_options=AUTO_SYNC_PRESET_OPTIONS,
        repricing_rules=_rules_out(rules),
    )


@router.get("", response_model=ScanIntervalSettingsOut)
async def get_settings(db: AsyncSession = Depends(get_db)) -> ScanIntervalSettingsOut:
    return await _build_response(db)


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
    return await _build_response(db)


@router.put("/auto-sync-interval", response_model=ScanIntervalSettingsOut)
async def update_auto_sync_interval(
    payload: AutoSyncIntervalUpdate,
    db: AsyncSession = Depends(get_db),
) -> ScanIntervalSettingsOut:
    await save_auto_sync_interval_minutes(db, payload.minutes)
    await db.commit()
    return await _build_response(db)


@router.put("/repricing-rules", response_model=ScanIntervalSettingsOut)
async def update_repricing_rules(
    payload: RepricingRulesUpdate,
    db: AsyncSession = Depends(get_db),
) -> ScanIntervalSettingsOut:
    rules = RepricingRules(price_step=payload.price_step)
    await save_repricing_rules(db, rules)
    await db.commit()
    return await _build_response(db)
