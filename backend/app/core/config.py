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

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
