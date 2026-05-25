from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import get_db
from app.core.security import decrypt_secret, encrypt_secret
from app.models import Product, Store
from app.schemas import StoreCreate, StoreOut
from app.services.ozon_client import OzonClient

router = APIRouter(prefix="/stores", tags=["stores"])


@router.get("", response_model=list[StoreOut])
async def list_stores(db: AsyncSession = Depends(get_db)) -> list[Store]:
    stores = await db.scalars(select(Store).order_by(Store.id.desc()))
    return stores.all()


@router.post("", response_model=StoreOut)
async def create_store(payload: StoreCreate, db: AsyncSession = Depends(get_db)) -> Store:
    existed = await db.scalar(select(Store).where(Store.name == payload.name))
    if existed:
        raise HTTPException(status_code=409, detail="Store name already exists.")

    store = Store(
        name=payload.name,
        client_id=payload.client_id,
        api_key_encrypted=encrypt_secret(payload.api_key),
        api_base_url=payload.api_base_url or settings.ozon_api_base_url,
        is_active=True,
    )
    db.add(store)
    await db.commit()
    await db.refresh(store)
    return store


@router.post("/{store_id}/sync-products")
async def sync_store_products(store_id: int, db: AsyncSession = Depends(get_db)) -> dict:
    store = await db.get(Store, store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found.")

    client = OzonClient(
        api_base_url=store.api_base_url,
        client_id=store.client_id,
        api_key=decrypt_secret(store.api_key_encrypted),
    )
    ozon_products = await client.list_products()
    synced = 0

    for item in ozon_products:
        product_id = str(item.get("product_id") or item.get("id"))
        if not product_id:
            continue
        name = item.get("name") or f"Ozon Product {product_id}"
        current_price = Decimal(str(item.get("price") or "0"))
        if current_price <= 0:
            continue
        net_price_raw = item.get("net_price")
        cost_price = Decimal(str(net_price_raw)) if net_price_raw not in (None, "", "0") else current_price

        product = await db.scalar(
            select(Product).where(Product.store_id == store.id, Product.ozon_product_id == product_id)
        )
        if product:
            product.name = name
            product.current_price = current_price
            product.sku = item.get("offer_id") or product.sku
            if net_price_raw not in (None, "", "0"):
                product.cost_price = cost_price
        else:
            db.add(
                Product(
                    store_id=store.id,
                    ozon_product_id=product_id,
                    sku=item.get("offer_id"),
                    name=name,
                    current_price=current_price,
                    cost_price=cost_price,
                    auto_reprice_enabled=True,
                )
            )
        synced += 1

    await db.commit()
    return {"store_id": store_id, "synced": synced}
