import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Bot, Power, Edit, Trash2, CheckCircle2, Sliders } from 'lucide-react';
import { ruleService } from '../../services/index.ts';
import { Rule, RuleStatus, IssueSeverity } from '../../types/index.ts';
import { DataTable, Column, TableToolbar } from '../../components/table/index.ts';
import { ConfirmModal } from '../../components/ui/index.ts';
import RuleInformationModal, { RuleFormData } from './RuleInformation.tsx';

export default function RulesPage() {
  const [ruleList, setRuleList] = useState<Rule[]>([]);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | RuleStatus>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Delete Confirm State
  const [deletingRule, setDeletingRule] = useState<Rule | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const [formData, setFormData] = useState<RuleFormData>({
    id: '',
    code: '',
    name: '',
    description: '',
    category_preset: 'AHU_TEMP_DEV',
    entity_type: 'AHU',
    property_scope: 'OFFICE_ONLY',
    severity: 'CRITICAL' as IssueSeverity,
    status: 'APPROVED' as RuleStatus,
    is_active: true,
    condition_expr: 'abs(supply_air_temperature_c - supply_air_temperature_setpoint_c) > tolerance',
    duration_seconds: 900,
    tolerance: 3.0,
    require_run_status_on: true
  });

  const [searchTerm, setSearchTerm] = useState<string>('');

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const result = await ruleService.getRulesPaginated({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        search: searchTerm.trim() || undefined,
        page,
        limit: pageSize
      });
      setRuleList(result.items);
      setTotalRecords(result.total);
    } catch (err) {
      console.error('Failed to load rules:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm, page, pageSize]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  // Reset page to 1 when statusFilter or searchTerm changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter, searchTerm]);

  const toggleRuleActive = async (rule: Rule) => {
    const nextActive = !rule.is_active;
    setRuleList(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: nextActive } : r));
    try {
      await ruleService.updateRuleStatus(rule.id, rule.status, nextActive);
    } catch (err: any) {
      alert(`Failed to update rule status: ${err.message}`);
      loadRules();
    }
  };

  const handleApproveDraft = async (rule: Rule) => {
    setRuleList(prev => prev.map(r => r.id === rule.id ? { ...r, status: 'APPROVED', is_active: true } : r));
    try {
      await ruleService.updateRuleStatus(rule.id, 'APPROVED', true);
    } catch (err: any) {
      alert(`Failed to approve rule: ${err.message}`);
      loadRules();
    }
  };

  const handleOpenAddModal = () => {
    setModalMode('add');
    const autoCode = `RULE_AFDD_${Date.now().toString().slice(-4)}`;
    setFormData({
      id: autoCode,
      code: autoCode,
      name: 'AHU Supply Air Temperature Deviation Fault',
      description: 'Opens a Critical issue when AHU is ON and supply air temperature deviates from setpoint continuously for 15 minutes.',
      category_preset: 'AHU_TEMP_DEV',
      entity_type: 'AHU',
      property_scope: 'OFFICE_ONLY',
      severity: 'CRITICAL',
      status: 'APPROVED',
      is_active: true,
      condition_expr: 'abs(supply_air_temperature_c - supply_air_temperature_setpoint_c) > tolerance',
      duration_seconds: 900,
      tolerance: 3.0,
      require_run_status_on: true
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rule: Rule) => {
    setModalMode('edit');
    const logic = rule.fault_logic;
    const scope = rule.target_scope || {};
    const propTypes = scope.property_types || [];
    let propScope: 'ALL' | 'OFFICE_ONLY' | 'HOTEL_ONLY' = 'ALL';
    if (propTypes.includes('Office') && !propTypes.includes('Hotel')) propScope = 'OFFICE_ONLY';
    else if (propTypes.includes('Hotel') && !propTypes.includes('Office')) propScope = 'HOTEL_ONLY';

    setFormData({
      id: rule.id,
      code: rule.code || rule.id,
      name: rule.name,
      description: rule.description || '',
      category_preset: 'CUSTOM',
      entity_type: scope.entity_type || 'AHU',
      property_scope: propScope,
      severity: rule.severity,
      status: rule.status,
      is_active: rule.is_active,
      condition_expr: logic.condition_expr || logic.condition || 'abs(supply_air_temperature_c - supply_air_temperature_setpoint_c) > tolerance',
      duration_seconds: logic.duration_seconds || 900,
      tolerance: logic.parameters?.tolerance || logic.threshold || 3.0,
      require_run_status_on: logic.parameters?.require_run_status_on ?? true
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    const propertyTypes = 
      formData.property_scope === 'OFFICE_ONLY' ? ['Office'] :
      formData.property_scope === 'HOTEL_ONLY' ? ['Hotel'] : ['Office', 'Hotel'];

    // Derive metric list from expression
    const knownMetrics = ['supply_air_temperature_c', 'supply_air_temperature_setpoint_c', 'run_status', 'co2_ppm', 'active_power_kw', 'chw_valve', 'reheat_valve', 'val'];
    const detectedMetrics = knownMetrics.filter(m => formData.condition_expr.includes(m));
    const finalMetrics = [...detectedMetrics];
    const isAhu = formData.entity_type === 'AHU';
    const requireRunStatus = isAhu && formData.require_run_status_on;
    if (requireRunStatus && !finalMetrics.includes('run_status')) {
      finalMetrics.push('run_status');
    }

    const payload = {
      code: (formData.code || formData.id).trim(),
      name: formData.name.trim(),
      description: formData.description.trim(),
      severity: formData.severity,
      status: formData.status,
      is_active: formData.is_active,
      created_by: 'human_engineer',
      target_scope: {
        entity_type: formData.entity_type,
        site_id: 'all',
        property_types: propertyTypes
      },
      fault_logic: {
        condition_expr: formData.condition_expr,
        duration_seconds: Number(formData.duration_seconds),
        metrics: finalMetrics,
        parameters: {
          tolerance: Number(formData.tolerance),
          require_run_status_on: formData.require_run_status_on
        }
      }
    };

    try {
      if (modalMode === 'add') {
        await ruleService.createRule(payload as any);
      } else {
        await ruleService.updateRule(formData.id, payload as any);
      }

      setIsModalOpen(false);
      await loadRules();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save rule');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingRule) return;
    setIsDeleting(true);
    try {
      await ruleService.deleteRule(deletingRule.id);
      setDeletingRule(null);
      await loadRules();
    } catch (err: any) {
      alert(`Error deleting rule: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const tableData = useMemo(() => {
    return ruleList.map(r => ({
      ...r,
      logic_summary: `${r.fault_logic?.condition_expr || r.fault_logic?.condition || 'N/A'} (${r.fault_logic?.duration_seconds || 0}s)`
    }));
  }, [ruleList]);

  const columns: Column<any>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Rule Name',
      type: 'text',
      width: '35%',
      render: (rule) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.86rem' }}>{rule.name}</span>
            {rule.created_by === 'ai_agent' && (
              <span className="badge" style={{ background: 'var(--accent-purple-subtle)', color: '#7c3aed', border: '1px solid #d8b4fe', fontSize: '0.65rem' }}>
                <Bot size={10} /> AI
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '380px' }}>
            {rule.description}
          </div>
          <div className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>{rule.code || rule.id}</div>
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
      key: 'status',
      header: 'Review Status',
      type: 'status',
      width: '130px',
      statusMap: {
        APPROVED: { label: 'APPROVED', color: '#16a34a', bg: 'var(--status-healthy-bg)' },
        DRAFT: { label: 'DRAFT', color: '#d97706', bg: 'var(--status-medium-bg)' },
        REJECTED: { label: 'REJECTED', color: '#dc2626', bg: 'var(--status-critical-bg)' }
      }
    },
    {
      key: 'logic_summary',
      header: 'Condition Logic',
      type: 'code',
      width: '200px'
    },
    {
      key: 'is_active',
      header: 'Engine State',
      type: 'action',
      width: '120px',
      render: (rule) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleRuleActive(rule);
          }}
          style={{
            background: rule.is_active ? 'var(--status-healthy-bg)' : 'var(--bg-subtle)',
            border: `1px solid ${rule.is_active ? 'var(--status-healthy-border)' : 'var(--border-color)'}`,
            borderRadius: '4px',
            padding: '3px 8px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.74rem',
            color: rule.is_active ? 'var(--status-healthy-text)' : 'var(--text-muted)',
            fontWeight: '600'
          }}
          title="Toggle Rule Evaluation Status"
        >
          <Power size={12} />
          <span>{rule.is_active ? 'ENABLED' : 'DISABLED'}</span>
        </button>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      type: 'action',
      width: '120px',
      align: 'right',
      render: (rule) => (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          {rule.status === 'DRAFT' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleApproveDraft(rule);
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
              title="Approve Draft Rule"
            >
              <CheckCircle2 size={13} />
              <span>Approve</span>
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenEditModal(rule);
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
            title="Edit Rule"
          >
            <Edit size={15} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeletingRule(rule);
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
            title="Delete Rule"
          >
            <Trash2 size={15} />
          </button>
        </div>
      )
    }
  ], [ruleList]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', minHeight: '560px', gap: '12px' }}>
      
      {/* Full-Height Server-Side DataTable */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <DataTable
          title="FDD Diagnostic Rules"
          subtitle={`${totalRecords} rules configured in system`}
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
          searchPlaceholder="Search rule name, code, condition..."
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
              addLabel="Create Rule"
              onRefresh={loadRules}
              isRefreshing={loading}
            />
          }
          filters={
            <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-subtle)', padding: '2px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              {(['ALL', 'APPROVED', 'DRAFT', 'REJECTED'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: 'none',
                    background: statusFilter === st ? '#ffffff' : 'transparent',
                    color: statusFilter === st ? 'var(--primary-blue)' : 'var(--text-muted)',
                    fontWeight: statusFilter === st ? '700' : '500',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    boxShadow: statusFilter === st ? 'var(--shadow-sm)' : 'none'
                  }}
                >
                  {st === 'ALL' ? 'All Rules' : st}
                </button>
              ))}
            </div>
          }
        />
      </div>

      {/* Add / Edit Rule Modal */}
      <RuleInformationModal
        isOpen={isModalOpen}
        mode={modalMode}
        formData={formData}
        submitting={submitting}
        errorMessage={errorMessage}
        onClose={() => setIsModalOpen(false)}
        onChange={(data) => setFormData(data)}
        onSubmit={handleSubmitModal}
      />

      {/* Delete Rule Modal */}
      <ConfirmModal
        isOpen={!!deletingRule}
        title="Delete Diagnostic Rule"
        message={`Are you sure you want to permanently delete rule "${deletingRule?.name}" (${deletingRule?.code})?`}
        confirmText="Delete Rule"
        type="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingRule(null)}
      />

    </div>
  );
}
