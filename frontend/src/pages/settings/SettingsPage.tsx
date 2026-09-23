import React, { useState, useMemo } from 'react';
import { RefreshCw, Eye, Settings as SettingsIcon } from 'lucide-react';
import { DataTable, Column, TableToolbar } from '../../components/table/index.ts';
import PointInformationModal from './PointInformation.tsx';

interface BMSPoint {
  tag: string;
  entity: string;
  standardMetric: string;
  unit: string;
  status: string;
  interval: string;
  protocol?: string;
}

export default function SettingsPage() {
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [selectedPoint, setSelectedPoint] = useState<BMSPoint | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const points: BMSPoint[] = useMemo(() => [
    { tag: 'B1_AHU01_SAT_PV', entity: 'AHU_A_01', standardMetric: 'supply_temp', unit: '°C', status: 'ONLINE', interval: '15s', protocol: 'BACnet/IP (Port 47808)' },
    { tag: 'B1_AHU01_RAT_PV', entity: 'AHU_A_01', standardMetric: 'return_temp', unit: '°C', status: 'ONLINE', interval: '15s', protocol: 'BACnet/IP (Port 47808)' },
    { tag: 'B1_AHU01_SF_SPD', entity: 'AHU_A_01', standardMetric: 'fan_speed', unit: '%', status: 'ONLINE', interval: '15s', protocol: 'BACnet/IP (Port 47808)' },
    { tag: 'B1_AHU01_CHWV_POS', entity: 'AHU_A_01', standardMetric: 'chw_valve_pos', unit: '%', status: 'ONLINE', interval: '15s', protocol: 'BACnet/IP (Port 47808)' },
    { tag: 'METER_MAIN_KW', entity: 'Meter_A_Main', standardMetric: 'power_kw', unit: 'kW', status: 'ONLINE', interval: '60s', protocol: 'Modbus TCP (Port 502)' },
    { tag: 'IAQ_CONF101_CO2', entity: 'IAQ_A_101', standardMetric: 'co2_ppm', unit: 'ppm', status: 'ONLINE', interval: '60s', protocol: 'MQTT (Broker 1883)' },
  ], []);

  const handleSyncBACnet = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      alert('BACnet points synchronization complete. All 6 datapoints verified.');
    }, 1000);
  };

  const handleInspectPoint = (point: BMSPoint) => {
    setSelectedPoint(point);
    setIsModalOpen(true);
  };

  const columns: Column<BMSPoint>[] = useMemo(() => [
    {
      key: 'tag',
      header: 'BMS Raw Tag Name',
      type: 'code',
      width: '220px',
      render: (p) => <span className="mono" style={{ fontWeight: '700' }}>{p.tag}</span>
    },
    {
      key: 'entity',
      header: 'Target Entity ID',
      type: 'text',
      width: '160px',
      render: (p) => <span className="mono">{p.entity}</span>
    },
    {
      key: 'standardMetric',
      header: 'Standardized Metric Name',
      type: 'text',
      width: '180px',
      render: (p) => <span style={{ color: 'var(--primary-blue)', fontWeight: '600' }}>{p.standardMetric}</span>
    },
    {
      key: 'unit',
      header: 'Unit',
      type: 'text',
      width: '80px'
    },
    {
      key: 'interval',
      header: 'Poll Interval',
      type: 'text',
      width: '110px'
    },
    {
      key: 'status',
      header: 'Status',
      type: 'status',
      width: '110px',
      statusMap: {
        ONLINE: { label: 'ONLINE', color: '#16a34a', bg: 'var(--status-healthy-bg)' },
        OFFLINE: { label: 'OFFLINE', color: '#dc2626', bg: 'var(--status-critical-bg)' }
      }
    },
    {
      key: 'actions',
      header: 'Actions',
      type: 'action',
      width: '90px',
      align: 'right',
      render: (p) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleInspectPoint(p);
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
          title="Inspect Datapoint Mapping"
        >
          <Eye size={13} />
          <span>View</span>
        </button>
      )
    }
  ], []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', minHeight: '560px', gap: '12px' }}>
      
      {/* Full-Height DataTable */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <DataTable
          title="BMS Point Mapping & Ingestion Pipeline"
          subtitle="Maps BACnet, Modbus, and MQTT tags into BrickSchema standardized telemetry metrics"
          columns={columns}
          data={points}
          keyExtractor={(item) => item.tag}
          searchable={true}
          searchPlaceholder="Search tag name, entity, or metric..."
          searchFilter={(item, q) =>
            item.tag.toLowerCase().includes(q) ||
            item.entity.toLowerCase().includes(q) ||
            item.standardMetric.toLowerCase().includes(q)
          }
          pagination={true}
          defaultPageSize={10}
          stickyHeader={true}
          containerStyle={{ height: '100%', display: 'flex', flexDirection: 'column' }}
          actions={
            <TableToolbar
              onRefresh={handleSyncBACnet}
              isRefreshing={isSyncing}
              refreshLabel="Sync BACnet"
            />
          }
        />
      </div>

      {/* Point Information Modal */}
      <PointInformationModal
        isOpen={isModalOpen}
        point={selectedPoint}
        onClose={() => setIsModalOpen(false)}
      />

    </div>
  );
}
