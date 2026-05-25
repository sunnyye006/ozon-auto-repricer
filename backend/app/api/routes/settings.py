from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models import AppSetting
from app.schemas import RepricingRulesOut, RepricingRulesUpdate, ScanIntervalSettingsOut, ScanIntervalSettingsUpdate
from app.services.app_settings_service import (
    SCAN_INTERVAL_KEY,
    RepricingRules,
    get_repricing_rules,
    get_scan_interval_minutes,
    save_repricing_rules,
)
from app.services.scheduler_service import scheduler_service

router = APIRouter(prefix="/settings", tags=["settings"])

PRESET_OPTIONS = [5, 10, 20]


@router.get("", response_model=ScanIntervalSettingsOut)
async def get_settings(db: AsyncSession = Depends(get_db)) -> ScanIntervalSettingsOut:
    minutes = await get_scan_interval_minutes(db)
    rules = await get_repricing_rules(db)
    return ScanIntervalSettingsOut(
        scan_interval_minutes=minutes,
        preset_options=PRESET_OPTIONS,
        repricing_rules=RepricingRulesOut(
            price_step=rules.price_step,
            cost_buffer=rules.cost_buffer,
            max_round_drop_percent=rules.max_round_drop_percent,
            restore_when_no_competitors=rules.restore_when_no_competitors,
        ),
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
        repricing_rules=RepricingRulesOut(
            price_step=rules.price_step,
            cost_buffer=rules.cost_buffer,
            max_round_drop_percent=rules.max_round_drop_percent,
            restore_when_no_competitors=rules.restore_when_no_competitors,
        ),
    )


@router.put("/repricing-rules", response_model=ScanIntervalSettingsOut)
async def update_repricing_rules(
    payload: RepricingRulesUpdate,
    db: AsyncSession = Depends(get_db),
) -> ScanIntervalSettingsOut:
    rules = RepricingRules(
        price_step=payload.price_step,
        cost_buffer=payload.cost_buffer,
        max_round_drop_percent=payload.max_round_drop_percent,
        restore_when_no_competitors=payload.restore_when_no_competitors,
    )
    await save_repricing_rules(db, rules)
    minutes = await get_scan_interval_minutes(db)
    await db.commit()
    return ScanIntervalSettingsOut(
        scan_interval_minutes=minutes,
        preset_options=PRESET_OPTIONS,
        repricing_rules=RepricingRulesOut(
            price_step=rules.price_step,
            cost_buffer=rules.cost_buffer,
            max_round_drop_percent=rules.max_round_drop_percent,
            restore_when_no_competitors=rules.restore_when_no_competitors,
        ),
    )
