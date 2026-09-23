import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit, Trash2, Database, Radio, Wifi, WifiOff, Wind, Zap, Thermometer, Cpu } from 'lucide-react';
import { ontologyService, issueService, telemetryService } from '../../services/index.ts';
import { Entity, Issue, EntityType, EntityRelationship } from '../../types/index.ts';
import { DataTable, Column, TableToolbar } from '../../components/table/index.ts';
import { ConfirmModal } from '../../components/ui/index.ts';
import { useWebSocket } from '../../context/WebSocketContext.tsx';
import EquipmentInformationModal from './EquipmentInformation.tsx';
import EquipmentLogsModal from './EquipmentLogsModal.tsx';

interface EquipmentPageProps {
  currentSite: string;
}

export default function EquipmentPage({ currentSite }: EquipmentPageProps) {
  const navigate = useNavigate();
  const [equipments, setEquipments] = useState<Entity[]>([]);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  const [allSpaces, setAllSpaces] = useState<Entity[]>([]);
  const [relationships, setRelationships] = useState<EntityRelationship[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [deviceStatuses, setDeviceStatuses] = useState<Record<string, { last_seen: string | null; reading_count: number }>>({});
  const [filterType, setFilterType] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);

  // Modal State for Add & Edit
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Equipment Logs Modal State
  const [viewingLogsEquipment, setViewingLogsEquipment] = useState<Entity | null>(null);

  // Delete Confirm State
  const [deletingEquipment, setDeletingEquipment] = useState<Entity | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    id: '',
    code: '',
    name: '',
    entity_type: 'AHU' as EntityType,
    brick_class: 'brick:Air_Handling_Unit',
    target_id: ''
  });

  const { subscribe } = useWebSocket();

  // 1. Fetch spaces & relationships once for target mapping & modal options
  useEffect(() => {
    if (currentSite) {
      Promise.all([
        ontologyService.getEntities(currentSite).catch(() => []),
        ontologyService.getRelationships().catch(() => []),
        issueService.getIssues(currentSite).catch(() => []),
        telemetryService.getDeviceStatus(currentSite).catch(() => [])
      ]).then(([allEnts, relData, issueData, statusData]) => {
        setAllSpaces(allEnts || []);
        setRelationships(relData || []);
        setIssues(issueData || []);

        const statusMap: Record<string, { last_seen: string | null; reading_count: number }> = {};
        for (const item of statusData || []) {
          statusMap[item.entity_id] = {
            last_seen: item.last_seen,
            reading_count: item.reading_count
          };
        }
        setDeviceStatuses(statusMap);
      });
    }
  }, [currentSite]);

  const [searchTerm, setSearchTerm] = useState<string>('');

  // 2. Server-Side Fetch Equipment
  const fetchEquipment = useCallback(async () => {
    if (!currentSite) return;
    setLoading(true);
    try {
      const result = await ontologyService.getEntitiesPaginated({
        site_id: currentSite,
        entity_type: filterType === 'ALL' ? undefined : (filterType as EntityType),
        search: searchTerm.trim() || undefined,
        page,
        limit: pageSize
      });

      // If filterType is ALL, we filter only equipment types on frontend or backend
      const validItems = filterType === 'ALL' 
        ? result.items.filter(e => ['AHU', 'Meter', 'IAQ_Sensor', 'Equipment'].includes(e.entity_type))
        : result.items;

      setEquipments(validItems);
      setTotalRecords(result.total);
    } catch (err) {
      console.error('Failed to load equipment data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentSite, filterType, searchTerm, page, pageSize]);

  useEffect(() => {
    fetchEquipment();
  }, [fetchEquipment]);

  // Reset page to 1 when filterType, currentSite, or searchTerm changes
  useEffect(() => {
    setPage(1);
  }, [filterType, currentSite, searchTerm]);

  // Real-time device status update via WebSocket
  useEffect(() => {
    const unsub = subscribe('device.status', (event) => {
      const { entity_id, last_seen, status } = event.data || {};
      if (entity_id) {
        setDeviceStatuses(prev => ({
          ...prev,
          [entity_id]: {
            last_seen: last_seen || (status === 'ONLINE' ? new Date().toISOString() : prev[entity_id]?.last_seen || null),
            reading_count: status === 'ONLINE' ? (prev[entity_id]?.reading_count || 0) + 1 : (prev[entity_id]?.reading_count || 0),
          }
        }));
      }
    });
    return () => unsub();
  }, [subscribe]);

  const zones = allSpaces.filter(e => e.entity_type === 'HVAC_Zone');

  // Calculates whether a device is Online (< 3 mins since last telemetry)
  const getDeviceOnlineState = (eqId: string) => {
    const status = deviceStatuses[eqId];
    if (!status || !status.last_seen) {
      return { isOnline: false, label: 'Offline', subText: 'No telemetry stream' };
    }
    const lastSeenTime = new Date(status.last_seen).getTime();
    const diffSeconds = (Date.now() - lastSeenTime) / 1000;

    if (diffSeconds < 180) {
      const text = diffSeconds < 60 ? `${Math.floor(diffSeconds)}s ago` : `${Math.floor(diffSeconds / 60)}m ago`;
      return { isOnline: true, label: 'Online', subText: text };
    } else {
      const mins = Math.floor(diffSeconds / 60);
      return { isOnline: false, label: 'Offline', subText: `${mins > 60 ? Math.floor(mins / 60) + 'h' : mins + 'm'} ago` };
    }
  };

  const getEquipmentStatus = (eqId: string) => {
    const issue = issues.find(i => i.entity_id === eqId && (i.status === 'OPEN' || i.status === 'ACKNOWLEDGED'));
    if (issue) {
      return 'CRITICAL';
    }
    return 'OPTIMAL';
  };

  const getDevicePredicate = (type: EntityType) => {
    if (type === 'AHU') return 'feeds';
    if (type === 'Meter') return 'measures';
    if (type === 'IAQ_Sensor') return 'locatedIn';
    return 'locatedIn';
  };

  const getEntityIcon = (type?: string) => {
    switch (type) {
      case 'AHU': return <Wind size={15} color="#dc2626" />;
      case 'Meter': return <Zap size={15} color="#d97706" />;
      case 'IAQ_Sensor': return <Thermometer size={15} color="#ea580c" />;
      default: return <Cpu size={15} color="var(--primary-blue)" />;
    }
  };

  // Prepare table data with flat clean fields
  const tableData = useMemo(() => {
    return equipments.map(eq => {
      const onlineState = getDeviceOnlineState(eq.id);
      return {
        ...eq,
        status: getEquipmentStatus(eq.id),
        is_online: onlineState.isOnline,
        online_label: onlineState.label,
        online_subtext: onlineState.subText,
        brick_class_label: eq.brick_class || 'brick:Equipment'
      };
    });
  }, [equipments, issues, deviceStatuses]);

  const handleOpenAddModal = () => {
    setModalMode('add');
    const autoCode = `ahu-${Date.now().toString().slice(-4)}`;
    setFormData({
      id: '',
      code: autoCode,
      name: '',
      entity_type: 'AHU',
      brick_class: 'brick:Air_Handling_Unit',
      target_id: zones[0]?.id || ''
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (eq: Entity) => {
    setModalMode('edit');
    // Find primary relationship based on device type
    const preferredPredicate = eq.entity_type === 'AHU' ? 'feeds' : eq.entity_type === 'Meter' ? 'measures' : 'locatedIn';
    let currentRel = relationships.find(
      r => (r.subject_id === eq.id || r.subject_id === eq.code) && r.predicate.toLowerCase() === preferredPredicate.toLowerCase()
    );
    if (!currentRel) {
      currentRel = relationships.find(
        r => (r.subject_id === eq.id || r.subject_id === eq.code) && ['feeds', 'measures', 'locatedIn'].includes(r.predicate)
      );
    }

    let targetSpaceId = '';
    if (currentRel) {
      const matchedSpace = allSpaces.find(s => s.id === currentRel.object_id || s.code === currentRel.object_id);
      targetSpaceId = matchedSpace ? matchedSpace.id : currentRel.object_id;
    }

    setFormData({
      id: eq.id,
      code: eq.code || eq.id,
      name: eq.name,
      entity_type: eq.entity_type,
      brick_class: eq.brick_class || '',
      target_id: targetSpaceId
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const predicate = getDevicePredicate(formData.entity_type);

      if (modalMode === 'add') {
        const newEntity = await ontologyService.createEntity({
          code: formData.code.trim() || `eq-${Date.now().toString().slice(-4)}`,
          name: formData.name.trim() || formData.code.trim(),
          entity_type: formData.entity_type,
          site_id: currentSite,
          brick_class: formData.brick_class
        });

        if (formData.target_id && newEntity?.id) {
          await ontologyService.createRelationship({
            subject_id: newEntity.id,
            predicate: predicate,
            object_id: formData.target_id
          });
        }
      } else {
        await ontologyService.updateEntity(formData.id, {
          name: formData.name.trim(),
          brick_class: formData.brick_class.trim()
        });

        for (const pred of ['feeds', 'measures', 'locatedIn']) {
          await ontologyService.deleteRelationship({
            subject_id: formData.id,
            predicate: pred
          });
        }

        if (formData.target_id) {
          await ontologyService.createRelationship({
            subject_id: formData.id,
            predicate: predicate,
            object_id: formData.target_id
          });
        }
      }

      setIsModalOpen(false);
      await fetchEquipment();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save equipment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingEquipment) return;
    setIsDeleting(true);
    try {
      await ontologyService.deleteEntity(deletingEquipment.id);
      setDeletingEquipment(null);
      await fetchEquipment();
    } catch (err: any) {
      alert(`Error deleting equipment: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<any>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Equipment Name & Code',
      type: 'text',
      width: '260px',
      render: (eq) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {getEntityIcon(eq.entity_type)}
          </div>
          <div>
            <strong style={{ display: 'block', fontSize: '0.88rem', color: 'var(--text-main)' }}>{eq.name}</strong>
            <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{eq.code || eq.id}</span>
          </div>
        </div>
      )
    },
    {
      key: 'entity_type',
      header: 'Type',
      type: 'type',
      width: '130px',
      badgeMap: {
        AHU: { label: 'Air Handler', badgeClass: 'badge-critical' },
        Meter: { label: 'Power Meter', badgeClass: 'badge-medium' },
        IAQ_Sensor: { label: 'IAQ Sensor', badgeClass: 'badge-purple' },
        Equipment: { label: 'Equipment', badgeClass: 'badge-neutral' }
      }
    },
    {
      key: 'space_location',
      header: 'Space / Location Context',
      type: 'text',
      width: '230px',
      render: (eq) => {
        const preferredPredicate = eq.entity_type === 'AHU' ? 'feeds' : eq.entity_type === 'Meter' ? 'measures' : 'locatedIn';
        
        let primaryRel = relationships.find(
          r => (r.subject_id === eq.id || r.subject_id === eq.code) && r.predicate.toLowerCase() === preferredPredicate.toLowerCase()
        );
        if (!primaryRel) {
          primaryRel = relationships.find(
            r => (r.subject_id === eq.id || r.subject_id === eq.code) && ['feeds', 'measures', 'locatedIn', 'is_part_of'].includes(r.predicate.toLowerCase())
          );
        }

        let primarySpace = primaryRel ? allSpaces.find(s => s.id === primaryRel.object_id || s.code === primaryRel.object_id) : null;
        
        if (!primarySpace && eq.metadata_json) {
          const targetCode = eq.metadata_json.served_space_id || eq.metadata_json.measurement_scope_id || eq.metadata_json.installed_space_id;
          if (targetCode) {
            primarySpace = allSpaces.find(s => s.code === targetCode || s.id === targetCode) || null;
          }
        }

        const predicate = primaryRel ? primaryRel.predicate.toLowerCase() : preferredPredicate.toLowerCase();
        const predicateLabel = predicate === 'feeds' ? '⚡ Feeds Zone' : predicate === 'measures' ? '📊 Measures Floor' : '📍 Located in';
        const badgeColor = predicate === 'feeds' ? '#2563eb' : predicate === 'measures' ? '#d97706' : '#059669';

        return (
          <div>
            <span style={{ 
              fontSize: '0.68rem', 
              fontWeight: '700', 
              color: badgeColor, 
              textTransform: 'uppercase', 
              letterSpacing: '0.04em',
              display: 'block' 
            }}>
              {predicateLabel}
            </span>
            <span style={{ fontWeight: '600', fontSize: '0.82rem', color: 'var(--text-main)', display: 'block' }}>
              {primarySpace ? primarySpace.name : '—'}
            </span>
            <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {primarySpace?.code || (primarySpace ? primarySpace.id : '')}
            </span>
          </div>
        );
      }
    },
    {
      key: 'brick_class_label',
      header: 'Brick Schema Class',
      type: 'code',
      width: '180px'
    },
    {
      key: 'status',
      header: 'Fault Status',
      type: 'status',
      width: '120px',
      statusMap: {
        OPTIMAL: { label: 'OPTIMAL', color: '#16a34a', bg: 'var(--status-healthy-bg)' },
        CRITICAL: { label: 'FAULT ACTIVE', color: '#dc2626', bg: 'var(--status-critical-bg)' }
      }
    },
    {
      key: 'is_online',
      header: 'Connectivity',
      type: 'custom',
      width: '150px',
      render: (eq) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span 
            className={`pulse-indicator ${eq.is_online ? 'green' : 'gray'}`} 
            style={{ width: '8px', height: '8px', borderRadius: '50%' }}
          />
          <div>
            <span style={{ 
              fontWeight: '700', 
              fontSize: '0.78rem',
              color: eq.is_online ? 'var(--status-healthy-text)' : 'var(--text-muted)' 
            }}>
              {eq.online_label}
            </span>
            <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              {eq.online_subtext}
            </span>
          </div>
        </div>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      type: 'action',
      width: '130px',
      align: 'right',
      render: (eq) => (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setViewingLogsEquipment(eq);
            }}
            style={{
              background: 'var(--primary-blue-subtle)',
              border: '1px solid #93c5fd',
              color: 'var(--primary-blue)',
              cursor: 'pointer',
              padding: '5px 8px',
              borderRadius: '4px',
              fontSize: '0.72rem',
              fontWeight: '600',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Inspect Real-time Telemetry Logs"
          >
            <Database size={13} />
            <span>Logs</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenEditModal(eq);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--primary-blue)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '4px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Edit Equipment"
          >
            <Edit size={15} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeletingEquipment(eq);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#dc2626',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '4px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Delete Equipment"
          >
            <Trash2 size={15} />
          </button>
        </div>
      )
    }
  ], [issues, deviceStatuses]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', minHeight: '560px', gap: '12px' }}>
      
      {/* Main Full-Height Server-Side DataTable */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <DataTable
          title="Equipment & Device Fleet"
          subtitle={`${totalRecords} equipment items deployed at ${currentSite.replace('_', ' ')}`}
          data={tableData}
          columns={columns}
          keyExtractor={(item) => item.id}
          searchable={true}
          initialSearch={searchTerm}
          onSearchChange={(q) => {
            setSearchTerm(q);
            setPage(1);
          }}
          searchPlaceholder="Search equipment name, code, type, or location..."
          isLoading={loading}
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
              onAdd={handleOpenAddModal}
              addLabel="Add Equipment"
              onRefresh={fetchEquipment}
              isRefreshing={loading}
            />
          }
          filters={
            <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-subtle)', padding: '2px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              {[
                { id: 'ALL', label: 'All Equipment' },
                { id: 'AHU', label: 'Air Handlers' },
                { id: 'Meter', label: 'Power Meters' },
                { id: 'IAQ_Sensor', label: 'IAQ Sensors' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFilterType(tab.id)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: 'none',
                    background: filterType === tab.id ? '#ffffff' : 'transparent',
                    color: filterType === tab.id ? 'var(--primary-blue)' : 'var(--text-muted)',
                    fontWeight: filterType === tab.id ? '700' : '500',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    boxShadow: filterType === tab.id ? 'var(--shadow-sm)' : 'none'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          }
        />
      </div>

      {/* Reusable Equipment Information Modal Component */}
      <EquipmentInformationModal
        isOpen={isModalOpen}
        mode={modalMode}
        formData={formData}
        entities={allSpaces}
        submitting={submitting}
        errorMessage={errorMessage}
        onClose={() => setIsModalOpen(false)}
        onChange={setFormData}
        onSubmit={handleSubmitModal}
      />

      {/* Equipment Telemetry Logs Modal */}
      <EquipmentLogsModal
        isOpen={!!viewingLogsEquipment}
        equipment={viewingLogsEquipment}
        onClose={() => setViewingLogsEquipment(null)}
      />

      {/* Reusable ConfirmModal for Delete */}
      <ConfirmModal
        isOpen={!!deletingEquipment}
        onClose={() => setDeletingEquipment(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Equipment"
        message={`Are you sure you want to permanently delete equipment "${deletingEquipment?.name}" (${deletingEquipment?.id})?`}
        confirmText="Delete Equipment"
        type="danger"
        isLoading={isDeleting}
      />

    </div>
  );
}
