from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decrypt_secret
from app.models import Product, Store
from app.services.ozon_client import OzonClient, OzonApiError


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


async def sync_store_products_stream(
    db: AsyncSession,
    store_id: int,
) -> AsyncGenerator[str, None]:
    store = await db.get(Store, store_id)
    if not store:
        yield _sse({"phase": "error", "message": "店铺不存在"})
        return

    try:
        client = OzonClient(
            api_base_url=store.api_base_url,
            client_id=store.client_id,
            api_key=decrypt_secret(store.api_key_encrypted),
        )

        progress_queue: asyncio.Queue[dict] = asyncio.Queue()

        def capture_progress(phase: str, current: int, total: int, message: str) -> None:
            progress_queue.put_nowait(
                {"phase": phase, "current": current, "total": total, "message": message}
            )

        fetch_task = asyncio.create_task(client.list_products(on_progress=capture_progress))

        while not fetch_task.done() or not progress_queue.empty():
            try:
                event = await asyncio.wait_for(progress_queue.get(), timeout=0.15)
                yield _sse(event)
            except TimeoutError:
                continue

        ozon_products = await fetch_task

        total = len(ozon_products)
        if total == 0:
            yield _sse({"phase": "done", "current": 0, "total": 0, "synced": 0, "message": "未找到可同步商品"})
            return

        synced = 0
        for index, item in enumerate(ozon_products, start=1):
            product_id = str(item.get("product_id") or item.get("id"))
            if not product_id:
                continue
            name = item.get("name") or f"Ozon Product {product_id}"
            net_price_raw = item.get("net_price")
            current_price = Decimal(str(item.get("price") or "0"))
            if current_price <= 0:
                cost_price = Decimal("0.01")
                auto_enabled = False
            else:
                cost_price = (
                    Decimal(str(net_price_raw)) if net_price_raw not in (None, "", "0") else current_price
                )
                auto_enabled = store.auto_reprice_enabled

            product = await db.scalar(
                select(Product).where(Product.store_id == store.id, Product.ozon_product_id == product_id)
            )
            image_url = item.get("image_url")
            if product:
                product.name = name
                product.current_price = current_price
                product.sku = item.get("offer_id") or product.sku
                if image_url:
                    product.image_url = image_url
                if net_price_raw not in (None, "", "0"):
                    product.cost_price = cost_price
                elif current_price <= 0 and product.cost_price <= 0:
                    product.cost_price = cost_price
            else:
                db.add(
                    Product(
                        store_id=store.id,
                        ozon_product_id=product_id,
                        sku=item.get("offer_id"),
                        name=name,
                        image_url=image_url,
                        platform="Ozon",
                        current_price=current_price,
                        cost_price=cost_price,
                        auto_reprice_enabled=auto_enabled,
                    )
                )
            synced += 1
            yield _sse(
                {
                    "phase": "sync",
                    "current": index,
                    "total": total,
                    "synced": synced,
                    "message": f"同步商品 {index}/{total}",
                }
            )

        store.last_synced_at = datetime.now(timezone.utc)
        await db.commit()
        yield _sse(
            {
                "phase": "done",
                "current": total,
                "total": total,
                "synced": synced,
                "message": f"同步完成，共 {synced} 个商品",
            }
        )
    except OzonApiError as exc:
        yield _sse({"phase": "error", "message": str(exc)})
    except Exception as exc:  # noqa: BLE001
        yield _sse({"phase": "error", "message": f"同步失败: {exc}"})
