import React from 'react';
import { PodSummary } from '../../types/workloads';
import { POD_PHASE_COLORS } from '../../lib/constants';
import { PodPhase } from '../../types/graph';
import { RestartPill } from './RestartPill';
import { formatAge } from '../../lib/workloadUtils';
import { useLogManager } from '../../hooks/useLogManager';
import { ScrollText, FileText } from 'lucide-react';

export const PodList: React.FC<{ pods: PodSummary[], namespace: string }> = ({ pods, namespace }) => {
  const { openLogTab, openDescribeTab } = useLogManager();

  return (
    <div style={{ width: '100%', overflowX: 'auto', flex: 1, overflowY: 'auto' }}>
      <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
        <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)' }}>
          <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
            <th style={{ padding: '8px 12px', fontWeight: 400 }}>Phase</th>
            <th style={{ padding: '8px 12px', fontWeight: 400 }}>Name</th>
            <th style={{ padding: '8px 12px', fontWeight: 400 }}>IP</th>
            <th style={{ padding: '8px 12px', fontWeight: 400 }}>Node</th>
            <th style={{ padding: '8px 12px', fontWeight: 400 }}>Restarts</th>
            <th style={{ padding: '8px 12px', fontWeight: 400 }}>Age</th>
            <th style={{ padding: '8px 12px', fontWeight: 400 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {pods.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No pods found</td>
            </tr>
          ) : (
            pods.map(pod => (
              <tr key={pod.name} style={{ height: '36px', borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '0 12px' }}>
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
                </td>
                <td style={{ padding: '0 12px', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'monospace' }} title={pod.name}>
                  {pod.name}
                </td>
                <td style={{ padding: '0 12px', fontFamily: 'monospace', color: 'var(--text-code)' }}>
                  {pod.pod_ip || '—'}
                </td>
                <td style={{ padding: '0 12px', color: 'var(--text-secondary)', maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={pod.node_name || ''}>
                  {pod.node_name || '—'}
                </td>
                <td style={{ padding: '0 12px' }}>
                  <RestartPill count={pod.restart_count} />
                </td>
                <td style={{ padding: '0 12px' }}>
                  {formatAge(pod.created_at)}
                </td>
                <td style={{ padding: '0 12px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => openLogTab({ kind: 'pod', namespace: namespace, name: pod.name, label: pod.name })}
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
                      onClick={() => openDescribeTab({ kind: 'pod', namespace: namespace, name: pod.name, label: pod.name })}
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
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
