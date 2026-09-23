import React, { useState, useEffect, useMemo } from 'react';
import { Network, Building2, Wind, Thermometer, Zap, Layers, Box, Eye, RefreshCw } from 'lucide-react';
import { ontologyService } from '../../services/index.ts';
import { Entity, EntityRelationship, EntityType } from '../../types/index.ts';
import { DataTable, Column, TableToolbar } from '../../components/table/index.ts';
import OntologyInformationModal from './OntologyInformation.tsx';

interface OntologyPageProps {
  currentSite: string;
}

export default function OntologyPage({ currentSite }: OntologyPageProps) {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [relationships, setRelationships] = useState<EntityRelationship[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const loadOntologyData = async () => {
    setLoading(true);
    try {
      const [entData, relData] = await Promise.all([
        ontologyService.getEntities(currentSite),
        ontologyService.getRelationships()
      ]);
      setEntities(entData);
      setRelationships(relData);
    } catch (err) {
      console.error('Failed to load ontology data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOntologyData();
  }, [currentSite]);

  const handleInspectEntity = (entity: Entity) => {
    setSelectedEntity(entity);
    setIsModalOpen(true);
  };

  const getEntityRelationshipsCount = (entityId: string) => {
    const outgoing = relationships.filter(r => r.subject_id === entityId).length;
    const incoming = relationships.filter(r => r.object_id === entityId).length;
    return { outgoing, incoming, total: outgoing + incoming };
  };

  const tableData = useMemo(() => {
    return entities
      .filter(e => selectedType === 'ALL' || e.entity_type === selectedType)
      .map(e => {
        const counts = getEntityRelationshipsCount(e.id);
        return {
          ...e,
          edge_count_label: `${counts.total} (${counts.outgoing} out, ${counts.incoming} in)`
        };
      });
  }, [entities, relationships, selectedType]);

  const allEntityTypes = useMemo(() => {
    const types = Array.from(new Set(entities.map(e => e.entity_type)));
    return ['ALL', ...types];
  }, [entities]);

  const columns: Column<any>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Entity Name & Identifier',
      type: 'text',
      width: '260px',
      render: (item) => (
        <div>
          <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.86rem' }}>{item.name}</div>
          <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.id}</div>
        </div>
      )
    },
    {
      key: 'entity_type',
      header: 'Entity Class',
      type: 'type',
      width: '140px',
      badgeMap: {
        Building: { badgeClass: 'badge-blue' },
        Floor: { badgeClass: 'badge-cyan' },
        HVAC_Zone: { badgeClass: 'badge-healthy', label: 'HVAC Zone' },
        Room: { badgeClass: 'badge-purple' },
        AHU: { badgeClass: 'badge-critical' },
        Meter: { badgeClass: 'badge-medium' },
        IAQ_Sensor: { badgeClass: 'badge-warning', label: 'IAQ Sensor' },
        Equipment: { badgeClass: 'badge-info' }
      }
    },
    {
      key: 'brick_class',
      header: 'BrickSchema Taxonomy',
      type: 'code',
      width: '220px'
    },
    {
      key: 'site_id',
      header: 'Site',
      type: 'text',
      width: '120px'
    },
    {
      key: 'edge_count_label',
      header: 'Graph Topology Edges',
      type: 'text',
      width: '170px'
    },
    {
      key: 'actions',
      header: 'Actions',
      type: 'action',
      width: '100px',
      align: 'right',
      render: (item) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleInspectEntity(item);
          }}
          style={{
            background: 'var(--primary-blue-subtle)',
            border: '1px solid #93c5fd',
            color: 'var(--primary-blue)',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '0.72rem',
            fontWeight: '600',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}
          title="Inspect Topology Graph Node"
        >
          <Eye size={13} />
          <span>Graph</span>
        </button>
      )
    }
  ], [relationships]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', minHeight: '560px', gap: '12px' }}>
      
      {/* Full-Height DataTable */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <DataTable
          title="BrickSchema Digital Twin Topology"
          subtitle={`${entities.length} total nodes • ${relationships.length} semantic edges`}
          columns={columns}
          data={tableData}
          keyExtractor={(item) => item.id}
          isLoading={loading}
          searchable={true}
          searchPlaceholder="Search node ID, name, Brick class..."
          searchFilter={(item, q) =>
            item.name.toLowerCase().includes(q) ||
            item.id.toLowerCase().includes(q) ||
            (item.brick_class && item.brick_class.toLowerCase().includes(q))
          }
          pagination={true}
          defaultPageSize={15}
          pageSizeOptions={[15, 30, 50, 100]}
          stickyHeader={true}
          containerStyle={{ height: '100%', display: 'flex', flexDirection: 'column' }}
          actions={
            <TableToolbar
              onRefresh={loadOntologyData}
              isRefreshing={loading}
            />
          }
          filters={
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                value={selectedType}
                onChange={e => setSelectedType(e.target.value)}
                style={{
                  padding: '5px 8px',
                  fontSize: '0.78rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  background: '#ffffff',
                  color: 'var(--text-main)'
                }}
              >
                {allEntityTypes.map(t => (
                  <option key={t} value={t}>{t === 'ALL' ? 'All Classes' : t.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          }
        />
      </div>

      {/* Ontology Information Modal */}
      <OntologyInformationModal
        isOpen={isModalOpen}
        entity={selectedEntity}
        relationships={relationships}
        onClose={() => setIsModalOpen(false)}
      />

    </div>
  );
}
