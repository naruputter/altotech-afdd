import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Search, Bell, Sparkles, ChevronRight, Menu, 
  Building2, Check, ChevronDown, User, Shield, LogOut
} from 'lucide-react';
import { siteService } from '../../services/index.ts';
import { Site } from '../../types/index.ts';

interface TopHeaderProps {
  currentSite: string;
  onSelectSite: (site: string) => void;
  onToggleAICopilot: () => void;
  issueCount: number;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export default function TopHeader({ 
  currentSite, 
  onSelectSite,
  onToggleAICopilot, 
  issueCount,
  isSidebarCollapsed,
  onToggleSidebar
}: TopHeaderProps) {
  const location = useLocation();
  const currentPathKey = location.pathname.replace('/', '') || 'telemetry';

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const tabTitles: Record<string, string> = {
    telemetry: 'Real-time Telemetry & Equipment Monitoring',
    issues: 'Fault Detection & Diagnostics (FDD) Incident Matrix',
    energy: 'Building Energy & Carbon Sustainability Analytics',
    spaces: 'Spatial Hierarchy & Space Directory',
    equipment: 'Equipment & Device Fleet Directory',
    ontology: 'BrickSchema Digital Twin & Spatial Topology',
    rules: 'Fault Detection Rules & Engineering Logic',
    settings: 'BMS Hardware Point Mapping & Configuration'
  };

  useEffect(() => {
    async function loadSites() {
      try {
        const siteData = await siteService.getSites();
        if (siteData && siteData.length > 0) {
          setSites(siteData);
        }
      } catch (err) {
        console.error('Failed to load sites:', err);
      }
    }
    loadSites();
  }, []);

  const currentSiteObj = currentSite === 'all' 
    ? { id: 'all', code: 'ALL_SITES', name: 'All Properties (Portfolio Overview)', description: '3 Buildings · 93 Spaces · 84 Devices' }
    : (sites.find(s => s.id === currentSite || s.code === currentSite) || sites[0] || {
        id: currentSite,
        code: currentSite,
        name: currentSite.replace('_', ' '),
        description: 'Managed Property'
      });

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header style={{ 
      height: '64px', 
      background: '#ffffff', 
      borderBottom: '1px solid var(--border-color)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      padding: '0 28px', 
      position: 'sticky', 
      top: 0, 
      zIndex: 40, 
      boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' 
    }}>
      {/* Left Breadcrumb & Navigation Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {isSidebarCollapsed && (
          <button
            onClick={onToggleSidebar}
            title="Expand Sidebar"
            style={{
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-main)',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <Menu size={18} />
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <span style={{ fontWeight: '600', color: 'var(--primary-blue)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Building2 size={14} /> {currentSiteObj.name.split(' (')[0]}
          </span>
          <ChevronRight size={14} />
          <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>
            {tabTitles[currentPathKey] || 'Dashboard'}
          </span>
        </div>
      </div>

      {/* Right Controls & Profile / Site Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        
        {/* Notifications */}
        <button style={{ 
          width: '36px', 
          height: '36px', 
          borderRadius: 'var(--radius-md)', 
          border: '1px solid var(--border-color)', 
          background: '#ffffff', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          color: 'var(--text-muted)', 
          cursor: 'pointer', 
          position: 'relative' 
        }}>
          <Bell size={17} />
          {issueCount > 0 && (
            <span style={{ position: 'absolute', top: '7px', right: '7px', width: '7px', height: '7px', background: '#dc2626', borderRadius: '50%' }}></span>
          )}
        </button>

        {/* User Profile & Interactive Site Switcher Dropdown */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setIsDropdownOpen(prev => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '4px 10px 4px 6px',
              background: isDropdownOpen ? 'var(--bg-subtle)' : '#ffffff',
              border: '1px solid var(--border-color)',
              borderRadius: '24px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #2563eb 0%, #0891b2 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
              fontSize: '0.75rem',
              boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
            }}>
              PE
            </div>

            <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-main)', lineHeight: 1.1, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentSiteObj.name || 'Building A'}
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                Lead Engineer
              </span>
            </div>

            <ChevronDown size={14} color="var(--text-muted)" style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
          </button>

          {/* Profile & Site Selector Popup Menu */}
          {isDropdownOpen && (
            <div style={{
              position: 'absolute',
              top: '115%',
              right: 0,
              width: '280px',
              background: '#ffffff',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-lg)',
              padding: '12px',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              {/* Account Details Header */}
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: '#eff6ff',
                  color: 'var(--primary-blue)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '0.85rem'
                }}>
                  <User size={18} />
                </div>
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)' }}>Putter (Lead Engineer)</h4>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Shield size={12} color="#16a34a" /> Full Administrative Access
                  </p>
                </div>
              </div>

              {/* Site Selection List */}
              <div>
                <p style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 10px 6px' }}>
                  SWITCH MANAGED SITE
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {/* Portfolio Overview / All Properties Option */}
                  <button
                    onClick={() => {
                      onSelectSite('all');
                      setIsDropdownOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      background: currentSite === 'all' ? '#eff6ff' : 'transparent',
                      color: currentSite === 'all' ? 'var(--primary-blue)' : 'var(--text-main)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      if (currentSite !== 'all') e.currentTarget.style.background = 'var(--bg-subtle)';
                    }}
                    onMouseLeave={e => {
                      if (currentSite !== 'all') e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Building2 size={16} color={currentSite === 'all' ? 'var(--primary-blue)' : 'var(--text-muted)'} />
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: currentSite === 'all' ? '700' : '500' }}>
                          🏢 All Properties (Portfolio)
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          Combined multi-site overview
                        </div>
                      </div>
                    </div>

                    {currentSite === 'all' && <Check size={16} color="var(--primary-blue)" />}
                  </button>

                  <div style={{ height: '1px', background: 'var(--border-color)', margin: '2px 0' }} />

                  {sites.map(site => {
                    const isSelected = site.id === currentSite || site.code === currentSite;
                    return (
                      <button
                        key={site.id}
                        onClick={() => {
                          onSelectSite(site.id);
                          setIsDropdownOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-sm)',
                          border: 'none',
                          background: isSelected ? '#eff6ff' : 'transparent',
                          color: isSelected ? 'var(--primary-blue)' : 'var(--text-main)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={e => {
                          if (!isSelected) e.currentTarget.style.background = 'var(--bg-subtle)';
                        }}
                        onMouseLeave={e => {
                          if (!isSelected) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Building2 size={16} color={isSelected ? 'var(--primary-blue)' : 'var(--text-muted)'} />
                          <div>
                            <div style={{ fontSize: '0.82rem', fontWeight: isSelected ? '700' : '500' }}>
                              {site.name}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {site.description || site.code || 'Managed Facility'}
                            </div>
                          </div>
                        </div>

                        {isSelected && <Check size={16} color="var(--primary-blue)" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Footer Actions */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', paddingLeft: '6px' }}>
                  v1.0.0 Enterprise
                </span>
                <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: '600', paddingRight: '6px' }}>
                  Connected
                </span>
              </div>

            </div>
          )}
        </div>

      </div>
    </header>
  );
}
