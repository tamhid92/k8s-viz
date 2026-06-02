export interface EventItem {
  uid: string;
  type: string;
  reason: string;
  message: string;
  count: number;
  first_time: string | null;
  last_time: string | null;
  regarding: string;
  regarding_namespace: string | null;
  source_component: string | null;
  namespace: string | null;
}

export interface EventsListResponse {
  events: EventItem[];
  warning_count: number;
  total: number;
}

export interface PolicyRule {
  verbs: string[];
  api_groups: string[];
  resources: string[];
  resource_names: string[];
}

export interface RoleItem {
  name: string;
  namespace: string | null;
  rules: PolicyRule[];
  created_at: string | null;
  rule_count: number;
}

export interface RoleListResponse {
  items: RoleItem[];
}

export interface Subject {
  kind: string;
  name: string;
  namespace: string | null;
}

export interface RoleBindingItem {
  name: string;
  namespace: string | null;
  role_ref: string;
  role_kind: string;
  subjects: Subject[];
  created_at: string | null;
}

export interface RoleBindingListResponse {
  items: RoleBindingItem[];
}

export interface ServiceAccountItem {
  name: string;
  namespace: string;
  secrets: string[];
  created_at: string | null;
  bound_roles: string[];
}

export interface ServiceAccountListResponse {
  items: ServiceAccountItem[];
}

export interface ConfigMapItem {
  name: string;
  namespace: string;
  keys: string[];
  data: Record<string, string>;
  created_at: string | null;
}

export interface ConfigMapListResponse {
  items: ConfigMapItem[];
}

export interface SecretItem {
  name: string;
  namespace: string;
  secret_type: string;
  keys: string[];
  created_at: string | null;
}

export interface SecretListResponse {
  items: SecretItem[];
}
