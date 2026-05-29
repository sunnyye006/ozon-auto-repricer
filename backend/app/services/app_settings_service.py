import json
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import AppSetting

SCAN_INTERVAL_KEY = "scan_interval_minutes"
AUTO_SYNC_INTERVAL_KEY = "auto_sync_interval_minutes"
REPRICING_RULES_KEY = "repricing_rules_json"

DEFAULT_AUTO_SYNC_INTERVAL_MINUTES = 60

PRICE_STEP_PRESETS = [Decimal("0.1"), Decimal("1.0")]


@dataclass
class RepricingRules:
    """可配置项：跟价时比对手低多少（卢布）。"""

    price_step: Decimal


def default_repricing_rules() -> RepricingRules:
    return RepricingRules(price_step=Decimal(str(settings.price_step)))


async def get_scan_interval_minutes(db: AsyncSession) -> int:
    row = await db.get(AppSetting, SCAN_INTERVAL_KEY)
    if not row:
        return settings.scan_interval_minutes
    try:
        parsed = int(row.value)
        return max(1, min(parsed, 1440))
    except ValueError:
        return settings.scan_interval_minutes


async def get_auto_sync_interval_minutes(db: AsyncSession) -> int:
    row = await db.get(AppSetting, AUTO_SYNC_INTERVAL_KEY)
    if not row:
        return DEFAULT_AUTO_SYNC_INTERVAL_MINUTES
    try:
        parsed = int(row.value)
        return max(5, min(parsed, 1440))
    except ValueError:
        return DEFAULT_AUTO_SYNC_INTERVAL_MINUTES


async def save_auto_sync_interval_minutes(db: AsyncSession, minutes: int) -> int:
    value = max(5, min(int(minutes), 1440))
    row = await db.get(AppSetting, AUTO_SYNC_INTERVAL_KEY)
    if row:
        row.value = str(value)
    else:
        db.add(AppSetting(key=AUTO_SYNC_INTERVAL_KEY, value=str(value)))
    return value


def repricing_rules_to_dict(rules: RepricingRules) -> dict[str, str]:
    return {"price_step": str(rules.price_step)}


def parse_repricing_rules(raw: dict | None) -> RepricingRules:
    defaults = default_repricing_rules()
    if not raw:
        return defaults

    try:
        price_step = Decimal(str(raw.get("price_step", defaults.price_step)))
    except Exception:
        return defaults

    if price_step <= 0:
        price_step = defaults.price_step

    return RepricingRules(price_step=price_step)


async def get_repricing_rules(db: AsyncSession) -> RepricingRules:
    row = await db.get(AppSetting, REPRICING_RULES_KEY)
    if not row:
        return default_repricing_rules()

    try:
        payload = json.loads(row.value)
        if not isinstance(payload, dict):
            return default_repricing_rules()
    except Exception:
        return default_repricing_rules()
    return parse_repricing_rules(payload)


async def save_repricing_rules(db: AsyncSession, rules: RepricingRules) -> None:
    payload = json.dumps(repricing_rules_to_dict(rules), ensure_ascii=True)
    row = await db.get(AppSetting, REPRICING_RULES_KEY)
    if row:
        row.value = payload
    else:
        db.add(AppSetting(key=REPRICING_RULES_KEY, value=payload))
