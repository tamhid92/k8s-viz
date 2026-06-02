import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Loader2, Share2, Boxes, Server, Network, Globe, FileText, Lock, Shield, User } from 'lucide-react';
import { DeploymentMap } from '../../types/workloads';
import { MapLaneColumn } from './MapLaneColumn';
import { MapNode } from './MapNode';
import { ConnectionLines } from '../LaneView/ConnectionLines';
import { healthColor } from '../../lib/workloadUtils';

interface Props {
  map: DeploymentMap | null;
  loading: boolean;
  selectedNodeKey: string | null;
  onNodeSelect: (key: string | null) => void;
}

import { EdgeType } from '../../types/graph';

interface MapConnection {
  id: string;
  sourceId: string;
  targetId: string;
  edgeType: EdgeType;
  animated: boolean;
}

export const DeploymentMapCanvas: React.FC<Props> = ({ map, loading, selectedNodeKey, onNodeSelect }) => {
  const [nodeRects, setNodeRects] = useState<Map<string, DOMRect>>(new Map());
  const elementsRef = useRef<Map<string, HTMLElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);

  const [refVersion, setRefVersion] = useState(0);

  const updateRects = useCallback(() => {
    if (!containerRef.current) return;
    const canvasRect = containerRef.current.getBoundingClientRect();
    const newRects = new Map<string, DOMRect>();
    elementsRef.current.forEach((el, key) => {
      const rect = el.getBoundingClientRect();
      if (rect.bottom < canvasRect.top || rect.top > canvasRect.bottom) return;
      newRects.set(key, new DOMRect(
        rect.left - canvasRect.left,
        rect.top - canvasRect.top,
        rect.width,
        rect.height
      ));
    });
    setNodeRects(newRects);
    setRefVersion(v => v + 1);
  }, []);

  const registerRef = useCallback((key: string, el: HTMLElement | null) => {
    if (el) {
      elementsRef.current.set(key, el);
      if (resizeObserver.current) resizeObserver.current.observe(el);
    } else {
      const existing = elementsRef.current.get(key);
      if (existing && resizeObserver.current) resizeObserver.current.unobserve(existing);
      elementsRef.current.delete(key);
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    resizeObserver.current = new ResizeObserver(() => {
      requestAnimationFrame(updateRects);
    });
    resizeObserver.current.observe(containerRef.current);
    
    setTimeout(updateRects, 50);

    return () => {
      if (resizeObserver.current) {
        resizeObserver.current.disconnect();
      }
    };
  }, [updateRects, map]);

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        <Loader2 size={32} className="spin" style={{ marginBottom: '16px', animation: 'spin 1s linear infinite' }} />
        <div style={{ fontSize: '14px' }}>Loading resource map...</div>
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!map) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        <Share2 size={32} style={{ marginBottom: '16px', opacity: 0.5 }} />
        <div style={{ fontSize: '14px' }}>Select a deployment</div>
      </div>
    );
  }

  const connections: MapConnection[] = [];
  
  map.pod_groups.forEach((g, gi) => {
    connections.push({ id: `dep-pod-${g.label}-${gi}`, sourceId: 'deploy', targetId: `podgroup-${g.label}-${gi}`, edgeType: 'service_selects_pod', animated: true });
    g.host_nodes.forEach((n, ni) => {
      connections.push({ id: `pod-${g.label}-node-${n}-${gi}-${ni}`, sourceId: `podgroup-${g.label}-${gi}`, targetId: `node-${n}-${gi}-${ni}`, edgeType: 'pod_to_node', animated: false });
    });
  });

  map.services.forEach(s => {
    connections.push({ id: `dep-svc-${s.name}`, sourceId: 'deploy', targetId: `svc-${s.name}`, edgeType: 'service_selects_pod', animated: true });
    map.ingresses.forEach(i => {
      connections.push({ id: `svc-${s.name}-ing-${i.name}`, sourceId: `svc-${s.name}`, targetId: `ingress-${i.name}`, edgeType: 'ingress_to_service', animated: true });
    });
  });

  map.config_maps.forEach(c => {
    connections.push({ id: `dep-cm-${c.name}`, sourceId: 'deploy', targetId: `cm-${c.name}`, edgeType: 'pod_to_namespace', animated: false });
  });

  map.secrets.forEach(s => {
    connections.push({ id: `dep-sec-${s.name}`, sourceId: 'deploy', targetId: `secret-${s.name}`, edgeType: 'pod_to_namespace', animated: false });
  });

  map.network_policies.forEach(n => {
    connections.push({ id: `dep-netpol-${n.name}`, sourceId: 'deploy', targetId: `netpol-${n.name}`, edgeType: 'netpol_selects_pod', animated: false });
  });

  if (map.service_account) {
    connections.push({ id: `dep-sa-${map.service_account.name}`, sourceId: 'deploy', targetId: `sa-${map.service_account.name}`, edgeType: 'pod_to_namespace', animated: false });
  }

  const handleContainerClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onNodeSelect(null);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ height: '40px', borderBottom: '1px solid var(--border)', display: 'flex', background: 'var(--bg-elevated)', flexShrink: 0 }}>
        <div style={{ flex: 1, borderRight: '1px solid var(--border)', padding: '0 16px', display: 'flex', alignItems: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deployment</div>
        <div style={{ flex: 1, borderRight: '1px solid var(--border)', padding: '0 16px', display: 'flex', alignItems: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pods / Nodes</div>
        <div style={{ flex: 1, borderRight: '1px solid var(--border)', padding: '0 16px', display: 'flex', alignItems: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Services / Ingress</div>
        <div style={{ flex: 1, borderRight: '1px solid var(--border)', padding: '0 16px', display: 'flex', alignItems: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Config</div>
        <div style={{ flex: 1, padding: '0 16px', display: 'flex', alignItems: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Security</div>
      </div>

      <div ref={containerRef} onClick={handleContainerClick} style={{ flex: 1, display: 'flex', overflowY: 'auto', position: 'relative' }}>
        <ConnectionLines connections={connections} getRect={(id) => nodeRects.get(id) || null} containerRef={containerRef} refVersion={refVersion} />

        <MapLaneColumn laneId="deployment" onScroll={updateRects}>
          <MapNode
            nodeKey="deploy"
            icon={Boxes}
            label={map.deployment_name}
            subtitle={map.namespace}
            accentColor="var(--ingress)"
            selected={selectedNodeKey === 'deploy'}
            onSelect={() => onNodeSelect('deploy')}
            registerRef={registerRef}
            extraRows={
              <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: healthColor(map.health as any) }} />
                  <div style={{ fontSize: '12px', textTransform: 'capitalize' }}>{map.health}</div>
                </div>
                <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                  ×{map.ready_replicas}/{map.desired_replicas} replicas
                </div>
              </div>
            }
          />
        </MapLaneColumn>

        <MapLaneColumn laneId="compute" onScroll={updateRects}>
          {map.pod_groups.map((g, gi) => (
            <React.Fragment key={`${g.label}-${gi}`}>
              <MapNode
                nodeKey={`podgroup-${g.label}-${gi}`}
                icon={Boxes}
                label={g.label}
                subtitle={`×${g.replica_count} pods`}
                badge={`${g.pods.filter(p => p.ready).length}/${g.pods.length} ready`}
                accentColor="var(--pod)"
                selected={selectedNodeKey === `podgroup-${g.label}-${gi}`}
                onSelect={() => onNodeSelect(`podgroup-${g.label}-${gi}`)}
                registerRef={registerRef}
              />
              {g.host_nodes.map((n, ni) => {
                const nodeData = map.nodes.find(nd => nd.name === n);
                return (
                  <div key={`${n}-${gi}-${ni}`} style={{ paddingLeft: '20px', width: '100%', display: 'flex', justifyContent: 'center' }}>
                    <MapNode
                      nodeKey={`node-${n}-${gi}-${ni}`}
                      icon={Server}
                      label={n}
                      subtitle={nodeData?.internal_ip || 'unknown IP'}
                      accentColor="var(--cluster-node)"
                      selected={selectedNodeKey === `node-${n}-${gi}-${ni}`}
                      onSelect={() => onNodeSelect(`node-${n}-${gi}-${ni}`)}
                      registerRef={registerRef}
                    />
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </MapLaneColumn>

        <MapLaneColumn laneId="traffic" onScroll={updateRects}>
          {map.services.map(s => (
            <MapNode
              key={s.name}
              nodeKey={`svc-${s.name}`}
              icon={Network}
              label={s.name}
              subtitle={s.cluster_ip || 'None'}
              badge={s.service_type}
              accentColor="var(--service)"
              selected={selectedNodeKey === `svc-${s.name}`}
              onSelect={() => onNodeSelect(`svc-${s.name}`)}
              registerRef={registerRef}
            />
          ))}
          {map.ingresses.map(i => (
            <MapNode
              key={i.name}
              nodeKey={`ingress-${i.name}`}
              icon={Globe}
              label={i.name}
              subtitle={i.hosts.length > 0 ? i.hosts[0] : 'No rules'}
              accentColor="var(--ingress)"
              selected={selectedNodeKey === `ingress-${i.name}`}
              onSelect={() => onNodeSelect(`ingress-${i.name}`)}
              registerRef={registerRef}
            />
          ))}
        </MapLaneColumn>

        <MapLaneColumn laneId="config" onScroll={updateRects}>
          {map.config_maps.map(c => (
            <MapNode
              key={c.name}
              nodeKey={`cm-${c.name}`}
              icon={FileText}
              label={c.name}
              subtitle={`${c.keys.length} keys · ${c.mount_type}`}
              badge="CM"
              accentColor="var(--cluster-node)"
              selected={selectedNodeKey === `cm-${c.name}`}
              onSelect={() => onNodeSelect(`cm-${c.name}`)}
              registerRef={registerRef}
            />
          ))}
          {map.secrets.map(s => (
            <MapNode
              key={s.name}
              nodeKey={`secret-${s.name}`}
              icon={Lock}
              label={s.name}
              subtitle={`${s.keys.length} keys · ${s.mount_type}`}
              badge={s.secret_type.replace('kubernetes.io/', '')}
              accentColor="var(--netpol)"
              selected={selectedNodeKey === `secret-${s.name}`}
              onSelect={() => onNodeSelect(`secret-${s.name}`)}
              registerRef={registerRef}
            />
          ))}
        </MapLaneColumn>

        <MapLaneColumn laneId="security" onScroll={updateRects}>
          {map.network_policies.map(n => (
            <MapNode
              key={n.name}
              nodeKey={`netpol-${n.name}`}
              icon={Shield}
              label={n.name}
              subtitle={n.summary}
              badge={n.policy_types.join(', ')}
              accentColor="var(--netpol)"
              selected={selectedNodeKey === `netpol-${n.name}`}
              onSelect={() => onNodeSelect(`netpol-${n.name}`)}
              registerRef={registerRef}
            />
          ))}
          {map.service_account && (() => {
            const sa = map.service_account;
            return (
              <MapNode
                nodeKey={`sa-${sa.name}`}
                icon={User}
                label={sa.name}
                subtitle={sa.namespace}
                accentColor="var(--service)"
                selected={selectedNodeKey === `sa-${sa.name}`}
                onSelect={() => onNodeSelect(`sa-${sa.name}`)}
                registerRef={registerRef}
              />
            );
          })()}
        </MapLaneColumn>
      </div>
    </div>
  );
};
