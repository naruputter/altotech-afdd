import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Database, 
  RefreshCw, 
  Download, 
  CheckCircle, 
  Radio 
} from 'lucide-react';
import { telemetryService, TelemetryHistoryRecord } from '../../services/telemetryService.ts';
import { Entity } from '../../types/index.ts';
import { DataTable, Column } from '../../components/table/index.ts';

interface EquipmentLogsModalProps {
  isOpen: boolean;
  equipment: Entity | null;
  onClose: () => void;
}

export default function EquipmentLogsModal({
  isOpen,
  equipment,
  onClose
}: EquipmentLogsModalProps) {
  const [records, setRecords] = useState<TelemetryHistoryRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  const fetchLogs = async () => {
    if (!equipment) return;
    setLoading(true);
    try {
      const data = await telemetryService.getHistory({
        entity_id: equipment.id,
        limit: 500
      });
      setRecords(data || []);
    } catch (err) {
      console.error('Failed to fetch equipment logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && equipment) {
      fetchLogs();
    } else {
      setRecords([]);
    }
  }, [isOpen, equipment]);

  useEffect(() => {
    if (!isOpen || !autoRefresh || !equipment) return;
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [isOpen, autoRefresh, equipment]);

  const handleExportCSV = () => {
    if (!records.length || !equipment) return;
    const headers = ['Timestamp', 'Equipment ID', 'Equipment Name', 'Metric Name', 'Value', 'Unit', 'Ingested At'];
    const rows = records.map(r => [
      r.timestamp,
      equipment.code || equipment.id,
      equipment.name,
      r.metric_name,
      r.val,
      r.unit || '',
      r.ingested_at
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `logs_${equipment.code || equipment.id}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns: Column<TelemetryHistoryRecord>[] = useMemo(() => [
    {
      key: 'timestamp',
      header: 'Sensor Timestamp (UTC)',
      type: 'datetime',
      width: '210px',
      render: (r) => (
        <span className="mono" style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
          {new Date(r.timestamp).toISOString().replace('T', ' ').slice(0, 23)}
        </span>
      )
    },
    {
      key: 'metric_name',
      header: 'Metric Name',
      type: 'text',
      width: '220px',
      render: (r) => (
        <span style={{ fontWeight: '600', color: 'var(--primary-blue)', fontSize: '0.84rem' }}>
          {r.metric_name}
        </span>
      )
    },
    {
      key: 'val',
      header: 'Numeric Value',
      type: 'number',
      width: '130px',
      align: 'right',
      render: (r) => (
        <span className="mono" style={{ fontWeight: '700', color: '#38bdf8', fontSize: '0.86rem' }}>
          {typeof r.val === 'number' ? r.val.toFixed(2) : r.val}
        </span>
      )
    },
    {
      key: 'unit',
      header: 'Unit',
      type: 'text',
      width: '90px',
      render: (r) => (
        <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
          {r.unit || '—'}
        </span>
      )
    },
    {
      key: 'ingested_at',
      header: 'Ingested Timestamp',
      type: 'datetime',
      width: '210px',
      render: (r) => (
        <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {r.ingested_at ? new Date(r.ingested_at).toISOString().replace('T', ' ').slice(0, 23) : '—'}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Storage State',
      type: 'status',
      width: '130px',
      render: () => (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '0.72rem',
          color: '#10b981',
          background: 'rgba(16,185,129,0.1)',
          padding: '2px 8px',
          borderRadius: '4px',
          fontWeight: '600'
        }}>
          <CheckCircle size={11} /> Ingested
        </span>
      )
    }
  ], []);

  const tableActions = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <button
        onClick={() => setAutoRefresh(!autoRefresh)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: autoRefresh ? 'rgba(16,185,129,0.1)' : 'var(--bg-card)',
          color: autoRefresh ? '#10b981' : 'var(--text-muted)',
          border: `1px solid ${autoRefresh ? '#10b98140' : 'var(--border-color)'}`,
          padding: '5px 10px',
          borderRadius: '6px',
          fontSize: '0.78rem',
          fontWeight: '600',
          cursor: 'pointer'
        }}
      >
        <Radio size={12} className={autoRefresh ? 'pulse-indicator green' : ''} />
        {autoRefresh ? 'Live (5s)' : 'Paused'}
      </button>

      <button
        onClick={fetchLogs}
        disabled={loading}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'var(--bg-card)',
          color: 'var(--text-main)',
          border: '1px solid var(--border-color)',
          padding: '5px 10px',
          borderRadius: '6px',
          fontSize: '0.78rem',
          cursor: 'pointer'
        }}
      >
        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        Refresh
      </button>

      <button
        onClick={handleExportCSV}
        disabled={records.length === 0}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'var(--primary-blue)',
          color: '#ffffff',
          border: 'none',
          padding: '5px 12px',
          borderRadius: '6px',
          fontSize: '0.78rem',
          fontWeight: '600',
          cursor: 'pointer'
        }}
      >
        <Download size={12} /> Export CSV
      </button>
    </div>
  );

  if (!isOpen || !equipment) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.7)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '24px'
    }}
    onClick={onClose}
    >
      <div 
        style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          width: '100%',
          maxWidth: '1100px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'modalSlideIn 0.2s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-subtle)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              background: 'rgba(59, 130, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary-blue)'
            }}>
              <Database size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
                {equipment.name} <span className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({equipment.code || equipment.id})</span>
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Brick Schema: <strong style={{ color: 'var(--primary-blue)' }}>{equipment.brick_class}</strong> • Storage: <strong style={{ color: '#10b981' }}>TimescaleDB</strong>
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.background = 'var(--bg-muted)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content with DataTable */}
        <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
          <DataTable
            columns={columns}
            data={records}
            keyExtractor={(r, idx) => r.id || `${r.timestamp}-${r.metric_name}-${idx}`}
            title="Telemetry Data Log"
            subtitle={`${records.length} time-series entries captured`}
            actions={tableActions}
            searchable={true}
            searchPlaceholder="Search metric name, value, timestamp..."
            searchFilter={(r, query) => {
              const q = query.toLowerCase();
              return (
                r.metric_name.toLowerCase().includes(q) ||
                (r.unit && r.unit.toLowerCase().includes(q)) ||
                String(r.val).includes(q) ||
                r.timestamp.includes(q)
              );
            }}
            pagination={true}
            defaultPageSize={15}
            pageSizeOptions={[10, 15, 30, 50]}
            maxHeight="420px"
            isLoading={loading && records.length === 0}
            emptyMessage="No telemetry log records recorded for this equipment yet."
          />
        </div>

      </div>
    </div>
  );
}
