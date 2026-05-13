from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import AppSetting

SCAN_INTERVAL_KEY = "scan_interval_minutes"


async def get_scan_interval_minutes(db: AsyncSession) -> int:
    row = await db.get(AppSetting, SCAN_INTERVAL_KEY)
    if not row:
        return settings.scan_interval_minutes
    try:
        parsed = int(row.value)
        return max(1, min(parsed, 1440))
    except ValueError:
        return settings.scan_interval_minutes
