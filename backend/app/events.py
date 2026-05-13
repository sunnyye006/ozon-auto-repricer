import asyncio
import json
from collections.abc import AsyncGenerator


class EventBus:
    def __init__(self) -> None:
        self._subscribers: list[asyncio.Queue[str]] = []

    async def publish(self, payload: dict) -> None:
        message = f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
        for queue in list(self._subscribers):
            await queue.put(message)

    async def stream(self) -> AsyncGenerator[str, None]:
        queue: asyncio.Queue[str] = asyncio.Queue()
        self._subscribers.append(queue)
        try:
            while True:
                yield await queue.get()
        finally:
            self._subscribers.remove(queue)


event_bus = EventBus()
