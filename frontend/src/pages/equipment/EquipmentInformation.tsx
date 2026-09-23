import React, { useMemo, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Wind, Zap, Activity, Cpu } from 'lucide-react';
import { Entity, EntityType } from '../../types/index.ts';
import { Modal, Button } from '../../components/ui/index.ts';
import { TextInput, SelectInput } from '../../components/input/index.ts';

interface EquipmentInformationModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  formData: {
    id: string;
    code?: string;
    name: string;
    entity_type: EntityType;
    brick_class: string;
    target_id?: string;
  };
  entities?: Entity[];
  submitting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onChange: (data: any) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function EquipmentInformationModal({
  isOpen,
  mode,
  formData,
  entities = [],
  submitting,
  errorMessage,
  onClose,
  onChange,
  onSubmit
}: EquipmentInformationModalProps) {
  const isEdit = mode === 'edit';

  const typeOptions = [
    { value: 'AHU', label: 'Air Handler (AHU)' },
    { value: 'Meter', label: 'Power Meter' },
    { value: 'IAQ_Sensor', label: 'IAQ Sensor' },
    { value: 'Equipment', label: 'Other Equipment / Asset' }
  ];

  // Dynamic target relationship options based on entity_type
  const targetOptions = useMemo(() => {
    const defaultOption = { value: '', label: '-- None / Unassigned --' };

    switch (formData.entity_type) {
      case 'AHU': {
        // AHU feeds HVAC Zones or Floors
        const validSpaces = entities.filter(
          e => e.entity_type === 'HVAC_Zone' || e.entity_type === 'Floor'
        );
        return [
          defaultOption,
          ...validSpaces.map(s => ({
            value: s.id,
            label: `${s.name} (${s.entity_type === 'HVAC_Zone' ? 'Zone' : 'Floor'})`
          }))
        ];
      }
      case 'IAQ_Sensor': {
        // IAQ Sensors monitor Rooms or HVAC Zones or Floors
        const validSpaces = entities.filter(
          e => e.entity_type === 'Room' || e.entity_type === 'HVAC_Zone' || e.entity_type === 'Floor'
        );
        return [
          defaultOption,
          ...validSpaces.map(s => ({
            value: s.id,
            label: `${s.name} (${s.entity_type})`
          }))
        ];
      }
      case 'Meter': {
        // Power Meters measure AHUs, Buildings, Floors, or Zones
        const validAssets = entities.filter(
          e => (e.entity_type === 'AHU' && (!isEdit || e.id !== formData.id)) || 
               e.entity_type === 'Building' || 
               e.entity_type === 'Floor' ||
               e.entity_type === 'HVAC_Zone'
        );
        return [
          defaultOption,
          ...validAssets.map(a => ({
            value: a.id,
            label: `${a.name} (${a.entity_type})`
          }))
        ];
      }
      default: {
        // General Equipment located in Floor, Room, Building
        const validSpaces = entities.filter(
          e => ['Floor', 'Room', 'Building', 'HVAC_Zone'].includes(e.entity_type)
        );
        return [
          defaultOption,
          ...validSpaces.map(s => ({
            value: s.id,
            label: `${s.name} (${s.entity_type})`
          }))
        ];
      }
    }
  }, [entities, formData.entity_type, formData.id, isEdit]);

  const getRelationshipConfig = () => {
    switch (formData.entity_type) {
      case 'AHU':
        return {
          label: 'Feeds HVAC Zone / Floor',
          icon: <Wind size={13} color="#dc2626" />,
          hint: 'Topology: AHU supplies conditioned air (feeds) downstream to this zone/floor.',
          color: '#dc2626',
          bg: '#fef2f2',
          border: '#fecaca'
        };
      case 'Meter':
        return {
          label: 'Measures Equipment / Space',
          icon: <Zap size={13} color="#d97706" />,
          hint: 'Topology: Power meter records energy consumption (measures) for this target.',
          color: '#d97706',
          bg: '#fffbeb',
          border: '#fde68a'
        };
      case 'IAQ_Sensor':
        return {
          label: 'Monitored Space (Zone/Room)',
          icon: <Activity size={13} color="#7c3aed" />,
          hint: 'Topology: IAQ sensor monitors indoor environmental quality in this space.',
          color: '#7c3aed',
          bg: '#f5f3ff',
          border: '#ddd6fe'
        };
      default:
        return {
          label: 'Located In Space',
          icon: <Cpu size={13} color="#475569" />,
          hint: 'Topology: Mechanical asset physical location within the building twin.',
          color: '#475569',
          bg: '#f8fafc',
          border: '#e2e8f0'
        };
    }
  };

  const relConfig = getRelationshipConfig();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Equipment Details' : 'Add New Equipment / Sensor'}
      subtitle={isEdit ? `Modifying properties for ${formData.name || formData.id}` : 'Register an AHU, power meter, or IAQ sensor'}
      maxWidth="520px"
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
            {isEdit ? 'Save Changes' : 'Create Equipment'}
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
        <TextInput
          label="Equipment Code / Identifier"
          required={!isEdit}
          disabled={isEdit}
          value={formData.code || formData.id}
          onChange={e => onChange({ ...formData, code: e.target.value })}
          placeholder="e.g. ahu-a-f01-east, pm-a-main"
          className="mono"
        />

        <TextInput
          label="Equipment Name / Label"
          required
          value={formData.name}
          onChange={e => onChange({ ...formData, name: e.target.value })}
          placeholder="e.g. Air Handling Unit AHU-A5"
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <SelectInput
            label="Device Type"
            required
            disabled={isEdit}
            value={formData.entity_type}
            options={typeOptions}
            onChange={e => {
              const type = e.target.value as EntityType;
              const brickMap: Record<string, string> = {
                AHU: 'brick:Air_Handling_Unit',
                Meter: 'brick:Electric_Meter',
                IAQ_Sensor: 'brick:Air_Quality_Sensor',
                Equipment: 'brick:Equipment'
              };
              onChange({ 
                ...formData, 
                entity_type: type,
                brick_class: brickMap[type] || 'brick:Equipment',
                target_id: ''
              });
            }}
          />

          <SelectInput
            label={relConfig.label}
            value={formData.target_id || ''}
            options={targetOptions}
            onChange={e => onChange({ ...formData, target_id: e.target.value })}
          />
        </div>

        {/* Topology Helper */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          background: relConfig.bg,
          border: `1px solid ${relConfig.border}`,
          borderRadius: '6px',
          fontSize: '0.75rem',
          color: relConfig.color,
          fontWeight: '500'
        }}>
          {relConfig.icon}
          <span>{relConfig.hint}</span>
        </div>

        <TextInput
          label="BrickSchema Class"
          value={formData.brick_class}
          onChange={e => onChange({ ...formData, brick_class: e.target.value })}
          placeholder="brick:Air_Handling_Unit, brick:Electric_Meter"
          className="mono"
        />
      </form>
    </Modal>
  );
}

