import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Layers, Boxes, Database, Network, Globe, FileText, Lock, User, Shield } from 'lucide-react';
import { NamespaceMap, NamespaceWorkload, ConnectedService, ConnectedIngress, ConnectedConfigMap, ConnectedSecret, ConnectedServiceAccount, ConnectedNetworkPolicy } from '../../types/workloads';
import { Graph } from '../../types/graph';
import { MapLaneColumn } from '../DeployMapSection/MapLaneColumn';
import { MapNode } from '../DeployMapSection/MapNode';
import { ConnectionLines } from '../LaneView/ConnectionLines';

interface Props {
  nsMap: NamespaceMap | null;
  loading: boolean;
  selectedNodeKey: string | null;
  onNodeSelect: (key: string | null) => void;
  onNavigateToDeployMap: (namespace: string, name: string) => void;
  graph: Graph | null;
}

export const NamespaceMapCanvas: React.FC<Props> = ({
  nsMap, loading, selectedNodeKey, onNodeSelect, onNavigateToDeployMap, graph
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRefs = useRef<Record<string, HTMLElement | null>>({});
  const [refVersion, setRefVersion] = useState(0);

  const registerRef = (key: string, el: HTMLElement | null) => {
    if (elementRefs.current[key] !== el) {
      elementRefs.current[key] = el;
      setRefVersion(v => v + 1);
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => setRefVersion(v => v + 1));
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [nsMap]);

  const connections = useMemo(() => {
    if (!nsMap) return [];
    const conns: { id: string; sourceId: string; targetId: string; type: string; animated?: boolean }[] = [];

    nsMap.workloads.forEach((wl: NamespaceWorkload) => {
      const tgtKey = `workload-${wl.kind}-${wl.name}`;
      wl.service_names.forEach((svcName: string) => {
        const srcKey = `svc-${svcName}`;
        conns.push({
          id: `${srcKey}->${tgtKey}`,
          sourceId: srcKey,
          targetId: tgtKey,
          type: 'service_selects_pod',
          animated: true
        });
      });
    });

    if (graph) {
      const ingressEdges = graph.edges.filter(e => e.type === 'ingress_to_service');
      ingressEdges.forEach(edge => {
        const sourceNode = graph.nodes.find(n => n.id === edge.source);
        const targetNode = graph.nodes.find(n => n.id === edge.target);
        if (sourceNode?.namespace === nsMap.namespace && targetNode?.namespace === nsMap.namespace) {
          const tgtKey = `svc-${targetNode.label}`;
          const srcKey = `ingress-${sourceNode.label}`;
          conns.push({
            id: `${srcKey}->${tgtKey}`,
            sourceId: srcKey,
            targetId: tgtKey,
            type: 'ingress_to_service'
          });
        }
      });
    }

    return conns;
  }, [nsMap, graph]);

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-canvas)' }}>
        <div className="spinner" style={{ width: '24px', height: '24px', border: '2px solid var(--border)', borderTopColor: 'var(--text-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!nsMap) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-canvas)', color: 'var(--text-muted)' }}>
        <Layers size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
        <div style={{ fontSize: '14px' }}>Select a namespace</div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'var(--bg-canvas)' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', overflowX: 'auto', overflowY: 'hidden', display: 'flex', padding: '32px', gap: '64px' }}>
        <ConnectionLines
          connections={connections}
          getRect={(id) => {
            const el = elementRefs.current[id];
            if (!el || !containerRef.current) return null;
            const elRect = el.getBoundingClientRect();
            const containerRect = containerRef.current.getBoundingClientRect();
            
            // If the element is completely scrolled out of the container's view vertically, hide the line
            if (elRect.bottom < containerRect.top || elRect.top > containerRect.bottom) {
              return null;
            }

            return new DOMRect(
              elRect.left - containerRect.left,
              elRect.top - containerRect.top,
              elRect.width,
              elRect.height
            );
          }}
          containerRef={containerRef}
          refVersion={refVersion}
        />

        <MapLaneColumn laneId="ingresses" onScroll={() => setRefVersion(v => v + 1)}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Ingresses ({nsMap.ingresses.length})</div>
          {nsMap.ingresses.map((ing: ConnectedIngress) => {
            const key = `ingress-${ing.name}`;
            return (
              <MapNode
                key={key}
                nodeKey={key}
                icon={Globe}
                label={ing.name}
                subtitle={ing.hosts[0] || 'No rules'}
                accentColor="var(--ingress)"
                selected={selectedNodeKey === key}
                onSelect={() => onNodeSelect(key)}
                registerRef={registerRef}
              />
            );
          })}
        </MapLaneColumn>

        <MapLaneColumn laneId="services" onScroll={() => setRefVersion(v => v + 1)}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Services ({nsMap.services.length})</div>
          {nsMap.services.map((svc: ConnectedService) => {
            const key = `svc-${svc.name}`;
            return (
              <MapNode
                key={key}
                nodeKey={key}
                icon={Network}
                label={svc.name}
                subtitle={svc.cluster_ip || 'None'}
                badge={svc.service_type}
                accentColor="var(--service)"
                selected={selectedNodeKey === key}
                onSelect={() => onNodeSelect(key)}
                registerRef={registerRef}
              />
            );
          })}
        </MapLaneColumn>

        <MapLaneColumn laneId="workloads" onScroll={() => setRefVersion(v => v + 1)}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Workloads ({nsMap.workloads.length})</div>
          {nsMap.workloads.map((wl: NamespaceWorkload) => {
            let Icon = Boxes;
            if (wl.kind === 'StatefulSet') Icon = Database;
            if (wl.kind === 'DaemonSet') Icon = Layers;

            const key = `workload-${wl.kind}-${wl.name}`;
            return (
              <div key={key} onDoubleClick={() => onNavigateToDeployMap(nsMap.namespace, wl.name)} title="Double-click to open Deploy Map">
                <MapNode
                  nodeKey={key}
                  icon={Icon}
                  label={wl.name}
                  subtitle={`${wl.kind} · ${wl.ready_string}`}
                  badge={wl.health}
                  accentColor="var(--pod)"
                  selected={selectedNodeKey === key}
                  onSelect={() => onNodeSelect(key)}
                  registerRef={registerRef}
                />
              </div>
            );
          })}
        </MapLaneColumn>

        <MapLaneColumn laneId="config" onScroll={() => setRefVersion(v => v + 1)}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Config ({nsMap.config_maps.length + nsMap.secrets.length + nsMap.service_accounts.length})</div>
          {nsMap.config_maps.map((cm: ConnectedConfigMap) => {
            const key = `cm-${cm.name}`;
            return (
              <MapNode
                key={key}
                nodeKey={key}
                icon={FileText}
                label={cm.name}
                subtitle={`${cm.keys.length} keys`}
                accentColor="var(--cluster-node)"
                selected={selectedNodeKey === key}
                onSelect={() => onNodeSelect(key)}
                registerRef={registerRef}
              />
            );
          })}
          {nsMap.secrets.map((sec: ConnectedSecret) => {
            const key = `secret-${sec.name}`;
            return (
              <MapNode
                key={key}
                nodeKey={key}
                icon={Lock}
                label={sec.name}
                subtitle={`${sec.keys.length} keys · ${sec.secret_type}`}
                accentColor="var(--netpol)"
                selected={selectedNodeKey === key}
                onSelect={() => onNodeSelect(key)}
                registerRef={registerRef}
              />
            );
          })}
          {nsMap.service_accounts.map((sa: ConnectedServiceAccount) => {
            const key = `sa-${sa.name}`;
            return (
              <MapNode
                key={key}
                nodeKey={key}
                icon={User}
                label={sa.name}
                subtitle={sa.namespace}
                accentColor="var(--service)"
                selected={selectedNodeKey === key}
                onSelect={() => onNodeSelect(key)}
                registerRef={registerRef}
              />
            );
          })}
        </MapLaneColumn>

        <MapLaneColumn laneId="security" onScroll={() => setRefVersion(v => v + 1)}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Security ({nsMap.network_policies.length})</div>
          {nsMap.network_policies.map((np: ConnectedNetworkPolicy) => {
            const key = `netpol-${np.name}`;
            return (
              <MapNode
                key={key}
                nodeKey={key}
                icon={Shield}
                label={np.name}
                subtitle={np.summary}
                accentColor="var(--netpol)"
                selected={selectedNodeKey === key}
                onSelect={() => onNodeSelect(key)}
                registerRef={registerRef}
              />
            );
          })}
        </MapLaneColumn>
      </div>
    </div>
  );
};
