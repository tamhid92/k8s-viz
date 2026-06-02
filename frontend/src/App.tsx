import React, { useState } from 'react';
import { useGraph } from './hooks/useGraph';
import { useSocket } from './hooks/useSocket';
import { Shell } from './components/Shell/Shell';
import { WorkloadsSection } from './components/WorkloadsSection/WorkloadsSection';
import { NetworkSection } from './components/NetworkSection/NetworkSection';
import { NetworkSectionHeader } from './components/NetworkSection/NetworkSectionHeader';
import { EventsSection } from './components/EventsSection/EventsSection';
import { RbacSection } from './components/RbacSection/RbacSection';
import { ConfigSection } from './components/ConfigSection/ConfigSection';
import { StatusBar } from './components/StatusBar/StatusBar';
import { ViewMode, WorkloadGroup } from './types/graph';
import { TraceRequest } from './types/trace';

import { DeployMapSection } from './components/DeployMapSection/DeployMapSection';
import { NamespaceMapSection } from './components/NamespaceMapSection/NamespaceMapSection';
import { LogManagerProvider } from './context/LogManagerContext';
import { LogsSection } from './components/LogsSection/LogsSection';

export type SectionId = 'network' | 'workloads' | 'deploymap' | 'nsmap' | 'events' | 'rbac' | 'config' | 'logs';

export type AppView =
  | { screen: 'overview' }
  | { screen: 'transitioning-in'; namespace: string }
  | { screen: 'lane'; namespace: string }
  | { screen: 'transitioning-out'; namespace: string };

const App: React.FC = () => {
  const { graph, namespaceStats } = useGraph();
  const { connected } = useSocket();
  const [activeSection, setActiveSection] = useState<SectionId>('network');
  const [logsSubTab, setLogsSubTab] = useState<'pods' | 'deployments' | 'system'>('pods');
  const [view, setView] = useState<AppView>({ screen: 'overview' });
  const [viewMode, setViewMode] = useState<ViewMode>('policy');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [traceRequest, setTraceRequest] = useState<TraceRequest | null>(null);
  const [latestWorkloadGroups, setLatestWorkloadGroups] = useState<WorkloadGroup[]>([]);
  const [initialDeployment, setInitialDeployment] = useState<{namespace: string, name: string} | null>(null);

  const handleNamespaceSelect = (ns: string) => {
    setView({ screen: 'transitioning-in', namespace: ns });
    setTimeout(() => setView({ screen: 'lane', namespace: ns }), 400);
  };

  const handleBack = () => {
    const currentNs = 'namespace' in view ? view.namespace : null;
    if (!currentNs) return;
    setView({ screen: 'transitioning-out', namespace: currentNs });
    setTimeout(() => setView({ screen: 'overview' }), 350);
  };

  const handleNavigate = (targetNamespace: string, targetNodeId?: string) => {
    setView({ screen: 'transitioning-out', namespace: 'namespace' in view ? view.namespace : targetNamespace });
    setTimeout(() => {
      setView({ screen: 'lane', namespace: targetNamespace });
      if (targetNodeId) setSelectedNodeId(targetNodeId);
    }, 350);
  };

  return (
    <LogManagerProvider onSectionChange={setActiveSection}>
      <Shell
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        connected={connected}
        clusterInfo={graph?.cluster_info ?? null}
        logsSubTab={logsSubTab}
        onLogsSubTabChange={setLogsSubTab}
      >
        {activeSection === 'network' && (
        <>
          <NetworkSectionHeader
            view={view}
            viewMode={viewMode}
            onViewModeChange={(mode) => {
              setViewMode(mode);
              setSelectedNodeId(null);
            }}
            onBack={handleBack}
          />
          <NetworkSection
            view={view}
            viewMode={viewMode}
            onViewModeChange={(mode) => {
              setViewMode(mode);
              setSelectedNodeId(null);
            }}
            graph={graph}
            namespaceStats={namespaceStats}
            selectedNodeId={selectedNodeId}
            onNodeSelect={setSelectedNodeId}
            traceRequest={traceRequest}
            onTraceRequest={setTraceRequest}
            latestWorkloadGroups={latestWorkloadGroups}
            onWorkloadGroupsChange={setLatestWorkloadGroups}
            onNamespaceSelect={handleNamespaceSelect}
            onNavigate={handleNavigate}
          />
        </>
      )}
      {activeSection === 'workloads' && <WorkloadsSection />}
      {activeSection === 'deploymap' && (
        <DeployMapSection
          initialDeployment={initialDeployment}
          onNavigateToNetwork={(ns: string, id?: string) => {
            setActiveSection('network');
            handleNavigate(ns, id);
          }}
        />
      )}
      {activeSection === 'nsmap' && (
        <NamespaceMapSection
          graph={graph}
          namespaceStats={namespaceStats}
          onNavigate={(section: SectionId, params: Record<string, string>) => {
            if (section === 'deploymap' && params.namespace && params.name) {
              setInitialDeployment({ namespace: params.namespace, name: params.name });
              setActiveSection('deploymap');
            }
          }}
        />
      )}
      {activeSection === 'logs' && <LogsSection logsSubTab={logsSubTab} />}
      {activeSection === 'events' && <EventsSection />}
      {activeSection === 'rbac' && <RbacSection />}
      {activeSection === 'config' && <ConfigSection />}
      
        <StatusBar
          stats={namespaceStats}
          edgeCount={graph?.edges.length || 0}
        />
      </Shell>
    </LogManagerProvider>
  );
};

export default App;
