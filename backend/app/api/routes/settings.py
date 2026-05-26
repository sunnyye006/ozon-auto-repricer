from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models import AppSetting
from app.schemas import RepricingRulesOut, RepricingRulesUpdate, ScanIntervalSettingsOut, ScanIntervalSettingsUpdate
from app.services.app_settings_service import (
    PRICE_STEP_PRESETS,
    SCAN_INTERVAL_KEY,
    RepricingRules,
    get_repricing_rules,
    get_scan_interval_minutes,
    save_repricing_rules,
)
from app.services.scheduler_service import scheduler_service

router = APIRouter(prefix="/settings", tags=["settings"])

PRESET_OPTIONS = [5, 10, 20]


def _rules_out(rules: RepricingRules) -> RepricingRulesOut:
    return RepricingRulesOut(
        price_step=rules.price_step,
        price_step_presets=PRICE_STEP_PRESETS,
    )


@router.get("", response_model=ScanIntervalSettingsOut)
async def get_settings(db: AsyncSession = Depends(get_db)) -> ScanIntervalSettingsOut:
    minutes = await get_scan_interval_minutes(db)
    rules = await get_repricing_rules(db)
    return ScanIntervalSettingsOut(
        scan_interval_minutes=minutes,
        preset_options=PRESET_OPTIONS,
        repricing_rules=_rules_out(rules),
    )


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
    rules = await get_repricing_rules(db)
    return ScanIntervalSettingsOut(
        scan_interval_minutes=payload.minutes,
        preset_options=PRESET_OPTIONS,
        repricing_rules=_rules_out(rules),
    )


@router.put("/repricing-rules", response_model=ScanIntervalSettingsOut)
async def update_repricing_rules(
    payload: RepricingRulesUpdate,
    db: AsyncSession = Depends(get_db),
) -> ScanIntervalSettingsOut:
    rules = RepricingRules(price_step=payload.price_step)
    await save_repricing_rules(db, rules)
    minutes = await get_scan_interval_minutes(db)
    await db.commit()
    return ScanIntervalSettingsOut(
        scan_interval_minutes=minutes,
        preset_options=PRESET_OPTIONS,
        repricing_rules=_rules_out(rules),
    )
