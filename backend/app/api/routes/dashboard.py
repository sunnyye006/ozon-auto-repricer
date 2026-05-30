from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, accessible_store_ids, get_current_user, require_admin
from app.core.db import get_db
from app.models import PriceEvent, Product, RepricingState, Store
from app.schemas import DashboardStats, PriceEventOut
from app.services.repricer_runner import repricer_runner

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> DashboardStats:
    store_ids = await accessible_store_ids(db, user)
    if store_ids is not None and not store_ids:
        return DashboardStats(
            total_products=0, top_price_capture_ratio=0.0, repricing_product_count=0, competitor_count=0
        )

    product_filter = [] if store_ids is None else [Product.store_id.in_(store_ids)]

    total_products = await db.scalar(select(func.count(Product.id)).where(*product_filter)) or 0
    repricing_product_count = await db.scalar(
        select(func.count(Product.id)).where(Product.auto_reprice_enabled.is_(True), *product_filter)
    ) or 0
    competitor_count = await db.scalar(
        select(func.coalesce(func.sum(RepricingState.competitor_count), 0))
        .select_from(RepricingState)
        .join(Product, Product.id == RepricingState.product_id)
        .where(*product_filter)
    ) or 0
    top_price_count = await db.scalar(
        select(func.count(RepricingState.product_id))
        .select_from(RepricingState)
        .join(Product, Product.id == RepricingState.product_id)
        .where(
            RepricingState.in_round.is_(True),
            RepricingState.floor_reached.is_(False),
            *product_filter,
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
async def recent_events(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    limit: int = 100,
) -> list[PriceEvent]:
    store_ids = await accessible_store_ids(db, user)
    stmt = select(PriceEvent).order_by(PriceEvent.created_at.desc()).limit(limit)
    if store_ids is not None:
        if not store_ids:
            return []
        names = (await db.scalars(select(Store.name).where(Store.id.in_(store_ids)))).all()
        if not names:
            return []
        stmt = (
            select(PriceEvent)
            .where(PriceEvent.store_name.in_(list(names)))
            .order_by(PriceEvent.created_at.desc())
            .limit(limit)
        )
    rows = await db.scalars(stmt)
    return rows.all()


@router.post("/scan-now")
async def scan_now(_: CurrentUser = Depends(require_admin)) -> dict:
    await repricer_runner.run_once()
    return {"ok": True}
