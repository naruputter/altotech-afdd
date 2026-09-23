import json
import logging
from aiohttp import web
from typing import List, Any
from devices.base import BaseDeviceSimulator

logger = logging.getLogger("Simulator_Web")


def create_web_app(devices: List[BaseDeviceSimulator], state: Any = None) -> web.Application:
    app = web.Application()

    def get_is_paused() -> bool:
        if state is None:
            return False
        if isinstance(state, dict):
            return state.get("is_paused", False)
        return getattr(state, "is_paused", False)

    def set_is_paused(paused: bool):
        if state is not None:
            if isinstance(state, dict):
                state["is_paused"] = paused
            else:
                setattr(state, "is_paused", paused)

    async def handle_options(request):
        return web.Response(
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            }
        )

    async def handle_status_json(request):
        total_msgs = sum(d.total_messages_sent for d in devices)
        is_paused = get_is_paused()
        device_data = [
            {
                "device_id": d.device_id,
                "device_code": d.device_code,
                "device_type": d.device_type,
                "site_id": d.site_id,
                "topic": d.get_topic(),
                "interval": d.interval,
                "total_messages": d.total_messages_sent,
                "last_published_at": d.last_published_at,
                "last_values": d.last_values,
                "simulate_fault": getattr(d, "simulate_fault", False),
                "is_on": getattr(d, "is_on", True),
            }
            for d in devices
        ]
        return web.json_response({
            "status": "online",
            "is_paused": is_paused,
            "is_streaming": not is_paused,
            "total_devices": len(devices),
            "total_messages_published": total_msgs,
            "devices": device_data
        }, headers={"Access-Control-Allow-Origin": "*"})

    async def handle_toggle_stream(request):
        try:
            current = get_is_paused()
            new_paused = not current
            set_is_paused(new_paused)
            logger.info(f"Simulator streaming state changed: is_paused={new_paused}")
            return web.json_response({
                "success": True,
                "is_paused": new_paused,
                "is_streaming": not new_paused
            }, headers={"Access-Control-Allow-Origin": "*"})
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)}, status=400, headers={"Access-Control-Allow-Origin": "*"})

    async def handle_toggle_fault(request):
        try:
            body = await request.json()
            device_id = body.get("device_id")
            for d in devices:
                if d.device_id == device_id or d.device_code == device_id:
                    if hasattr(d, "simulate_fault"):
                        d.simulate_fault = not d.simulate_fault
                        return web.json_response({"success": True, "device_id": d.device_id, "simulate_fault": d.simulate_fault}, headers={"Access-Control-Allow-Origin": "*"})
            return web.json_response({"success": False, "error": "Device not found or not faultable"}, status=404, headers={"Access-Control-Allow-Origin": "*"})
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)}, status=400, headers={"Access-Control-Allow-Origin": "*"})

    async def handle_index_html(request):
        html_content = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AFDD IoT Fleet Simulator</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #0b1120;
      --border: #1e293b;
      --text: #f8fafc;
      --text-muted: #64748b;
      --primary: #2563eb;
      --accent: #10b981;
      --danger: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { background: var(--bg); color: var(--text); padding: 20px; font-size: 0.85rem; }
    header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 14px; border-bottom: 1px solid var(--border); margin-bottom: 16px; }
    .title-group { display: flex; align-items: center; gap: 10px; }
    .title-group h1 { font-size: 1.1rem; font-weight: 600; color: #fff; }
    .fleet-table-container { background: var(--card-bg); border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
    .table-header { padding: 10px 14px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: #080d1a; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th { background: #080d1a; padding: 8px 12px; color: var(--text-muted); font-weight: 500; font-size: 0.78rem; border-bottom: 1px solid var(--border); }
    td { padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.03); font-size: 0.8rem; }
    tr:hover { background: rgba(255,255,255,0.02); }
    .tag { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 600; }
    .tag-ahu { background: rgba(30,58,138,0.3); color: #93c5fd; border: 1px solid rgba(30,64,175,0.4); }
    .tag-iaq { background: rgba(6,78,59,0.3); color: #6ee7b7; border: 1px solid rgba(6,95,70,0.4); }
    .tag-meter { background: rgba(88,28,135,0.3); color: #d8b4fe; border: 1px solid rgba(107,33,168,0.4); }
    .btn-fault { background: #0f172a; color: #64748b; border: 1px solid var(--border); padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; cursor: pointer; }
    .btn-fault.active { background: rgba(239,68,68,0.2); border-color: #ef4444; color: #f87171; font-weight: 600; }
    .metrics-cell { font-family: monospace; font-size: 0.76rem; color: #94a3b8; }
  </style>
</head>
<body>
  <header>
    <div class="title-group">
      <h1>IoT Simulator Fleet</h1>
      <span style="color: var(--text-muted); font-family: monospace;" id="summary-text">-</span>
    </div>
    <div style="display: flex; align-items: center; gap: 10px;">
      <button id="stream-btn" onclick="toggleStream()" style="background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.4); color: #34d399; padding: 4px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; cursor: pointer;">
        Live Streaming
      </button>
      <div style="font-size: 0.75rem; color: var(--text-muted);" id="refresh-time">Updated: Just now</div>
    </div>
  </header>

  <div class="fleet-table-container">
    <div class="table-header">
      <input type="text" id="search-input" placeholder="Filter by Code, Type or Topic..." style="background: #0f172a; border: 1px solid var(--border); color: #fff; padding: 5px 10px; border-radius: 4px; font-size: 0.8rem; width: 280px; outline: none;">
    </div>
    <table>
      <thead>
        <tr>
          <th>Type</th>
          <th>Device Code</th>
          <th>MQTT Topic</th>
          <th>Rate</th>
          <th>Live Values</th>
          <th style="text-align: right;">Msgs</th>
          <th style="text-align: center;">Fault</th>
        </tr>
      </thead>
      <tbody id="fleet-tbody">
        <tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted);">Loading fleet status...</td></tr>
      </tbody>
    </table>
  </div>

  <script>
    let fleetData = [];

    async function toggleFault(deviceId) {
      try {
        const res = await fetch('/api/fault/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_id: deviceId })
        });
        if (res.ok) {
          fetchStatus();
        }
      } catch (err) {
        console.error(err);
      }
    }

    function renderTable() {
      const filter = document.getElementById('search-input').value.toLowerCase();
      const tbody = document.getElementById('fleet-tbody');
      const filtered = fleetData.filter(d => 
        (d.device_code && d.device_code.toLowerCase().includes(filter)) ||
        (d.device_type && d.device_type.toLowerCase().includes(filter)) ||
        (d.topic && d.topic.toLowerCase().includes(filter))
      );

      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-muted);">No devices match search.</td></tr>';
        return;
      }

      tbody.innerHTML = filtered.map(d => {
        let tagClass = 'tag-ahu';
        if (d.device_type === 'IAQ_Sensor' || d.device_type === 'IAQ') tagClass = 'tag-iaq';
        if (d.device_type === 'Meter') tagClass = 'tag-meter';

        const metricsStr = Object.entries(d.last_values || {})
          .map(([k, v]) => `${k}: <b style="color:#60a5fa;">${v}</b>`)
          .join(' | ') || '<span style="color:#64748b">Pending publish...</span>';

        const isAhu = d.device_type === 'AHU';
        const faultBtn = isAhu ? 
          `<button class="btn-fault ${d.simulate_fault ? 'active' : ''}" onclick="toggleFault('${d.device_id}')">
            ${d.simulate_fault ? '🔥 Fault Active' : '⚡ Normal'}
          </button>` : '<span style="color:#64748b; font-size:0.75rem;">N/A</span>';

        return `
          <tr>
            <td><span class="tag ${tagClass}">${d.device_type}</span></td>
            <td style="font-weight:600; color:#fff;">${d.device_code}</td>
            <td style="font-family:monospace; color:#94a3b8;">${d.topic}</td>
            <td>${d.interval}s</td>
            <td class="metrics-cell">${metricsStr}</td>
            <td style="font-weight:600; color:#38bdf8;">${d.total_messages}</td>
            <td>${faultBtn}</td>
          </tr>
        `;
      }).join('');
    }

    async function toggleStream() {
      try {
        const res = await fetch('/api/stream/toggle', { method: 'POST' });
        if (res.ok) {
          fetchStatus();
        }
      } catch (err) {
        console.error("Failed to toggle stream", err);
      }
    }

    async function fetchStatus() {
      try {
        const res = await fetch('/api/status');
        if (res.ok) {
          const json = await res.json();
          fleetData = json.devices || [];
          document.getElementById('summary-text').innerText = `(${json.total_devices || 0} Devices • ${(json.total_messages_published || 0).toLocaleString()} Sent)`;
          document.getElementById('refresh-time').innerText = 'Updated: ' + new Date().toLocaleTimeString();
          
          const btn = document.getElementById('stream-btn');
          if (btn) {
            if (json.is_paused) {
              btn.innerText = '⏸ Paused (Stopped)';
              btn.style.background = 'rgba(239,68,68,0.15)';
              btn.style.borderColor = 'rgba(239,68,68,0.4)';
              btn.style.color = '#f87171';
            } else {
              btn.innerText = '🟢 Live Streaming';
              btn.style.background = 'rgba(16,185,129,0.15)';
              btn.style.borderColor = 'rgba(16,185,129,0.4)';
              btn.style.color = '#34d399';
            }
          }
          
          renderTable();
        }
      } catch (err) {
        console.error("Failed to fetch simulator status", err);
      }
    }

    document.getElementById('search-input').addEventListener('input', renderTable);
    fetchStatus();
    setInterval(fetchStatus, 3000);
  </script>
</body>
</html>
"""
        return web.Response(text=html_content, content_type="text/html")

    # Routes
    app.router.add_get("/", handle_index_html)
    app.router.add_get("/api/status", handle_status_json)
    app.router.add_post("/api/stream/toggle", handle_toggle_stream)
    app.router.add_post("/api/fault/toggle", handle_toggle_fault)
    app.router.add_route("OPTIONS", "/{tail:.*}", handle_options)

    return app
