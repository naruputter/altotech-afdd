import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  FolderTree, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Edit, 
  Trash2, 
  Building2, 
  Layers, 
  MapPin, 
  Globe, 
  Search, 
  RefreshCw, 
  X, 
  Cpu, 
  Activity, 
  Wind,
  Zap,
  Gauge
} from 'lucide-react';
import { ontologyService, issueService } from '../../services/index.ts';
import { Entity, EntityRelationship, EntityType, Issue } from '../../types/index.ts';
import { ConfirmModal } from '../../components/ui/index.ts';
import SpaceInformationModal from './SpaceInformation.tsx';

interface SpacesPageProps {
  currentSite: string;
}

interface SpaceTreeNode extends Entity {
  children: SpaceTreeNode[];
  devices: Entity[];
}

export default function SpacesPage({ currentSite }: SpacesPageProps) {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [relationships, setRelationships] = useState<EntityRelationship[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Tree & Selection State
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<SpaceTreeNode | null>(null);

  // Modal & Form State
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Delete Confirm State
  const [deletingSpace, setDeletingSpace] = useState<Entity | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    id: '',
    code: '',
    name: '',
    entity_type: 'Room' as EntityType,
    parent_id: '',
    brick_class: 'brick:Room'
  });

  const loadSpacesData = async () => {
    setLoading(true);
    try {
      const [entData, relData, issueData] = await Promise.all([
        ontologyService.getEntities(currentSite),
        ontologyService.getRelationships(),
        issueService.getIssues(currentSite)
      ]);
      setEntities(entData || []);
      setRelationships(relData || []);
      setIssues(issueData || []);
    } catch (err) {
      console.error('Failed to load spaces data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentSite) {
      loadSpacesData();
    }
  }, [currentSite]);

  // Space filtering
  const spaceTypes: EntityType[] = ['Building', 'Floor', 'HVAC_Zone', 'Room'];
  const allSpaces = useMemo(() => entities.filter(e => spaceTypes.includes(e.entity_type)), [entities]);
  const allDevices = useMemo(() => entities.filter(e => !spaceTypes.includes(e.entity_type)), [entities]);

  // Build Hierarchical Tree Structure
  const treeData = useMemo(() => {
    if (allSpaces.length === 0) return [];

    // Map each space to child relationships (hasPart or isPartOf)
    const childToParent = new Map<string, string>();
    const spaceDevicesMap = new Map<string, Entity[]>();

    // Wire up device locations / scopes
    relationships.forEach(rel => {
      if (rel.predicate === 'isPartOf') {
        childToParent.set(rel.subject_id, rel.object_id);
      } else if (rel.predicate === 'hasPart') {
        childToParent.set(rel.object_id, rel.subject_id);
      } else if (['locatedIn', 'feeds', 'measures'].includes(rel.predicate)) {
        // Device locatedIn or feeds or measures Space
        const dev = allDevices.find(d => d.id === rel.subject_id);
        if (dev) {
          const list = spaceDevicesMap.get(rel.object_id) || [];
          if (!list.some(d => d.id === dev.id)) {
            list.push(dev);
            spaceDevicesMap.set(rel.object_id, list);
          }
        }
      }
    });

    const nodeMap = new Map<string, SpaceTreeNode>();
    allSpaces.forEach(s => {
      nodeMap.set(s.id, {
        ...s,
        children: [],
        devices: spaceDevicesMap.get(s.id) || []
      });
    });

    const roots: SpaceTreeNode[] = [];
    nodeMap.forEach((node, id) => {
      const parentId = childToParent.get(id);
      if (parentId && nodeMap.has(parentId)) {
        nodeMap.get(parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }, [allSpaces, allDevices, relationships]);

  // Expand all by default when treeData first loads
  useEffect(() => {
    if (treeData.length > 0 && expandedNodeIds.size === 0) {
      const allIds = new Set<string>();
      const collectIds = (nodes: SpaceTreeNode[]) => {
        nodes.forEach(n => {
          allIds.add(n.id);
          if (n.children.length > 0) collectIds(n.children);
        });
      };
      collectIds(treeData);
      setExpandedNodeIds(allIds);
    }
  }, [treeData]);

  // Dynamic Search Filter Logic
  const filterTreeNodes = useCallback((nodes: SpaceTreeNode[], query: string): { filtered: SpaceTreeNode[], matchedIds: Set<string> } => {
    const trimmedQuery = query.trim().toLowerCase();
    const matchedIds = new Set<string>();

    if (!trimmedQuery) {
      return { filtered: nodes, matchedIds };
    }

    const checkAndFilter = (list: SpaceTreeNode[]): SpaceTreeNode[] => {
      const result: SpaceTreeNode[] = [];
      for (const node of list) {
        const isMatch = (node.name && node.name.toLowerCase().includes(trimmedQuery)) || 
                        (node.code && node.code.toLowerCase().includes(trimmedQuery)) ||
                        (node.entity_type && node.entity_type.toLowerCase().includes(trimmedQuery));
        const filteredChildren = node.children ? checkAndFilter(node.children) : [];

        if (isMatch || filteredChildren.length > 0) {
          if (isMatch) matchedIds.add(node.id);
          result.push({
            ...node,
            children: filteredChildren
          });
        }
      }
      return result;
    };

    return { filtered: checkAndFilter(nodes), matchedIds };
  }, []);

  const { filteredTreeData, searchMatchedIds } = useMemo(() => {
    const { filtered, matchedIds } = filterTreeNodes(treeData, searchQuery);
    return { filteredTreeData: filtered, searchMatchedIds: matchedIds };
  }, [treeData, searchQuery, filterTreeNodes]);

  const toggleNodeExpand = (nodeId: string) => {
    setExpandedNodeIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) newSet.delete(nodeId);
      else newSet.add(nodeId);
      return newSet;
    });
  };

  const handleExpandAll = () => {
    const allIds = new Set<string>();
    const collectIds = (nodes: SpaceTreeNode[]) => {
      nodes.forEach(n => {
        allIds.add(n.id);
        if (n.children.length > 0) collectIds(n.children);
      });
    };
    collectIds(treeData);
    setExpandedNodeIds(allIds);
  };

  const handleCollapseAll = () => {
    setExpandedNodeIds(new Set());
  };

  // Node Actions
  const handleAddRoot = () => {
    setModalMode('add');
    const autoCode = `building-${Date.now().toString().slice(-4)}`;
    setFormData({
      id: '',
      code: autoCode,
      name: '',
      entity_type: 'Building',
      parent_id: '',
      brick_class: 'brick:Building'
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleAddChild = (parentNode: SpaceTreeNode) => {
    setModalMode('add');
    let defaultType: EntityType = 'Floor';
    let defaultClass = 'brick:Floor';
    let prefix = 'floor';

    if (parentNode.entity_type === 'Building') {
      defaultType = 'Floor';
      defaultClass = 'brick:Floor';
      prefix = 'floor';
    } else if (parentNode.entity_type === 'Floor') {
      defaultType = 'HVAC_Zone';
      defaultClass = 'brick:HVAC_Zone';
      prefix = 'zone';
    } else if (parentNode.entity_type === 'HVAC_Zone') {
      defaultType = 'Room';
      defaultClass = 'brick:Room';
      prefix = 'room';
    }

    const autoCode = `${parentNode.code || 'space'}-${prefix}-${Date.now().toString().slice(-3)}`;
    setFormData({
      id: '',
      code: autoCode,
      name: '',
      entity_type: defaultType,
      parent_id: parentNode.id,
      brick_class: defaultClass
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleEditNode = (node: SpaceTreeNode) => {
    setModalMode('edit');
    // Find current parent from relationships
    const parentRel = relationships.find(
      r => r.subject_id === node.id && (r.predicate === 'isPartOf' || r.predicate === 'hasPart')
    );
    const currentParentId = parentRel ? (parentRel.predicate === 'isPartOf' ? parentRel.object_id : parentRel.subject_id) : '';

    setFormData({
      id: node.id,
      code: node.code || node.id,
      name: node.name,
      entity_type: node.entity_type,
      parent_id: currentParentId,
      brick_class: node.brick_class || ''
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      if (modalMode === 'add') {
        const autoCode = `${formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-4)}`;
        const newSpace = await ontologyService.createEntity({
          code: formData.code.trim() || autoCode,
          name: formData.name.trim() || autoCode,
          entity_type: formData.entity_type,
          site_id: currentSite,
          brick_class: formData.brick_class
        });

        if (formData.parent_id && newSpace?.id) {
          await ontologyService.createRelationship({
            subject_id: newSpace.id,
            predicate: 'isPartOf',
            object_id: formData.parent_id
          });
        }
      } else {
        await ontologyService.updateEntity(formData.id, {
          name: formData.name.trim(),
          brick_class: formData.brick_class.trim()
        });

        // Update Parent Relationship
        // 1. Remove previous isPartOf relationships
        await ontologyService.deleteRelationship({
          subject_id: formData.id,
          predicate: 'isPartOf'
        });

        // 2. Add new parent if selected
        if (formData.parent_id) {
          await ontologyService.createRelationship({
            subject_id: formData.id,
            predicate: 'isPartOf',
            object_id: formData.parent_id
          });
        }
      }

      setIsModalOpen(false);
      await loadSpacesData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save space');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingSpace) return;
    setIsDeleting(true);
    try {
      await ontologyService.deleteEntity(deletingSpace.id);
      if (selectedNode && selectedNode.id === deletingSpace.id) {
        setSelectedNode(null);
      }
      setDeletingSpace(null);
      await loadSpacesData();
    } catch (err: any) {
      alert(`Error deleting space: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Badge & Icon styling
  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'Building':
        return {
          icon: Building2,
          color: '#2563eb',
          bg: '#eff6ff',
          badgeClass: 'badge-primary',
          label: 'Building'
        };
      case 'Floor':
        return {
          icon: Layers,
          color: '#0891b2',
          bg: '#ecfeff',
          badgeClass: 'badge-blue',
          label: 'Floor'
        };
      case 'HVAC_Zone':
        return {
          icon: Wind,
          color: '#7c3aed',
          bg: '#f5f3ff',
          badgeClass: 'badge-purple',
          label: 'HVAC Zone'
        };
      case 'Room':
        return {
          icon: MapPin,
          color: '#16a34a',
          bg: '#f0fdf4',
          badgeClass: 'badge-optimal',
          label: 'Room / Office'
        };
      default:
        return {
          icon: Globe,
          color: '#64748b',
          bg: '#f8fafc',
          badgeClass: 'badge-neutral',
          label: type
        };
    }
  };

  // Recursive Tree Node Item
  const TreeNode = ({ node, depth = 0 }: { node: SpaceTreeNode, depth: number }) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodeIds.has(node.id);
    const { icon: TypeIcon, color, bg, label: typeLabel } = getTypeConfig(node.entity_type);
    const isSearchMatched = searchMatchedIds.has(node.id);
    const isSelected = selectedNode?.id === node.id;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 14px',
            marginLeft: `${depth * 24}px`,
            borderRadius: 'var(--radius-md)',
            background: isSelected ? '#eff6ff' : (isSearchMatched ? '#fefce8' : '#ffffff'),
            border: isSelected ? '1px solid #bfdbfe' : (isSearchMatched ? '1px solid #fef08a' : '1px solid var(--border-color)'),
            transition: 'all 0.15s ease',
            boxShadow: isSelected ? '0 2px 4px rgba(37,99,235,0.08)' : 'none'
          }}
          className="hover:shadow-sm"
        >
          {/* Left: Expand toggle & clickable space title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleNodeExpand(node.id);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: hasChildren ? 'pointer' : 'default',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: hasChildren ? 'var(--text-muted)' : '#cbd5e1',
                opacity: hasChildren ? 1 : 0.4
              }}
              disabled={!hasChildren}
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>

            <div
              onClick={() => setSelectedNode(node)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', minWidth: 0, flex: 1 }}
            >
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: bg,
                color: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <TypeIcon size={18} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <span style={{ fontWeight: isSelected ? '700' : '600', color: isSelected ? 'var(--primary-blue)' : 'var(--text-main)', fontSize: '0.88rem', whiteSpace: 'nowrap' }}>
                  {node.name}
                </span>
                <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  ({node.code || node.id})
                </span>
                <span style={{ 
                  fontSize: '0.7rem', 
                  fontWeight: '600', 
                  color: color, 
                  background: bg, 
                  padding: '2px 8px', 
                  borderRadius: '12px',
                  border: `1px solid ${color}20`
                }}>
                  {typeLabel}
                </span>
                {node.devices.length > 0 && (
                  <span style={{ fontSize: '0.7rem', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Cpu size={12} /> {node.devices.length} Devices
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={() => handleAddChild(node)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--primary-blue)',
                padding: '6px',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.75rem',
                fontWeight: '600'
              }}
              title="Add Sub-space"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">Add Sub-space</span>
            </button>
            <button
              onClick={() => handleEditNode(node)}
              style={{ background: 'transparent', border: 'none', color: '#d97706', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}
              title="Edit Space"
            >
              <Edit size={15} />
            </button>
            <button
              onClick={() => setDeletingSpace(node)}
              style={{ background: 'transparent', border: 'none', color: '#dc2626', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}
              title="Delete Space"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Recursive Children */}
        {hasChildren && isExpanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
            {node.children.map(child => (
              <TreeNode key={child.id} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 'calc(100vh - 120px)' }}>
      
      {/* Header Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#ffffff',
        padding: '14px 20px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        {/* Search Input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--bg-subtle)',
          padding: '8px 14px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          width: '300px'
        }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search spaces by name, code, or type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.82rem', width: '100%', color: 'var(--text-main)' }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleExpandAll}
            className="btn btn-secondary"
            style={{ padding: '7px 12px', fontSize: '0.78rem' }}
          >
            Expand All
          </button>
          <button
            onClick={handleCollapseAll}
            className="btn btn-secondary"
            style={{ padding: '7px 12px', fontSize: '0.78rem' }}
          >
            Collapse All
          </button>
          <button
            onClick={loadSpacesData}
            className="btn btn-secondary"
            style={{ padding: '7px 10px' }}
            title="Refresh Hierarchy"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleAddRoot}
            className="btn btn-primary"
            style={{ padding: '7px 14px', fontSize: '0.82rem', gap: '6px' }}
          >
            <Plus size={16} />
            <span>Add Building / Root</span>
          </button>
        </div>
      </div>

      {/* Main Content Area: Tree Column & Detail Panel Column */}
      <div style={{ display: 'flex', gap: '16px', flex: 1, alignItems: 'flex-start' }}>
        
        {/* Tree Column */}
        <div style={{
          flex: selectedNode ? '0 0 65%' : '1 1 100%',
          background: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          padding: '20px',
          boxShadow: 'var(--shadow-sm)',
          maxHeight: 'calc(100vh - 220px)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          transition: 'all 0.2s ease'
        }}>
          {loading && allSpaces.length === 0 ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
              <p style={{ fontSize: '0.88rem' }}>Loading spatial hierarchy...</p>
            </div>
          ) : filteredTreeData.length === 0 ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              <FolderTree size={36} strokeWidth={1.5} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontSize: '0.88rem' }}>No spaces found in this site.</p>
            </div>
          ) : (
            filteredTreeData.map(node => (
              <TreeNode key={node.id} node={node} depth={0} />
            ))
          )}
        </div>

        {/* Selected Space Detail Drawer Panel */}
        {selectedNode && (
          <div style={{
            flex: '0 0 35%',
            background: '#ffffff',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            maxHeight: 'calc(100vh - 220px)',
            overflowY: 'auto'
          }}>
            {/* Drawer Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderTree size={20} color="var(--primary-blue)" />
                <h3 style={{ fontSize: '0.98rem', fontWeight: '700', color: 'var(--text-main)' }}>
                  {selectedNode.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Info Badges */}
            <div style={{ background: 'var(--bg-subtle)', padding: '12px 14px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Space Type:</span>
                <span style={{ fontWeight: '600', color: getTypeConfig(selectedNode.entity_type).color }}>
                  {selectedNode.entity_type}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Code / Identifier:</span>
                <span className="mono" style={{ color: 'var(--text-main)', fontWeight: '600' }}>{selectedNode.code || selectedNode.id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Brick Class:</span>
                <span className="mono" style={{ color: 'var(--text-muted)' }}>{selectedNode.brick_class}</span>
              </div>
            </div>

            {/* Space Quick Actions */}
            <div>
              <h4 style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                Space Management
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  onClick={() => handleAddChild(selectedNode)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.78rem', justifyContent: 'center', padding: '8px' }}
                >
                  <Plus size={14} /> Add Sub-space
                </button>
                <button
                  onClick={() => handleEditNode(selectedNode)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.78rem', justifyContent: 'center', padding: '8px' }}
                >
                  <Edit size={14} /> Edit Space
                </button>
              </div>
            </div>

            {/* Devices Mapped in Space */}
            <div style={{ flex: 1 }}>
              <h4 style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Cpu size={14} /> Devices in this Space ({selectedNode.devices.length})
              </h4>
              
              {selectedNode.devices.length === 0 ? (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '12px 0' }}>
                  No equipment directly associated with this space.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                  {selectedNode.devices.map(dev => (
                    <div key={dev.id} style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      background: '#ffffff',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {dev.entity_type === 'AHU' && <Wind size={15} color="#2563eb" />}
                        {dev.entity_type === 'Meter' && <Zap size={15} color="#d97706" />}
                        {dev.entity_type === 'IAQ_Sensor' && <Gauge size={15} color="#16a34a" />}
                        <div>
                          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-main)' }}>{dev.name}</div>
                          <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{dev.code || dev.id}</div>
                        </div>
                      </div>
                      <span className="badge badge-neutral" style={{ fontSize: '0.68rem' }}>{dev.entity_type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Space Telemetry / Activity Stats */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <h4 style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Activity size={14} /> Environmental Status
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ background: 'var(--bg-subtle)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Status</span>
                  <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#16a34a', marginTop: '2px' }}>Optimal</div>
                </div>
                <div style={{ background: 'var(--bg-subtle)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Active Faults</span>
                  <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#2563eb', marginTop: '2px' }}>
                    {issues.filter(i => selectedNode.devices.some(d => d.id === i.entity_id)).length}
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* Space Add/Edit Modal */}
      <SpaceInformationModal
        isOpen={isModalOpen}
        mode={modalMode}
        formData={formData}
        allSpaces={allSpaces}
        submitting={submitting}
        errorMessage={errorMessage}
        onClose={() => setIsModalOpen(false)}
        onChange={setFormData}
        onSubmit={handleSubmitModal}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deletingSpace}
        onClose={() => setDeletingSpace(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Spatial Entity"
        message={
          <>
            Are you sure you want to delete <strong>{deletingSpace?.name}</strong> (<code>{deletingSpace?.code || deletingSpace?.id}</code>)?
            <p style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              This will remove all associated topology links and nested sub-spaces in the digital twin.
            </p>
          </>
        }
        confirmText="Delete Space"
        type="danger"
        isLoading={isDeleting}
      />

    </div>
  );
}
