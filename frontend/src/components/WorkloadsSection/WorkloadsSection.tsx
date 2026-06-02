import React, { useState, useEffect, useMemo } from 'react';
import { WorkloadKind, WorkloadSummary, DeploymentItem, StatefulSetItem, DaemonSetItem, PodSummary, JobItem, CronJobItem } from '../../types/workloads';
import { WorkloadsSectionHeader } from './WorkloadsSectionHeader';
import { WorkloadsSubNav } from './WorkloadsSubNav';
import { WorkloadDetailPanel } from './WorkloadDetailPanel';
import { ResourceTable, TableColumn, TableRow } from './ResourceTable';
import { SummaryBar } from './SummaryBar';
import { HealthDot } from './HealthDot';
import { RestartPill } from './RestartPill';
import { formatAge, readyString, jobStatusColor, jobStatusLabel, cronJobStatusColor, relativeTime } from '../../lib/workloadUtils';
import { POD_PHASE_COLORS } from '../../lib/constants';
import { PodPhase } from '../../types/graph';
import { useLogManager } from '../../hooks/useLogManager';
import { ScrollText, FileText } from 'lucide-react';


function JobStatusBadgeComponent({ status }: { status: any }) {
  const color = jobStatusColor(status);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: `${color}14`,
      border: `1px solid ${color}40`,
      color, borderRadius: 4,
      padding: '1px 7px', fontSize: 10, fontWeight: 600,
    }}>
      {jobStatusLabel(status)}
    </span>
  );
}

export const WorkloadsSection: React.FC = () => {
  const { openLogTab, openDescribeTab } = useLogManager();
  const [kind, setKind] = useState<WorkloadKind>('deployments');
  const [selectedNamespace, setSelectedNamespace] = useState<string>('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  
  const [deployments, setDeployments] = useState<{ items: DeploymentItem[], summary: WorkloadSummary | null }>({ items: [], summary: null });
  const [statefulsets, setStatefulsets] = useState<{ items: StatefulSetItem[], summary: WorkloadSummary | null }>({ items: [], summary: null });
  const [daemonsets, setDaemonsets] = useState<{ items: DaemonSetItem[], summary: WorkloadSummary | null }>({ items: [], summary: null });
  const [jobs, setJobs] = useState<any>({ items: [], summary: null });
  const [cronJobs, setCronJobs] = useState<any>({ items: [] });
  
  const [namespaces, setNamespaces] = useState<string[]>([]);

  const fetchKind = async (k: 'deployments' | 'statefulsets' | 'daemonsets' | 'jobs' | 'cronjobs', ns: string) => {
    const res = await fetch(`/api/v1/workloads/${k}?namespace=${ns}`);
    if (!res.ok) throw new Error(`Failed to fetch ${k}`);
    return res.json();
  };

  // On mount fetch all 3 to get namespaces
  useEffect(() => {
    let active = true;
    const init = async () => {
      setLoading(true);
      try {
        const [deps, sts, dss, jbs, cjs] = await Promise.all([
          fetchKind('deployments', ''),
          fetchKind('statefulsets', ''),
          fetchKind('daemonsets', ''),
          fetchKind('jobs', ''),
          fetchKind('cronjobs', '')
        ]);
        if (!active) return;
        setDeployments(deps);
        setStatefulsets(sts);
        setDaemonsets(dss);
        setJobs(jbs);
        setCronJobs(cjs);

        const nsSet = new Set<string>();
        [...deps.items, ...sts.items, ...dss.items, ...jbs.items, ...cjs.items].forEach((i: any) => nsSet.add(i.namespace));
        setNamespaces(Array.from(nsSet));
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    };
    init();
    return () => { active = false; };
  }, []);

  // On kind or namespace change, refetch
  useEffect(() => {
    if (kind === 'pods') return;
    let active = true;
    const update = async () => {
      setLoading(true);
      try {
        const data = await fetchKind(kind, selectedNamespace);
        if (!active) return;
        if (kind === 'deployments') setDeployments(data);
        if (kind === 'statefulsets') setStatefulsets(data);
        if (kind === 'daemonsets') setDaemonsets(data);
        if (kind === 'jobs') setJobs(data);
        if (kind === 'cronjobs') setCronJobs(data);
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    };
    update();
    return () => { active = false; };
  }, [kind, selectedNamespace]);

  const activeData = useMemo(() => {
    if (kind === 'deployments') return deployments;
    if (kind === 'statefulsets') return statefulsets;
    if (kind === 'daemonsets') return daemonsets;
    if (kind === 'jobs') return jobs;
    if (kind === 'cronjobs') return cronJobs;
    return { items: [], summary: null };
  }, [kind, deployments, statefulsets, daemonsets, jobs, cronJobs]);

  // Pods aggregation
  const flattenedPods = useMemo(() => {
    if (kind !== 'pods') return [];
    const all = [...deployments.items, ...statefulsets.items, ...daemonsets.items, ...jobs.items];
    const podMap = new Map<string, PodSummary & { namespace: string }>();
    all.forEach(wl => {
      if (!selectedNamespace || wl.namespace === selectedNamespace) {
        wl.pods.forEach((p: PodSummary) => {
          podMap.set(p.name, { ...p, namespace: wl.namespace });
        });
      }
    });
    return Array.from(podMap.values());
  }, [kind, deployments, statefulsets, daemonsets, jobs, selectedNamespace]);

  const activeSummary = useMemo(() => {
    if (kind === 'pods') {
      let h = 0, p = 0, f = 0, u = 0;
      flattenedPods.forEach(pod => {
        if (pod.phase === 'Running' || pod.phase === 'Succeeded') h++;
        else if (pod.phase === 'Pending') p++;
        else if (pod.phase === 'Failed') f++;
        else u++;
      });
      return { total: flattenedPods.length, healthy: h, degraded: p, unavailable: f, scaled_down: u } as WorkloadSummary;
    }
    return activeData.summary;
  }, [kind, activeData, flattenedPods]);

  // Filtering
  const filteredItems = useMemo(() => {
    const s = search.toLowerCase();
    if (kind === 'pods') {
      return flattenedPods.filter(p => p.name.toLowerCase().includes(s));
    }
    return activeData.items.filter((i: any) => i.name.toLowerCase().includes(s));
  }, [kind, search, activeData.items, flattenedPods]);

  const selectedItem = useMemo(() => {
    if (!selectedId || kind === 'pods') return null;
    return activeData.items.find((i: any) => i.name === selectedId) || null;
  }, [selectedId, activeData.items, kind]);

  // Columns definition
  const columns = useMemo<TableColumn[]>(() => {
    let cols: TableColumn[] = [];
    if (kind === 'jobs') {
      cols = [
        { key: 'status', label: 'Status', width: '100px', sortable: true },
        { key: 'name', label: 'Name', sortable: true }
      ];
      if (!selectedNamespace) cols.push({ key: 'namespace', label: 'Namespace', width: '120px', sortable: true });
      cols.push(
        { key: 'completions', label: 'Completions', width: '100px', sortable: true },
        { key: 'duration', label: 'Duration', width: '100px', sortable: true },
        { key: 'failed', label: 'Failures', width: '70px', sortable: true },
        { key: 'owner', label: 'Owner', width: '140px', sortable: true },
        { key: 'age', label: 'Age', width: '60px', sortable: true },
        { key: 'actions', label: 'Actions', width: '140px' }
      );
      return cols;
    } else if (kind === 'cronjobs') {
      cols = [
        { key: 'status', label: 'Status', width: '80px', sortable: true },
        { key: 'name', label: 'Name', sortable: true }
      ];
      if (!selectedNamespace) cols.push({ key: 'namespace', label: 'Namespace', width: '120px', sortable: true });
      cols.push(
        { key: 'schedule', label: 'Schedule', width: '120px', sortable: true },
        { key: 'next_run', label: 'Next Run', width: '100px', sortable: true },
        { key: 'last_run', label: 'Last Run', width: '100px', sortable: true },
        { key: 'active', label: 'Active', width: '60px', sortable: true },
        { key: 'age', label: 'Age', width: '60px', sortable: true },
        { key: 'actions', label: 'Actions', width: '140px' }
      );
      return cols;
    }
    
    cols = [
      { key: 'health', label: kind === 'pods' ? 'Phase' : '●', width: kind === 'pods' ? '110px' : '32px', sortable: true },
      { key: 'name', label: 'Name', sortable: true },
    ];
    if (!selectedNamespace) {
      cols.push({ key: 'namespace', label: 'Namespace', width: '120px', sortable: true });
    }
    
    if (kind === 'pods') {
      cols.push(
        { key: 'ip', label: 'IP', sortable: true },
        { key: 'node', label: 'Node', sortable: true },
        { key: 'restarts', label: 'Restarts', width: '80px', sortable: true },
        { key: 'age', label: 'Age', width: '60px', sortable: true }
      );
    } else {
      cols.push({ key: 'ready', label: 'Ready', width: '70px', sortable: true });
      if (kind === 'deployments') {
        cols.push({ key: 'up_to_date', label: 'Up-to-date', width: '90px', sortable: true });
        cols.push({ key: 'available', label: 'Available', width: '90px', sortable: true });
      }
      if (kind === 'statefulsets') {
        cols.push({ key: 'service', label: 'Service', sortable: true });
      }
      if (kind === 'daemonsets') {
        cols.push({ key: 'available', label: 'Available', width: '90px', sortable: true });
        cols.push({ key: 'misscheduled', label: 'Misscheduled', width: '90px', sortable: true });
      }
      cols.push(
        { key: 'restarts', label: 'Restarts', width: '80px', sortable: true },
        { key: 'age', label: 'Age', width: '60px', sortable: true },
        { key: 'images', label: 'Images', width: '200px' }
      );
    }
    cols.push({ key: 'actions', label: 'Actions', width: '140px' });
    return cols;
  }, [kind, selectedNamespace]);

  // Rows definition
  const rows = useMemo<TableRow[]>(() => {
    if (kind === 'jobs') {
      return (filteredItems as JobItem[]).map(job => {
        const ownerNode = job.owner_cronjob ? (
          <div
            onClick={(e) => { e.stopPropagation(); setKind('cronjobs'); setSelectedId(job.owner_cronjob); }}
            style={{
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px',
              padding: '1px 6px', background: 'rgba(217,119,6,0.08)', color: 'var(--ingress)',
              border: '1px solid rgba(217,119,6,0.2)', borderRadius: '3px', fontSize: '11px', fontWeight: 500
            }}
          >
            CronJob/{job.owner_cronjob}
          </div>
        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>;
        
        return {
          id: job.name,
          health: job.status === 'failed' ? 'unavailable' : job.status === 'running' ? 'degraded' : 'healthy',
          className: job.status === 'running' ? 'job-running-row' : '',
          sortValues: {
            status: job.status,
            name: job.name,
            namespace: job.namespace,
            completions: job.succeeded,
            duration: job.duration || '',
            failed: job.failed,
            owner: job.owner_cronjob || '',
            age: job.created_at ? new Date(job.created_at).getTime() : 0
          },
          cells: {
            status: <JobStatusBadgeComponent status={job.status} />,
            name: <span style={{ fontWeight: 600 }}>{job.name}</span>,
            namespace: (
              <span style={{
                background: 'rgba(8,145,178,0.08)', color: 'var(--namespace)',
                border: '1px solid rgba(8,145,178,0.2)', borderRadius: '3px',
                padding: '1px 6px', fontSize: '11px', fontFamily: 'monospace'
              }}>
                {job.namespace}
              </span>
            ),
            completions: <span style={{
              fontFamily: 'monospace',
              color: job.failed > 0 ? 'var(--status-failed)' : (job.succeeded === job.completions ? 'var(--status-running)' : 'var(--restart-warning)')
            }}>{job.succeeded}/{job.completions}</span>,
            duration: <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{job.duration || '—'}</span>,
            failed: job.failed > 0 ? <RestartPill count={job.failed} /> : null,
            owner: ownerNode,
            age: formatAge(job.created_at),
            actions: (
              <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => openDescribeTab({ kind: 'job', namespace: job.namespace, name: job.name, label: job.name })}
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
            )
          }
        };
      });
    }

    if (kind === 'cronjobs') {
      return (filteredItems as CronJobItem[]).map(cj => {
        const nextIsSoon = cj.next_schedule_relative?.includes('m') || cj.next_schedule_relative?.includes('s');
        return {
          id: cj.name,
          health: cj.suspended ? 'scaled_down' : (cj.active_jobs > 0 ? 'degraded' : 'healthy'),
          style: cj.suspended ? { opacity: 0.6 } : undefined,
          sortValues: {
            status: cj.suspended ? 'suspended' : 'active',
            name: cj.name,
            namespace: cj.namespace,
            schedule: cj.schedule,
            next_run: cj.next_schedule_time ? new Date(cj.next_schedule_time).getTime() : 0,
            last_run: cj.last_schedule_time ? new Date(cj.last_schedule_time).getTime() : 0,
            active: cj.active_jobs,
            age: cj.created_at ? new Date(cj.created_at).getTime() : 0
          },
          cells: {
            status: <span style={{
              display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: cronJobStatusColor(cj)
            }} />,
            name: <span style={{ fontWeight: 600 }}>{cj.name}</span>,
            namespace: (
              <span style={{
                background: 'rgba(8,145,178,0.08)', color: 'var(--namespace)',
                border: '1px solid rgba(8,145,178,0.2)', borderRadius: '3px',
                padding: '1px 6px', fontSize: '11px', fontFamily: 'monospace'
              }}>
                {cj.namespace}
              </span>
            ),
            schedule: (
              <span title={`Concurrency: ${cj.concurrency_policy}\nHistory: ${cj.successful_jobs_history_limit} successful / ${cj.failed_jobs_history_limit} failed`}
                    style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-code)' }}>
                {cj.schedule}
              </span>
            ),
            next_run: <span style={{ fontSize: '11px', fontFamily: 'monospace', color: nextIsSoon ? 'var(--restart-warning)' : 'inherit' }}>{cj.suspended ? '—' : (cj.next_schedule_relative || '—')}</span>,
            last_run: <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{relativeTime(cj.last_schedule_time)}</span>,
            active: cj.active_jobs > 0 ? (
              <span style={{
                background: 'rgba(8,145,178,0.1)', color: 'var(--pod)',
                border: '1px solid rgba(8,145,178,0.3)', borderRadius: '12px',
                padding: '1px 7px', fontSize: '10px', fontWeight: 600
              }}>⟳ {cj.active_jobs}</span>
            ) : <span style={{ color: 'var(--text-muted)' }}>—</span>,
            age: formatAge(cj.created_at),
            actions: (
              <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => openDescribeTab({ kind: 'cronjob', namespace: cj.namespace, name: cj.name, label: cj.name })}
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
            )
          },
          subRow: selectedId === cj.name && cj.recent_jobs && cj.recent_jobs.length > 0 ? (
            <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Recent:</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[...cj.recent_jobs].reverse().slice(-6).map((j, i) => (
                  <div key={i} title={`${j.name}\nDuration: ${j.duration}\nAge: ${formatAge(j.created_at)}`} style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: j.status === 'complete' ? 'var(--status-running)' : j.status === 'failed' ? 'var(--status-failed)' : j.status === 'running' ? 'var(--pod)' : 'var(--text-muted)'
                  }} />
                ))}
              </div>
            </div>
          ) : undefined
        };
      });
    }

    if (kind === 'pods') {
      return (filteredItems as (PodSummary & { namespace: string })[]).map(pod => ({
        id: pod.name,
        health: 'healthy',
        sortValues: {
          health: pod.phase,
          name: pod.name,
          namespace: pod.namespace,
          ip: pod.pod_ip || '',
          node: pod.node_name || '',
          restarts: pod.restart_count,
          age: pod.created_at ? new Date(pod.created_at).getTime() : 0
        },
        cells: {
          health: (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '2px 8px',
              borderRadius: '12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              fontSize: '11px',
              fontWeight: 500,
              color: 'var(--text-primary)'
            }}>
              <span style={{
                display: 'inline-block',
                width: '6px', height: '6px',
                borderRadius: '50%',
                background: POD_PHASE_COLORS[pod.phase as PodPhase] || 'var(--status-unknown)'
              }} />
              {pod.phase}
            </div>
          ),
          name: <span style={{ fontWeight: 600 }}>{pod.name}</span>,
          namespace: (
            <span style={{
              background: 'rgba(8,145,178,0.08)', color: 'var(--namespace)',
              border: '1px solid rgba(8,145,178,0.2)', borderRadius: '3px',
              padding: '1px 6px', fontSize: '11px', fontFamily: 'monospace'
            }}>
              {pod.namespace}
            </span>
          ),
          ip: <span style={{ fontFamily: 'monospace', color: 'var(--text-code)' }}>{pod.pod_ip || '—'}</span>,
          node: <span style={{ color: 'var(--text-secondary)' }}>{pod.node_name || '—'}</span>,
          restarts: <RestartPill count={pod.restart_count} />,
          age: formatAge(pod.created_at),
          actions: (
            <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
              <button
                onClick={() => openLogTab({ kind: 'pod', namespace: pod.namespace, name: pod.name, label: pod.name })}
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
                onClick={() => openDescribeTab({ kind: 'pod', namespace: pod.namespace, name: pod.name, label: pod.name })}
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
          )
        }
      }));
    }

    return (filteredItems as (DeploymentItem | StatefulSetItem | DaemonSetItem)[]).map(item => {
      const images = item.containers.map(c => {
        const parts = c.image.split('/');
        return parts[parts.length - 1];
      });
      const primaryImage = images[0] || '—';
      const extraImages = images.length > 1 ? ` +${images.length - 1}` : '';

      const baseCells: Record<string, React.ReactNode> = {
        health: <HealthDot health={item.health} />,
        name: <span style={{ fontWeight: 600 }}>{item.name}</span>,
        namespace: (
          <span style={{
            background: 'rgba(8,145,178,0.08)', color: 'var(--namespace)',
            border: '1px solid rgba(8,145,178,0.2)', borderRadius: '3px',
            padding: '1px 6px', fontSize: '11px', fontFamily: 'monospace'
          }}>
            {item.namespace}
          </span>
        ),
        ready: <span style={{ fontFamily: 'monospace', color: item.health === 'healthy' ? 'var(--status-running)' : 'var(--text-primary)' }}>{readyString(item)}</span>,
        restarts: <RestartPill count={item.total_restarts} />,
        age: formatAge(item.created_at),
        images: <span style={{ fontFamily: 'monospace', color: 'var(--text-code)', fontSize: '11px' }}>{primaryImage}{extraImages}</span>,
        actions: (
          <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
            {kind === 'deployments' && (
              <button
                onClick={() => openLogTab({ kind: 'deployment', namespace: item.namespace, name: item.name, label: item.name })}
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
            <button
              onClick={() => openDescribeTab({ kind: kind.replace(/s$/, ''), namespace: item.namespace, name: item.name, label: item.name })}
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
        )
      };

      const sortValues: Record<string, any> = {
        health: item.health,
        name: item.name,
        namespace: item.namespace,
        restarts: item.total_restarts,
        age: item.created_at ? new Date(item.created_at).getTime() : 0
      };

      if (kind === 'deployments') {
        const d = item as DeploymentItem;
        baseCells.up_to_date = <span style={{ fontFamily: 'monospace' }}>{d.updated_replicas}</span>;
        baseCells.available = <span style={{ fontFamily: 'monospace' }}>{d.available_replicas}</span>;
        sortValues.up_to_date = d.updated_replicas;
        sortValues.available = d.available_replicas;
      } else if (kind === 'statefulsets') {
        const s = item as StatefulSetItem;
        baseCells.service = s.service_name || '—';
        sortValues.service = s.service_name || '';
      } else if (kind === 'daemonsets') {
        const ds = item as DaemonSetItem;
        baseCells.available = <span style={{ fontFamily: 'monospace' }}>{ds.number_available}</span>;
        baseCells.misscheduled = <span style={{ fontFamily: 'monospace' }}>{ds.number_misscheduled}</span>;
        sortValues.available = ds.number_available;
        sortValues.misscheduled = ds.number_misscheduled;
      }

      return {
        id: item.name,
        health: item.health,
        sortValues,
        cells: baseCells
      };
    });
  }, [filteredItems, kind, selectedNamespace]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 'var(--section-header-height)', paddingBottom: 'var(--status-bar-height)', height: '100vh', overflow: 'hidden' }}>
      <WorkloadsSectionHeader
        selectedNamespace={selectedNamespace}
        namespaces={namespaces}
        onNamespaceChange={setSelectedNamespace}
        search={search}
        onSearchChange={setSearch}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <WorkloadsSubNav
          active={kind}
          onChange={(k) => { setKind(k); setSelectedId(null); }}
          summary={activeSummary}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {activeSummary && <SummaryBar summary={activeSummary} kind={kind} />}
          <ResourceTable
            columns={columns}
            rows={rows}
            selectedId={selectedId}
            onRowClick={(id) => setSelectedId(id)}
            loading={loading && filteredItems.length === 0}
            emptyMessage={`No ${kind} found`}
          />
        </div>
        <WorkloadDetailPanel
          item={selectedItem}
          kind={kind}
          onClose={() => setSelectedId(null)}
        />
      </div>
    </div>
  );
};
