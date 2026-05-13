from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import dashboard, events, products, settings, stores
from app.core.config import settings as app_settings
from app.core.db import SessionLocal, engine
from app.models import Base
from app.services.app_settings_service import get_scan_interval_minutes
from app.services.scheduler_service import scheduler_service


@asynccontextmanager
async def lifespan(_: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as db:
        interval_minutes = await get_scan_interval_minutes(db)
    scheduler_service.start(interval_minutes)
    yield
    scheduler_service.stop()


app = FastAPI(title=app_settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stores.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(events.router, prefix="/api")
app.include_router(settings.router, prefix="/api")


@app.get("/healthz")
async def healthz() -> dict:
    return {"ok": True}
