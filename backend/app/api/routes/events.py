from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.events import event_bus

router = APIRouter(prefix="/events", tags=["events"])


@router.get("/stream")
async def stream_events() -> StreamingResponse:
    return StreamingResponse(event_bus.stream(), media_type="text/event-stream")
