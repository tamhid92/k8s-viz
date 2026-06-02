import { NodeType, PodPhase, EdgeType, PolicyConnectionStatus } from '../types/graph';

export const NODE_COLORS: Record<NodeType, string> = {
  pod: 'var(--pod)',
  service: 'var(--service)',
  ingress: 'var(--ingress)',
  network_policy: 'var(--netpol)',
  cluster_node: 'var(--cluster-node)',
  namespace: 'var(--namespace)',
};

export const NODE_LABELS: Record<NodeType, string> = {
  pod: 'Pod',
  service: 'Service',
  ingress: 'Ingress',
  network_policy: 'NetPol',
  cluster_node: 'Node',
  namespace: 'Namespace',
};

export const POD_PHASE_COLORS: Record<PodPhase, string> = {
  Running: 'var(--status-running)',
  Pending: 'var(--status-pending)',
  Failed: 'var(--status-failed)',
  Succeeded: 'var(--status-succeeded)',
  Unknown: 'var(--status-unknown)',
};

export const EDGE_COLORS: Record<EdgeType, string> = {
  pod_to_node: 'var(--edge-placement)',
  pod_to_namespace: 'var(--edge-placement)',
  service_selects_pod: 'var(--edge-service)',
  ingress_to_service: 'var(--edge-ingress)',
  netpol_selects_pod: 'var(--edge-netpol-allow)',
  netpol_allows_ingress: 'var(--edge-netpol-allow)',
  netpol_allows_egress: 'var(--edge-netpol-allow)',
};

export const POLICY_STATUS_COLORS: Record<PolicyConnectionStatus, string> = {
  allowed: 'var(--edge-netpol-allow)',
  blocked: 'var(--edge-netpol-block)',
  implicit: 'var(--edge-implicit)',
};

export const LANE_ORDER_TOPOLOGY = ['external', 'ingress', 'service', 'workload', 'node'] as const;
export const LANE_ORDER_POLICY = ['sources', 'workloads', 'destinations'] as const;

export const LANE_LABELS: Record<string, string> = {
  sources: 'Sources',
  workloads: 'Workload Groups',
  destinations: 'Destinations',
  external: 'External',
  ingress: 'Ingress',
  service: 'Service',
  workload: 'Workload',
  node: 'Node',
};
