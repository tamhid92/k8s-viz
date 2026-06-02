import React, { useState, useEffect, useRef } from 'react';
import { DeployMapSectionHeader } from './DeployMapSectionHeader';
import { DeploymentList } from './DeploymentList';
import { DeploymentMapCanvas } from './DeploymentMapCanvas';
import { DeployMapDetailPanel } from './DeployMapDetailPanel';
import { DeploymentMap } from '../../types/workloads';

interface Props {
  initialDeployment?: { namespace: string; name: string } | null;
  onNavigateToNetwork: (ns: string, id?: string) => void;
}

export const DeployMapSection: React.FC<Props> = ({ initialDeployment, onNavigateToNetwork }) => {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mapData, setMapData] = useState<DeploymentMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (initialDeployment) {
      setSelectedKey(`${initialDeployment.namespace}/${initialDeployment.name}`);
    }
  }, [initialDeployment]);

  useEffect(() => {
    if (!selectedKey) {
      setMapData(null);
      setLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const parts = selectedKey.split('/');
    const ns = parts[0];
    const name = parts[1];

    setLoading(true);
    setMapData(null);
    setSelectedNodeKey(null);

    fetch(`/api/v1/workloads/deployments/${ns}/${name}/map`, {
      signal: abortControllerRef.current.signal
    })
      .then(r => r.json())
      .then(data => {
        setMapData(data.deployment_name ? data : null);
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
  }, [selectedKey]);

  let namespace = null;
  let name = null;
  if (selectedKey) {
    const parts = selectedKey.split('/');
    namespace = parts[0];
    name = parts[1];
  }

  const handleViewInNetwork = () => {
    if (namespace && name) {
      onNavigateToNetwork(namespace, `deploy-${name}`);
    }
  };

  return (
    <div style={{
      paddingTop: 'var(--section-header-height)',
      paddingBottom: 'var(--status-bar-height)',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <DeployMapSectionHeader
        namespace={namespace}
        name={name}
        onViewInNetwork={handleViewInNetwork}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <DeploymentList selected={selectedKey} onSelect={setSelectedKey} />
        
        <DeploymentMapCanvas
          map={mapData}
          loading={loading}
          selectedNodeKey={selectedNodeKey}
          onNodeSelect={setSelectedNodeKey}
        />

        <DeployMapDetailPanel
          nodeKey={selectedNodeKey}
          map={mapData}
          onClose={() => setSelectedNodeKey(null)}
        />
      </div>
    </div>
  );
};
