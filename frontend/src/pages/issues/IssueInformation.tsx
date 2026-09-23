import React from 'react';
import { 
  Layers, 
  DollarSign, 
  Sparkles, 
  Check, 
  Clock, 
  Activity, 
  Wind, 
  Zap, 
  Thermometer, 
  Cpu, 
  Building2, 
  MapPin, 
  CheckCircle2, 
  AlertTriangle,
  Sliders,
  CheckCircle,
  HelpCircle,
  Hash
} from 'lucide-react';
import { Issue, Entity } from '../../types/index.ts';
import { Modal, Button } from '../../components/ui/index.ts';

interface IssueInformationModalProps {
  isOpen: boolean;
  issue: Issue | null;
  entity?: Entity | null;
  onClose: () => void;
  onAcknowledge: (issueId: string) => void;
  onSelectIssueForAI: (issue: Issue) => void;
}

export default function IssueInformationModal({
  isOpen,
  issue,
  entity,
  onClose,
  onAcknowledge,
  onSelectIssueForAI
}: IssueInformationModalProps) {
  if (!issue) return null;

  const getEntityIcon = (type?: string) => {
    switch (type) {
      case 'AHU': return <Wind size={22} color="#dc2626" />;
      case 'Meter': return <Zap size={22} color="#d97706" />;
      case 'IAQ_Sensor': return <Thermometer size={22} color="#ea580c" />;
      default: return <Cpu size={22} color="var(--primary-blue)" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const sev = severity?.toUpperCase() || 'MEDIUM';
    const config: Record<string, { bg: string; color: string; border: string }> = {
      CRITICAL: { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' },
      HIGH: { bg: '#ffedd5', color: '#c2410c', border: '#fdba74' },
      MEDIUM: { bg: '#fef3c7', color: '#b45309', border: '#fde68a' },
      LOW: { bg: '#dbeafe', color: '#1d4ed8', border: '#bfdbfe' }
    };
    const c = config[sev] || config.MEDIUM;
    return (
      <span style={{
        padding: '4px 10px',
        borderRadius: '9999px',
        fontSize: '0.72rem',
        fontWeight: '800',
        letterSpacing: '0.04em',
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`
      }}>
        {sev} PRIORITY
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const st = status?.toUpperCase() || 'OPEN';
    const config: Record<string, { bg: string; color: string; border: string }> = {
      OPEN: { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' },
      ACKNOWLEDGED: { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' },
      RESOLVED: { bg: '#dcfce7', color: '#15803d', border: '#86efac' }
    };
    const c = config[st] || config.OPEN;
    return (
      <span style={{
        padding: '3px 9px',
        borderRadius: '6px',
        fontSize: '0.72rem',
        fontWeight: '800',
        letterSpacing: '0.04em',
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`
      }}>
        {st}
      </span>
    );
  };

  // Helper to format metric names cleanly
  const formatMetricLabel = (key: string) => {
    const dict: Record<string, string> = {
      supply_air_temperature_c: 'Supply Air Temp (Actual)',
      supply_air_temperature_setpoint_c: 'Supply Air Temp (Setpoint)',
      return_air_temperature_c: 'Return Air Temp',
      chw_valve_command_pct: 'CHW Valve Position',
      chw_valve: 'CHW Valve Position',
      reheat_valve: 'Reheat Valve Position',
      run_status: 'Equipment Run Status',
      co2_ppm: 'CO₂ Concentration',
      temperature_c: 'Room Temperature',
      active_power_kw: 'Active Power Demand',
      total_energy_kwh: 'Total Energy'
    };
    if (dict[key]) return dict[key];
    return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Format metric value with unit
  const formatMetricValue = (key: string, val: any) => {
    if (typeof val === 'number') {
      if (key.includes('temperature') || key.endsWith('_c')) return `${val.toFixed(1)} °C`;
      if (key.includes('pct') || key.includes('valve')) return `${val.toFixed(0)} %`;
      if (key.includes('ppm')) return `${val.toLocaleString()} ppm`;
      if (key.includes('kw')) return `${val.toFixed(1)} kW`;
      if (key === 'run_status') return val >= 0.5 ? 'ON (1)' : 'OFF (0)';
      return `${val}`;
    }
    return String(val);
  };

  // Parse evidence properly
  const rawEvidence = issue.evidence || {};
  const latestMetrics = (rawEvidence.latest_metrics && typeof rawEvidence.latest_metrics === 'object')
    ? rawEvidence.latest_metrics
    : {};
  const parameters = (rawEvidence.parameters && typeof rawEvidence.parameters === 'object')
    ? rawEvidence.parameters
    : {};

  // If latest_metrics is empty, check top-level primitive values (for backward compatibility)
  const legacyReadings: Record<string, any> = {};
  if (Object.keys(latestMetrics).length === 0) {
    Object.entries(rawEvidence).forEach(([k, v]) => {
      if (typeof v === 'number' || typeof v === 'string') {
        if (!['sample_count', 'window_start', 'window_end', 'condition_expr', 'reason', 'recovered_at', 'recovery_reason'].includes(k)) {
          legacyReadings[k] = v;
        }
      }
    });
  }

  const readingsToDisplay = Object.keys(latestMetrics).length > 0 ? latestMetrics : legacyReadings;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {getSeverityBadge(issue.severity)}
          <span style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-main)' }}>
            {issue.title}
          </span>
        </div>
      }
      subtitle={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
          <span className="mono">Incident ID: {issue.code || issue.id}</span>
          <span>•</span>
          <span>Site: <strong style={{ color: 'var(--text-main)' }}>{issue.site_id}</strong></span>
        </div>
      }
      maxWidth="720px"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>

          {issue.status !== 'ACKNOWLEDGED' && issue.status !== 'RESOLVED' && (
            <Button
              variant="secondary"
              onClick={() => onAcknowledge(issue.id)}
              leftIcon={<Check size={14} />}
            >
              Acknowledge Incident
            </Button>
          )}

          {issue.status === 'ACKNOWLEDGED' && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#0369a1', fontWeight: '700', marginRight: 'auto' }}>
              <CheckCircle2 size={16} /> Acknowledged by Engineer
            </span>
          )}

          <Button
            variant="primary"
            onClick={() => {
              onClose();
              onSelectIssueForAI(issue);
            }}
            leftIcon={<Sparkles size={14} />}
          >
            Ask AI Copilot
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* 1. Spotlight Card: Target Equipment & Status */}
        <div style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          border: '1px solid #cbd5e1',
          borderRadius: '10px',
          padding: '16px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '10px',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
              border: '1px solid #e2e8f0',
              flexShrink: 0
            }}>
              {getEntityIcon(entity?.entity_type)}
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: '700' }}>
                Affected Equipment / Sensor
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
                {entity?.name || issue.entity_id}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', fontSize: '0.74rem' }}>
                <span className="mono" style={{ color: 'var(--primary-blue)', fontWeight: '600' }}>ID: {issue.entity_id}</span>
                {entity?.brick_class && (
                  <>
                    <span style={{ color: '#cbd5e1' }}>|</span>
                    <span style={{ color: 'var(--text-muted)' }}>{entity.brick_class}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
            <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700' }}>
              Fault Status
            </span>
            {getStatusBadge(issue.status)}
          </div>
        </div>

        {/* 2. Diagnostic Summary & Root Cause */}
        <div style={{ background: 'var(--bg-subtle)', padding: '14px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={14} color="#d97706" />
            <span>Root Cause & Diagnostic Analysis</span>
          </div>
          <p style={{ fontSize: '0.88rem', lineHeight: '1.55', color: 'var(--text-main)', margin: 0 }}>
            {issue.description || 'No diagnostic explanation provided.'}
          </p>
        </div>

        {/* 3. Real Telemetry Sensor Readings at Fault Time */}
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={14} color="var(--primary-blue)" />
            <span>Telemetry Sensor Readings (Detection Window)</span>
          </div>

          {Object.keys(readingsToDisplay).length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
              {Object.entries(readingsToDisplay).map(([key, val]) => (
                <div key={key} style={{
                  background: '#ffffff',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '600', minHeight: '18px' }}>
                    {formatMetricLabel(key)}
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--primary-blue)', marginTop: '4px' }}>
                    {formatMetricValue(key, val)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px dashed #cbd5e1', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              No telemetry snapshot points logged for this fault.
            </div>
          )}
        </div>

        {/* 4. Downstream Affected Physical Spaces */}
        {issue.affected_rooms && issue.affected_rooms.length > 0 && (
          <div style={{ background: 'rgba(124, 58, 237, 0.04)', border: '1px solid #ddd6fe', padding: '14px 16px', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: '#6d28d9' }}>
              <Layers size={15} />
              <span style={{ fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase' }}>Downstream Impacted Physical Spaces</span>
            </div>
            <p style={{ fontSize: '0.76rem', color: '#5b21b6', marginBottom: '10px', margin: '0 0 10px 0' }}>
              Physical areas or rooms supplied by this faulty unit:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {issue.affected_rooms.map(r => (
                <span key={r} style={{
                  background: '#ffffff',
                  color: '#6d28d9',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  border: '1px solid #c4b5fd',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Building2 size={13} color="#7c3aed" />
                  <span>{r}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 5. Metrics & Timeline Footnote */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div style={{ background: 'var(--bg-subtle)', padding: '12px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'rgba(217, 119, 6, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <DollarSign size={18} color="#d97706" />
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Estimated Energy Waste</div>
              <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#d97706', marginTop: '2px' }}>
                {issue.estimated_energy_waste_kwh ? `${issue.estimated_energy_waste_kwh.toFixed(1)} kWh/day` : '24.5 kWh/day'}
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-subtle)', padding: '12px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'rgba(37, 99, 235, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Clock size={18} color="var(--primary-blue)" />
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>First Detected Time</div>
              <div style={{ fontSize: '0.86rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '2px' }}>
                {new Date(issue.started_at).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

      </div>
    </Modal>
  );
}
