import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Set, Any, Optional
from fastapi import WebSocket

logger = logging.getLogger("WebSocketManager")


class WebSocketManager:
    """
    Manages active WebSocket connections grouped by site_id and globally.
    Thread-safe and async-compatible.
    """

    def __init__(self):
        # Map site_id -> Set[WebSocket]
        self._site_connections: Dict[str, Set[WebSocket]] = {}
        # Set of all active WebSockets
        self._all_connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, site_id: Optional[str] = None):
        """Accepts and registers a new WebSocket connection."""
        await websocket.accept()
        async with self._lock:
            self._all_connections.add(websocket)
            if site_id:
                if site_id not in self._site_connections:
                    self._site_connections[site_id] = set()
                self._site_connections[site_id].add(websocket)
        logger.info(f"WebSocket connected. site_id={site_id}. Total active: {len(self._all_connections)}")

    async def disconnect(self, websocket: WebSocket, site_id: Optional[str] = None):
        """Removes a WebSocket connection on disconnect."""
        async with self._lock:
            self._all_connections.discard(websocket)
            if site_id and site_id in self._site_connections:
                self._site_connections[site_id].discard(websocket)
                if not self._site_connections[site_id]:
                    del self._site_connections[site_id]
        logger.info(f"WebSocket disconnected. site_id={site_id}. Remaining: {len(self._all_connections)}")

    async def broadcast(self, event_type: str, data: Any, site_id: Optional[str] = None):
        """
        Broadcasts an event to clients subscribed to a specific site_id,
        or to all connected clients if site_id is None or 'all'.
        """
        payload = {
            "event": event_type,
            "site_id": site_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": data,
        }
        text_data = json.dumps(payload, default=str)

        async with self._lock:
            if site_id and site_id != "all":
                # Send to specific site clients + global listeners (site_id=all/None)
                target_clients = set(self._site_connections.get(site_id, set()))
                global_clients = self._site_connections.get("all", set())
                target_clients.update(global_clients)
            else:
                # Send to all connected clients
                target_clients = set(self._all_connections)

        if not target_clients:
            return

        # Broadcast concurrently and clean up disconnected sockets
        disconnected = []
        for ws in target_clients:
            try:
                await ws.send_text(text_data)
            except Exception as e:
                logger.debug(f"Failed to send to WebSocket: {e}")
                disconnected.append(ws)

        if disconnected:
            async with self._lock:
                for ws in disconnected:
                    self._all_connections.discard(ws)
                    for s_id in list(self._site_connections.keys()):
                        self._site_connections[s_id].discard(ws)


# Global singleton instance
ws_manager = WebSocketManager()
