import csv
import io
from decimal import Decimal

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models import Product
from app.schemas import CostUpdateItem, ProductOut

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=list[ProductOut])
async def list_products(db: AsyncSession = Depends(get_db)) -> list[Product]:
    products = await db.scalars(select(Product).order_by(Product.updated_at.desc()))
    return products.all()


@router.put("/costs")
async def update_costs(payload: list[CostUpdateItem], db: AsyncSession = Depends(get_db)) -> dict:
    updated = 0
    for item in payload:
        product = await db.get(Product, item.product_id)
        if not product:
            continue
        product.cost_price = item.cost_price
        updated += 1
    await db.commit()
    return {"updated": updated}


@router.post("/costs/import")
async def import_costs_csv(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)) -> dict:
    """
    CSV 模板:
    product_id,cost_price
    1001,249.90
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only csv file is supported.")

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
        if not product:
            continue
        product.cost_price = cost_price
        updated += 1

    await db.commit()
    return {"updated": updated}


@router.put("/{product_id}/toggle")
async def toggle_auto_reprice(product_id: int, enabled: bool, db: AsyncSession = Depends(get_db)) -> dict:
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")
    product.auto_reprice_enabled = enabled
    await db.commit()
    return {"product_id": product_id, "enabled": enabled}
