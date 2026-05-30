import csv
import io
from decimal import Decimal

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, accessible_store_ids, get_current_user
from app.core.db import get_db
from app.models import Product, Store
from app.schemas import CostUpdateItem, ProductOut

router = APIRouter(prefix="/products", tags=["products"])


def _product_accessible(product: Product | None, store_ids: list[int] | None) -> bool:
    if product is None:
        return False
    if store_ids is None:
        return True
    return product.store_id in store_ids


@router.get("", response_model=list[ProductOut])
async def list_products(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> list[Product]:
    store_ids = await accessible_store_ids(db, user)
    stmt = select(Product).order_by(Product.updated_at.desc())
    if store_ids is not None:
        if not store_ids:
            return []
        stmt = stmt.where(Product.store_id.in_(store_ids))
    products = await db.scalars(stmt)
    return products.all()


@router.put("/costs")
async def update_costs(
    payload: list[CostUpdateItem],
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    store_ids = await accessible_store_ids(db, user)
    updated = 0
    for item in payload:
        product = await db.get(Product, item.product_id)
        if not _product_accessible(product, store_ids):
            continue
        product.cost_price = item.cost_price
        updated += 1
    await db.commit()
    return {"updated": updated}


@router.post("/costs/import")
async def import_costs_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """
    CSV 模板:
    product_id,cost_price
    1001,249.90
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only csv file is supported.")

    store_ids = await accessible_store_ids(db, user)
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8")))
    updated = 0

    for row in reader:
        try:
            product_id = int(row["product_id"])
            cost_price = Decimal(row["cost_price"])
        except (KeyError, ValueError):
            continue

        product = await db.get(Product, product_id)
        if not _product_accessible(product, store_ids):
            continue
        product.cost_price = cost_price
        updated += 1

    await db.commit()
    return {"updated": updated}


@router.put("/{product_id}/toggle")
async def toggle_auto_reprice(
    product_id: int,
    enabled: bool,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    product = await db.get(Product, product_id)
    store_ids = await accessible_store_ids(db, user)
    if not _product_accessible(product, store_ids):
        raise HTTPException(status_code=404, detail="Product not found.")
    product.auto_reprice_enabled = enabled
    await db.commit()
    return {"product_id": product_id, "enabled": enabled}
