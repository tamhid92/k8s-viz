export type NodeType =
  | 'namespace' | 'cluster_node' | 'pod'
  | 'service' | 'ingress' | 'network_policy';

export type EdgeType =
  | 'pod_to_node' | 'pod_to_namespace'
  | 'service_selects_pod' | 'ingress_to_service'
  | 'netpol_selects_pod' | 'netpol_allows_ingress' | 'netpol_allows_egress';

export type PodPhase = 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown';
export type ServiceType = 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName';
export type WatchEventType = 'ADDED' | 'MODIFIED' | 'DELETED' | 'FULL_SYNC';

export interface PodContainer {
  name: string;
  image: string;
  ready: boolean;
  restart_count: number;
  ports: number[];
}

export interface PodData {
  kind: 'pod';
  phase: PodPhase;
  pod_ip: string | null;
  host_ip: string | null;
  node_name: string | null;
  containers: PodContainer[];
  labels?: Record<string, string>;
}

export interface ServicePort {
  port: number;
  target_port: string;
  protocol: string;
  node_port: number | null;
}

export interface ServiceData {
  kind: 'service';
  type: ServiceType;
  cluster_ip: string | null;
  external_ips: string[];
  ports: ServicePort[];
  selector: Record<string, string>;
}

export interface IngressRule {
  host: string | null;
  paths: Array<{
    path: string;
    path_type: string;
    backend_service: string;
    backend_port: number;
  }>;
}

export interface IngressData {
  kind: 'ingress';
  ingress_class: string | null;
  rules: IngressRule[];
  tls_hosts: string[];
}

export interface NetworkPolicyPeer {
  pod_selector: Record<string, string>;
  namespace_selector: Record<string, string>;
  ip_block: string | null;
}

export interface NetPolRule {
  ports: Array<{ port: number | null; protocol: string }>;
  peers: NetworkPolicyPeer[];
}

export interface NetworkPolicyData {
  kind: 'network_policy';
  pod_selector: Record<string, string>;
  policy_types: string[];
  ingress_rules: NetPolRule[];
  egress_rules: NetPolRule[];
}

export interface ClusterNodeData {
  kind: 'cluster_node';
  internal_ip: string | null;
  ready: boolean;
  roles: string[];
  capacity_cpu: string;
  capacity_memory: string;
  os_image: string;
  kernel_version: string;
  container_runtime: string;
  pod_cidr: string | null;
}

export interface NamespaceData {
  kind: 'namespace';
  status: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

export type NodeData =
  | PodData
  | ServiceData
  | IngressData
  | NetworkPolicyData
  | ClusterNodeData
  | NamespaceData;

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  namespace: string | null;
  data: NodeData;
}

export interface EdgeData {
  edgeType: EdgeType;
  ports?: Array<{ port: number; protocol: string }>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  data?: EdgeData;
}

export interface ClusterInfo {
  server_version: string;
  platform: string;
}

export interface Graph {
  cluster_info: ClusterInfo;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphDelta {
  event_type: WatchEventType;
  node_id: string | null;
  node: GraphNode | null;
  edges_added: GraphEdge[];
  edges_removed: string[];
  graph?: Graph;
}

export interface Snapshot {
  graph: Graph;
  timestamp: string;
}

export interface WorkloadGroup {
  groupId: string;
  label: string;
  namespace: string;
  replicaCount: number;
  pods: GraphNode[];
  hostNodeNames: string[];
  selectorLabels: Record<string, string>;
  serviceIds: string[];
  ingressIds: string[];
}

export type PolicyConnectionStatus = 'allowed' | 'blocked' | 'implicit';

export interface PolicyConnection {
  id: string;
  sourceId: string;
  targetId: string;
  status: PolicyConnectionStatus;
  ports: number[];
  protocols: string[];
  ruleDescription: string;
  edgeType: EdgeType;
}

export type ViewMode = 'policy' | 'topology';

export interface CrossNsWorkload {
  id: string;            // 'cross-ns:wg/<namespace>/<workloadName>'
  groupId: string;       // the WorkloadGroup.groupId in its own namespace
  namespace: string;     // the other namespace this workload lives in
  label: string;         // workload display name
  replicaCount: number;
}

export interface NamespacePortal {
  id: string;            // 'portal-ns-<namespaceName>'
  namespace: string;     // the namespace being referenced
  podCount: number;      // how many pods are in that namespace (0 if unknown)
}

export interface PolicyLaneData {
  workloadGroups:  WorkloadGroup[];
  policyConnections: PolicyConnection[];
  hasPolicies:     boolean;
  crossNsWorkloads: Map<string, CrossNsWorkload>;   // keyed by CrossNsWorkload.id
  namespacePortals: Map<string, NamespacePortal>;   // keyed by NamespacePortal.id
}
