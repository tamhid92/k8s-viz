export type LogTabKind = 'pod' | 'deployment' | 'describe';

export interface LogsRequest {
  kind:      'pod' | 'deployment';
  namespace: string;
  name:      string;
  label:     string;
}

export interface DescribeRequest {
  kind:      string;
  namespace: string | null;
  name:      string;
  label:     string;
}

export interface LogTabMeta {
  id:          string;
  tabKind:     LogTabKind;
  label:       string;
  namespace:   string;
  name:        string;
  status:      'streaming' | 'error' | 'idle';
  unreadCount: number;
  addedAt:     number;
}

export interface LogLine {
  raw:       string;
  timestamp: string | null;
  message:   string;
  level:     'error' | 'warn' | 'info' | 'debug' | 'unknown';
  pod?:      string;
}

export interface DescribeResult {
  error?:      string;
  kind:        string;
  name:        string;
  namespace:   string | null;
  labels:      Record<string, string>;
  annotations: Record<string, string>;
  created_at:  string | null;
  summary:     string;
  conditions:  Array<{type: string; status: string; reason: string; message: string}>;
  details:     Record<string, unknown>;
  events:      Array<{
    type: string; reason: string; message: string;
    count: number; first_time: string | null;
    last_time: string | null; source: string | null;
  }>;
}

export interface PodListItem {
  name:      string;
  namespace: string;
  phase:     string;
  node_name: string | null;
  id:        string;
  labels:    Record<string, string>;
}
