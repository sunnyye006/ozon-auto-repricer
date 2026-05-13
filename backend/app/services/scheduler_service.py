from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.services.repricer_runner import repricer_runner


class SchedulerService:
    JOB_ID = "ozon-repricer-scan"

    def __init__(self) -> None:
        self.scheduler = AsyncIOScheduler()
        self.current_minutes: int | None = None
        self.started = False

    def start(self, interval_minutes: int) -> None:
        if self.started:
            return
        self.scheduler.add_job(
            repricer_runner.run_once,
            IntervalTrigger(minutes=interval_minutes),
            id=self.JOB_ID,
            replace_existing=True,
        )
        self.current_minutes = interval_minutes
        self.scheduler.start()
        self.started = True

    def update_interval(self, interval_minutes: int) -> None:
        if not self.started:
            self.start(interval_minutes)
            return
        self.scheduler.reschedule_job(self.JOB_ID, trigger=IntervalTrigger(minutes=interval_minutes))
        self.current_minutes = interval_minutes

    def stop(self) -> None:
        if self.started:
            self.scheduler.shutdown(wait=False)
            self.started = False


scheduler_service = SchedulerService()
