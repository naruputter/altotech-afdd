import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar.tsx';
import TopHeader from './components/layout/TopHeader.tsx';
import AICopilotDrawer from './components/ai/AICopilotDrawer.tsx';
import TelemetryPage from './pages/TelemetryPage.tsx';
import TelemetryHistoryPage from './pages/TelemetryHistoryPage.tsx';
import IssuesPage from './pages/issues/IssuesPage.tsx';
import EnergyPage from './pages/EnergyPage.tsx';
import SpacesPage from './pages/spaces/SpacesPage.tsx';
import EquipmentPage from './pages/equipment/EquipmentPage.tsx';
import OntologyPage from './pages/ontology/OntologyPage.tsx';
import RulesPage from './pages/rules/RulesPage.tsx';
import SettingsPage from './pages/settings/SettingsPage.tsx';
import SimulatorPage from './pages/SimulatorPage.tsx';
import { checkHealth, issueService } from './services/index.ts';
import { Issue, Site } from './types/index.ts';
import { siteService } from './services/siteService.ts';
import { WebSocketProvider, useWebSocket } from './context/WebSocketContext.tsx';

interface AppContentProps {
  currentSite: string;
  onSelectSite: (siteId: string) => void;
}

function AppContent({ currentSite, onSelectSite }: AppContentProps) {
  const [backendStatus, setBackendStatus] = useState<string>('healthy');
  const [activeIssueCount, setActiveIssueCount] = useState<number>(0);
  const [isAiOpen, setIsAiOpen] = useState<boolean>(false);
  const [aiContext, setAiContext] = useState<Issue | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const { subscribe, isConnected } = useWebSocket();

  // Fetch initial active issue count on mount or site change (only OPEN / unacknowledged issues)
  useEffect(() => {
    if (currentSite) {
      issueService.getOpenIssueCount(currentSite)
        .then(count => setActiveIssueCount(count))
        .catch(err => console.error('Failed to load initial issue count:', err));
    }
  }, [currentSite]);

  // Subscribe to real-time issue creation and resolution via WebSocket
  useEffect(() => {
    const unsubCreated = subscribe('issue.created', (event) => {
      if (!currentSite || event.site_id === currentSite || currentSite === 'all') {
        setActiveIssueCount(prev => prev + 1);
      }
    });

    const unsubResolved = subscribe('issue.resolved', (event) => {
      if (!currentSite || event.site_id === currentSite || currentSite === 'all') {
        setActiveIssueCount(prev => Math.max(0, prev - 1));
      }
    });

    return () => {
      unsubCreated();
      unsubResolved();
    };
  }, [subscribe, currentSite]);

  const handleSelectSite = (siteId: string) => {
    onSelectSite(siteId);
  };

  // Check backend health once on mount
  useEffect(() => {
    checkHealth().then(health => {
      setBackendStatus(health.status === 'healthy' ? 'healthy' : 'simulation');
    });
  }, []);


  const handleSelectIssueForAI = (issue: Issue) => {
    setAiContext(issue);
    setIsAiOpen(true);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-app)' }}>
      
      {/* 1. Left Enterprise Sidebar Navigation (Collapsible) */}
      <Sidebar 
        issueCount={activeIssueCount}
        backendStatus={backendStatus}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
      />

      {/* 2. Main Body with Top Header and Dynamic Pages */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        
        {/* Top Header with Account Profile & Site Switcher */}
        <TopHeader 
          currentSite={currentSite}
          onSelectSite={handleSelectSite}
          onToggleAICopilot={() => setIsAiOpen(prev => !prev)}
          issueCount={activeIssueCount}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed(prev => !prev)}
        />

        {/* Dynamic Page Rendering via React Router */}
        <main style={{ flex: 1, padding: '16px 24px', maxWidth: '100%', width: '100%', margin: '0 auto', height: 'calc(100vh - 64px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/telemetry" replace />} />
            <Route path="/telemetry" element={<TelemetryPage currentSite={currentSite} onSelectIssueForAI={handleSelectIssueForAI} />} />
            <Route path="/telemetry-history" element={<TelemetryHistoryPage currentSite={currentSite} />} />
            <Route path="/issues" element={<IssuesPage currentSite={currentSite} onSelectIssueForAI={handleSelectIssueForAI} onIssueCountChange={setActiveIssueCount} />} />
            <Route path="/energy" element={<EnergyPage currentSite={currentSite} />} />
            <Route path="/spaces" element={<SpacesPage currentSite={currentSite} />} />
            <Route path="/equipment" element={<EquipmentPage currentSite={currentSite} />} />
            <Route path="/ontology" element={<OntologyPage currentSite={currentSite} />} />
            <Route path="/rules" element={<RulesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/simulator" element={<SimulatorPage />} />
            <Route path="*" element={<Navigate to="/telemetry" replace />} />
          </Routes>
        </main>

      </div>

      {/* 3. AI Copilot Drawer */}
      <AICopilotDrawer 
        isOpen={isAiOpen} 
        onClose={() => { setIsAiOpen(false); setAiContext(null); }}
        initialContext={aiContext}
      />

    </div>
  );
}

export default function App() {
  const [currentSite, setCurrentSite] = useState<string>(() => {
    return localStorage.getItem('afdd_current_site') || '';
  });

  // Initialize and load actual sites from backend
  useEffect(() => {
    async function initSites() {
      try {
        const sites = await siteService.getSites();
        if (sites && sites.length > 0) {
          const savedSite = localStorage.getItem('afdd_current_site');
          const matched = sites.find(s => s.id === savedSite);
          const activeId = matched ? matched.id : sites[0].id;
          setCurrentSite(activeId);
          localStorage.setItem('afdd_current_site', activeId);
        }
      } catch (err) {
        console.error('Failed to initialize sites:', err);
      }
    }
    initSites();
  }, []);

  const handleSelectSite = (siteId: string) => {
    setCurrentSite(siteId);
    localStorage.setItem('afdd_current_site', siteId);
  };

  return (
    <WebSocketProvider siteId={currentSite}>
      <AppContent currentSite={currentSite} onSelectSite={handleSelectSite} />
    </WebSocketProvider>
  );
}
