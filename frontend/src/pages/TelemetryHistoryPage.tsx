import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  RefreshCw, 
  Download, 
  CheckCircle, 
  Radio 
} from 'lucide-react';
import { ontologyService, telemetryService } from '../services/index.ts';
import { TelemetryHistoryRecord } from '../services/telemetryService.ts';
import { Entity } from '../types/index.ts';
import { DataTable, Column } from '../components/table/index.ts';

interface TelemetryHistoryPageProps {
  currentSite: string;
}

export default function TelemetryHistoryPage({ currentSite }: TelemetryHistoryPageProps) {
  const [searchParams] = useSearchParams();
  const initialSearchParam = searchParams.get('search') || searchParams.get('entity_id') || '';

  const [entities, setEntities] = useState<Entity[]>([]);
  const [records, setRecords] = useState<TelemetryHistoryRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Server-side pagination & filter state
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState<string>(initialSearchParam);

  // 1. Load entities for mapping entity_id to readable names/codes
  useEffect(() => {
    async function loadEntities() {
      if (!currentSite) return;
      try {
        const ents = await ontologyService.getEntities(currentSite);
        setEntities(ents);
      } catch (err) {
        console.error('Failed to load entities:', err);
      }
    }
    loadEntities();
  }, [currentSite]);

  const entityMap = useMemo(() => {
    const map = new Map<string, Entity>();
    for (const ent of entities) {
      map.set(ent.id, ent);
    }
    return map;
  }, [entities]);

  // 2. Fetch telemetry history logs with server-side pagination
  const fetchHistory = async () => {
    if (!currentSite) return;
    setLoading(true);
    try {
      const result = await telemetryService.getHistoryPaginated({
        site_id: currentSite,
        search: searchTerm.trim() || undefined,
        page,
        limit: pageSize
      });
      setRecords(result.items || []);
      setTotalRecords(result.total);
    } catch (err) {
      console.error('Failed to fetch telemetry history:', err);
    } finally {
      setLoading(false);
    }
  };

  // Reset page to 1 when site or search changes
  useEffect(() => {
    setPage(1);
  }, [currentSite, searchTerm]);

  useEffect(() => {
    fetchHistory();
  }, [currentSite, page, pageSize, searchTerm]);

  // Auto-refresh interval (every 5 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, currentSite, page, pageSize, searchTerm]);

  // Export CSV helper (fetches complete log sample for site)
  const handleExportCSV = async () => {
    if (!currentSite) return;
    try {
      const exportLogs = await telemetryService.getHistory({
        site_id: currentSite,
        search: searchTerm.trim() || undefined,
        limit: 2000
      });
      if (exportLogs.length === 0) return;

      const headers = ['Timestamp', 'Entity Code', 'Entity Name', 'Metric Name', 'Value', 'Unit', 'Ingested At'];
      const rows = exportLogs.map(r => {
        const ent = entityMap.get(r.entity_id);
        return [
          r.timestamp,
          ent?.code || r.entity_id,
          ent?.name || '',
          r.metric_name,
          r.val,
          r.unit || '',
          r.ingested_at
        ];
      });
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `telemetry_logs_site_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export CSV:', err);
    }
  };

  // Define Columns matching design system with compact responsive widths
  const columns: Column<TelemetryHistoryRecord>[] = useMemo(() => [
    {
      key: 'timestamp',
      header: 'Sensor Timestamp (UTC)',
      type: 'datetime',
      width: '180px',
      render: (r) => (
        <span className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
          {new Date(r.timestamp).toISOString().replace('T', ' ').slice(0, 23)}
        </span>
      )
    },
    {
      key: 'entity_id',
      header: 'Equipment / Sensor',
      type: 'text',
      width: '180px',
      render: (r) => {
        const ent = entityMap.get(r.entity_id);
        return (
          <div style={{ minWidth: 0 }}>
            <span style={{ fontWeight: '700', color: 'var(--text-main)', display: 'block', fontSize: '0.84rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {ent ? ent.name : r.entity_id}
            </span>
            <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {ent?.code || r.entity_id}
            </span>
          </div>
        );
      }
    },
    {
      key: 'metric_name',
      header: 'Metric Name',
      type: 'text',
      width: '180px',
      render: (r) => (
        <span style={{ fontWeight: '600', color: 'var(--primary-blue)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
          {r.metric_name}
        </span>
      )
    },
    {
      key: 'val',
      header: 'Numeric Value',
      type: 'number',
      width: '110px',
      align: 'right',
      render: (r) => (
        <span className="mono" style={{ fontWeight: '700', color: 'var(--primary-blue)', fontSize: '0.86rem' }}>
          {typeof r.val === 'number' ? r.val.toFixed(2) : r.val}
        </span>
      )
    },
    {
      key: 'unit',
      header: 'Unit',
      type: 'text',
      width: '80px',
      render: (r) => (
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          {r.unit || '—'}
        </span>
      )
    },
    {
      key: 'ingested_at',
      header: 'Ingested Timestamp',
      type: 'datetime',
      width: '180px',
      render: (r) => (
        <span className="mono" style={{ fontSize: '0.76rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {r.ingested_at ? new Date(r.ingested_at).toISOString().replace('T', ' ').slice(0, 23) : '—'}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Storage State',
      type: 'status',
      width: '110px',
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
  ], [entityMap]);

  // Clean Table Action Buttons (Auto-refresh + Export CSV)
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
          padding: '6px 12px',
          borderRadius: '6px',
          fontSize: '0.8rem',
          fontWeight: '600',
          cursor: 'pointer'
        }}
      >
        <Radio size={12} className={autoRefresh ? 'pulse-indicator green' : ''} />
        {autoRefresh ? 'Live (5s)' : 'Paused'}
      </button>

      <button
        onClick={fetchHistory}
        disabled={loading}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'var(--bg-card)',
          color: 'var(--text-main)',
          border: '1px solid var(--border-color)',
          padding: '6px 12px',
          borderRadius: '6px',
          fontSize: '0.8rem',
          cursor: 'pointer'
        }}
      >
        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
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
          padding: '6px 14px',
          borderRadius: '6px',
          fontSize: '0.8rem',
          fontWeight: '600',
          cursor: 'pointer'
        }}
      >
        <Download size={13} /> Export CSV
      </button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', minHeight: '560px', gap: '12px' }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <DataTable
          columns={columns}
          data={records}
          keyExtractor={(r, idx) => r.id || `${r.timestamp}-${r.entity_id}-${r.metric_name}-${idx}`}
          title="Site Telemetry Logs"
          subtitle="TimescaleDB historical ingestion stream across all equipment"
          actions={tableActions}
          searchable={true}
          initialSearch={searchTerm}
          onSearchChange={(q) => setSearchTerm(q)}
          searchPlaceholder="Search equipment, metric name, timestamp, or value..."
          pagination={true}
          serverSidePagination={true}
          page={page}
          pageSize={pageSize}
          totalRecords={totalRecords}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
          pageSizeOptions={[15, 25, 50, 100]}
          stickyHeader={true}
          containerStyle={{ height: '100%', display: 'flex', flexDirection: 'column' }}
          isLoading={loading && records.length === 0}
          emptyMessage="No telemetry log records found for this site."
        />
      </div>
    </div>
  );
}
