from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import SessionLocal, get_db
from app.core.security import encrypt_secret
from app.models import Product, Store
from app.schemas import StoreCreate, StoreOut, StoreUpdate
from app.services.product_sync_service import sync_store_products_stream

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
        auto_reprice_enabled=True,
    )
    db.add(store)
    await db.commit()
    await db.refresh(store)
    return store


@router.patch("/{store_id}", response_model=StoreOut)
async def update_store(store_id: int, payload: StoreUpdate, db: AsyncSession = Depends(get_db)) -> Store:
    store = await db.get(Store, store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found.")

    if payload.name is not None and payload.name != store.name:
        existed = await db.scalar(select(Store).where(Store.name == payload.name, Store.id != store_id))
        if existed:
            raise HTTPException(status_code=409, detail="Store name already exists.")
        store.name = payload.name

    if payload.client_id is not None:
        store.client_id = payload.client_id
    if payload.api_key:
        store.api_key_encrypted = encrypt_secret(payload.api_key)
    if payload.api_base_url is not None:
        store.api_base_url = payload.api_base_url or settings.ozon_api_base_url
    if payload.auto_reprice_enabled is not None:
        store.auto_reprice_enabled = payload.auto_reprice_enabled
        products = await db.scalars(select(Product).where(Product.store_id == store.id))
        for product in products.all():
            product.auto_reprice_enabled = payload.auto_reprice_enabled
    if payload.auto_sync_interval_minutes is not None:
        store.auto_sync_interval_minutes = payload.auto_sync_interval_minutes
    if payload.scan_interval_minutes is not None:
        store.scan_interval_minutes = payload.scan_interval_minutes

    await db.commit()
    await db.refresh(store)
    return store


@router.post("/{store_id}/sync-products")
async def sync_store_products(store_id: int) -> StreamingResponse:
    async def event_generator():
        async with SessionLocal() as db:
            async for event in sync_store_products_stream(db, store_id):
                yield event

    return StreamingResponse(event_generator(), media_type="text/event-stream")
