from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class StoreCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    client_id: str
    api_key: str
    api_base_url: str | None = None


class StoreOut(BaseModel):
    id: int
    name: str
    client_id: str
    api_base_url: str
    is_active: bool

    class Config:
        from_attributes = True


class ProductOut(BaseModel):
    id: int
    store_id: int
    ozon_product_id: str
    sku: str | None
    name: str
    current_price: Decimal
    cost_price: Decimal
    auto_reprice_enabled: bool

    class Config:
        from_attributes = True


class CostUpdateItem(BaseModel):
    product_id: int
    cost_price: Decimal = Field(gt=0)


class DashboardStats(BaseModel):
    total_products: int
    top_price_capture_ratio: float
    repricing_product_count: int
    competitor_count: int


class PriceEventOut(BaseModel):
    platform: str
    store_name: str
    product_name: str
    direction: str
    old_price: Decimal
    new_price: Decimal
    note: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class ScanIntervalSettingsOut(BaseModel):
    scan_interval_minutes: int
    preset_options: list[int]


class ScanIntervalSettingsUpdate(BaseModel):
    minutes: int = Field(gt=0, le=1440)
