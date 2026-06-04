import React, { useMemo } from 'react';
import { X, ArrowRight, ArrowLeft, Boxes, Shield, ShieldAlert, ScrollText, FileText } from 'lucide-react';
import { useLogManager } from '../../hooks/useLogManager';
import { Graph, PodData, ServiceData, IngressData, NetworkPolicyData, ClusterNodeData, NamespaceData, WorkloadGroup } from '../../types/graph';
import { TraceRequest } from '../../types/trace';
import { NODE_COLORS, NODE_LABELS, POD_PHASE_COLORS } from '../../lib/constants';
import { toPolicyLaneData, groupPods } from '../../lib/laneTransform';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface DetailPanelProps {
  nodeId: string | null;
  groupId: string | null;
  graph: Graph | null;
  namespace: string | null;
  onClose: () => void;
  onNavigate: (namespace: string, nodeId: string) => void;
  workloadGroups?: WorkloadGroup[];
  onTrace?: (req: TraceRequest) => void;
}

export const DetailPanel: React.FC<DetailPanelProps> = ({ nodeId, groupId, graph, namespace, onClose, onNavigate, workloadGroups, onTrace }) => {
  useEscapeKey(() => {
    onClose();
  });

  const { openLogTab, openDescribeTab } = useLogManager();
  const node = graph?.nodes.find(n => n.id === nodeId);
  const data = node?.data;
  
  const policyData = useMemo(() => {
    if (!graph || !namespace || !groupId) return null;
    return toPolicyLaneData(graph, namespace);
  }, [graph, namespace, groupId]);

  const group = policyData?.workloadGroups.find(g => g.groupId === groupId);

  const getWorkloadGroup = (id: string): WorkloadGroup | undefined => {
    if (!graph) return undefined;
    const actualGroupId = id.startsWith('cross-ns:') ? id.replace('cross-ns:', '') : id;
    
    let wg = workloadGroups?.find(g => g.groupId === actualGroupId);
    if (wg) return wg;

    const parts = actualGroupId.split('/');
    if (parts.length >= 3) {
      const ns = parts[1];
      const pods = graph.nodes.filter(n => n.type === 'pod' && n.namespace === ns);
      const groups = groupPods(pods, graph);
      return groups.find(g => g.groupId === actualGroupId);
    }
    return undefined;
  };

  const handleTrace = (conn: any) => {
    if (!workloadGroups || !onTrace || !groupId) {
      console.warn('handleTrace: missing workloadGroups, onTrace, or groupId');
      return;
    }
    const activeGroup = workloadGroups.find(g => g.groupId === groupId);
    if (!activeGroup || activeGroup.pods.length === 0) {
      console.warn('handleTrace: activeGroup not found or has no pods', { groupId, activeGroup });
      return;
    }

    const sourcePod = activeGroup.pods.find(p => (p.data as PodData).phase === 'Running') ?? activeGroup.pods[0];
    const isOutbound = conn.sourceId === groupId;

    if (isOutbound) {
      const destGroup = getWorkloadGroup(conn.targetId);
      if (!destGroup || destGroup.serviceIds.length === 0) {
        console.warn('handleTrace: destGroup not found or has no serviceIds', { targetId: conn.targetId, destGroup });
        return;
      }
      onTrace({
        fromPodId:   sourcePod.id,
        toServiceId: destGroup.serviceIds[0],
        fromLabel:   activeGroup.label,
        toLabel:     destGroup.label,
      });
    } else {
      const sourceGroup = getWorkloadGroup(conn.sourceId);
      if (!sourceGroup || sourceGroup.pods.length === 0) {
        console.warn('handleTrace: sourceGroup not found or has no pods', { sourceId: conn.sourceId, sourceGroup });
        return;
      }
      const srcPod = sourceGroup.pods.find(p => (p.data as PodData).phase === 'Running') ?? sourceGroup.pods[0];
      const destGroup = workloadGroups.find(g => g.groupId === groupId);
      if (!destGroup || destGroup.serviceIds.length === 0) {
        console.warn('handleTrace: destGroup not found or has no serviceIds', { groupId, destGroup });
        return;
      }
      onTrace({
        fromPodId:   srcPod.id,
        toServiceId: destGroup.serviceIds[0],
        fromLabel:   sourceGroup.label,
        toLabel:     destGroup.label,
      });
    }
  };

  const renderGroupContent = () => {
    if (!group || !policyData) return null;

    const inbound = policyData.policyConnections.filter(c => c.targetId === groupId);
    const outbound = policyData.policyConnections.filter(c => c.sourceId === groupId);

    const inboundAllowed = inbound.filter(c => c.status === 'allowed');
    const outboundAllowed = outbound.filter(c => c.status === 'allowed');
    const implicit = [...inbound, ...outbound].filter(c => c.status === 'implicit');
    const blocked = [...inbound, ...outbound].filter(c => c.status === 'blocked');

    const renderPolicyList = (title: string, list: any[], type: 'allow' | 'block' | 'implicit') => {
      if (list.length === 0) return null;
      let icon = <Shield size={12} className="text-[var(--edge-netpol-allow)]" />;
      let titleColor = "text-[var(--edge-netpol-allow)]";
      if (type === 'block') {
        icon = <ShieldAlert size={12} className="text-[var(--edge-netpol-block)]" />;
        titleColor = "text-[var(--edge-netpol-block)]";
      } else if (type === 'implicit') {
        icon = <Shield size={12} className="text-[var(--text-muted)]" />;
        titleColor = "text-[var(--text-secondary)]";
      }

      return (
        <div className="mb-4">
          <div className={`text-[12px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${titleColor}`}>
            {icon} {title}
          </div>
          <div className="space-y-2">
            {list.map((c, i) => {
              const isSourceGroup = c.sourceId === groupId;
              const otherId = isSourceGroup ? c.targetId : c.sourceId;
              let otherLabel = otherId;
              if (otherId === 'external') otherLabel = 'Internet (external)';
              else if (otherId.startsWith('portal-entry-crossns')) otherLabel = 'Cross-Namespace Inbound';
              else if (otherId.startsWith('portal-exit-crossns')) otherLabel = 'Cross-Namespace Outbound';
              else {
                const otherGroup = policyData.workloadGroups.find(g => g.groupId === otherId);
                if (otherGroup) otherLabel = otherGroup.label;
              }

              const destGroupId = isSourceGroup ? otherId : groupId;
              const destGroupForTrace = destGroupId === groupId ? group : getWorkloadGroup(destGroupId);
              const hasService = !!destGroupForTrace && destGroupForTrace.serviceIds.length > 0;

              const showTrace = type === 'allow' && otherId !== 'external' && otherId !== 'unrestricted' && !otherId.startsWith('portal-') && hasService;

              return (
                <div key={i} className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded p-2 text-[11px] flex flex-col">
                  <div className="text-[var(--text-primary)] font-medium mb-1 break-all">
                    {isSourceGroup ? (
                      <><span>To: </span><span>{otherLabel}</span></>
                    ) : (
                      <><span>From: </span><span>{otherLabel}</span></>
                    )}
                  </div>
                  <div className="text-[10px] text-[var(--text-secondary)] font-mono break-all" title={c.ruleDescription}>
                    Rule: {c.ruleDescription || 'N/A'}
                  </div>
                  {c.ports && c.ports.length > 0 && (
                    <div className="text-[10px] text-[var(--text-muted)] mt-1 font-mono">
                      Ports: {c.ports.join(', ')}
                    </div>
                  )}
                  {showTrace && (
                    <div className="mt-2 flex justify-end">
                      <button 
                        onClick={() => handleTrace(c)}
                        style={{ flexShrink: 0, fontSize: '11px', color: 'var(--border-accent)', background: 'transparent', border: '1px solid var(--border-accent)', borderRadius: '3px', padding: '2px 6px', cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.08)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        Trace →
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-6">
        <div>
          {renderPolicyList('Inbound Allowed', inboundAllowed, 'allow')}
          {renderPolicyList('Outbound Allowed', outboundAllowed, 'allow')}
          {renderPolicyList('Implicit (No Policy)', implicit, 'implicit')}
          {renderPolicyList('Blocked', blocked, 'block')}
        </div>

        <div className="border-t border-[var(--border)] pt-4">
          <div className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center justify-between">
            <span>Replicas</span>
            <span className="px-1.5 py-0.5 bg-[var(--bg-elevated)] rounded border border-[var(--border)]">{group.pods.length}</span>
          </div>
          <div className="space-y-1">
            {group.pods.map(p => {
              const pd = p.data as PodData;
              return (
                <div key={p.id} className="flex justify-between items-center text-[11px] py-1 border-b border-[var(--border)] last:border-0">
                  <span className="font-mono text-[var(--text-secondary)] truncate flex-1">{p.label}</span>
                  <div className="flex items-center gap-1.5 ml-2 w-[80px] shrink-0 justify-end">
                    <span className="text-[var(--text-muted)]">{pd.phase}</span>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: POD_PHASE_COLORS[pd.phase] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (!data) return null;

    if (data.kind === 'pod') {
      const p = data as PodData;
      return (
        <div className="space-y-4">
          <div className="text-[13px] grid grid-cols-[100px_1fr] gap-2">
            <span className="text-[var(--text-muted)]">Phase</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: POD_PHASE_COLORS[p.phase] }} />
              <span>{p.phase}</span>
            </div>
            <span className="text-[var(--text-muted)]">Pod IP</span>
            <span className="font-mono text-[var(--text-code)]">{p.pod_ip || 'None'}</span>
            <span className="text-[var(--text-muted)]">Host IP</span>
            <span className="font-mono text-[var(--text-code)]">{p.host_ip || 'None'}</span>
            <span className="text-[var(--text-muted)]">Node</span>
            <span className="font-mono text-[var(--text-code)] truncate">{p.node_name || 'None'}</span>
          </div>

          <div>
            <div className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Containers</div>
            <div className="space-y-2">
              {p.containers.map((c, i) => (
                <div key={i} className="border border-[var(--border)] rounded px-3 py-2 text-[12px] space-y-1 bg-[var(--bg-base)]">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{c.name}</span>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${c.ready ? 'bg-[var(--status-running)]' : 'bg-[var(--status-failed)]'}`} />
                      <span className="text-[11px] text-[var(--text-muted)]">{c.ready ? 'Ready' : 'Not Ready'}</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)] font-mono truncate">{c.image}</div>
                  <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                    <span>Restarts: {c.restart_count}</span>
                    {c.ports.length > 0 && <span>Ports: {c.ports.join(', ')}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (data.kind === 'service') {
      const s = data as ServiceData;
      return (
        <div className="space-y-4">
          <div className="text-[13px] grid grid-cols-[100px_1fr] gap-2">
            <span className="text-[var(--text-muted)]">Type</span>
            <span>{s.type}</span>
            <span className="text-[var(--text-muted)]">Cluster IP</span>
            <span className="font-mono text-[var(--text-code)]">{s.cluster_ip || 'None'}</span>
            <span className="text-[var(--text-muted)]">External IPs</span>
            <span className="font-mono text-[var(--text-code)]">{s.external_ips.join(', ') || 'None'}</span>
          </div>

          <div>
            <div className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Selector</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(s.selector).map(([k, v]) => (
                <div key={k} className="px-2 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border)] text-[11px] font-mono text-[var(--text-secondary)]">
                  {k}={v}
                </div>
              ))}
              {Object.keys(s.selector).length === 0 && <span className="text-[12px] text-[var(--text-muted)]">None</span>}
            </div>
          </div>

          <div>
            <div className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Ports</div>
            <div className="space-y-1">
              {s.ports.map((p, i) => (
                <div key={i} className="font-mono text-[12px] text-[var(--text-secondary)]">
                  {p.port} → {p.target_port}/{p.protocol}
                  {p.node_port && <span className="text-[var(--text-muted)] ml-2">(NodePort: {p.node_port})</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (data.kind === 'ingress') {
      const ing = data as IngressData;
      return (
        <div className="space-y-4">
          <div className="text-[13px] grid grid-cols-[100px_1fr] gap-2">
            <span className="text-[var(--text-muted)]">Class</span>
            <span>{ing.ingress_class || 'None'}</span>
            <span className="text-[var(--text-muted)]">TLS Hosts</span>
            <span className="font-mono text-[var(--text-code)]">{ing.tls_hosts.join(', ') || 'None'}</span>
          </div>

          <div>
            <div className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Rules</div>
            <div className="space-y-3">
              {ing.rules.map((r, i) => (
                <div key={i} className="border border-[var(--border)] rounded overflow-hidden">
                  <div className="bg-[var(--bg-elevated)] border-b border-[var(--border)] px-3 py-1.5 text-[12px] font-mono text-[var(--text-code)] truncate">
                    {r.host || '*'}
                  </div>
                  <div className="p-2 space-y-1 bg-[var(--bg-base)]">
                    {r.paths.map((p, j) => (
                      <div key={j} className="grid grid-cols-[1fr_auto] gap-4 text-[11px] items-center">
                        <span className="font-mono text-[var(--text-secondary)] truncate">{p.path}</span>
                        <span className="text-[var(--text-muted)] text-right">
                          {p.backend_service}:{p.backend_port}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (data.kind === 'network_policy') {
      const np = data as NetworkPolicyData;
      return (
        <div className="space-y-4">
          <div className="text-[13px] grid grid-cols-[100px_1fr] gap-2">
            <span className="text-[var(--text-muted)]">Types</span>
            <div className="flex gap-1">
              {np.policy_types.map(t => (
                <span key={t} className="px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border)] text-[10px] uppercase">
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Pod Selector</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(np.pod_selector).map(([k, v]) => (
                <div key={k} className="px-2 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border)] text-[11px] font-mono text-[var(--text-secondary)]">
                  {k}={v}
                </div>
              ))}
              {Object.keys(np.pod_selector).length === 0 && <span className="text-[12px] text-[var(--text-muted)]">All pods</span>}
            </div>
          </div>

          {np.ingress_rules.length > 0 && (
            <div>
              <div className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Ingress Rules</div>
              <div className="text-[11px] text-[var(--text-secondary)] bg-[var(--bg-base)] border border-[var(--border)] rounded p-2">
                {np.ingress_rules.length} rule(s)
              </div>
            </div>
          )}

          {np.egress_rules.length > 0 && (
            <div>
              <div className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Egress Rules</div>
              <div className="text-[11px] text-[var(--text-secondary)] bg-[var(--bg-base)] border border-[var(--border)] rounded p-2">
                {np.egress_rules.length} rule(s)
              </div>
            </div>
          )}
        </div>
      );
    }

    if (data.kind === 'cluster_node') {
      const cn = data as ClusterNodeData;
      return (
        <div className="space-y-4">
          <div className="text-[13px] grid grid-cols-[100px_1fr] gap-2">
            <span className="text-[var(--text-muted)]">Status</span>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${cn.ready ? 'bg-[var(--status-running)]' : 'bg-[var(--status-failed)]'}`} />
              <span>{cn.ready ? 'Ready' : 'Not Ready'}</span>
            </div>
            <span className="text-[var(--text-muted)]">Internal IP</span>
            <span className="font-mono text-[var(--text-code)]">{cn.internal_ip || 'None'}</span>
            <span className="text-[var(--text-muted)]">Roles</span>
            <div className="flex gap-1 flex-wrap">
              {cn.roles.map(r => (
                <span key={r} className="px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border)] text-[10px] uppercase">
                  {r}
                </span>
              ))}
              {cn.roles.length === 0 && 'None'}
            </div>
            <span className="text-[var(--text-muted)]">Pod CIDR</span>
            <span className="font-mono text-[var(--text-code)]">{cn.pod_cidr || 'None'}</span>
            <span className="text-[var(--text-muted)]">CPU</span>
            <span className="font-mono text-[var(--text-secondary)]">{cn.capacity_cpu}</span>
            <span className="text-[var(--text-muted)]">Memory</span>
            <span className="font-mono text-[var(--text-secondary)]">{cn.capacity_memory}</span>
            <span className="text-[var(--text-muted)]">OS</span>
            <span className="font-mono text-[var(--text-secondary)] truncate" title={cn.os_image}>{cn.os_image}</span>
            <span className="text-[var(--text-muted)]">Kernel</span>
            <span className="font-mono text-[var(--text-secondary)] truncate" title={cn.kernel_version}>{cn.kernel_version}</span>
            <span className="text-[var(--text-muted)]">Runtime</span>
            <span className="font-mono text-[var(--text-secondary)] truncate" title={cn.container_runtime}>{cn.container_runtime}</span>
          </div>
        </div>
      );
    }

    if (data.kind === 'namespace') {
      const ns = data as NamespaceData;
      return (
        <div className="space-y-4">
          <div className="text-[13px] grid grid-cols-[100px_1fr] gap-2">
            <span className="text-[var(--text-muted)]">Status</span>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${ns.status === 'Active' ? 'bg-[var(--status-running)]' : 'bg-[var(--status-failed)]'}`} />
              <span>{ns.status}</span>
            </div>
            <span className="text-[var(--text-muted)]">Annotations</span>
            <span>{Object.keys(ns.annotations).length}</span>
          </div>

          <div>
            <div className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Labels</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(ns.labels).map(([k, v]) => (
                <div key={k} className="px-2 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border)] text-[11px] font-mono text-[var(--text-secondary)] max-w-full truncate">
                  <span className="opacity-70">{k}</span>={v}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderEdges = () => {
    if (!graph || !node) return null;
    
    const relatedEdges = graph.edges.filter(e => e.source === node.id || e.target === node.id);
    if (relatedEdges.length === 0) return null;

    return (
      <div className="mt-8 border-t border-[var(--border)] pt-4">
        <div className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Connected Edges</div>
        <div className="space-y-2">
          {relatedEdges.map(e => {
            const isSource = e.source === node.id;
            const otherNodeId = isSource ? e.target : e.source;
            const otherNode = graph.nodes.find(n => n.id === otherNodeId);
            if (!otherNode) return null;

            return (
              <div key={e.id} className="flex items-center gap-2 text-[12px]">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-muted)] font-mono whitespace-nowrap">
                  {e.type}
                </span>
                {isSource ? (
                  <ArrowRight size={12} className="text-[var(--text-muted)] shrink-0" />
                ) : (
                  <ArrowLeft size={12} className="text-[var(--text-muted)] shrink-0" />
                )}
                <span 
                  className="truncate cursor-pointer hover:text-[var(--text-primary)] hover:underline text-[var(--text-secondary)] transition-colors"
                  style={{ color: NODE_COLORS[otherNode.type] }}
                  onClick={() => {
                    if (otherNode.namespace) {
                      onNavigate(otherNode.namespace, otherNode.id);
                    }
                  }}
                >
                  {otherNode.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div 
      className="fixed top-[52px] right-0 bottom-[28px] w-[320px] bg-[var(--bg-surface)] border-l border-[var(--border)] z-50 flex flex-col shadow-2xl"
      style={{
        transform: `translateX(${(nodeId || groupId) ? '0' : '100%'})`,
        transition: 'transform 300ms ease',
      }}
    >
      {group && (
        <>
          <div className="px-5 py-4 border-b border-[var(--border)] flex items-start justify-between bg-[var(--bg-elevated)]">
            <div className="min-w-0 pr-4">
              <div className="flex items-center gap-2 mb-1 text-[var(--workload)]">
                <Boxes size={14} className="shrink-0" />
                <span className="text-[11px] font-mono text-[var(--text-muted)] truncate">{group.namespace}</span>
              </div>
              <h2 className="text-[14px] font-semibold text-[var(--text-primary)] truncate flex items-center gap-2" title={group.label}>
                {group.label}
                <span className="px-1.5 py-0.5 rounded-full bg-[rgba(37,99,235,0.08)] border border-[rgba(37,99,235,0.2)] text-[var(--workload)] text-[9px] font-mono leading-none font-normal shrink-0">
                  ×{group.replicaCount}
                </span>
              </h2>
              <div className="flex gap-1.5 mt-2">
                <button
                  onClick={() => openLogTab({ kind: 'deployment', namespace: group.namespace, name: group.label, label: group.label })}
                  style={{
                    fontSize: '11px', color: 'var(--logs)', background: 'transparent',
                    border: '1px solid rgba(8,145,178,0.4)', borderRadius: '3px', padding: '1px 7px',
                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--logs)'; e.currentTarget.style.background = 'rgba(8,145,178,0.06)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(8,145,178,0.4)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <ScrollText size={10} /> Logs
                </button>
                <button
                  onClick={() => openDescribeTab({ kind: 'deployment', namespace: group.namespace, name: group.label, label: group.label })}
                  style={{
                    fontSize: '11px', color: 'var(--text-secondary)', background: 'transparent',
                    border: '1px solid rgba(8,145,178,0.4)', borderRadius: '3px', padding: '1px 7px',
                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--logs)'; e.currentTarget.style.background = 'rgba(8,145,178,0.06)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(8,145,178,0.4)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <FileText size={10} /> Describe
                </button>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1 -mr-1 rounded hover:bg-[var(--bg-surface)]"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            {renderGroupContent()}
          </div>
        </>
      )}

      {node && data && !group && (
        <>
          <div className="px-5 py-4 border-b border-[var(--border)] flex items-start justify-between bg-[var(--bg-elevated)]">
            <div className="min-w-0 pr-4">
              <div className="flex items-center gap-2 mb-1">
                <span 
                  className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider"
                  style={{ backgroundColor: `${NODE_COLORS[node.type]}20`, color: NODE_COLORS[node.type] }}
                >
                  {NODE_LABELS[node.type]}
                </span>
                {node.namespace && (
                  <span className="text-[11px] font-mono text-[var(--text-muted)] truncate">{node.namespace}</span>
                )}
              </div>
              <h2 className="text-[14px] font-semibold text-[var(--text-primary)] truncate" title={node.label}>
                {node.label}
              </h2>
              <div className="flex gap-1.5 mt-2">
                {node.type === 'pod' && (
                  <button
                    onClick={() => openLogTab({ kind: 'pod', namespace: node.namespace || 'default', name: node.label, label: node.label })}
                    style={{
                      fontSize: '11px', color: 'var(--logs)', background: 'transparent',
                      border: '1px solid rgba(8,145,178,0.4)', borderRadius: '3px', padding: '1px 7px',
                      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--logs)'; e.currentTarget.style.background = 'rgba(8,145,178,0.06)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(8,145,178,0.4)'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    <ScrollText size={10} /> Logs
                  </button>
                )}
                {node.type !== 'namespace' && (
                  <button
                    onClick={() => {
                      let kind: string = node.type;
                      if (kind === 'network_policy') kind = 'networkpolicy';
                      if (kind === 'cluster_node') kind = 'node';
                      openDescribeTab({ kind, namespace: node.namespace || null, name: node.label, label: node.label });
                    }}
                    style={{
                      fontSize: '11px', color: 'var(--text-secondary)', background: 'transparent',
                      border: '1px solid rgba(8,145,178,0.4)', borderRadius: '3px', padding: '1px 7px',
                      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--logs)'; e.currentTarget.style.background = 'rgba(8,145,178,0.06)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(8,145,178,0.4)'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    <FileText size={10} /> Describe
                  </button>
                )}
              </div>
            </div>
            <button 
              onClick={onClose}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1 -mr-1 rounded hover:bg-[var(--bg-surface)]"
            >
              <X size={16} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5">
            {renderContent()}
            {renderEdges()}
          </div>
        </>
      )}
    </div>
  );
};
