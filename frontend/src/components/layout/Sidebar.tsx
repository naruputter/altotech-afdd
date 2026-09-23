import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  Activity,
  AlertTriangle,
  Network,
  Sliders,
  Leaf,
  Settings,
  Building2,
  Wind,
  Database,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';

interface SidebarProps {
  issueCount: number;
  backendStatus: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({
  issueCount,
  backendStatus,
  isCollapsed,
  onToggleCollapse
}: SidebarProps) {
  const [simStatus, setSimStatus] = useState<{ isPaused: boolean; totalDevices: number; isOnline: boolean }>({
    isPaused: false,
    totalDevices: 84,
    isOnline: true
  });

  useEffect(() => {
    const checkSim = async () => {
      try {
        const res = await fetch('http://localhost:3333/api/status');
        if (res.ok) {
          const data = await res.json();
          setSimStatus({
            isPaused: Boolean(data.is_paused),
            totalDevices: data.total_devices || 84,
            isOnline: true
          });
        } else {
          setSimStatus(prev => ({ ...prev, isOnline: false }));
        }
      } catch {
        setSimStatus(prev => ({ ...prev, isOnline: false }));
      }
    };
    checkSim();
  }, []);
  const navSections = [
    {
      title: 'ANALYTICS & FAULTS',
      items: [
        { id: 'home', path: '/telemetry', label: 'Home', icon: <Home size={18} /> },
        { id: 'telemetry-history', path: '/telemetry-history', label: 'Telemetry Logs', icon: <Database size={18} /> },
        {
          id: 'issues',
          path: '/issues',
          label: 'Issues',
          icon: <AlertTriangle size={18} />,
          badge: issueCount > 0 ? issueCount : null,
        },
      ]
    },
    {
      title: 'DIGITAL TWIN & ASSETS',
      items: [
        { id: 'spaces', path: '/spaces', label: 'Spaces', icon: <Building2 size={18} /> },
        { id: 'equipment', path: '/equipment', label: 'Equipment', icon: <Wind size={18} /> },
        { id: 'rules', path: '/rules', label: 'FDD Rule', icon: <Sliders size={18} /> },
      ]
    }
  ];

  return (
    <aside style={{
      width: isCollapsed ? '72px' : '260px',
      minWidth: isCollapsed ? '72px' : '260px',
      background: 'var(--bg-sidebar)',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      borderRight: '1px solid #1e293b',
      transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      overflow: 'hidden'
    }}>

      {/* Brand Header & Toggle Button */}
      <div style={{
        padding: isCollapsed ? '20px 0' : '20px 16px 18px 20px',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'space-between',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, overflow: 'hidden' }}>
          <div style={{
            width: '36px',
            height: '36px',
            minWidth: '36px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #2563eb 0%, #38bdf8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(37,99,235,0.4)',
            cursor: isCollapsed ? 'pointer' : 'default'
          }}
            onClick={isCollapsed ? onToggleCollapse : undefined}
            title={isCollapsed ? "Expand Sidebar" : undefined}
          >
            <Building2 size={20} color="#ffffff" strokeWidth={2.2} />
          </div>

          {!isCollapsed && (
            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>
              <h2 style={{ fontSize: '0.98rem', fontWeight: '700', color: '#ffffff', letterSpacing: '-0.01em', lineHeight: '1.2' }}>
                ALTOTECH AFDD
              </h2>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '500' }}>
                Building Intelligence Suite
              </span>
            </div>
          )}
        </div>

        {/* Collapse Button (Expanded State) */}
        {!isCollapsed && (
          <button
            onClick={onToggleCollapse}
            title="Collapse Sidebar"
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: '#94a3b8',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.background = '#334155'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = '#1e293b'; }}
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Navigation Links Grouped */}
      <nav style={{
        flex: 1,
        padding: isCollapsed ? '16px 8px' : '16px 12px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: isCollapsed ? '12px' : '20px'
      }}>
        {navSections.map((section, idx) => (
          <div key={idx}>
            {!isCollapsed && (
              <p style={{ fontSize: '0.68rem', fontWeight: '700', color: '#64748b', letterSpacing: '0.6px', padding: '0 10px', marginBottom: '8px', whiteSpace: 'nowrap' }}>
                {section.title}
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {section.items.map(item => {
                return (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    title={isCollapsed ? item.label : undefined}
                    style={({ isActive }) => ({
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: isCollapsed ? 'center' : 'space-between',
                      width: '100%',
                      padding: isCollapsed ? '10px 0' : '9px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      background: isActive ? '#2563eb' : 'transparent',
                      color: isActive ? '#ffffff' : '#cbd5e1',
                      fontSize: '0.84rem',
                      fontWeight: isActive ? '600' : '400',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'left',
                      position: 'relative',
                      textDecoration: 'none'
                    })}
                  >
                    {({ isActive }) => (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <span style={{ color: isActive ? '#ffffff' : '#94a3b8', display: 'flex', alignItems: 'center' }}>
                            {item.icon}
                          </span>
                          {!isCollapsed && (
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.label}
                            </span>
                          )}
                        </div>

                        {!isCollapsed ? (
                          item.badge ? (
                            <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.7rem', fontWeight: '700', padding: '1px 7px', borderRadius: '10px' }}>
                              {item.badge}
                            </span>
                          ) : (
                            isActive && <ChevronRight size={14} color="#93c5fd" />
                          )
                        ) : (
                          item.badge ? (
                            <span style={{ position: 'absolute', top: '4px', right: '8px', width: '7px', height: '7px', background: '#ef4444', borderRadius: '50%' }}></span>
                          ) : null
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer System Engine & Simulator Link */}
      <NavLink
        to="/simulator"
        title={`IoT Telemetry Simulator (${simStatus.isPaused ? 'Paused / Stopped' : `${simStatus.totalDevices} Devices Active`})`}
        style={({ isActive }) => ({
          padding: isCollapsed ? '14px 8px' : '12px 14px',
          borderTop: '1px solid #1e293b',
          background: isActive ? '#1e293b' : '#0b1120',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          textDecoration: 'none',
          transition: 'all 0.15s ease',
          cursor: 'pointer'
        })}
      >
        {({ isActive }) => {
          const isPaused = simStatus.isPaused || !simStatus.isOnline;
          return !isCollapsed ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem' }}>
                <span className={`pulse-indicator ${isPaused ? 'red' : 'green'}`}></span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{
                    color: isActive ? '#60a5fa' : isPaused ? '#f87171' : '#86efac',
                    fontWeight: '600',
                    transition: 'color 0.2s ease'
                  }}>
                    IoT Simulator
                  </span>
                  <span style={{ color: isPaused ? '#ef4444' : '#64748b', fontSize: '0.68rem' }}>
                    {isPaused ? 'MQTT Stream Paused' : `${simStatus.totalDevices} Devices Active`}
                  </span>
                </div>
              </div>
              <span style={{
                background: isPaused ? 'rgba(239,68,68,0.15)' : isActive ? '#2563eb' : '#1e293b',
                color: isPaused ? '#f87171' : isActive ? '#ffffff' : '#34d399',
                fontSize: '0.68rem',
                fontWeight: '600',
                padding: '2px 6px',
                borderRadius: '4px',
                border: `1px solid ${isPaused ? 'rgba(239,68,68,0.4)' : '#334155'}`,
                transition: 'all 0.2s ease'
              }}>
                {isPaused ? 'Stopped' : 'Live'}
              </span>
            </>
          ) : (
            <div
              title={`IoT Simulator (${isPaused ? 'MQTT Stopped' : `${simStatus.totalDevices} Devices Active`})`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <span className={`pulse-indicator ${isPaused ? 'red' : 'green'}`}></span>
            </div>
          );
        }}
      </NavLink>

    </aside>
  );
}
