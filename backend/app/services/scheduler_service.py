from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from app.core.db import SessionLocal
from app.models import PriceEvent, Product, Store

# price_events 保留天数，超过后由后台任务定期清理，防止表无限膨胀
PRICE_EVENT_RETENTION_DAYS = 60
from app.services.app_settings_service import (
    get_auto_sync_interval_minutes,
    get_scan_interval_minutes,
)
from app.services.product_sync_service import sync_store_products_stream
from app.services.repricer_runner import repricer_runner


class SchedulerService:
    """轻量化 tick：每分钟扫描各店状态，符合条件即派发独立后台任务。"""

    JOB_ID = "ozon-per-store-tick"
    CLEANUP_JOB_ID = "ozon-price-events-cleanup"

    def __init__(self) -> None:
        self.scheduler = AsyncIOScheduler()
        self.started = False
        self._scan_locks: dict[int, asyncio.Lock] = {}
        self._sync_locks: dict[int, asyncio.Lock] = {}

    def start(self, _interval_minutes: int | None = None) -> None:
        if self.started:
            return
        self.scheduler.add_job(
            self.tick,
            IntervalTrigger(minutes=1),
            id=self.JOB_ID,
            replace_existing=True,
            coalesce=True,
            max_instances=1,
        )
        self.scheduler.add_job(
            self.cleanup_price_events,
            IntervalTrigger(hours=6),
            id=self.CLEANUP_JOB_ID,
            replace_existing=True,
            coalesce=True,
            max_instances=1,
        )
        self.scheduler.start()
        self.started = True

    async def cleanup_price_events(self) -> None:
        cutoff = datetime.now(timezone.utc) - timedelta(days=PRICE_EVENT_RETENTION_DAYS)
        async with SessionLocal() as db:
            try:
                await db.execute(delete(PriceEvent).where(PriceEvent.created_at < cutoff))
                await db.commit()
            except Exception:  # noqa: BLE001
                await db.rollback()

    def update_interval(self, _interval_minutes: int) -> None:
        if not self.started:
            self.start()

    def stop(self) -> None:
        if self.started:
            self.scheduler.shutdown(wait=False)
            self.started = False

    @staticmethod
    def _due(last: datetime | None, interval_minutes: int, now: datetime) -> bool:
        if interval_minutes <= 0:
            return False
        if last is None:
            return True
        return (now - last).total_seconds() >= interval_minutes * 60

    def _scan_lock(self, store_id: int) -> asyncio.Lock:
        lock = self._scan_locks.get(store_id)
        if lock is None:
            lock = asyncio.Lock()
            self._scan_locks[store_id] = lock
        return lock

    def _sync_lock(self, store_id: int) -> asyncio.Lock:
        lock = self._sync_locks.get(store_id)
        if lock is None:
            lock = asyncio.Lock()
            self._sync_locks[store_id] = lock
        return lock

    async def _run_repricer(self, store_id: int) -> None:
        lock = self._scan_lock(store_id)
        if lock.locked():
            return
        async with lock:
            async with SessionLocal() as db:
                store = await db.scalar(
                    select(Store)
                    .where(Store.id == store_id)
                    .options(selectinload(Store.products).selectinload(Product.state))
                )
                if not store or not store.auto_reprice_enabled or not store.is_active:
                    return
                try:
                    await repricer_runner.run_for_store(db, store)
                    await db.commit()
                except Exception:  # noqa: BLE001
                    await db.rollback()

    async def _run_sync(self, store_id: int) -> None:
        lock = self._sync_lock(store_id)
        if lock.locked():
            return
        async with lock:
            async with SessionLocal() as db:
                try:
                    async for _ in sync_store_products_stream(db, store_id):
                        pass
                except Exception:  # noqa: BLE001
                    pass

    async def tick(self) -> None:
        now = datetime.now(timezone.utc)
        async with SessionLocal() as db:
            scan_interval = await get_scan_interval_minutes(db)
            auto_sync_interval = await get_auto_sync_interval_minutes(db)
            stores = (
                await db.scalars(select(Store).where(Store.is_active.is_(True)))
            ).all()
            due_repricer: list[int] = []
            due_sync: list[int] = []
            for store in stores:
                if store.auto_reprice_enabled and self._due(
                    store.last_scanned_at, scan_interval, now
                ):
                    due_repricer.append(store.id)
                if self._due(store.last_synced_at, auto_sync_interval, now):
                    due_sync.append(store.id)

        loop = asyncio.get_running_loop()
        for store_id in due_repricer:
            loop.create_task(self._run_repricer(store_id))
        for store_id in due_sync:
            loop.create_task(self._run_sync(store_id))


scheduler_service = SchedulerService()
