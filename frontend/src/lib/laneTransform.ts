import {
  Graph,
  GraphDelta,
  GraphNode,
  EdgeType,
  IngressData,
  WorkloadGroup,
  PolicyConnection,
  NetworkPolicyData,
  NetworkPolicyPeer,
  NamespaceData,
  CrossNsWorkload,
  NamespacePortal,
  PolicyLaneData
} from '../types/graph';

export interface LaneNodeItem {
  nodeId: string;
  node: GraphNode;
  lane: string;
}

export interface ExitPortalItem {
  portalId: string;
  sourceNodeId: string;
  targetNamespace: string;
  targetNodeId: string;
  targetLabel: string;
  edgeType: EdgeType;
}

export interface EntryPortalItem {
  portalId: string;
  sourceNamespace: string;
  sourceNodeId: string;
  sourceLabel: string;
  targetNodeId: string;
  edgeType: EdgeType;
}

export interface TopologyConnection {
  id: string;
  sourceId: string;
  targetId: string;
  edgeType: EdgeType;
  ports: number[];
  animated: boolean;
}

export interface TopologyLaneData {
  external: boolean;
  ingresses: GraphNode[];
  services: GraphNode[];
  workloadGroups: WorkloadGroup[];
  clusterNodes: GraphNode[];
  exitPortals: ExitPortalItem[];
  entryPortals: EntryPortalItem[];
  connections: TopologyConnection[];
}



export interface NamespaceStats {
  name: string;
  podCount: number;
  serviceCount: number;
  ingressCount: number;
  netpolCount: number;
  nodeCount: number;
  crossLinks: Array<{
    targetNamespace: string;
    direction: 'outgoing' | 'incoming' | 'both';
  }>;
}

export const deriveWorkloadLabel = (pod: GraphNode): string => {
  if (pod.data.kind !== 'pod') return pod.label;
  const labels = pod.data.labels || {};
  if (labels['app.kubernetes.io/name']) return labels['app.kubernetes.io/name'];
  if (labels['app']) return labels['app'];
  if (labels['k8s-app']) return labels['k8s-app'];

  const parts = pod.label.split('-');
  if (parts.length > 2) {
    const hashPart = parts[parts.length - 2];
    if (hashPart.length >= 8 && hashPart.length <= 10 && /^[a-f0-9]+$/.test(hashPart)) {
      return parts.slice(0, -2).join('-');
    }
  }
  if (parts.length > 1) {
    return parts.slice(0, -1).join('-');
  }
  return pod.label;
};

export const groupPods = (pods: GraphNode[], graph: Graph): WorkloadGroup[] => {
  const groupsMap = new Map<string, WorkloadGroup>();

  for (const pod of pods) {
    const workloadLabel = deriveWorkloadLabel(pod);
    const key = `wg/${pod.namespace}/${workloadLabel}`;
    
    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        groupId: key,
        label: workloadLabel,
        namespace: pod.namespace || '',
        replicaCount: 0,
        pods: [],
        hostNodeNames: [],
        selectorLabels: pod.data.kind === 'pod' ? pod.data.labels || {} : {},
        serviceIds: [],
        ingressIds: [],
      });
    }

    const group = groupsMap.get(key)!;
    group.replicaCount++;
    group.pods.push(pod);
    if (pod.data.kind === 'pod' && pod.data.node_name) {
      if (!group.hostNodeNames.includes(pod.data.node_name)) {
        group.hostNodeNames.push(pod.data.node_name);
      }
    }
  }

  // Assign serviceIds and ingressIds
  for (const group of groupsMap.values()) {
    const podIds = new Set(group.pods.map(p => p.id));
    const serviceIds = new Set<string>();
    
    for (const e of graph.edges) {
      if (e.type === 'service_selects_pod' && podIds.has(e.target)) {
        serviceIds.add(e.source);
      }
    }
    
    group.serviceIds = Array.from(serviceIds);
    
    const ingressIds = new Set<string>();
    for (const e of graph.edges) {
      if (e.type === 'ingress_to_service' && serviceIds.has(e.target)) {
        ingressIds.add(e.source);
      }
    }
    group.ingressIds = Array.from(ingressIds);
  }

  return Array.from(groupsMap.values()).sort((a, b) => a.label.localeCompare(b.label));
};

function selectorMatchesLabels(
  selector: Record<string, string>,
  labels: Record<string, string>,
): boolean {
  if (Object.keys(selector).length === 0) return true;
  return Object.entries(selector).every(([k, v]) => labels[k] === v);
}

function selectorMatchesGroup(
  selector: Record<string, string>,
  group: WorkloadGroup,
): boolean {
  if (Object.keys(selector).length === 0) return true;
  return Object.entries(selector).every(
    ([k, v]) => group.selectorLabels[k] === v,
  );
}

function namespacesMatchingSelector(
  selector: Record<string, string>,
  graph: Graph,
): string[] {
  if (Object.keys(selector).length === 0) {
    return graph.nodes
      .filter(n => n.type === 'namespace')
      .map(n => n.label);
  }
  return graph.nodes
    .filter(n => {
      if (n.type !== 'namespace') return false;
      const nsData = n.data as NamespaceData;
      const labels: Record<string, string> = {
        ...nsData.labels,
        'kubernetes.io/metadata.name': n.label,
        'name': n.label,
      };
      return selectorMatchesLabels(selector, labels);
    })
    .map(n => n.label);
}

function resolvePeerToId(
  peer: NetworkPolicyPeer,
  currentNs: string,
  allGroupsByNs: Map<string, WorkloadGroup[]>,
  graph: Graph,
  crossNsWorkloads: Map<string, CrossNsWorkload>,
  namespacePortals: Map<string, NamespacePortal>,
): string {
  if (peer.ip_block) return 'external';

  const hasPodSel = Object.keys(peer.pod_selector).length > 0;
  const hasNsSel  = Object.keys(peer.namespace_selector).length > 0;

  if (!hasPodSel && !hasNsSel) return 'external';

  const matchingNamespaces = hasNsSel
    ? namespacesMatchingSelector(peer.namespace_selector, graph)
    : [currentNs];

  if (hasPodSel) {
    for (const ns of matchingNamespaces) {
      const groups = allGroupsByNs.get(ns) ?? [];
      const matched = groups.find(g => selectorMatchesGroup(peer.pod_selector, g));
      if (matched) {
        if (ns === currentNs) return matched.groupId;

        const crossId = `cross-ns:${matched.groupId}`;
        if (!crossNsWorkloads.has(crossId)) {
          crossNsWorkloads.set(crossId, {
            id: crossId,
            groupId: matched.groupId,
            namespace: ns,
            label: matched.label,
            replicaCount: matched.replicaCount,
          });
        }
        return crossId;
      }
    }
  }

  if (matchingNamespaces.length === 1) {
    const ns = matchingNamespaces[0];
    const portalId = `portal-ns-${ns}`;
    if (!namespacePortals.has(portalId)) {
      const podCount = graph.nodes.filter(
        n => n.type === 'pod' && n.namespace === ns,
      ).length;
      namespacePortals.set(portalId, { id: portalId, namespace: ns, podCount });
    }
    return portalId;
  }

  if (matchingNamespaces.length > 1) {
    const portalId = `portal-ns-multi-${matchingNamespaces.sort().join('-')}`;
    if (!namespacePortals.has(portalId)) {
      namespacePortals.set(portalId, {
        id: portalId,
        namespace: matchingNamespaces.join(', '),
        podCount: 0,
      });
    }
    return portalId;
  }

  return 'external';
}

function describePeer(peer: NetworkPolicyPeer): string {
  const parts: string[] = [];

  if (Object.keys(peer.pod_selector).length > 0) {
    const labels = Object.entries(peer.pod_selector)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    parts.push(`pod: [${labels}]`);
  }

  if (Object.keys(peer.namespace_selector).length > 0) {
    const labels = Object.entries(peer.namespace_selector)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    parts.push(`ns: [${labels}]`);
  }

  if (peer.ip_block) parts.push(`ipBlock: ${peer.ip_block}`);

  return parts.length > 0 ? parts.join(', ') : 'any';
}

export function toPolicyLaneData(
  graph: Graph,
  namespace: string,
): PolicyLaneData {
  const crossNsWorkloads = new Map<string, CrossNsWorkload>();
  const namespacePortals = new Map<string, NamespacePortal>();

  const allPodsByNs = new Map<string, GraphNode[]>();
  for (const n of graph.nodes) {
    if (n.type !== 'pod' || !n.namespace) continue;
    if (!allPodsByNs.has(n.namespace)) allPodsByNs.set(n.namespace, []);
    allPodsByNs.get(n.namespace)!.push(n);
  }

  const allGroupsByNs = new Map<string, WorkloadGroup[]>();
  for (const [ns, pods] of allPodsByNs) {
    allGroupsByNs.set(ns, groupPods(pods, graph));
  }

  const currentNsGroups  = allGroupsByNs.get(namespace) ?? [];
  const currentNsNetpols = graph.nodes.filter(
    n => n.type === 'network_policy' && n.namespace === namespace,
  );
  const otherNsNetpols   = graph.nodes.filter(
    n => n.type === 'network_policy' && n.namespace !== namespace,
  );

  const hasPolicies = currentNsNetpols.length > 0;
  const policyConnections: PolicyConnection[] = [];
  const seen = new Set<string>();

  const add = (conn: PolicyConnection) => {
    if (seen.has(conn.id)) return;
    seen.add(conn.id);
    policyConnections.push(conn);
  };

  const resolve = (peer: NetworkPolicyPeer, currentNs: string) =>
    resolvePeerToId(
      peer, currentNs, allGroupsByNs, graph, crossNsWorkloads, namespacePortals,
    );

  // ── Case 1: NetworkPolicies in the current namespace ─────────────────────
  for (const netpol of currentNsNetpols) {
    const npData = netpol.data as NetworkPolicyData;

    const selectedGroups = currentNsGroups.filter(g =>
      selectorMatchesGroup(npData.pod_selector, g),
    );

    for (const selected of selectedGroups) {
      for (const rule of npData.ingress_rules) {
        const ports     = rule.ports.map(p => p.port).filter((p): p is number => typeof p === 'number');
        const protocols = rule.ports.map(p => p.protocol);

        if (rule.peers.length === 0) {
          add({
            id: `any→${selected.groupId}__${netpol.id}`,
            sourceId: 'external', targetId: selected.groupId,
            status: 'allowed', ports, protocols,
            ruleDescription: 'any source',
            edgeType: 'netpol_allows_ingress',
          });
          continue;
        }

        for (const peer of rule.peers) {
          const sourceId = resolve(peer, namespace);
          add({
            id: `${sourceId}→${selected.groupId}__${netpol.id}__${describePeer(peer)}`,
            sourceId, targetId: selected.groupId,
            status: 'allowed', ports, protocols,
            ruleDescription: describePeer(peer),
            edgeType: 'netpol_allows_ingress',
          });
        }
      }

      for (const rule of npData.egress_rules) {
        const ports     = rule.ports.map(p => p.port).filter((p): p is number => typeof p === 'number');
        const protocols = rule.ports.map(p => p.protocol);

        if (rule.peers.length === 0) {
          add({
            id: `${selected.groupId}→any__${netpol.id}`,
            sourceId: selected.groupId, targetId: 'external',
            status: 'allowed', ports, protocols,
            ruleDescription: 'any destination',
            edgeType: 'netpol_allows_egress',
          });
          continue;
        }

        for (const peer of rule.peers) {
          const targetId = resolve(peer, namespace);
          add({
            id: `${selected.groupId}→${targetId}__${netpol.id}__${describePeer(peer)}`,
            sourceId: selected.groupId, targetId,
            status: 'allowed', ports, protocols,
            ruleDescription: describePeer(peer),
            edgeType: 'netpol_allows_egress',
          });
        }
      }
    }
  }

  // ── Case 2: NetworkPolicies in OTHER namespaces whose egress targets ───────
  //            pods in the current namespace
  const currentNsNode   = graph.nodes.find(n => n.type === 'namespace' && n.label === namespace);
  const currentNsLabels = currentNsNode
    ? {
        ...(currentNsNode.data as NamespaceData).labels,
        'kubernetes.io/metadata.name': namespace,
        'name': namespace,
      }
    : { 'kubernetes.io/metadata.name': namespace, 'name': namespace };

  for (const netpol of otherNsNetpols) {
    const npData      = netpol.data as NetworkPolicyData;
    const otherNs     = netpol.namespace ?? '';
    const otherGroups = allGroupsByNs.get(otherNs) ?? [];

    const selectedOtherGroups = otherGroups.filter(g =>
      selectorMatchesGroup(npData.pod_selector, g),
    );
    if (selectedOtherGroups.length === 0) continue;

    for (const rule of npData.egress_rules) {
      const ports     = rule.ports.map(p => p.port).filter((p): p is number => typeof p === 'number');
      const protocols = rule.ports.map(p => p.protocol);

      for (const peer of rule.peers) {
        if (Object.keys(peer.namespace_selector).length === 0) continue;

        if (!selectorMatchesLabels(peer.namespace_selector, currentNsLabels)) continue;

        const targetGroups = Object.keys(peer.pod_selector).length > 0
          ? currentNsGroups.filter(g => selectorMatchesGroup(peer.pod_selector, g))
          : currentNsGroups;

        for (const selected of selectedOtherGroups) {
          const crossId = `cross-ns:${selected.groupId}`;
          if (!crossNsWorkloads.has(crossId)) {
            crossNsWorkloads.set(crossId, {
              id: crossId,
              groupId: selected.groupId,
              namespace: otherNs,
              label: selected.label,
              replicaCount: selected.replicaCount,
            });
          }

          for (const target of targetGroups) {
            add({
              id: `${crossId}→${target.groupId}__${netpol.id}__case2`,
              sourceId: crossId,
              targetId: target.groupId,
              status: 'allowed',
              ports,
              protocols,
              ruleDescription: `egress from ${otherNs} · ${describePeer(peer)}`,
              edgeType: 'netpol_allows_egress',
            });
          }
        }
      }
    }
  }

  // ── Unisolated groups (no policy in current namespace selects them) ────────
  // Isolation is determined ONLY by policies in the pod's own namespace.
  // Case 2 connections do not make a group "isolated".
  const selectedByCurrentNsPolicy = new Set<string>();
  for (const netpol of currentNsNetpols) {
    const npData = netpol.data as NetworkPolicyData;
    for (const g of currentNsGroups) {
      if (selectorMatchesGroup(npData.pod_selector, g)) {
        selectedByCurrentNsPolicy.add(g.groupId);
      }
    }
  }

  for (const group of currentNsGroups) {
    if (selectedByCurrentNsPolicy.has(group.groupId)) continue;
    for (const other of currentNsGroups) {
      if (other.groupId === group.groupId) continue;
      add({
        id: `implicit-${group.groupId}→${other.groupId}`,
        sourceId: group.groupId, targetId: other.groupId,
        status: 'implicit', ports: [], protocols: [],
        ruleDescription: 'Unisolated — unrestricted ingress',
        edgeType: 'netpol_allows_ingress',
      });
      add({
        id: `implicit-${other.groupId}→${group.groupId}`,
        sourceId: other.groupId, targetId: group.groupId,
        status: 'implicit', ports: [], protocols: [],
        ruleDescription: 'Unisolated — unrestricted egress',
        edgeType: 'netpol_allows_egress',
      });
    }
  }

  return {
    workloadGroups: currentNsGroups,
    policyConnections,
    hasPolicies,
    crossNsWorkloads,
    namespacePortals,
  };
}

export const toTopologyLaneData = (graph: Graph, namespace: string): TopologyLaneData => {
  const ingresses: GraphNode[] = [];
  const services: GraphNode[] = [];
  const exitPortals: ExitPortalItem[] = [];
  const entryPortals: EntryPortalItem[] = [];
  const connections: TopologyConnection[] = [];
  let external = false;

  const nsNodes = new Map<string, GraphNode>();
  const clusterNodes = new Map<string, GraphNode>();

  for (const n of graph.nodes) {
    if (n.type === 'cluster_node') {
      clusterNodes.set(n.id, n);
    } else if (n.namespace === namespace) {
      nsNodes.set(n.id, n);
      if (n.type === 'ingress') {
        ingresses.push(n);
        const ingress = n.data as IngressData;
        if (ingress.rules && ingress.rules.length > 0) external = true;
      } else if (n.type === 'service') {
        services.push(n);
      }
    }
  }

  const pods = graph.nodes.filter(n => n.type === 'pod' && n.namespace === namespace);
  const workloadGroups = groupPods(pods, graph);

  const usedClusterNodes = new Set<string>();
  for (const wg of workloadGroups) {
    for (const nodeName of wg.hostNodeNames) {
      const cn = Array.from(clusterNodes.values()).find(n => n.label === nodeName);
      if (cn) usedClusterNodes.add(cn.id);
    }
  }
  
  const clusterNodesList = Array.from(usedClusterNodes).map(id => clusterNodes.get(id)!);

  for (const e of graph.edges) {
    const s = graph.nodes.find(n => n.id === e.source);
    const t = graph.nodes.find(n => n.id === e.target);
    if (!s || !t) continue;

    const sInNs = s.namespace === namespace;
    const tInNs = t.namespace === namespace;

    if (e.type === 'ingress_to_service' && sInNs && tInNs) {
      connections.push({
        id: e.id,
        sourceId: e.source,
        targetId: e.target,
        edgeType: e.type as EdgeType,
        ports: e.data?.ports?.map(p => p.port) || [],
        animated: true,
      });
    }

    if (e.type === 'service_selects_pod' && sInNs && tInNs) {
      const wg = workloadGroups.find(g => g.pods.some(p => p.id === e.target));
      if (wg) {
        const connId = `svc-wg-${e.source}-${wg.groupId}`;
        if (!connections.find(c => c.id === connId)) {
          connections.push({
            id: connId,
            sourceId: e.source,
            targetId: wg.groupId,
            edgeType: e.type as EdgeType,
            ports: e.data?.ports?.map(p => p.port) || [],
            animated: true,
          });
        }
      }
    }

    if (sInNs && !tInNs && t.namespace !== null) {
      if (e.type === 'service_selects_pod' || e.type === 'ingress_to_service') {
        let sourceId = e.source;
        if (e.type === 'service_selects_pod' && s.type === 'pod') {
          const wg = workloadGroups.find(g => g.pods.some(p => p.id === e.source));
          if (wg) sourceId = wg.groupId;
        }

        const portalId = `portal-exit-${sourceId}-${t.namespace}`;
        if (!exitPortals.find(p => p.portalId === portalId)) {
          exitPortals.push({
            portalId,
            sourceNodeId: sourceId,
            targetNamespace: t.namespace,
            targetNodeId: e.target,
            targetLabel: t.label,
            edgeType: e.type as EdgeType,
          });
        }
        connections.push({
          id: e.id,
          sourceId,
          targetId: portalId,
          edgeType: e.type as EdgeType,
          ports: e.data?.ports?.map(p => p.port) || [],
          animated: true,
        });
      }
    } else if (!sInNs && s.namespace !== null && tInNs) {
      if (e.type === 'service_selects_pod' || e.type === 'ingress_to_service') {
        let targetId = e.target;
        if (e.type === 'service_selects_pod' && t.type === 'pod') {
          const wg = workloadGroups.find(g => g.pods.some(p => p.id === e.target));
          if (wg) targetId = wg.groupId;
        }

        const portalId = `portal-entry-${s.namespace}-${targetId}`;
        if (!entryPortals.find(p => p.portalId === portalId)) {
          entryPortals.push({
            portalId,
            sourceNamespace: s.namespace,
            sourceNodeId: e.source,
            sourceLabel: s.label,
            targetNodeId: targetId,
            edgeType: e.type as EdgeType,
          });
        }
        connections.push({
          id: e.id,
          sourceId: portalId,
          targetId,
          edgeType: e.type as EdgeType,
          ports: e.data?.ports?.map(p => p.port) || [],
          animated: true,
        });
      }
    }
  }

  for (const wg of workloadGroups) {
    for (const nodeName of wg.hostNodeNames) {
      const cn = clusterNodesList.find(n => n.label === nodeName);
      if (cn) {
        connections.push({
          id: `wg-node-${wg.groupId}-${cn.id}`,
          sourceId: wg.groupId,
          targetId: cn.id,
          edgeType: 'pod_to_node',
          ports: [],
          animated: false,
        });
      }
    }
  }

  if (external) {
    for (const ing of ingresses) {
      const ingress = ing.data as IngressData;
      if (ingress.rules && ingress.rules.length > 0) {
        connections.push({
          id: `ext-to-${ing.id}`,
          sourceId: 'external',
          targetId: ing.id,
          edgeType: 'ingress_to_service',
          ports: [],
          animated: true,
        });
      }
    }
  }

  return {
    external,
    ingresses,
    services,
    workloadGroups,
    clusterNodes: clusterNodesList,
    exitPortals,
    entryPortals,
    connections,
  };
};

export const toNamespaceStats = (graph: Graph): NamespaceStats[] => {
  const statsMap = new Map<string, NamespaceStats>();

  for (const n of graph.nodes) {
    if (n.type === 'namespace') {
      statsMap.set(n.label, {
        name: n.label,
        podCount: 0,
        serviceCount: 0,
        ingressCount: 0,
        netpolCount: 0,
        nodeCount: 0,
        crossLinks: [],
      });
    }
  }

  for (const n of graph.nodes) {
    const ns = n.namespace;
    if (ns && statsMap.has(ns)) {
      const stats = statsMap.get(ns)!;
      if (n.type === 'pod') stats.podCount++;
      else if (n.type === 'service') stats.serviceCount++;
      else if (n.type === 'ingress') stats.ingressCount++;
      else if (n.type === 'network_policy') stats.netpolCount++;
    }
  }

  const nsNodes = new Map<string, Set<string>>();
  for (const e of graph.edges) {
    if (e.type === 'pod_to_node') {
      const s = graph.nodes.find(n => n.id === e.source);
      if (s && s.namespace) {
        if (!nsNodes.has(s.namespace)) {
          nsNodes.set(s.namespace, new Set());
        }
        nsNodes.get(s.namespace)!.add(e.target);
      }
    }
  }

  for (const [ns, nodes] of nsNodes.entries()) {
    if (statsMap.has(ns)) {
      statsMap.get(ns)!.nodeCount = nodes.size;
    }
  }

  const crossLinks = new Map<string, Map<string, 'outgoing' | 'incoming' | 'both'>>();

  for (const e of graph.edges) {
    const s = graph.nodes.find(n => n.id === e.source);
    const t = graph.nodes.find(n => n.id === e.target);
    if (!s || !t) continue;
    const sNs = s.namespace;
    const tNs = t.namespace;
    if (sNs && tNs && sNs !== tNs) {
      if (!crossLinks.has(sNs)) crossLinks.set(sNs, new Map());
      if (!crossLinks.has(tNs)) crossLinks.set(tNs, new Map());

      const sMap = crossLinks.get(sNs)!;
      const tMap = crossLinks.get(tNs)!;

      if (sMap.get(tNs) === 'incoming') sMap.set(tNs, 'both');
      else if (!sMap.has(tNs)) sMap.set(tNs, 'outgoing');

      if (tMap.get(sNs) === 'outgoing') tMap.set(sNs, 'both');
      else if (!tMap.has(sNs)) tMap.set(sNs, 'incoming');
    }
  }

  for (const [ns, links] of crossLinks.entries()) {
    if (statsMap.has(ns)) {
      const stats = statsMap.get(ns)!;
      for (const [targetNamespace, direction] of links.entries()) {
        stats.crossLinks.push({ targetNamespace, direction });
      }
    }
  }

  return Array.from(statsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
};

export const applyDelta = (graph: Graph, delta: GraphDelta): Graph => {
  if (delta.event_type === 'FULL_SYNC' && delta.graph) {
    return {
      cluster_info: delta.graph.cluster_info,
      nodes: [...delta.graph.nodes],
      edges: [...delta.graph.edges],
    };
  }

  const newNodes = [...graph.nodes];
  let newEdges = [...graph.edges];

  if (delta.event_type === 'ADDED' || delta.event_type === 'MODIFIED') {
    if (delta.node) {
      const idx = newNodes.findIndex(n => n.id === delta.node!.id);
      if (idx >= 0) newNodes[idx] = delta.node;
      else newNodes.push(delta.node);
    }
    if (delta.edges_added && delta.edges_added.length > 0) {
      newEdges.push(...delta.edges_added);
    }
    if (delta.edges_removed && delta.edges_removed.length > 0) {
      newEdges = newEdges.filter(e => !delta.edges_removed.includes(e.id));
    }
  } else if (delta.event_type === 'DELETED') {
    if (delta.node_id) {
      const idx = newNodes.findIndex(n => n.id === delta.node_id);
      if (idx >= 0) newNodes.splice(idx, 1);
      newEdges = newEdges.filter(e => e.source !== delta.node_id && e.target !== delta.node_id);
    }
  }

  return {
    cluster_info: graph.cluster_info,
    nodes: newNodes,
    edges: newEdges,
  };
};
