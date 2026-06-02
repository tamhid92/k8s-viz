import { WorkloadHealth, DeploymentItem, StatefulSetItem, DaemonSetItem, JobStatus, JobItem, CronJobItem } from '../types/workloads';

export function formatAge(isoString: string | null): string {
  if (!isoString) return '—';
  const s = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (s < 0) return '<1m';
  if (s < 60) return '<1m';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function restartThreshold(count: number): 'none' | 'warning' | 'high' | 'critical' {
  if (count === 0) return 'none';
  if (count <= 4) return 'warning';
  if (count <= 9) return 'high';
  return 'critical';
}

export function restartColor(threshold: ReturnType<typeof restartThreshold>): string {
  if (threshold === 'none') return '';
  if (threshold === 'warning') return 'var(--restart-warning)';
  if (threshold === 'high') return 'var(--restart-high)';
  if (threshold === 'critical') return 'var(--restart-critical)';
  return '';
}

export function healthColor(health: WorkloadHealth): string {
  if (health === 'healthy') return 'var(--status-running)';
  if (health === 'degraded') return 'var(--status-pending)';
  if (health === 'unavailable') return 'var(--status-failed)';
  if (health === 'scaled_down') return 'bg-gray-100 text-gray-500';
  return '';
}

export function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400)return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

export function healthLabel(health: WorkloadHealth): string {
  if (health === 'healthy') return 'Healthy';
  if (health === 'degraded') return 'Degraded';
  if (health === 'unavailable') return 'Unavailable';
  if (health === 'scaled_down') return 'Scaled Down';
  return '';
}

export function readyString(item: DeploymentItem | StatefulSetItem | DaemonSetItem): string {
  if ('desired_number_scheduled' in item) {
    return `${item.number_ready}/${item.desired_number_scheduled}`;
  }
  return `${item.ready_replicas}/${item.desired_replicas}`;
}

export function jobStatusColor(status: JobStatus): string {
  switch (status) {
    case 'complete':  return 'var(--status-running)';
    case 'running':   return 'var(--pod)';
    case 'failed':    return 'var(--status-failed)';
    case 'suspended': return 'var(--text-muted)';
    default: return 'var(--text-muted)';
  }
}

export function jobStatusLabel(status: JobStatus): string {
  switch (status) {
    case 'complete':  return 'Complete';
    case 'running':   return 'Running';
    case 'failed':    return 'Failed';
    case 'suspended': return 'Suspended';
    default: return 'Unknown';
  }
}

export function cronJobStatusColor(cj: CronJobItem): string {
  if (cj.suspended) return 'var(--text-muted)';
  if (cj.active_jobs > 0) return 'var(--pod)';
  return 'var(--status-running)';
}
