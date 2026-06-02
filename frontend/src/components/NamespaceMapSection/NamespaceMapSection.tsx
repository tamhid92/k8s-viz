import React, { useState, useEffect, useRef } from 'react';
import { SectionId } from '../../App';
import { NamespaceMap } from '../../types/workloads';
import { Graph } from '../../types/graph';
import { NamespaceStats } from '../../lib/laneTransform';
import { NamespaceMapSectionHeader } from './NamespaceMapSectionHeader';
import { NamespaceList } from './NamespaceList';
import { NamespaceMapCanvas } from './NamespaceMapCanvas';
import { DeployMapDetailPanel } from '../DeployMapSection/DeployMapDetailPanel';

interface Props {
  graph: Graph | null;
  namespaceStats: NamespaceStats[];
  onNavigate: (section: SectionId, params: Record<string, string>) => void;
}

export const NamespaceMapSection: React.FC<Props> = ({ graph, namespaceStats, onNavigate }) => {
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(null);
  const [nsMap, setNsMap] = useState<NamespaceMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!selectedNamespace) {
      setNsMap(null);
      setLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setNsMap(null);
    setSelectedNodeKey(null);

    fetch(`/api/v1/workloads/namespaces/${selectedNamespace}/map`, {
      signal: abortControllerRef.current.signal
    })
      .then(r => r.json())
      .then(data => {
        setNsMap(data.namespace ? data : null);
        setLoading(false);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error(err);
          setLoading(false);
        }
      });

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [selectedNamespace]);

  const handleViewInNetwork = () => {
    if (selectedNamespace) {
      onNavigate('network', { namespace: selectedNamespace });
    }
  };

  const handleNavigateToDeployMap = (namespace: string, name: string) => {
    onNavigate('deploymap', { namespace, name });
  };

  // Convert NamespaceMap to DeploymentMap shape for DeployMapDetailPanel
  const detailMapData = nsMap ? {
    deployment_name: 'namespace-map',
    namespace: nsMap.namespace,
    desired_replicas: 0,
    ready_replicas: 0,
    health: 'healthy' as const,
    pod_groups: nsMap.workloads.map(w => w.pod_group),
    nodes: nsMap.nodes,
    services: nsMap.services,
    ingresses: nsMap.ingresses,
    network_policies: nsMap.network_policies,
    config_maps: nsMap.config_maps,
    secrets: nsMap.secrets,
    service_account: nsMap.service_accounts[0] || null
  } : null;

  return (
    <div style={{
      paddingTop: 'var(--section-header-height)',
      paddingBottom: 'var(--status-bar-height)',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <NamespaceMapSectionHeader
        namespace={selectedNamespace}
        summary={nsMap?.summary || null}
        onViewInNetwork={handleViewInNetwork}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <NamespaceList
          selected={selectedNamespace}
          onSelect={setSelectedNamespace}
          namespaceStats={namespaceStats}
        />
        
        <NamespaceMapCanvas
          nsMap={nsMap}
          loading={loading}
          selectedNodeKey={selectedNodeKey}
          onNodeSelect={setSelectedNodeKey}
          onNavigateToDeployMap={handleNavigateToDeployMap}
          graph={graph}
        />

        <DeployMapDetailPanel
          nodeKey={selectedNodeKey}
          map={detailMapData}
          onClose={() => setSelectedNodeKey(null)}
        />
      </div>
    </div>
  );
};
