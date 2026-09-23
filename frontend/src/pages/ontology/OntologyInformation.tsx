import React from 'react';
import { Network, Building2, Wind, Thermometer, Zap, Layers, Box } from 'lucide-react';
import { Entity, EntityRelationship } from '../../types/index.ts';
import { Modal, Button } from '../../components/ui/index.ts';

interface OntologyInformationModalProps {
  isOpen: boolean;
  entity: Entity | null;
  relationships: EntityRelationship[];
  onClose: () => void;
  onSelectEntity?: (entityId: string) => void;
}

export default function OntologyInformationModal({
  isOpen,
  entity,
  relationships,
  onClose,
  onSelectEntity
}: OntologyInformationModalProps) {
  if (!entity) return null;

  const outgoing = relationships.filter(r => r.subject_id === entity.id);
  const incoming = relationships.filter(r => r.object_id === entity.id);

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'Building': return <Building2 size={16} color="#0284c7" />;
      case 'Floor': return <Layers size={16} color="#6366f1" />;
      case 'HVAC_Zone': return <Box size={16} color="#7c3aed" />;
      case 'Room': return <Box size={16} color="#059669" />;
      case 'AHU': return <Wind size={16} color="#e11d48" />;
      case 'Meter': return <Zap size={16} color="#d97706" />;
      case 'IAQ_Sensor': return <Thermometer size={16} color="#ea580c" />;
      default: return <Box size={16} color="#64748b" />;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {getEntityIcon(entity.entity_type)}
          <span>{entity.name}</span>
        </div>
      }
      subtitle={`Node ID: ${entity.id} • Brick Class: ${entity.brick_class}`}
      maxWidth="560px"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Semantic Attributes */}
        <div style={{ background: 'var(--bg-subtle)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <h4 style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px' }}>
            Semantic Attributes
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Entity Type:</span>
              <span style={{ fontWeight: '600' }}>{entity.entity_type}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Brick Schema Class:</span>
              <span className="mono" style={{ color: 'var(--primary-blue)', fontWeight: '600' }}>{entity.brick_class}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Site Association:</span>
              <span>{entity.site_id}</span>
            </div>
          </div>
        </div>

        {/* Active Graph Relationships */}
        <div>
          <h4 style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Network size={13} />
            <span>Digital Twin Graph Edges</span>
          </h4>

          {/* Outgoing */}
          <div style={{ marginBottom: '10px' }}>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Outgoing (Subject $\rightarrow$ Predicate $\rightarrow$ Object):</p>
            {outgoing.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {outgoing.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#ffffff', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.78rem' }}>
                    <span className="mono">{r.subject_id}</span>
                    <span className="badge badge-info" style={{ fontSize: '0.62rem' }}>--{r.predicate}--&gt;</span>
                    <span className="mono" style={{ color: 'var(--primary-blue)', fontWeight: '600' }}>{r.object_id}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No outgoing edges</p>
            )}
          </div>

          {/* Incoming */}
          <div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Incoming (Target of):</p>
            {incoming.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {incoming.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#ffffff', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.78rem' }}>
                    <span className="mono" style={{ color: 'var(--primary-blue)', fontWeight: '600' }}>{r.subject_id}</span>
                    <span className="badge badge-healthy" style={{ fontSize: '0.62rem' }}>--{r.predicate}--&gt;</span>
                    <span className="mono">{r.object_id}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No incoming edges</p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
