import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Zap,
  Wind,
  Thermometer,
  AlertOctagon,
  Gauge,
  Loader2,
  ShieldAlert,
  Activity,
  Eye,
  CheckCircle2,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { ontologyService, issueService, telemetryService } from '../services/index.ts';
import { Entity, Issue } from '../types/index.ts';
import { useWebSocket } from '../context/WebSocketContext.tsx';
import IssueInformationModal from './issues/IssueInformation.tsx';

interface TelemetryPageProps {
  currentSite: string;
  onSelectIssueForAI?: (issue: Issue) => void;
}

export default function TelemetryPage({ currentSite, onSelectIssueForAI }: TelemetryPageProps) {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [deviceStatuses, setDeviceStatuses] = useState<Map<string, { lastSeen: Date; isOnline: boolean }>>(new Map());
  const [liveMetrics, setLiveMetrics] = useState<Map<string, Record<string, number>>>(new Map());
  const [loading, setLoading] = useState<boolean>(true);
  const [, setIsRefreshing] = useState<boolean>(false);
  const [, setLastUpdated] = useState<Date>(new Date());

  // Modal State for inspecting issue
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const { subscribe } = useWebSocket();

  // 1. Initial Snapshot Data Hydration via REST API
  const hydrateSnapshot = useCallback(async () => {
    if (!currentSite) return;
    setIsRefreshing(true);
    try {
      const [entitiesRes, issuesRes, recentTelemetry] = await Promise.all([
        ontologyService.getEntities(currentSite).catch(() => []),
        issueService.getIssuesPaginated({ site_id: currentSite, limit: 100 }).catch(() => ({ items: [], total: 0 })),
        telemetryService.getHistory({ site_id: currentSite, limit: 1000 }).catch(() => [])
      ]);

      setEntities(entitiesRes);
      const activeIssues = (issuesRes.items || []).filter(i => i.status === 'OPEN' || i.status === 'ACKNOWLEDGED');
      setIssues(activeIssues);

      const metricMap = new Map<string, Record<string, number>>();
      const statusMap = new Map<string, { lastSeen: Date; isOnline: boolean }>();
      const now = Date.now();

      recentTelemetry.forEach(pt => {
        const entId = pt.entity_id;
        if (!metricMap.has(entId)) {
          metricMap.set(entId, {});
        }
        const currentVals = metricMap.get(entId)!;
        if (currentVals[pt.metric_name] === undefined) {
          currentVals[pt.metric_name] = pt.val;
        }

        const ptTime = new Date(pt.timestamp).getTime();
        const isOnline = (now - ptTime) < 180000;
        if (!statusMap.has(entId) || statusMap.get(entId)!.lastSeen.getTime() < ptTime) {
          statusMap.set(entId, { lastSeen: new Date(pt.timestamp), isOnline });
        }
      });

      setLiveMetrics(metricMap);
      setDeviceStatuses(statusMap);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to hydrate home dashboard data:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [currentSite]);

  useEffect(() => {
    setLoading(true);
    hydrateSnapshot();
  }, [hydrateSnapshot]);

  // 2. Real-Time Incremental Updates via WebSocket
  useEffect(() => {
    const unsubTelemetry = subscribe('telemetry.new', (event) => {
      const data = event.data;
      if (!data || !data.entity_id || !data.metric_name) return;

      setLiveMetrics(prev => {
        const next = new Map(prev);
        const entityMetrics = { ...(next.get(data.entity_id) || {}) };
        entityMetrics[data.metric_name] = Number(data.val);
        next.set(data.entity_id, entityMetrics);
        return next;
      });

      setDeviceStatuses(prev => {
        const next = new Map(prev);
        next.set(data.entity_id, {
          lastSeen: new Date(data.timestamp || new Date()),
          isOnline: true
        });
        return next;
      });

      setLastUpdated(new Date());
    });

    const unsubIssueCreated = subscribe('issue.created', (event) => {
      const newIssue = event.data as Issue;
      if (newIssue && (!currentSite || event.site_id === currentSite || currentSite === 'all')) {
        setIssues(prev => {
          if (prev.some(i => i.id === newIssue.id)) {
            return prev.map(i => i.id === newIssue.id ? newIssue : i);
          }
          return [newIssue, ...prev];
        });
      }
    });

    const unsubIssueResolved = subscribe('issue.resolved', (event) => {
      const { id } = event.data || {};
      if (id) {
        setIssues(prev => prev.filter(i => i.id !== id));
      }
    });

    const unsubDeviceStatus = subscribe('device.status', (event) => {
      const data = event.data;
      if (data && data.entity_id) {
        setDeviceStatuses(prev => {
          const next = new Map(prev);
          next.set(data.entity_id, {
            lastSeen: new Date(data.last_seen || new Date()),
            isOnline: data.status === 'ONLINE'
          });
          return next;
        });
      }
    });

    return () => {
      unsubTelemetry();
      unsubIssueCreated();
      unsubIssueResolved();
      unsubDeviceStatus();
    };
  }, [subscribe, currentSite]);

  const isAhu = (e: Entity) => e.entity_type?.toUpperCase() === 'AHU';
  const isMeter = (e: Entity) => e.entity_type?.toUpperCase() === 'METER';
  const isIaq = (e: Entity) => e.entity_type?.toUpperCase() === 'IAQ_SENSOR';

  const ahus = useMemo(() => entities.filter(isAhu), [entities]);
  const meters = useMemo(() => entities.filter(isMeter), [entities]);
  const iaqs = useMemo(() => entities.filter(isIaq), [entities]);
  const totalEquipments = useMemo(() => ahus.length + meters.length + iaqs.length, [ahus, meters, iaqs]);

  const faultyEntityIds = useMemo(() => {
    const set = new Set<string>();
    issues.forEach(i => set.add(i.entity_id));
    return set;
  }, [issues]);

  const entityMap = useMemo(() => {
    const map = new Map<string, Entity>();
    entities.forEach(e => map.set(e.id, e));
    return map;
  }, [entities]);

  const totalPowerDemandKw = useMemo(() => {
    let total = 0;
    meters.forEach(m => {
      const vals = liveMetrics.get(m.id);
      if (vals && typeof vals['active_power_kw'] === 'number') {
        total += vals['active_power_kw'];
      }
    });
    return total > 0 ? total.toFixed(1) : '—';
  }, [meters, liveMetrics]);

  const totalDailyEnergyKwh = useMemo(() => {
    let total = 0;
    meters.forEach(m => {
      const vals = liveMetrics.get(m.id);
      if (vals && typeof vals['total_energy_kwh'] === 'number') {
        total += vals['total_energy_kwh'];
      }
    });
    return total > 0 ? (total % 10000).toFixed(1) : '—';
  }, [meters, liveMetrics]);

  const averageCo2Ppm = useMemo(() => {
    let total = 0;
    let count = 0;
    iaqs.forEach(s => {
      const vals = liveMetrics.get(s.id);
      if (vals && typeof vals['co2_ppm'] === 'number') {
        total += vals['co2_ppm'];
        count++;
      }
    });
    return count > 0 ? Math.round(total / count) : 0;
  }, [iaqs, liveMetrics]);

  const criticalIssuesCount = useMemo(() => issues.filter(i => i.severity === 'CRITICAL').length, [issues]);
  const highIssuesCount = useMemo(() => issues.filter(i => i.severity === 'HIGH').length, [issues]);

  const handleInspect = (issue: Issue) => {
    setSelectedIssue(issue);
    setIsModalOpen(true);
  };

  const handleAcknowledge = async (issueId: string) => {
    try {
      await issueService.updateIssueStatus(issueId, 'ACKNOWLEDGED');
      setIssues(prev => prev.map(i => i.id === issueId ? { ...i, status: 'ACKNOWLEDGED' as const } : i));
      if (selectedIssue?.id === issueId) {
        setSelectedIssue(prev => prev ? { ...prev, status: 'ACKNOWLEDGED' } : null);
      }
    } catch (err: any) {
      alert(`Failed to acknowledge issue: ${err.message}`);
    }
  };

  const onlineDevicesCount = useMemo(() => {
    let count = 0;
    entities.forEach(e => {
      const st = deviceStatuses.get(e.id);
      if (st ? st.isOnline : true) count++;
    });
    return count;
  }, [entities, deviceStatuses]);

  const ahuAnalytics = useMemo(() => {
    let nominalCount = 0;
    let devCount = 0;
    let totalDelta = 0;
    ahus.forEach(a => {
      const vals = liveMetrics.get(a.id) || {};
      const sat = vals['supply_air_temperature_c'];
      const setpoint = vals['supply_air_temperature_setpoint_c'] || 22.0;
      if (typeof sat === 'number') {
        const delta = Math.abs(sat - setpoint);
        totalDelta += delta;
        if (delta > 3.0) devCount++;
        else nominalCount++;
      } else {
        nominalCount++;
      }
    });
    const avgDelta = ahus.length > 0 ? (totalDelta / ahus.length).toFixed(2) : '0.00';
    return { nominalCount, devCount, avgDelta };
  }, [ahus, liveMetrics]);

  const iaqDistribution = useMemo(() => {
    let good = 0;
    let poor = 0;
    iaqs.forEach(s => {
      const vals = liveMetrics.get(s.id) || {};
      const co2 = vals['co2_ppm'];
      if (typeof co2 === 'number') {
        if (co2 > 1000) poor++;
        else good++;
      } else {
        good++;
      }
    });
    return { good, poor };
  }, [iaqs, liveMetrics]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '16px' }}>
        <Loader2 size={36} className="spin" style={{ color: '#3b82f6' }} />
        <p style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 500 }}>Loading Real-Time Command Center...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', minHeight: 0, padding: '4px' }}>

      {/* 1. Top Metric KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', flexShrink: 0 }}>

        {/* Active Faults Card */}
        <div style={kpiCardStyle(issues.length > 0 ? '#fef2f2' : '#f0fdf4', issues.length > 0 ? '#fecaca' : '#bbf7d0')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={kpiLabelStyle}>Active Fault Incidents</p>
              <h3 style={{ fontSize: '1.6rem', fontWeight: '800', marginTop: '4px', color: issues.length > 0 ? '#dc2626' : '#16a34a', lineHeight: 1 }}>
                {issues.length} <span style={{ fontSize: '0.7rem', fontWeight: '600', color: '#64748b' }}>OPEN</span>
              </h3>
            </div>
            <div style={kpiIconWrapper(issues.length > 0 ? '#fee2e2' : '#dcfce7', issues.length > 0 ? '#dc2626' : '#16a34a')}>
              <AlertOctagon size={20} />
            </div>
          </div>
          <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {criticalIssuesCount > 0 && (
              <span style={badgeStyle('#fee2e2', '#991b1b')}>🔥 {criticalIssuesCount} CRITICAL</span>
            )}
            {highIssuesCount > 0 && (
              <span style={badgeStyle('#ffedd5', '#9a3412')}>⚠️ {highIssuesCount} HIGH</span>
            )}
            {issues.length === 0 && (
              <span style={badgeStyle('#dcfce7', '#166534')}>✨ ALL NORMAL</span>
            )}
          </div>
        </div>

        {/* Real-time Total Power Load */}
        <div style={kpiCardStyle('#ffffff', '#e2e8f0')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={kpiLabelStyle}>Total Power Demand</p>
              <h3 style={{ fontSize: '1.6rem', fontWeight: '800', marginTop: '4px', color: '#0f172a', lineHeight: 1 }}>
                {totalPowerDemandKw} <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>kW</span>
              </h3>
            </div>
            <div style={kpiIconWrapper('#fef3c7', '#d97706')}>
              <Zap size={20} />
            </div>
          </div>
          <p style={{ marginTop: '12px', fontSize: '0.72rem', color: '#64748b', margin: '12px 0 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>{meters.length}</span> active floor meters reporting
          </p>
        </div>

        {/* Daily Energy Consumption */}
        <div style={kpiCardStyle('#ffffff', '#e2e8f0')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={kpiLabelStyle}>Cumulative Energy Today</p>
              <h3 style={{ fontSize: '1.6rem', fontWeight: '800', marginTop: '4px', color: '#0f172a', lineHeight: 1 }}>
                {totalDailyEnergyKwh} <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>kWh</span>
              </h3>
            </div>
            <div style={kpiIconWrapper('#eff6ff', '#2563eb')}>
              <Gauge size={20} />
            </div>
          </div>
          <p style={{ marginTop: '12px', fontSize: '0.72rem', color: '#ea580c', margin: '12px 0 0 0', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TrendingUp size={12} /> Est. Waste: ~{(issues.length * 24.5).toFixed(1)} kWh/day
          </p>
        </div>

        {/* Indoor Air Quality (IEQ Health Index) */}
        <div style={kpiCardStyle('#ffffff', '#e2e8f0')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={kpiLabelStyle}>Average Indoor CO₂</p>
              <h3 style={{ fontSize: '1.6rem', fontWeight: '800', marginTop: '4px', color: averageCo2Ppm > 1000 ? '#dc2626' : averageCo2Ppm > 800 ? '#d97706' : '#16a34a', lineHeight: 1 }}>
                {averageCo2Ppm || '—'} <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>ppm</span>
              </h3>
            </div>
            <div style={kpiIconWrapper('#ecfdf5', '#059669')}>
              <Thermometer size={20} />
            </div>
          </div>
          <p style={{ marginTop: '12px', fontSize: '0.72rem', color: '#64748b', margin: '12px 0 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Monitoring <span style={{ fontWeight: 700, color: '#0f172a' }}>{iaqs.length}</span> zones
          </p>
        </div>

      </div>

      {/* 2. Main Split View */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) minmax(380px, 1fr)', gap: '16px', flex: 1, minHeight: 0 }}>

        {/* LEFT COLUMN: Operational Summary Widgets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minHeight: 0 }}>

          {/* Widget 1: Equipment Health & Subsystem Status */}
          <div style={cardContainerStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} style={{ color: '#2563eb' }} />
                <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                  Equipment Health & Subsystem Status
                </h3>
              </div>
              <span style={badgeStyle('#eff6ff', '#1d4ed8')}>
                {onlineDevicesCount} / {totalEquipments} Online
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>

              {/* AHU Fleet Status */}
              <div style={subCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={subCardTitleStyle}>AHU FLEET</span>
                  <Wind size={15} style={{ color: '#2563eb' }} />
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
                  {ahus.length} <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '500' }}>Units</span>
                </div>
                <div style={{ marginTop: '6px', fontSize: '0.72rem', display: 'flex', flexDirection: 'column', gap: '3px', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Nominal:</span>
                    <strong style={{ color: '#16a34a' }}>{ahuAnalytics.nominalCount}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Deviations:</span>
                    <strong style={{ color: ahuAnalytics.devCount > 0 ? '#dc2626' : '#0f172a' }}>{ahuAnalytics.devCount}</strong>
                  </div>
                </div>
              </div>

              {/* Power Meters Status */}
              <div style={subCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={subCardTitleStyle}>METERS</span>
                  <Zap size={15} style={{ color: '#d97706' }} />
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
                  {meters.length} <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '500' }}>Units</span>
                </div>
                <div style={{ marginTop: '6px', fontSize: '0.72rem', display: 'flex', flexDirection: 'column', gap: '3px', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Total Demand:</span>
                    <strong style={{ color: '#0f172a' }}>{totalPowerDemandKw} kW</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Spike Alerts:</span>
                    <strong style={{ color: highIssuesCount > 0 ? '#ea580c' : '#16a34a' }}>{highIssuesCount}</strong>
                  </div>
                </div>
              </div>

              {/* IAQ Sensor Quality */}
              <div style={subCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={subCardTitleStyle}>IAQ SENSORS</span>
                  <Thermometer size={15} style={{ color: '#059669' }} />
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
                  {iaqs.length} <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '500' }}>Zones</span>
                </div>
                <div style={{ marginTop: '6px', fontSize: '0.72rem', display: 'flex', flexDirection: 'column', gap: '3px', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Optimal CO₂:</span>
                    <strong style={{ color: '#16a34a' }}>{iaqDistribution.good}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Elevated:</span>
                    <strong style={{ color: iaqDistribution.poor > 0 ? '#dc2626' : '#16a34a' }}>{iaqDistribution.poor}</strong>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Widget 2: Floor Electrical Load Distribution */}
          <div style={{ ...cardContainerStyle, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={18} style={{ color: '#d97706' }} />
                <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                  Floor Electrical Load Distribution
                </h3>
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                Live active demand
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
              {meters.map(meter => {
                const vals = liveMetrics.get(meter.id) || {};
                const kw = vals['active_power_kw'] || 0;
                const kwh = vals['total_energy_kwh'] || 0;
                const isSpike = kw > 30.0;
                const pct = Math.min(100, Math.round((kw / 80) * 100));

                return (
                  <div key={meter.id} style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div>
                        <span style={{ fontWeight: '700', fontSize: '0.8rem', color: '#0f172a' }}>{meter.name}</span>
                        <span className="mono" style={{ fontSize: '0.68rem', color: '#64748b', marginLeft: '6px', background: '#e2e8f0', padding: '1px 4px', borderRadius: '4px' }}>{meter.code}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: '800', fontSize: '0.85rem', color: isSpike ? '#dc2626' : '#0f172a' }}>
                          {kw.toFixed(2)} kW
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#64748b', marginLeft: '6px' }}>
                          ({kwh.toFixed(0)} kWh)
                        </span>
                      </div>
                    </div>
                    <div style={{ width: '100%', height: '6px', borderRadius: '9999px', background: '#e2e8f0', overflow: 'hidden' }}>
                      <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        borderRadius: '9999px',
                        background: isSpike ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : 'linear-gradient(90deg, #3b82f6, #10b981)',
                        transition: 'width 0.4s ease'
                      }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Widget 3: HVAC Thermal Tracking */}
          <div style={cardContainerStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wind size={18} style={{ color: '#2563eb' }} />
                <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                  HVAC Thermal Deviation Overview
                </h3>
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                Avg Deviation: {ahuAnalytics.avgDelta}°C
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              {ahus.map(ahu => {
                const vals = liveMetrics.get(ahu.id) || {};
                const sat = vals['supply_air_temperature_c'];
                const setpoint = vals['supply_air_temperature_setpoint_c'] || 22.0;
                const fan = vals['supply_fan_speed_pct'];
                const valve = vals['chw_valve_command_pct'];
                const isFault = faultyEntityIds.has(ahu.id);

                return (
                  <div key={ahu.id} style={{
                    background: '#f8fafc',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${isFault ? '#fecaca' : '#e2e8f0'}`,
                    borderLeft: `4px solid ${isFault ? '#dc2626' : '#16a34a'}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '700', fontSize: '0.78rem', color: '#0f172a' }}>{ahu.name}</span>
                      <span style={badgeStyle(isFault ? '#fee2e2' : '#dcfce7', isFault ? '#991b1b' : '#166534')}>
                        {isFault ? 'DEV > 3°' : 'OK'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.72rem' }}>
                      <span style={{ color: '#64748b' }}>SAT / SP:</span>
                      <strong style={{ color: isFault ? '#dc2626' : '#0f172a' }}>
                        {sat !== undefined ? `${sat.toFixed(1)}°` : '—'} / {setpoint.toFixed(0)}°
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px', fontSize: '0.72rem' }}>
                      <span style={{ color: '#64748b' }}>Fan / CHW:</span>
                      <span style={{ color: '#0f172a', fontWeight: 500 }}>
                        {fan !== undefined ? `${fan.toFixed(0)}%` : '—'} / {valve !== undefined ? `${valve.toFixed(0)}%` : '—'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Real-time Active Issues Feed */}
        <div style={{ ...cardContainerStyle, display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', minHeight: 0 }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18} style={{ color: issues.length > 0 ? '#dc2626' : '#16a34a' }} />
              <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                Live Active Issues
              </h3>
            </div>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '3px 9px',
              borderRadius: '9999px',
              fontSize: '0.7rem',
              fontWeight: '700',
              background: issues.length > 0 ? '#fee2e2' : '#dcfce7',
              color: issues.length > 0 ? '#dc2626' : '#16a34a'
            }}>
              {issues.length} ACTIVE
            </span>
          </div>

          <p style={{ fontSize: '0.72rem', color: '#64748b', margin: 0, flexShrink: 0, lineHeight: 1.4 }}>
            Real-time feed updated via WebSocket as soon as an anomaly is detected.
          </p>

          {issues.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              padding: '24px 16px',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px dashed #cbd5e1',
              textAlign: 'center',
              gap: '10px'
            }}>
              <CheckCircle2 size={32} style={{ color: '#16a34a' }} />
              <div>
                <p style={{ fontSize: '0.85rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                  All Systems Optimal
                </p>
                <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '3px 0 0 0' }}>
                  No active equipment or sensor faults detected on this site.
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
              {issues.map(issue => {
                const targetEnt = entityMap.get(issue.entity_id);
                return (
                  <div
                    key={issue.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      padding: '12px',
                      borderRadius: '8px',
                      background: '#f8fafc',
                      borderLeft: `4px solid ${issue.severity === 'CRITICAL' ? '#dc2626' :
                          issue.severity === 'HIGH' ? '#ea580c' : '#d97706'
                        }`,
                      border: '1px solid #e2e8f0',
                      borderLeftWidth: '4px',
                      flexShrink: 0
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={badgeStyle(
                        issue.severity === 'CRITICAL' ? '#fee2e2' : issue.severity === 'HIGH' ? '#ffedd5' : '#fef3c7',
                        issue.severity === 'CRITICAL' ? '#991b1b' : issue.severity === 'HIGH' ? '#9a3412' : '#92400e'
                      )}>
                        {issue.severity}
                      </span>
                      <span className="mono" style={{ fontSize: '0.68rem', color: '#64748b' }}>
                        {new Date(issue.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>

                    <div>
                      <h4 style={{ fontSize: '0.82rem', fontWeight: '700', color: '#0f172a', margin: 0, lineHeight: '1.3' }}>
                        {issue.title}
                      </h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                        <span className="mono" style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          {targetEnt?.name || issue.entity_id}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.7rem', color: '#d97706', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <AlertTriangle size={12} /> ~{issue.estimated_energy_waste_kwh || 24.5} kWh/day
                      </span>
                      <button
                        onClick={() => handleInspect(issue)}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid #93c5fd',
                          background: '#eff6ff',
                          color: '#2563eb',
                          fontSize: '0.7rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.2s'
                        }}
                      >
                        <Eye size={13} />
                        <span>Inspect</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>

      </div>

      {/* Issue Inspection Modal */}
      {selectedIssue && (
        <IssueInformationModal
          isOpen={isModalOpen}
          issue={selectedIssue}
          entity={entityMap.get(selectedIssue.entity_id)}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedIssue(null);
          }}
          onAcknowledge={handleAcknowledge}
          onSelectIssueForAI={(iss) => {
            setIsModalOpen(false);
            onSelectIssueForAI?.(iss);
          }}
        />
      )}

    </div>
  );
}

// UI Style Constants for Clean Look
const cardContainerStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: '12px',
  padding: '16px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.02), 0 1px 2px -1px rgba(0, 0, 0, 0.02)'
};

const kpiCardStyle = (bg: string, border: string): React.CSSProperties => ({
  background: bg,
  borderRadius: '12px',
  padding: '14px 16px',
  border: `1px solid ${border}`,
  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.01)'
});

const kpiLabelStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  color: '#64748b',
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  margin: 0
};

const kpiIconWrapper = (bg: string, color: string): React.CSSProperties => ({
  padding: '8px',
  borderRadius: '8px',
  background: bg,
  color: color,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
});

const subCardStyle: React.CSSProperties = {
  background: '#f8fafc',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0'
};

const subCardTitleStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: '700',
  color: '#64748b',
  letterSpacing: '0.03em'
};

const badgeStyle = (bg: string, color: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 6px',
  borderRadius: '6px',
  fontSize: '0.65rem',
  fontWeight: '700',
  background: bg,
  color: color
});