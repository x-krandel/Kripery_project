import asyncio
import logging
from collections import defaultdict

from fastapi import WebSocket

log = logging.getLogger(__name__)

SEND_TIMEOUT_SECONDS = 5


class WsHub:
    """auction_id -> subscribed sockets. Lives in process memory: run a single worker."""

    def __init__(self) -> None:
        # Each socket has its own lock so a broadcast cannot overtake the
        # initial snapshot or interleave with another send on the same socket.
        self._subs: dict[int, dict[WebSocket, asyncio.Lock]] = defaultdict(dict)

    def subscribe(self, auction_id: int, ws: WebSocket) -> asyncio.Lock:
        lock = asyncio.Lock()
        self._subs[auction_id][ws] = lock
        return lock

    def unsubscribe(self, auction_id: int, ws: WebSocket) -> None:
        subs = self._subs.get(auction_id)
        if subs is None:
            return
        subs.pop(ws, None)
        if not subs:
            del self._subs[auction_id]

    async def broadcast(self, auction_id: int, message: dict) -> None:
        subs = list(self._subs.get(auction_id, {}).items())
        results = await asyncio.gather(*(self._send(ws, lock, message) for ws, lock in subs))
        for (ws, _), ok in zip(subs, results):
            if not ok:
                self.unsubscribe(auction_id, ws)

    @staticmethod
    async def _send(ws: WebSocket, lock: asyncio.Lock, message: dict) -> bool:
        try:
            async with lock:
                await asyncio.wait_for(ws.send_json(message), SEND_TIMEOUT_SECONDS)
            return True
        except Exception:
            log.debug("dropping dead websocket", exc_info=True)
            return False


hub = WsHub()
