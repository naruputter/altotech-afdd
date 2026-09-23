import asyncio
import logging
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from src.services.ws_manager import ws_manager

router = APIRouter()
logger = logging.getLogger("WebSocketEndpoint")


@router.websocket("/ws")
@router.websocket("/ws/{site_id}")
async def websocket_endpoint(websocket: WebSocket, site_id: Optional[str] = None):
    """
    WebSocket endpoint for real-time updates (telemetry, issues, equipment status).
    Clients can optionally specify a `site_id` path parameter to subscribe to a specific site.
    """
    await ws_manager.connect(websocket, site_id=site_id)
    try:
        while True:
            # Keep connection alive, listen for ping or client messages
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket, site_id=site_id)
    except Exception as e:
        logger.warning(f"WebSocket error on site {site_id}: {e}")
        await ws_manager.disconnect(websocket, site_id=site_id)
