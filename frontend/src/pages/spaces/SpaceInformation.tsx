import React, { useEffect, useMemo } from 'react';
import { AlertCircle, CheckCircle2, Info, Building2, Layers, MapPin, DoorClosed } from 'lucide-react';
import { Entity, EntityType } from '../../types/index.ts';
import { Modal, Button } from '../../components/ui/index.ts';
import { TextInput, SelectInput } from '../../components/input/index.ts';

interface SpaceInformationModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  formData: {
    id: string;
    code: string;
    name: string;
    entity_type: EntityType;
    parent_id?: string;
    brick_class: string;
  };
  allSpaces?: Entity[];
  submitting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onChange: (data: any) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function SpaceInformationModal({
  isOpen,
  mode,
  formData,
  allSpaces = [],
  submitting,
  errorMessage,
  onClose,
  onChange,
  onSubmit
}: SpaceInformationModalProps) {
  const isEdit = mode === 'edit';

  const typeOptions = [
    { value: 'Building', label: 'Building (Top-Level Property)' },
    { value: 'Floor', label: 'Floor (Level)' },
    { value: 'HVAC_Zone', label: 'HVAC Zone' },
    { value: 'Room', label: 'Room / Office / Area' },
  ];

  // Dynamic hierarchy filtering based on BOT / Brick Schema standards:
  // - Building: Root node -> No parent allowed
  // - Floor: Can only be part of a Building
  // - HVAC_Zone: Can be part of a Floor (preferred) or Building
  // - Room: Can be part of an HVAC_Zone, Floor, or Building
  const validParentSpaces = useMemo(() => {
    return allSpaces.filter(s => {
      // Cannot select self as parent
      if (isEdit && s.id === formData.id) return false;

      switch (formData.entity_type) {
        case 'Building':
          // Buildings cannot have parents
          return false;
        case 'Floor':
          // Floors must belong directly to a Building
          return s.entity_type === 'Building';
        case 'HVAC_Zone':
          // Zones belong to Floors (or directly to a Building)
          return s.entity_type === 'Floor' || s.entity_type === 'Building';
        case 'Room':
          // Rooms can belong to HVAC Zones, Floors, or Buildings
          return s.entity_type === 'HVAC_Zone' || s.entity_type === 'Floor' || s.entity_type === 'Building';
        default:
          return s.entity_type !== 'Room';
      }
    });
  }, [allSpaces, formData.entity_type, formData.id, isEdit]);

  const parentOptions = useMemo(() => {
    if (formData.entity_type === 'Building') {
      return [{ value: '', label: '-- None (Root Property) --' }];
    }

    const defaultNoneLabel = formData.entity_type === 'Floor' 
      ? '-- Select Parent Building --' 
      : formData.entity_type === 'HVAC_Zone'
      ? '-- Select Parent Floor / Building --'
      : '-- Select Parent Zone / Floor --';

    return [
      { value: '', label: defaultNoneLabel },
      ...validParentSpaces.map(s => ({
        value: s.id,
        label: `${s.name} (${s.entity_type})`
      }))
    ];
  }, [formData.entity_type, validParentSpaces]);

  // When entity_type changes, automatically reset parent_id if currently selected parent is invalid
  useEffect(() => {
    if (formData.entity_type === 'Building' && formData.parent_id) {
      onChange({ ...formData, parent_id: '' });
    } else if (formData.parent_id && !validParentSpaces.some(s => s.id === formData.parent_id)) {
      onChange({ ...formData, parent_id: '' });
    }
  }, [formData.entity_type]);

  const getHierarchyHelper = () => {
    switch (formData.entity_type) {
      case 'Building':
        return {
          icon: <Building2 size={13} color="#2563eb" />,
          text: 'Building is the top-level property and cannot be inside another space.',
          color: '#2563eb',
          bg: '#eff6ff',
          border: '#bfdbfe'
        };
      case 'Floor':
        return {
          icon: <Layers size={13} color="#059669" />,
          text: 'Hierarchy: A Floor must be located within a Building.',
          color: '#059669',
          bg: '#ecfdf5',
          border: '#a7f3d0'
        };
      case 'HVAC_Zone':
        return {
          icon: <MapPin size={13} color="#d97706" />,
          text: 'Hierarchy: An HVAC Zone is serviced under a Floor or Building.',
          color: '#d97706',
          bg: '#fffbeb',
          border: '#fde68a'
        };
      case 'Room':
        return {
          icon: <DoorClosed size={13} color="#7c3aed" />,
          text: 'Hierarchy: A Room is located inside an HVAC Zone, Floor, or Building.',
          color: '#7c3aed',
          bg: '#f5f3ff',
          border: '#ddd6fe'
        };
      default:
        return null;
    }
  };

  const helper = getHierarchyHelper();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Space Details' : 'Add New Space'}
      subtitle={isEdit ? `Modifying space details for ${formData.name || formData.code}` : 'Register a building, floor, zone, or room entity'}
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
            {isEdit ? 'Save Changes' : 'Create Space'}
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
          label="Space Name / Label"
          required
          value={formData.name}
          onChange={e => onChange({ ...formData, name: e.target.value })}
          placeholder="e.g. Floor 2, Zone East, Conference Room 201"
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <SelectInput
            label="Space Type"
            required
            disabled={isEdit}
            value={formData.entity_type}
            options={typeOptions}
            onChange={e => {
              const type = e.target.value as EntityType;
              onChange({
                ...formData,
                entity_type: type,
                brick_class: `brick:${type}`,
                parent_id: type === 'Building' ? '' : formData.parent_id
              });
            }}
          />

          <SelectInput
            label="Parent Space"
            disabled={formData.entity_type === 'Building'}
            value={formData.parent_id || ''}
            options={parentOptions}
            onChange={e => onChange({ ...formData, parent_id: e.target.value })}
          />
        </div>

        {/* Hierarchy Context Hint */}
        {helper && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            background: helper.bg,
            border: `1px solid ${helper.border}`,
            borderRadius: '6px',
            fontSize: '0.75rem',
            color: helper.color,
            fontWeight: '500'
          }}>
            {helper.icon}
            <span>{helper.text}</span>
          </div>
        )}

        <TextInput
          label="BrickSchema Class"
          value={formData.brick_class}
          onChange={e => onChange({ ...formData, brick_class: e.target.value })}
          placeholder="brick:Room, brick:Floor, etc."
          className="mono"
        />
      </form>
    </Modal>
  );
}


