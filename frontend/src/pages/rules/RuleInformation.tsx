import React, { useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';
import { RuleStatus, IssueSeverity } from '../../types/index.ts';
import { Modal, Button } from '../../components/ui/index.ts';
import { TextInput, SelectInput } from '../../components/input/index.ts';

// Available metric variables per entity type, sourced from simulator device definitions
const ENTITY_METRICS: Record<string, { name: string; unit: string; desc: string }[]> = {
  AHU: [
    { name: 'supply_air_temperature_c',         unit: '°C',      desc: 'Supply air temperature' },
    { name: 'supply_air_temperature_setpoint_c', unit: '°C',      desc: 'Supply air temp setpoint' },
    { name: 'return_air_temperature_c',          unit: '°C',      desc: 'Return air temperature' },
    { name: 'chw_valve_command_pct',             unit: '%',       desc: 'Chilled water valve position' },
    { name: 'chw_valve',                         unit: '%',       desc: 'Chilled water valve (alias)' },
    { name: 'reheat_valve',                      unit: '%',       desc: 'Reheat coil valve position' },
    { name: 'supply_fan_speed_pct',              unit: '%',       desc: 'Supply fan speed' },
    { name: 'run_status',                        unit: 'binary',  desc: '1 = ON, 0 = OFF' },
    { name: 'tolerance',                         unit: 'param',   desc: 'Configurable threshold value' },
  ],
  IAQ_Sensor: [
    { name: 'co2_ppm',              unit: 'ppm',    desc: 'Carbon dioxide concentration' },
    { name: 'temperature_c',        unit: '°C',     desc: 'Room air temperature' },
    { name: 'relative_humidity_pct',unit: '%',      desc: 'Relative humidity' },
    { name: 'pm25_ug_m3',           unit: 'µg/m³', desc: 'Fine particulate matter PM2.5' },
    { name: 'tvoc_ppb',             unit: 'ppb',    desc: 'Total volatile organic compounds' },
    { name: 'tolerance',            unit: 'param',  desc: 'Configurable threshold value' },
  ],
  Meter: [
    { name: 'active_power_kw',   unit: 'kW',   desc: 'Instantaneous active power demand' },
    { name: 'total_energy_kwh',  unit: 'kWh',  desc: 'Cumulative energy consumption' },
    { name: 'tolerance',         unit: 'param', desc: 'Configurable threshold value' },
  ],
  Equipment: [
    { name: 'val',        unit: '-',     desc: 'Generic numeric value' },
    { name: 'tolerance',  unit: 'param', desc: 'Configurable threshold value' },
  ],
};

const SAFE_FUNCTIONS = [
  { name: 'abs()',   desc: 'Absolute value' },
  { name: 'min()',   desc: 'Minimum of values' },
  { name: 'max()',   desc: 'Maximum of values' },
  { name: 'round()', desc: 'Round to nearest integer' },
];

export interface RuleFormData {
  id: string;
  code: string;
  name: string;
  description: string;
  category_preset: 'AHU_TEMP_DEV' | 'IAQ_CO2_HIGH' | 'METER_PEAK_DEMAND' | 'SIMULTANEOUS_HEAT_COOL' | 'CUSTOM';
  entity_type: string;
  property_scope: 'ALL' | 'OFFICE_ONLY' | 'HOTEL_ONLY';
  severity: IssueSeverity;
  status: RuleStatus;
  is_active: boolean;
  condition_expr: string;
  duration_seconds: number;
  tolerance: number;
  require_run_status_on: boolean;
}

interface RuleInformationModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  formData: RuleFormData;
  submitting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onChange: (data: RuleFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const RULE_PRESETS = [
  {
    id: 'AHU_TEMP_DEV',
    label: '🌡️ HVAC: Supply Air Temperature Tracking Error',
    entity_type: 'AHU',
    default_name: 'AHU Supply Air Temperature Deviation Fault',
    default_desc: 'Opens a Critical issue when AHU is ON and supply air temperature deviates from setpoint continuously.',
    condition_expr: 'abs(supply_air_temperature_c - supply_air_temperature_setpoint_c) > tolerance',
    metrics: ['supply_air_temperature_c', 'supply_air_temperature_setpoint_c', 'run_status'],
    default_duration: 900,
    default_tolerance: 3.0,
    default_severity: 'CRITICAL' as IssueSeverity,
    require_run_status_on: true
  },
  {
    id: 'IAQ_CO2_HIGH',
    label: '💨 IAQ: High Indoor CO2 Alert (> 1000 ppm)',
    entity_type: 'IAQ_Sensor',
    default_name: 'High Indoor CO2 Concentration Alert',
    default_desc: 'Triggers when occupied space CO2 exceeds threshold continuously.',
    condition_expr: 'co2_ppm > tolerance',
    metrics: ['co2_ppm'],
    default_duration: 600,
    default_tolerance: 1000.0,
    default_severity: 'MEDIUM' as IssueSeverity,
    require_run_status_on: false
  },
  {
    id: 'METER_PEAK_DEMAND',
    label: '⚡ Energy: Floor Peak Electrical Demand Warning',
    entity_type: 'Meter',
    default_name: 'Floor Electricity Peak Demand Warning',
    default_desc: 'Alerts when active electrical demand exceeds peak threshold kW.',
    condition_expr: 'active_power_kw > tolerance',
    metrics: ['active_power_kw'],
    default_duration: 900,
    default_tolerance: 30.0,
    default_severity: 'HIGH' as IssueSeverity,
    require_run_status_on: false
  },
  {
    id: 'SIMULTANEOUS_HEAT_COOL',
    label: '❄️🔥 HVAC: Simultaneous Heating & Cooling Detection',
    entity_type: 'AHU',
    default_name: 'Simultaneous Heating & Cooling Valve Modulation',
    default_desc: 'Detects simultaneous valve opening of chilled water and reheat coil.',
    condition_expr: 'chw_valve > 50 and reheat_valve > 30',
    metrics: ['chw_valve', 'reheat_valve'],
    default_duration: 1200,
    default_tolerance: 50.0,
    default_severity: 'CRITICAL' as IssueSeverity,
    require_run_status_on: true
  },
  {
    id: 'CUSTOM',
    label: '⚙️ Custom Formula / Advanced Dynamic Rule',
    entity_type: 'AHU',
    default_name: 'Custom Diagnostic Rule',
    default_desc: 'Custom user-defined mathematical expression for telemetry evaluation.',
    condition_expr: 'val > tolerance',
    metrics: ['val'],
    default_duration: 900,
    default_tolerance: 1.0,
    default_severity: 'MEDIUM' as IssueSeverity,
    require_run_status_on: false
  }
];

export default function RuleInformationModal({
  isOpen,
  mode,
  formData,
  submitting,
  errorMessage,
  onClose,
  onChange,
  onSubmit
}: RuleInformationModalProps) {
  const isEdit = mode === 'edit';
  const exprRef = useRef<HTMLInputElement>(null);

  // Insert variable name at cursor position in condition_expr input
  const insertVariable = (varName: string) => {
    const input = exprRef.current;
    if (!input) {
      onChange({ ...formData, condition_expr: formData.condition_expr + varName });
      return;
    }
    const start = input.selectionStart ?? formData.condition_expr.length;
    const end = input.selectionEnd ?? formData.condition_expr.length;
    const newExpr =
      formData.condition_expr.slice(0, start) + varName + formData.condition_expr.slice(end);
    onChange({ ...formData, condition_expr: newExpr });
    // Restore focus and set cursor after inserted text
    requestAnimationFrame(() => {
      input.focus();
      const pos = start + varName.length;
      input.setSelectionRange(pos, pos);
    });
  };

  const handleSelectPreset = (presetId: string) => {
    const preset = RULE_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    onChange({
      ...formData,
      category_preset: preset.id as any,
      entity_type: preset.entity_type,
      name: isEdit ? formData.name : preset.default_name,
      description: isEdit ? formData.description : preset.default_desc,
      condition_expr: preset.condition_expr,
      duration_seconds: preset.default_duration,
      tolerance: preset.default_tolerance,
      severity: isEdit ? formData.severity : preset.default_severity,
      require_run_status_on: preset.require_run_status_on
    });
  };

  const severityOptions = [
    { value: 'CRITICAL', label: 'CRITICAL (Priority 1)' },
    { value: 'HIGH', label: 'HIGH (Priority 2)' },
    { value: 'MEDIUM', label: 'MEDIUM (Priority 3)' },
    { value: 'LOW', label: 'LOW (Info / Advisory)' }
  ];

  const statusOptions = [
    { value: 'APPROVED', label: 'APPROVED (Active Engine Candidate)' },
    { value: 'DRAFT', label: 'DRAFT (Under Review / Testing)' },
    { value: 'REJECTED', label: 'REJECTED (Deactivated)' }
  ];

  const entityTypeOptions = [
    { value: 'AHU', label: 'AHU (Air Handling Unit)' },
    { value: 'IAQ_Sensor', label: 'IAQ_Sensor (Indoor Air Quality)' },
    { value: 'Meter', label: 'Meter (Electricity & Power)' },
    { value: 'Equipment', label: 'General Equipment' }
  ];

  const propertyScopeOptions = [
    { value: 'OFFICE_ONLY', label: 'Office Buildings Only (Buildings A & B - Tenant Areas)' },
    { value: 'HOTEL_ONLY', label: 'Hotel Only (Building C - Guest & Common Spaces)' },
    { value: 'ALL', label: 'All Properties (All Sites A, B, C)' }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit AFDD Diagnostic Rule' : 'Create AFDD Diagnostic Rule'}
      subtitle={isEdit ? `Configuring rule algorithm ${formData.code || formData.id}` : 'Define continuous multi-site thermodynamic fault detection rule'}
      maxWidth="620px"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onSubmit}
            isLoading={submitting}
            leftIcon={<CheckCircle2 size={16} />}
          >
            {isEdit ? 'Save Changes' : 'Create Rule'}
          </Button>
        </>
      }
    >
      {/* Error Alert */}
      {errorMessage && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#dc2626', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <AlertCircle size={16} /> {errorMessage}
        </div>
      )}

      {/* Form Body */}
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        
        {/* 1. Category Template Preset Selector */}
        <div style={{ background: 'var(--bg-subtle)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: '700', marginBottom: '6px', color: 'var(--primary-blue)', textTransform: 'uppercase' }}>
            🎯 1. Rule Category & Template Preset
          </label>
          <select
            value={formData.category_preset}
            onChange={e => handleSelectPreset(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '0.84rem',
              fontWeight: '600',
              border: '1px solid #93c5fd',
              borderRadius: '6px',
              background: '#ffffff',
              color: '#1e293b',
              outline: 'none'
            }}
          >
            {RULE_PRESETS.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* 2. Metadata: Code & Name */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
          <TextInput
            label="Rule Code (ID)"
            required={!isEdit}
            disabled={isEdit}
            value={formData.code || formData.id}
            onChange={e => onChange({ ...formData, code: e.target.value, id: e.target.value })}
            placeholder="e.g. RULE_AHU_TEMP_DEV"
            className="mono"
          />

          <TextInput
            label="Rule Name"
            required
            value={formData.name}
            onChange={e => onChange({ ...formData, name: e.target.value })}
            placeholder="e.g. AHU Supply Air Temperature Deviation"
          />
        </div>

        {/* 3. Description */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '6px', color: 'var(--text-main)' }}>
            Diagnostic Description
          </label>
          <textarea
            rows={2}
            value={formData.description}
            onChange={e => onChange({ ...formData, description: e.target.value })}
            placeholder="Explain fault condition, root cause, and thermodynamic impact..."
            style={{
              width: '100%',
              padding: '9px 12px',
              fontSize: '0.84rem',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              outline: 'none',
              fontFamily: 'inherit',
              resize: 'vertical'
            }}
          />
        </div>

        {/* 4. Target Scope & Property Types */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <SelectInput
            label="Target Equipment (Scope)"
            value={formData.entity_type}
            options={entityTypeOptions}
            onChange={e => onChange({ ...formData, entity_type: e.target.value })}
          />

          <SelectInput
            label="Building Property Filter"
            value={formData.property_scope}
            options={propertyScopeOptions}
            onChange={e => onChange({ ...formData, property_scope: e.target.value as any })}
          />
        </div>

        {/* 5. Severity & Status */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <SelectInput
            label="Severity"
            value={formData.severity}
            options={severityOptions}
            onChange={e => onChange({ ...formData, severity: e.target.value as IssueSeverity })}
          />

          <SelectInput
            label="Review Status"
            value={formData.status}
            options={statusOptions}
            onChange={e => onChange({ ...formData, status: e.target.value as RuleStatus })}
          />
        </div>

        {/* 6. Dynamic Expression & Parameters */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <TextInput
              label="Dynamic Logic Expression (AST Parsed)"
              required
              ref={exprRef}
              value={formData.condition_expr}
              onChange={e => onChange({ ...formData, condition_expr: e.target.value })}
              placeholder="e.g. abs(supply_air_temperature_c - supply_air_temperature_setpoint_c) > tolerance"
              className="mono"
            />

            {/* Variable Hint Panel */}
            {(() => {
              const metrics = ENTITY_METRICS[formData.entity_type] ?? ENTITY_METRICS['Equipment'];
              return (
                <div style={{
                  marginTop: '6px',
                  padding: '10px 12px',
                  background: '#f8faff',
                  border: '1px solid #dbeafe',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '7px', color: '#2563eb', fontWeight: '600' }}>
                    <HelpCircle size={13} />
                    <span>Available Variables for <code style={{ background: '#dbeafe', borderRadius: '3px', padding: '0 4px' }}>{formData.entity_type}</code> — click to insert</span>
                  </div>

                  {/* Metric chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
                    {metrics.map(m => (
                      <button
                        key={m.name}
                        type="button"
                        title={`${m.desc} (${m.unit})`}
                        onClick={() => insertVariable(m.name)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          border: m.unit === 'param'
                            ? '1px solid #a78bfa'
                            : '1px solid #93c5fd',
                          background: m.unit === 'param'
                            ? '#ede9fe'
                            : '#eff6ff',
                          color: m.unit === 'param' ? '#6d28d9' : '#1d4ed8',
                          cursor: 'pointer',
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          transition: 'all 0.1s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.75'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                      >
                        {m.name}
                        <span style={{
                          fontSize: '0.65rem',
                          fontFamily: 'sans-serif',
                          fontWeight: '400',
                          opacity: 0.7,
                        }}>{m.unit}</span>
                      </button>
                    ))}
                  </div>

                  {/* Safe function chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', borderTop: '1px dashed #bfdbfe', paddingTop: '7px' }}>
                    <span style={{ color: '#64748b', fontWeight: '500', alignSelf: 'center', marginRight: '2px' }}>Functions:</span>
                    {SAFE_FUNCTIONS.map(fn => (
                      <button
                        key={fn.name}
                        type="button"
                        title={fn.desc}
                        onClick={() => insertVariable(fn.name.replace('()', '('))}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          border: '1px solid #6ee7b7',
                          background: '#ecfdf5',
                          color: '#065f46',
                          cursor: 'pointer',
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          transition: 'all 0.1s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.75'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                      >
                        {fn.name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <TextInput
              label="Tolerance / Threshold Value"
              type="number"
              step="0.5"
              value={formData.tolerance}
              onChange={e => onChange({ ...formData, tolerance: parseFloat(e.target.value) || 0 })}
            />

            <TextInput
              label="Window Duration (Seconds)"
              type="number"
              step="60"
              value={formData.duration_seconds}
              onChange={e => onChange({ ...formData, duration_seconds: parseInt(e.target.value) || 900 })}
            />
          </div>

          {/* Operating Status Checkbox */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-main)', marginTop: '4px' }}>
            <input
              type="checkbox"
              checked={formData.require_run_status_on}
              onChange={e => onChange({ ...formData, require_run_status_on: e.target.checked })}
              style={{ width: '16px', height: '16px', accentColor: 'var(--primary-blue)' }}
            />
            <span><strong>Require Equipment to be ON</strong> (run_status = 1) continuously during window</span>
          </label>
        </div>

      </form>
    </Modal>
  );
}
