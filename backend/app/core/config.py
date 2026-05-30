from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Ozon Auto Repricer"
    app_env: str = "dev"
    app_secret_key: str = "replace-me-in-production"

    # 默认使用本地 SQLite，便于开箱即跑；生产环境可覆盖为 Supabase/Postgres。
    database_url: str = "sqlite+aiosqlite:///./data/ozon_local.db"

    # Ozon 通用 API 主机，实际可按店铺维度覆盖
    ozon_api_base_url: str = "https://api-seller.ozon.ru"
    scan_interval_minutes: int = 10
    price_step: float = 0.1

    # 鉴权 / 多租户。默认关闭，开启前线上行为与单租户完全一致，避免把自己锁在门外。
    auth_enabled: bool = False
    # 该邮箱注册后自动成为超级管理员（可查看所有店铺并分配给其他用户）。
    super_admin_email: str = ""
    jwt_expire_minutes: int = 60 * 24 * 7

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
