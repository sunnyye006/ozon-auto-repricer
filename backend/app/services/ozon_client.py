from __future__ import annotations

import asyncio
from decimal import Decimal
from collections.abc import Callable
from typing import Any

import httpx

ProgressCallback = Callable[[str, int, int, str], None]


def _pick_positive_price(*candidates: Any) -> Any:
    for raw in candidates:
        if raw in (None, "", "0", 0):
            continue
        try:
            if Decimal(str(raw)) > 0:
                return raw
        except Exception:  # noqa: BLE001
            continue
    return None


class OzonApiError(Exception):
    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class OzonClient:
    """
    Ozon Seller API 客户端。

    接口路径与分页策略参考 ozon-mcp 的已验证 workflow：
    - ProductAPI_GetProductList
    - ProductAPI_GetProductInfoList
    - ProductAPI_GetProductInfoPrices
    - ProductAPI_ImportPrices
    """

    def __init__(self, api_base_url: str, client_id: str, api_key: str) -> None:
        self.api_base_url = api_base_url.rstrip("/")
        self.headers = {
            "Client-Id": client_id,
            "Api-Key": api_key,
            "Content-Type": "application/json",
        }

    async def _post(self, path: str, payload: dict[str, Any], *, retries: int = 3) -> dict[str, Any]:
        last_error: Exception | None = None
        for attempt in range(retries):
            try:
                async with httpx.AsyncClient(base_url=self.api_base_url, timeout=30.0) as client:
                    response = await client.post(path, headers=self.headers, json=payload)
                    if response.status_code == 429 and attempt < retries - 1:
                        retry_after = float(response.headers.get("Retry-After", "2"))
                        await asyncio.sleep(min(max(retry_after, 1.0), 20.0))
                        continue
                    if response.status_code >= 400:
                        detail = response.text[:500]
                        raise OzonApiError(
                            f"Ozon API {path} failed ({response.status_code}): {detail}",
                            status_code=response.status_code,
                        )
                    if not response.content:
                        return {}
                    return response.json()
            except OzonApiError:
                raise
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                if attempt >= retries - 1:
                    break
                await asyncio.sleep(1.5 * (attempt + 1))
        raise OzonApiError(f"Ozon API request failed for {path}: {last_error}")

    async def list_products(self, on_progress: ProgressCallback | None = None) -> list[dict[str, Any]]:
        def report(phase: str, current: int, total: int, message: str) -> None:
            if on_progress:
                on_progress(phase, current, total, message)

        product_ids: list[int] = []
        offer_by_product: dict[int, str] = {}
        last_id = ""
        report("fetch", 0, 0, "正在拉取商品 ID 列表…")

        while True:
            data = await self._post(
                "/v3/product/list",
                {"filter": {"visibility": "ALL"}, "last_id": last_id, "limit": 1000},
            )
            result = data.get("result", {})
            items = result.get("items", [])
            if not items:
                break

            for item in items:
                product_id = item.get("product_id")
                if product_id is None:
                    continue
                pid = int(product_id)
                product_ids.append(pid)
                offer_id = item.get("offer_id")
                if offer_id:
                    offer_by_product[pid] = str(offer_id)

            last_id = str(result.get("last_id") or "")
            if not last_id:
                break

        if not product_ids:
            return []

        info_by_id: dict[int, dict[str, Any]] = {}
        info_chunks = (len(product_ids) + 999) // 1000
        for chunk_index, i in enumerate(range(0, len(product_ids), 1000), start=1):
            chunk = product_ids[i : i + 1000]
            report("fetch", chunk_index, info_chunks, f"拉取商品详情 {chunk_index}/{info_chunks}…")
            info_data = await self._post("/v3/product/info/list", {"product_id": chunk})
            info_items = info_data.get("items") or info_data.get("result", {}).get("items", [])
            for item in info_items:
                pid = item.get("id") or item.get("product_id")
                if pid is not None:
                    info_by_id[int(pid)] = item

        price_by_id: dict[int, dict[str, Any]] = {}
        price_chunks = max(1, (len(product_ids) + 999) // 1000)
        for chunk_index, i in enumerate(range(0, len(product_ids), 1000), start=1):
            chunk = product_ids[i : i + 1000]
            report("fetch", chunk_index, price_chunks, f"拉取价格 {chunk_index}/{price_chunks}…")
            cursor = ""
            while True:
                price_data = await self._post(
                    "/v5/product/info/prices",
                    {
                        "filter": {"product_id": [str(pid) for pid in chunk], "visibility": "ALL"},
                        "cursor": cursor,
                        "limit": 1000,
                    },
                )
                price_items = price_data.get("result", {}).get("items", [])
                if not price_items:
                    break
                for item in price_items:
                    pid = item.get("product_id")
                    if pid is not None:
                        price_by_id[int(pid)] = item
                cursor = str(price_data.get("result", {}).get("cursor") or "")
                if not cursor:
                    break

        merged: list[dict[str, Any]] = []
        for pid in product_ids:
            info = info_by_id.get(pid, {})
            price_info = price_by_id.get(pid, {})
            price_block = price_info.get("price") if isinstance(price_info.get("price"), dict) else {}
            price_value = _pick_positive_price(
                price_block.get("price"),
                price_block.get("marketing_price"),
                price_block.get("old_price"),
                price_block.get("min_price"),
                price_block.get("retail_price"),
                price_block.get("marketing_seller_price"),
                info.get("price"),
                info.get("marketing_price"),
                info.get("old_price"),
                info.get("min_price"),
            )
            net_price_raw = _pick_positive_price(
                price_block.get("net_price"),
                price_info.get("net_price") if not isinstance(price_info.get("net_price"), dict) else None,
            )
            image_url = None
            primary = info.get("primary_image")
            if isinstance(primary, list):
                image_url = next((str(u) for u in primary if u), None)
            elif isinstance(primary, str):
                image_url = primary
            if not image_url:
                images = info.get("images")
                if isinstance(images, list) and images:
                    first = images[0]
                    image_url = first if isinstance(first, str) else (first.get("file_name") if isinstance(first, dict) else None)
            if not image_url:
                color_image = info.get("color_image")
                if isinstance(color_image, str):
                    image_url = color_image

            merged.append(
                {
                    "product_id": pid,
                    "offer_id": offer_by_product.get(pid) or info.get("offer_id"),
                    "name": info.get("name") or f"Ozon Product {pid}",
                    "image_url": image_url,
                    "price": price_value,
                    "net_price": net_price_raw,
                    "min_price": price_block.get("min_price"),
                }
            )
        return merged

    async def get_competitor_offers(self, ozon_product_id: str) -> list[dict[str, Any]]:
        """
        跟卖竞争价数据源：使用 Ozon 价格指数中的市场参考价。
        ozon-mcp 的 pricing_analysis workflow 表明应优先参考 price_indexes 字段。
        """
        pid = int(ozon_product_id)
        data = await self._post(
            "/v5/product/info/prices",
            {"filter": {"product_id": [pid], "visibility": "ALL"}, "cursor": "", "limit": 1},
        )
        items = data.get("result", {}).get("items", [])
        if not items:
            return []

        item = items[0]
        indexes = item.get("price_indexes") or {}
        candidates: list[Decimal] = []

        for key in ("ozon_index_data", "external_index_data", "self_marketplaces_index_data"):
            block = indexes.get(key) or {}
            minimal_price = block.get("minimal_price")
            if minimal_price is not None:
                candidates.append(Decimal(str(minimal_price)))

        # 去重并转成统一结构
        unique_prices = sorted({price for price in candidates if price > 0})
        return [{"seller_name": "market_index", "price": price} for price in unique_prices]

    async def update_price(
        self,
        ozon_product_id: str,
        new_price: Decimal,
        *,
        offer_id: str | None = None,
    ) -> None:
        entry: dict[str, Any] = {
            "product_id": int(ozon_product_id),
            "price": f"{new_price:.2f}",
            "currency_code": "RUB",
        }
        if offer_id:
            entry["offer_id"] = offer_id
        await self._post("/v1/product/import/prices", {"prices": [entry]})
