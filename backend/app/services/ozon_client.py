from decimal import Decimal
from typing import Any

import httpx


class OzonClient:
    def __init__(self, api_base_url: str, client_id: str, api_key: str) -> None:
        self.api_base_url = api_base_url.rstrip("/")
        self.headers = {
            "Client-Id": client_id,
            "Api-Key": api_key,
            "Content-Type": "application/json",
        }

    async def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        async with httpx.AsyncClient(base_url=self.api_base_url, timeout=20.0) as client:
            response = await client.post(path, headers=self.headers, json=payload)
            response.raise_for_status()
            return response.json()

    async def list_products(self) -> list[dict[str, Any]]:
        """
        拉取店铺商品。
        注意：不同 Ozon 账号权限及版本下接口字段会有差异，建议按你真实账号返回结构适配。
        """
        data = await self._post("/v3/product/list", {"filter": {}, "last_id": "", "limit": 1000})
        return data.get("result", {}).get("items", [])

    async def get_competitor_offers(self, ozon_product_id: str) -> list[dict[str, Any]]:
        """
        读取同商品链接的卖家报价列表（跟卖识别数据源）。
        这里保持统一返回结构：[{ "seller_name": str, "price": Decimal }, ...]
        """
        data = await self._post("/v1/product/offers", {"product_id": ozon_product_id})
        result = []
        for item in data.get("result", {}).get("offers", []):
            price = item.get("price")
            if price is None:
                continue
            result.append({"seller_name": item.get("seller_name", "unknown"), "price": Decimal(str(price))})
        return result

    async def update_price(self, ozon_product_id: str, new_price: Decimal) -> None:
        payload = {
            "prices": [
                {
                    "product_id": ozon_product_id,
                    "price": f"{new_price:.2f}",
                }
            ]
        }
        await self._post("/v1/product/import/prices", payload)
