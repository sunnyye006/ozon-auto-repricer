from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models import PriceEvent, Product, RepricingState
from app.schemas import DashboardStats, PriceEventOut
from app.services.repricer_runner import repricer_runner

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_stats(db: AsyncSession = Depends(get_db)) -> DashboardStats:
    total_products = await db.scalar(select(func.count(Product.id))) or 0
    repricing_product_count = await db.scalar(
        select(func.count(Product.id)).where(Product.auto_reprice_enabled.is_(True))
    ) or 0
    competitor_count = await db.scalar(
        select(func.coalesce(func.sum(RepricingState.competitor_count), 0))
    ) or 0
    top_price_count = await db.scalar(
        select(func.count(RepricingState.product_id)).where(
            RepricingState.in_round.is_(True),
            RepricingState.floor_reached.is_(False),
        )
    ) or 0
    ratio = float(top_price_count / total_products) if total_products else 0.0

    return DashboardStats(
        total_products=total_products,
        top_price_capture_ratio=ratio,
        repricing_product_count=repricing_product_count,
        competitor_count=competitor_count,
    )


@router.get("/events", response_model=list[PriceEventOut])
async def recent_events(db: AsyncSession = Depends(get_db), limit: int = 100) -> list[PriceEvent]:
    rows = await db.scalars(select(PriceEvent).order_by(PriceEvent.created_at.desc()).limit(limit))
    return rows.all()


@router.post("/scan-now")
async def scan_now() -> dict:
    await repricer_runner.run_once()
    return {"ok": True}
