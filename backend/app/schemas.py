from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class StoreCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    client_id: str
    api_key: str
    api_base_url: str | None = None


class StoreUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    client_id: str | None = None
    api_key: str | None = None
    api_base_url: str | None = None
    auto_reprice_enabled: bool | None = None
    auto_sync_interval_minutes: int | None = Field(default=None, ge=5, le=1440)
    scan_interval_minutes: int | None = Field(default=None, ge=1, le=1440)


class StoreOut(BaseModel):
    id: int
    name: str
    client_id: str
    api_base_url: str
    is_active: bool
    auto_reprice_enabled: bool
    auto_sync_interval_minutes: int
    scan_interval_minutes: int
    owner_id: int | None = None
    last_synced_at: datetime | None = None
    last_scanned_at: datetime | None = None

    class Config:
        from_attributes = True


class ProductOut(BaseModel):
    id: int
    store_id: int
    ozon_product_id: str
    sku: str | None
    name: str
    image_url: str | None = None
    platform: str = "Ozon"
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


class RepricingRulesOut(BaseModel):
    price_step: Decimal = Field(gt=0)
    price_step_presets: list[Decimal] = Field(default_factory=lambda: [Decimal("0.1"), Decimal("1.0")])


class RepricingRulesUpdate(BaseModel):
    price_step: Decimal = Field(gt=0)


class ScanIntervalSettingsOut(BaseModel):
    scan_interval_minutes: int
    auto_sync_interval_minutes: int
    preset_options: list[int]
    auto_sync_preset_options: list[int]
    repricing_rules: RepricingRulesOut


class ScanIntervalSettingsUpdate(BaseModel):
    minutes: int = Field(gt=0, le=1440)


class AutoSyncIntervalUpdate(BaseModel):
    minutes: int = Field(ge=5, le=1440)


# ---- 鉴权 / 用户 ----
_EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class RegisterIn(BaseModel):
    email: str = Field(pattern=_EMAIL_PATTERN, max_length=255)
    password: str = Field(min_length=6, max_length=128)


class LoginIn(BaseModel):
    email: str = Field(pattern=_EMAIL_PATTERN, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    id: int
    email: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AuthMeOut(BaseModel):
    authenticated: bool
    auth_enabled: bool
    id: int | None = None
    email: str | None = None
    role: str | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class AdminStoreOut(BaseModel):
    id: int
    name: str
    owner_id: int | None = None
    owner_email: str | None = None
    is_active: bool
    auto_reprice_enabled: bool


class AssignStoreIn(BaseModel):
    user_id: int | None = None
