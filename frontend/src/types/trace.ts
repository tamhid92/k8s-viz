export type HopType =
  | 'source' | 'dns' | 'kube_proxy' | 'load_balance'
  | 'cni_same_node' | 'cni_cross_node'
  | 'ingress_controller' | 'netpol_check' | 'destination';

export type HopStatus = 'theoretical' | 'allowed' | 'blocked' | 'unknown';

export interface TraceHop {
  step:      number;
  hop_type:  HopType;
  title:     string;
  subtitle:  string;
  detail:    string;
  technical: string;
  node_id:   string | null;
  status:    HopStatus;
}

export interface BackendCandidate {
  pod_id:    string;
  pod_name:  string;
  pod_ip:    string | null;
  node_name: string | null;
  same_node: boolean;
  ready:     boolean;
}

export interface TraceResult {
  from_pod_id:      string;
  to_service_id:    string;
  hops:             TraceHop[];
  candidates:       BackendCandidate[];
  cni_type:         string | null;
  kube_proxy_mode:  string | null;
  dns_fqdn:         string | null;
  cross_node:       boolean;
  has_netpol:       boolean;
  error:            string | null;
}

export interface TraceRequest {
  fromPodId:    string;
  toServiceId:  string;
  fromLabel:    string;
  toLabel:      string;
}
