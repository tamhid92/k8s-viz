import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { WorkloadKind, DeploymentItem, StatefulSetItem, DaemonSetItem, JobItem, CronJobItem } from '../../types/workloads';
import { HealthDot } from './HealthDot';
import { healthLabel, readyString, jobStatusColor, jobStatusLabel, cronJobStatusColor, relativeTime, formatAge } from '../../lib/workloadUtils';
import { PodList } from './PodList';
import { EventsList } from './EventsList';
import { useLogManager } from '../../hooks/useLogManager';
import { ScrollText, FileText } from 'lucide-react';

function JobStatusBadge({ status }: { status: any }) {
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

interface Props {
  item: DeploymentItem | StatefulSetItem | DaemonSetItem | JobItem | CronJobItem | null;
  kind: WorkloadKind;
  onClose: () => void;
  onNavigate?: (kind: WorkloadKind, id: string) => void;
}

export const WorkloadDetailPanel: React.FC<Props> = ({ item, kind, onClose, onNavigate }) => {
  const { openLogTab, openDescribeTab } = useLogManager();
  const [activeTab, setActiveTab] = useState<'overview' | 'pods' | 'events' | 'job history'>('overview');

  // Reset tab when item changes
  useEffect(() => {
    setActiveTab('overview');
  }, [item?.name]);

  return (
    <div style={{
      position: 'relative',
      width: '320px',
      height: '100%',
      background: 'var(--bg-surface)',
      borderLeft: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      transform: `translateX(${item ? '0' : '100%'})`,
      transition: 'transform 280ms ease',
      flexShrink: 0
    }}>
      {item && (
        <>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {kind === 'jobs' && 'status' in item ? (
                <JobStatusBadge status={(item as JobItem).status} />
              ) : kind === 'cronjobs' && 'suspended' in item ? (
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: cronJobStatusColor(item as CronJobItem) }} />
              ) : (
                <HealthDot health={(item as any).health} size={12} />
              )}
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', maxWidth: '170px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.name}>
                {item.name}
              </div>
              <div style={{
                background: 'rgba(8,145,178,0.08)',
                color: 'var(--namespace)',
                border: '1px solid rgba(8,145,178,0.2)',
                borderRadius: '3px',
                padding: '1px 6px',
                fontSize: '11px',
                fontFamily: 'monospace'
              }}>
                {item.namespace}
              </div>
            </div>
            <X size={16} color="var(--text-secondary)" style={{ cursor: 'pointer' }} onClick={onClose} />
          </div>

          <div style={{ display: 'flex', height: '36px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            {(kind === 'cronjobs' ? ['overview', 'job history', 'events'] : ['overview', 'pods', 'events']).map((tab: any) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `2px solid ${activeTab === tab ? 'var(--pod)' : 'transparent'}`,
                  color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: activeTab === tab ? 600 : 400,
                  fontSize: '12px',
                  cursor: 'pointer',
                  textTransform: 'capitalize'
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div style={{ padding: '16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {kind === 'cronjobs' && 'suspended' in item && item.suspended && (
                <div style={{ background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.25)', padding: '8px 12px', borderRadius: '4px', fontSize: '12px', color: 'var(--restart-warning)' }}>
                  ⏸ This CronJob is suspended and will not create new jobs.
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {kind === 'jobs' && 'status' in item ? (
                    <JobStatusBadge status={(item as JobItem).status} />
                  ) : kind === 'cronjobs' ? null : (
                    <>
                      <HealthDot health={(item as any).health} size={10} />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{healthLabel((item as any).health)}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>— {readyString(item as any)} Ready</span>
                    </>
                  )}
                </div>
                {kind === 'deployments' && (
                  <div style={{ display: 'flex', gap: '6px' }}>
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
                    <button
                      onClick={() => openDescribeTab({ kind: 'deployment', namespace: item.namespace, name: item.name, label: item.name })}
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
                )}
                {kind !== 'deployments' && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {kind === 'jobs' && 'pods' in item && (item as JobItem).pods.length > 0 && (
                      <button
                        onClick={() => openLogTab({ kind: 'pod', namespace: item.namespace, name: (item as JobItem).pods[0].name, label: (item as JobItem).pods[0].name })}
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
                    {kind === 'jobs' && 'pods' in item && (item as JobItem).pods.length === 0 && (
                      <button
                        disabled
                        style={{
                          fontSize: '11px', color: 'var(--text-muted)', background: 'transparent',
                          border: '1px solid var(--border)', borderRadius: '3px', padding: '1px 7px',
                          cursor: 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: '3px'
                        }}
                      >
                        <ScrollText size={10} /> Logs
                      </button>
                    )}
                    <button
                      onClick={() => openDescribeTab({ kind: kind === 'jobs' ? 'job' : kind === 'cronjobs' ? 'cronjob' : kind.replace(/s$/, ''), namespace: item.namespace, name: item.name, label: item.name })}
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
                )}
              </div>

              {'strategy' in item && (
                <div style={{ fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>Strategy:</span>
                  <span style={{ color: 'var(--text-primary)' }}>{item.strategy}</span>
                </div>
              )}

              {kind === 'jobs' && 'status' in item && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Completions</div>
                    <div style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 600, color: (item as JobItem).failed > 0 ? 'var(--status-failed)' : ((item as JobItem).succeeded === (item as JobItem).completions ? 'var(--status-running)' : 'var(--restart-warning)') }}>
                      {(item as JobItem).succeeded}/{(item as JobItem).completions}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Parallelism</div>
                    <div style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>{(item as JobItem).parallelism}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Duration</div>
                    <div style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>{(item as JobItem).duration || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Failures</div>
                    <div style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 600, color: (item as JobItem).failed > 0 ? 'var(--status-failed)' : 'var(--text-primary)' }}>{(item as JobItem).failed}</div>
                  </div>
                </div>
              )}

              {kind === 'jobs' && 'owner_cronjob' in item && item.owner_cronjob && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Owned by CronJob:</span>
                  <span
                    onClick={() => onNavigate?.('cronjobs', item.owner_cronjob as string)}
                    style={{ color: 'var(--ingress)', cursor: 'pointer', fontWeight: 500 }}
                  >{item.owner_cronjob}</span>
                </div>
              )}

              {kind === 'cronjobs' && 'schedule' in item && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Schedule:</span>
                    <span style={{ fontFamily: 'monospace', color: 'var(--text-code)' }}>{item.schedule}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Next Run:</span>
                    <span style={{ fontFamily: 'monospace' }}>{item.suspended ? '—' : (item.next_schedule_relative || '—')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Last Scheduled:</span>
                    <span>{relativeTime(item.last_schedule_time)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Last Successful:</span>
                    <span>{relativeTime(item.last_successful_time)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Concurrency:</span>
                    <span>{item.concurrency_policy}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Suspended:</span>
                    <span>{item.suspended ? 'Yes' : 'No'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>History Limits:</span>
                    <span>{item.successful_jobs_history_limit} successful / {item.failed_jobs_history_limit} failed</span>
                  </div>
                </div>
              )}

              {Object.keys((item as any).selector || {}).length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Selector</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {Object.entries((item as any).selector).map(([k, v]) => (
                      <span key={k} style={{
                        background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px', fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-secondary)'
                      }}>
                        {k}={v as React.ReactNode}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {'containers' in item && item.containers && item.containers.length > 0 && (
                <div>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>Containers</div>
                  {item.containers.map((c, i) => (
                  <div key={i} style={{ border: '1px solid var(--border)', borderRadius: '4px', padding: '10px', marginBottom: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{c.name}</div>
                    <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-code)', marginBottom: '8px', wordBreak: 'break-all' }}>{c.image}</div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Req CPU</div>
                        <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{c.cpu_request || '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Req Mem</div>
                        <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{c.memory_request || '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Lim CPU</div>
                        <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{c.cpu_limit || '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Lim Mem</div>
                        <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{c.memory_limit || '—'}</div>
                      </div>
                    </div>

                    {c.ports.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {c.ports.map((p, pi) => (
                          <span key={pi} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '3px', padding: '1px 4px', fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'pods' && 'pods' in item && (
                (item.pods && item.pods.length > 0) ? (
                  <PodList pods={item.pods} namespace={item.namespace} />
                ) : (
                  <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '13px' }}>No pods available</div>
                )
          )}

          {activeTab === 'job history' && kind === 'cronjobs' && 'recent_jobs' in item && (
            <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
              {item.recent_jobs.map(job => (
                <div key={job.name}
                  onClick={() => onNavigate?.('jobs', job.name)}
                  style={{
                    display: 'flex', alignItems: 'center', height: '36px', padding: '0 16px',
                    borderBottom: '1px solid var(--border)', cursor: 'pointer', gap: '12px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: jobStatusColor(job.status), flexShrink: 0 }} />
                  <div style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '12px', fontWeight: 500 }}>{job.name}</div>
                  <div style={{ width: '60px', fontSize: '11px', fontFamily: 'monospace', textAlign: 'right' }}>{job.succeeded}/{job.completions}</div>
                  <div style={{ width: '60px', fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)', textAlign: 'right' }}>{job.duration || '—'}</div>
                  <div style={{ width: '50px', fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'right' }}>{formatAge(job.created_at)}</div>
                  <div style={{ paddingLeft: '8px' }}>
                    {job.pods && job.pods.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openLogTab({ kind: 'pod', namespace: job.namespace, name: job.pods[0].name, label: job.pods[0].name });
                        }}
                        style={{
                          fontSize: '10px', color: 'var(--logs)', background: 'transparent',
                          border: '1px solid rgba(8,145,178,0.4)', borderRadius: '3px', padding: '1px 5px',
                          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--logs)'; e.currentTarget.style.background = 'rgba(8,145,178,0.06)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(8,145,178,0.4)'; e.currentTarget.style.background = 'transparent'; }}
                      >
                        <ScrollText size={10} /> Logs
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {item.recent_jobs.length > 0 && (
                <div style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                  Success rate: {item.recent_jobs.filter(j => j.status === 'complete').length}/{item.recent_jobs.length} ({Math.round(item.recent_jobs.filter(j => j.status === 'complete').length / item.recent_jobs.length * 100)}%)
                </div>
              )}
              {item.recent_jobs.length === 0 && (
                <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '13px' }}>No recent jobs</div>
              )}
            </div>
          )}

          {activeTab === 'events' && (
            <EventsList kind={kind} name={item.name} namespace={item.namespace} />
          )}
        </>
      )}
    </div>
  );
};
