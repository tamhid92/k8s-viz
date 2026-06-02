export type WorkloadHealth = 'healthy' | 'degraded' | 'unavailable' | 'scaled_down';

export interface ContainerSpec {
  name:           string;
  image:          string;
  cpu_request:    string | null;
  memory_request: string | null;
  cpu_limit:      string | null;
  memory_limit:   string | null;
  ports:          number[];
}

export interface PodSummary {
  name:          string;
  phase:         string;
  pod_ip:        string | null;
  node_name:     string | null;
  restart_count: number;
  ready:         boolean;
  created_at:    string | null;
}

export interface ConnectedPodGroup {
  label:         string;
  replica_count: number;
  pods:          PodSummary[];
  host_nodes:    string[];
}

export interface ConnectedService {
  name:         string;
  namespace:    string;
  cluster_ip:   string | null;
  service_type: string;
  ports:        Record<string, unknown>[];
}

export interface ConnectedIngress {
  name:          string;
  namespace:     string;
  ingress_class: string | null;
  hosts:         string[];
}

export interface ConnectedNetworkPolicy {
  name:         string;
  namespace:    string;
  policy_types: string[];
  summary:      string;
}

export interface ConnectedConfigMap {
  name:       string;
  namespace:  string;
  mount_type: string;
  keys:       string[];
}

export interface ConnectedSecret {
  name:        string;
  namespace:   string;
  mount_type:  string;
  keys:        string[];
  secret_type: string;
}

export interface ConnectedServiceAccount {
  name:      string;
  namespace: string;
}

export interface ConnectedNode {
  name:        string;
  internal_ip: string | null;
  roles:       string[];
  ready:       boolean;
}

export interface DeploymentMap {
  deployment_name:   string;
  namespace:         string;
  desired_replicas:  number;
  ready_replicas:    number;
  health:            WorkloadHealth;
  pod_groups:        ConnectedPodGroup[];
  nodes:             ConnectedNode[];
  services:          ConnectedService[];
  ingresses:         ConnectedIngress[];
  network_policies:  ConnectedNetworkPolicy[];
  config_maps:       ConnectedConfigMap[];
  secrets:           ConnectedSecret[];
  service_account:   ConnectedServiceAccount | null;
}

export interface DeploymentItem {
  name:               string;
  namespace:          string;
  desired_replicas:   number;
  ready_replicas:     number;
  available_replicas: number;
  updated_replicas:   number;
  strategy:           string;
  selector:           Record<string, string>;
  containers:         ContainerSpec[];
  created_at:         string | null;
  health:             WorkloadHealth;
  total_restarts:     number;
  pods:               PodSummary[];
}

export interface StatefulSetItem {
  name:             string;
  namespace:        string;
  desired_replicas: number;
  ready_replicas:   number;
  current_replicas: number;
  selector:         Record<string, string>;
  containers:       ContainerSpec[];
  created_at:       string | null;
  health:           WorkloadHealth;
  total_restarts:   number;
  pods:             PodSummary[];
  service_name:     string | null;
}

export interface DaemonSetItem {
  name:                     string;
  namespace:                string;
  desired_number_scheduled: number;
  number_ready:             number;
  number_available:         number;
  number_misscheduled:      number;
  selector:                 Record<string, string>;
  containers:               ContainerSpec[];
  created_at:               string | null;
  health:                   WorkloadHealth;
  total_restarts:           number;
  pods:                     PodSummary[];
}

export interface WorkloadSummary {
  total:       number;
  healthy:     number;
  degraded:    number;
  unavailable: number;
  scaled_down: number;
}

export interface KubeEvent {
  uid:        string;
  type:       string;
  reason:     string;
  message:    string;
  count:      number;
  first_time: string | null;
  last_time:  string | null;
  regarding:  string;
}

export type WorkloadKind = 'deployments' | 'statefulsets' | 'daemonsets' | 'pods' | 'jobs' | 'cronjobs';

export interface NamespaceWorkload {
  kind:          string;
  name:          string;
  namespace:     string;
  health:        WorkloadHealth;
  ready_string:  string;
  pod_group:     ConnectedPodGroup;
  service_names: string[];
}

export interface NamespaceMapSummary {
  workloads:        number;
  pods:             number;
  services:         number;
  ingresses:        number;
  network_policies: number;
  config_maps:      number;
  secrets:          number;
  service_accounts: number;
}

export interface NamespaceMap {
  namespace:        string;
  workloads:        NamespaceWorkload[];
  services:         ConnectedService[];
  ingresses:        ConnectedIngress[];
  network_policies: ConnectedNetworkPolicy[];
  config_maps:      ConnectedConfigMap[];
  secrets:          ConnectedSecret[];
  service_accounts: ConnectedServiceAccount[];
  nodes:            ConnectedNode[];
  summary:          NamespaceMapSummary;
}

export type JobStatus = 'complete' | 'running' | 'failed' | 'suspended';

export interface JobItem {
  name:            string;
  namespace:       string;
  completions:     number;
  succeeded:       number;
  active:          number;
  failed:          number;
  status:          JobStatus;
  start_time:      string | null;
  completion_time: string | null;
  duration:        string | null;
  parallelism:     number;
  created_at:      string | null;
  pods:            PodSummary[];
  owner_cronjob:   string | null;
}

export interface JobListResponse {
  items:   JobItem[];
  summary: WorkloadSummary;
}

export interface CronJobItem {
  name:                          string;
  namespace:                     string;
  schedule:                      string;
  suspended:                     boolean;
  active_jobs:                   number;
  last_schedule_time:            string | null;
  last_successful_time:          string | null;
  next_schedule_time:            string | null;
  next_schedule_relative:        string | null;
  concurrency_policy:            string;
  successful_jobs_history_limit: number;
  failed_jobs_history_limit:     number;
  created_at:                    string | null;
  recent_jobs:                   JobItem[];
}

export interface CronJobListResponse {
  items: CronJobItem[];
}
