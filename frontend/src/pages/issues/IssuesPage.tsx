import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sparkles, Check, ChevronRight, Eye, ShieldAlert, CheckCircle2, Wind, Zap, Thermometer, Cpu, AlertTriangle } from 'lucide-react';
import { issueService, ontologyService } from '../../services/index.ts';
import { Issue, IssueSeverity, Entity } from '../../types/index.ts';
import { DataTable, Column, TableToolbar } from '../../components/table/index.ts';
import { useWebSocket } from '../../context/WebSocketContext.tsx';
import IssueInformationModal from './IssueInformation.tsx';

interface IssuesPageProps {
  currentSite: string;
  onSelectIssueForAI: (issue: Issue) => void;
  onIssueCountChange?: (count: number) => void;
}

export default function IssuesPage({ currentSite, onSelectIssueForAI, onIssueCountChange }: IssuesPageProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const { subscribe } = useWebSocket();

  // Load ontology entities once per site for label lookups
  useEffect(() => {
    if (currentSite) {
      ontologyService.getEntities(currentSite)
        .then(setEntities)
        .catch(() => setEntities([]));
    }
  }, [currentSite]);

  // Server-side fetch issues whenever pagination or filters change
  const fetchIssues = useCallback(async () => {
    setLoading(true);
    try {
      const result = await issueService.getIssuesPaginated({
        site_id: currentSite,
        status: filterStatus === 'ALL' ? undefined : filterStatus,
        search: searchTerm.trim() || undefined,
        page,
        limit: pageSize
      });

      setIssues(result.items);
      setTotalRecords(result.total);

      // Sync active unacknowledged count for sidebar badge
      const openCount = await issueService.getOpenIssueCount(currentSite);
      onIssueCountChange?.(openCount);
    } catch (err) {
      console.error('Failed to load paginated issues:', err);
    } finally {
      setLoading(false);
    }
  }, [currentSite, filterStatus, searchTerm, page, pageSize, onIssueCountChange]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  // Reset page to 1 when filters or site change
  useEffect(() => {
    setPage(1);
  }, [currentSite, filterStatus, filterSeverity, searchTerm]);

  // Real-time subscription to created and resolved issues
  useEffect(() => {
    const unsubCreated = subscribe('issue.created', (event) => {
      const newIssue = event.data as Issue;
      if (newIssue) {
        // Refresh page to keep pagination synced
        fetchIssues();
      }
    });

    const unsubResolved = subscribe('issue.resolved', (event) => {
      const { id } = event.data || {};
      if (id) {
        fetchIssues();
      }
    });

    return () => {
      unsubCreated();
      unsubResolved();
    };
  }, [subscribe, fetchIssues]);

  const entityMap = useMemo(() => {
    const map = new Map<string, Entity>();
    entities.forEach(e => map.set(e.id, e));
    return map;
  }, [entities]);

  const handleAcknowledge = async (issueId: string) => {
    try {
      await issueService.updateIssueStatus(issueId, 'ACKNOWLEDGED');
      // Optimistic update
      setIssues(prev => prev.map(i => i.id === issueId ? { ...i, status: 'ACKNOWLEDGED' as const } : i));
      if (selectedIssue?.id === issueId) {
        setSelectedIssue(prev => prev ? { ...prev, status: 'ACKNOWLEDGED' } : null);
      }
      // Re-fetch badge count
      const openCount = await issueService.getOpenIssueCount(currentSite);
      onIssueCountChange?.(openCount);
    } catch (err: any) {
      alert(`Failed to acknowledge issue: ${err.message}`);
    }
  };

  const handleInspectIssue = (issue: Issue) => {
    setSelectedIssue(issue);
    setIsModalOpen(true);
  };

  const getEntityIcon = (type?: string) => {
    switch (type) {
      case 'AHU': return <Wind size={14} color="#e11d48" />;
      case 'Meter': return <Zap size={14} color="#d97706" />;
      case 'IAQ_Sensor': return <Thermometer size={14} color="#ea580c" />;
      default: return <Cpu size={14} color="var(--primary-blue)" />;
    }
  };

  // Format table data
  const tableData = useMemo(() => {
    return issues
      .filter(i => filterSeverity === 'ALL' || i.severity === filterSeverity)
      .map(i => {
        const entity = entityMap.get(i.entity_id);
        return {
          ...i,
          target_name: entity?.name || i.entity_id,
          target_type: entity?.entity_type || 'Device',
          energy_waste_label: `${i.estimated_energy_waste_kwh || 24.5} kWh/day`,
          impacted_summary: i.affected_rooms && i.affected_rooms.length > 0
            ? i.affected_rooms.join(', ')
            : '—'
        };
      });
  }, [issues, filterSeverity, entityMap]);

  const selectedEntity = useMemo(() => {
    if (!selectedIssue) return null;
    return entityMap.get(selectedIssue.entity_id) || null;
  }, [selectedIssue, entityMap]);

  const columns: Column<any>[] = useMemo(() => [
    {
      key: 'title',
      header: 'Fault Incident',
      type: 'text',
      width: '240px',
      render: (issue) => (
        <div style={{ maxWidth: '280px' }}>
          <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={issue.title}>
            {issue.title}
          </div>
          <div className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {issue.code || issue.id}
          </div>
        </div>
      )
    },
    {
      key: 'severity',
      header: 'Severity',
      type: 'type',
      width: '110px',
      badgeMap: {
        CRITICAL: { badgeClass: 'badge-critical' },
        HIGH: { badgeClass: 'badge-high' },
        MEDIUM: { badgeClass: 'badge-medium' },
        LOW: { badgeClass: 'badge-low' }
      }
    },
    {
      key: 'entity_id',
      header: 'Target Equipment',
      type: 'text',
      width: '180px',
      render: (issue) => {
        const ent = entityMap.get(issue.entity_id);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {getEntityIcon(ent?.entity_type)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: '700', fontSize: '0.82rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {ent?.name || issue.entity_id}
              </div>
              <div className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {issue.entity_id}
              </div>
            </div>
          </div>
        );
      }
    },
    {
      key: 'started_at',
      header: 'Detected Time',
      type: 'datetime',
      width: '160px'
    },
    {
      key: 'status',
      header: 'Status',
      type: 'status',
      width: '130px',
      statusMap: {
        OPEN: { label: 'OPEN', color: '#dc2626', bg: 'var(--status-critical-bg)' },
        ACKNOWLEDGED: { label: 'ACKNOWLEDGED', color: '#0284c7', bg: 'var(--status-info-bg)' },
        RESOLVED: { label: 'RESOLVED', color: '#16a34a', bg: 'var(--status-healthy-bg)' }
      }
    },
    {
      key: 'actions',
      header: 'Actions',
      type: 'action',
      width: '120px',
      align: 'right',
      render: (issue) => (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleInspectIssue(issue);
            }}
            style={{
              background: 'var(--primary-blue-subtle)',
              border: '1px solid #93c5fd',
              color: 'var(--primary-blue)',
              cursor: 'pointer',
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: '600',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Inspect Incident Details"
          >
            <Eye size={13} />
            <span>Inspect</span>
          </button>

          {issue.status === 'OPEN' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAcknowledge(issue.id);
              }}
              style={{
                background: 'transparent',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px 6px',
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Acknowledge Issue"
            >
              <Check size={14} />
            </button>
          )}
        </div>
      )
    }
  ], [entityMap]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', minHeight: '560px', gap: '12px' }}>

      {/* Full-Height Server-Side DataTable */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <DataTable
          title="Active Fault Incidents"
          subtitle={`${totalRecords} total fault records for ${currentSite}`}
          columns={columns}
          data={tableData}
          keyExtractor={(item) => item.id}
          isLoading={loading}
          searchable={true}
          initialSearch={searchTerm}
          onSearchChange={(q) => {
            setSearchTerm(q);
            setPage(1);
          }}
          searchPlaceholder="Search fault title, source equipment, code..."
          serverSidePagination={true}
          page={page}
          pageSize={pageSize}
          totalRecords={totalRecords}
          onPageChange={(newPage) => setPage(newPage)}
          onPageSizeChange={(newPageSize) => {
            setPageSize(newPageSize);
            setPage(1);
          }}
          stickyHeader={true}
          containerStyle={{ height: '100%', display: 'flex', flexDirection: 'column' }}
          actions={
            <TableToolbar
              onRefresh={fetchIssues}
              isRefreshing={loading}
            />
          }
          filters={
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {/* Status Filter */}
              <div style={{ display: 'flex', gap: '3px', background: 'var(--bg-subtle)', padding: '3px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                {(['ALL', 'OPEN', 'ACKNOWLEDGED', 'RESOLVED'] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => setFilterStatus(st)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      border: 'none',
                      background: filterStatus === st ? '#ffffff' : 'transparent',
                      color: filterStatus === st ? 'var(--primary-blue)' : 'var(--text-muted)',
                      fontWeight: filterStatus === st ? '700' : '500',
                      fontSize: '0.74rem',
                      cursor: 'pointer',
                      boxShadow: filterStatus === st ? 'var(--shadow-sm)' : 'none'
                    }}
                  >
                    {st === 'ALL' ? 'All Statuses' : st}
                  </button>
                ))}
              </div>

              {/* Severity Filter */}
              <div style={{ display: 'flex', gap: '3px', background: 'var(--bg-subtle)', padding: '3px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(sev => (
                  <button
                    key={sev}
                    onClick={() => setFilterSeverity(sev)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      border: 'none',
                      background: filterSeverity === sev ? '#ffffff' : 'transparent',
                      color: filterSeverity === sev ? 'var(--primary-blue)' : 'var(--text-muted)',
                      fontWeight: filterSeverity === sev ? '700' : '500',
                      fontSize: '0.74rem',
                      cursor: 'pointer',
                      boxShadow: filterSeverity === sev ? 'var(--shadow-sm)' : 'none'
                    }}
                  >
                    {sev === 'ALL' ? 'All Severities' : sev}
                  </button>
                ))}
              </div>
            </div>
          }
        />
      </div>

      {/* Reusable Issue Information Modal */}
      <IssueInformationModal
        isOpen={isModalOpen}
        issue={selectedIssue}
        entity={selectedEntity}
        onClose={() => setIsModalOpen(false)}
        onAcknowledge={handleAcknowledge}
        onSelectIssueForAI={onSelectIssueForAI}
      />

    </div>
  );
}
