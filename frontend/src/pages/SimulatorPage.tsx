import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  RefreshCw, 
  Search, 
  Radio, 
  Flame, 
  Zap, 
  ExternalLink,
  Play,
  Pause
} from 'lucide-react';

interface SimulatedDevice {
  device_id: string;
  device_code: string;
  device_type: string;
  site_id: string;
  topic: string;
  interval: number;
  total_messages: number;
  last_published_at: string | null;
  last_values: Record<string, any>;
  simulate_fault: boolean;
  is_on: boolean;
}

interface SimulatorStatusResponse {
  status: string;
  is_paused?: boolean;
  is_streaming?: boolean;
  total_devices: number;
  total_messages_published: number;
  devices: SimulatedDevice[];
}

export default function SimulatorPage() {
  const [fleet, setFleet] = useState<SimulatedDevice[]>([]);
  const [totalMessages, setTotalMessages] = useState<number>(0);
  const [totalDevices, setTotalDevices] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterText, setFilterText] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [isLiveActive, setIsLiveActive] = useState<boolean>(true);
  const [isTogglingStream, setIsTogglingStream] = useState<boolean>(false);

  const fetchSimulatorStatus = async () => {
    try {
      const res = await fetch('http://localhost:3333/api/status');
      if (res.ok) {
        const data: SimulatorStatusResponse = await res.json();
        setFleet(data.devices || []);
        setTotalMessages(data.total_messages_published || 0);
        setTotalDevices(data.total_devices || 0);
        if (typeof data.is_paused === 'boolean') {
          setIsLiveActive(!data.is_paused);
        }
        setLoading(false);
      }
    } catch (err) {
      console.warn('Simulator fetch error:', err);
    }
  };

  useEffect(() => {
    fetchSimulatorStatus();
  }, []);

  const handleToggleStream = async () => {
    setIsTogglingStream(true);
    try {
      const res = await fetch('http://localhost:3333/api/stream/toggle', {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        setIsLiveActive(!data.is_paused);
        await fetchSimulatorStatus();
      }
    } catch (err) {
      console.error('Failed to toggle stream:', err);
    } finally {
      setIsTogglingStream(false);
    }
  };

  const handleToggleFault = async (deviceId: string) => {
    setTogglingId(deviceId);
    try {
      const res = await fetch('http://localhost:3333/api/fault/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId })
      });
      if (res.ok) {
        await fetchSimulatorStatus();
      }
    } catch (err) {
      console.error('Failed to toggle fault:', err);
    } finally {
      setTogglingId(null);
    }
  };

  const filteredFleet = fleet.filter(dev => {
    const matchesSearch = 
      (dev.device_code && dev.device_code.toLowerCase().includes(filterText.toLowerCase())) ||
      (dev.topic && dev.topic.toLowerCase().includes(filterText.toLowerCase())) ||
      (dev.device_id && dev.device_id.toLowerCase().includes(filterText.toLowerCase()));
    
    const matchesType = typeFilter === 'ALL' || dev.device_type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div style={{
      background: '#090d16',
      minHeight: 'calc(100vh - 120px)',
      margin: '-28px -32px',
      padding: '24px 32px',
      color: '#e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      gap: '18px'
    }}>
      
      {/* Minimal Dark Top Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '16px',
        borderBottom: '1px solid #1e293b'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            background: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#60a5fa',
            border: '1px solid #334155'
          }}>
            <Cpu size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#ffffff', margin: 0 }}>
                IoT Simulator Streams
              </h1>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>
                ({totalDevices} Devices • {totalMessages.toLocaleString()} Sent)
              </span>
            </div>
          </div>
        </div>

        {/* Right Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleToggleStream}
            disabled={isTogglingStream}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: isLiveActive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              border: `1px solid ${isLiveActive ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
              color: isLiveActive ? '#34d399' : '#f87171',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: '600',
              cursor: isTogglingStream ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              opacity: isTogglingStream ? 0.7 : 1
            }}
            title={isLiveActive ? "Click to Pause MQTT Stream" : "Click to Resume Live MQTT Stream"}
          >
            {isLiveActive ? <Radio size={13} className="animate-pulse" /> : <Pause size={13} />}
            {isTogglingStream ? 'Updating...' : isLiveActive ? 'Live Streaming' : 'Paused (MQTT Stopped)'}
          </button>

          <a
            href="http://localhost:3333"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#1e293b',
              color: '#94a3b8',
              border: '1px solid #334155',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              textDecoration: 'none'
            }}
          >
            <ExternalLink size={12} />
            :3333
          </a>
        </div>
      </div>

      {/* Clean Filter Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        {/* Search */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '6px',
          padding: '6px 12px',
          width: '320px'
        }}>
          <Search size={14} color="#64748b" />
          <input
            type="text"
            placeholder="Filter by code or topic..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              fontSize: '0.82rem',
              width: '100%',
              outline: 'none'
            }}
          />
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { id: 'ALL', label: 'All Devices' },
            { id: 'AHU', label: 'AHU (12)' },
            { id: 'IAQ_Sensor', label: 'IAQ (60)' },
            { id: 'Meter', label: 'Meters (12)' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setTypeFilter(tab.id)}
              style={{
                background: typeFilter === tab.id ? '#2563eb' : '#0f172a',
                color: typeFilter === tab.id ? '#ffffff' : '#94a3b8',
                border: `1px solid ${typeFilter === tab.id ? '#3b82f6' : '#1e293b'}`,
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                cursor: 'pointer',
                fontWeight: typeFilter === tab.id ? '600' : '400'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Clean Minimal Dark Table */}
      <div style={{
        background: '#0b1120',
        border: '1px solid #1e293b',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ background: '#080d1a', borderBottom: '1px solid #1e293b', color: '#64748b' }}>
              <th style={{ padding: '10px 14px', fontWeight: '500' }}>Type</th>
              <th style={{ padding: '10px 14px', fontWeight: '500' }}>Device Code</th>
              <th style={{ padding: '10px 14px', fontWeight: '500' }}>MQTT Topic</th>
              <th style={{ padding: '10px 14px', fontWeight: '500' }}>Rate</th>
              <th style={{ padding: '10px 14px', fontWeight: '500' }}>Live Telemetry Values</th>
              <th style={{ padding: '10px 14px', fontWeight: '500', textAlign: 'right' }}>Msgs</th>
              <th style={{ padding: '10px 14px', fontWeight: '500', textAlign: 'center' }}>Fault</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                  <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 6px' }} />
                  Connecting to simulator...
                </td>
              </tr>
            ) : filteredFleet.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: '#475569' }}>
                  No matching devices found.
                </td>
              </tr>
            ) : (
              filteredFleet.map(dev => {
                const isAhu = dev.device_type === 'AHU';
                return (
                  <tr 
                    key={dev.device_id}
                    style={{ 
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                    }}
                  >
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: '600',
                        background: dev.device_type === 'AHU' ? '#1e3a8a30' : dev.device_type === 'Meter' ? '#581c8730' : '#064e3b30',
                        color: dev.device_type === 'AHU' ? '#93c5fd' : dev.device_type === 'Meter' ? '#d8b4fe' : '#6ee7b7',
                        border: `1px solid ${dev.device_type === 'AHU' ? '#1e40af50' : dev.device_type === 'Meter' ? '#6b21a850' : '#065f4650'}`
                      }}>
                        {dev.device_type}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: '600', color: '#f8fafc' }}>
                      {dev.device_code}
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.76rem', color: '#64748b' }}>
                      {dev.topic}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#94a3b8' }}>
                      {dev.interval}s
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.76rem' }}>
                      {Object.keys(dev.last_values || {}).length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {Object.entries(dev.last_values).map(([k, v]) => (
                            <span key={k} style={{ color: '#94a3b8', background: '#0f172a', padding: '1px 5px', borderRadius: '3px', border: '1px solid #1e293b' }}>
                              {k}: <b style={{ color: '#38bdf8' }}>{String(v)}</b>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: '#475569' }}>Streaming...</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '600', color: '#38bdf8' }}>
                      {dev.total_messages.toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <button
                        disabled={togglingId === dev.device_id}
                        onClick={() => handleToggleFault(dev.device_id)}
                        style={{
                          background: dev.simulate_fault ? 'rgba(239,68,68,0.2)' : '#0f172a',
                          color: dev.simulate_fault ? '#f87171' : '#64748b',
                          border: `1px solid ${dev.simulate_fault ? '#ef4444' : '#1e293b'}`,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title={dev.simulate_fault ? 'Click to restore normal operation' : 'Click to inject fault'}
                      >
                        {dev.simulate_fault ? <Flame size={11} /> : <Zap size={11} />}
                        {dev.simulate_fault ? 'Fault' : 'Normal'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}

