import React from 'react';
import { Tag, Cpu, Activity } from 'lucide-react';
import { Modal, Button } from '../../components/ui/index.ts';

interface BMSPoint {
  tag: string;
  entity: string;
  standardMetric: string;
  unit: string;
  status: string;
  interval: string;
  description?: string;
  protocol?: string;
}

interface PointInformationModalProps {
  isOpen: boolean;
  point: BMSPoint | null;
  onClose: () => void;
}

export default function PointInformationModal({
  isOpen,
  point,
  onClose
}: PointInformationModalProps) {
  if (!point) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-healthy">{point.status}</span>
          <span className="mono" style={{ fontSize: '1.05rem', fontWeight: '700' }}>{point.tag}</span>
        </div>
      }
      subtitle={`Raw BACnet / Modbus Ingestion Point Mapping`}
      maxWidth="520px"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {/* Mappings Detail */}
      <div style={{ background: 'var(--bg-subtle)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.84rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)' }}>Target Entity ID:</span>
          <span className="mono" style={{ fontWeight: '600' }}>{point.entity}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)' }}>Standardized Metric:</span>
          <span style={{ color: 'var(--primary-blue)', fontWeight: '600' }}>{point.standardMetric}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)' }}>Engineering Unit:</span>
          <span>{point.unit}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)' }}>Polling Interval:</span>
          <span>{point.interval}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)' }}>Protocol:</span>
          <span>{point.protocol || 'BACnet/IP (Port 47808)'}</span>
        </div>
      </div>
    </Modal>
  );
}
