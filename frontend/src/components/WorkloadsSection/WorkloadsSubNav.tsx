import React from 'react';
import { WorkloadKind, WorkloadSummary } from '../../types/workloads';
import { HealthDot } from './HealthDot';

interface Props {
  active: WorkloadKind;
  onChange: (k: WorkloadKind) => void;
  summary: WorkloadSummary | null;
}

const ITEMS: { id: WorkloadKind; label: string }[] = [
  { id: 'deployments', label: 'Deployments' },
  { id: 'statefulsets', label: 'StatefulSets' },
  { id: 'daemonsets', label: 'DaemonSets' },
  { id: 'pods', label: 'Pods' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'cronjobs', label: 'CronJobs' },
];

export const WorkloadsSubNav: React.FC<Props> = ({ active, onChange, summary }) => {
  return (
    <div style={{
      width: '160px',
      borderRight: '1px solid var(--border)',
      padding: '8px 0',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0
    }}>
      {ITEMS.map(item => {
        const isActive = active === item.id;
        return (
          <div
            key={item.id}
            onClick={() => onChange(item.id)}
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '13px',
              background: isActive ? 'rgba(37,99,235,0.06)' : 'transparent',
              borderLeft: `2px solid ${isActive ? 'var(--pod)' : 'transparent'}`,
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: isActive ? 600 : 400,
              transition: 'all 150ms'
            }}
          >
            {item.label}
          </div>
        );
      })}

      {summary && active === 'jobs' && (
        <div style={{ padding: '16px 16px', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'transparent', border: '1px solid var(--text-muted)', flexShrink: 0 }} />
            {summary.total} total
          </div>
          {summary.healthy > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--status-running)' }}>●</span>
              {summary.healthy} complete
            </div>
          )}
          {summary.degraded > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--pod)' }}>●</span>
              {summary.degraded} running
            </div>
          )}
          {summary.unavailable > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--status-failed)' }}>●</span>
              {summary.unavailable} failed
            </div>
          )}
        </div>
      )}

      {summary && active !== 'jobs' && active !== 'cronjobs' && (
        <div style={{ padding: '16px 16px', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'transparent', border: '1px solid var(--text-muted)', flexShrink: 0 }} />
            {summary.total} total
          </div>
          {summary.healthy > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <HealthDot health="healthy" size={8} />
              {summary.healthy} healthy
            </div>
          )}
          {summary.degraded > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <HealthDot health="degraded" size={8} />
              {summary.degraded} degraded
            </div>
          )}
          {summary.unavailable > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <HealthDot health="unavailable" size={8} />
              {summary.unavailable} unavailable
            </div>
          )}
          {summary.scaled_down > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <HealthDot health="scaled_down" size={8} />
              {summary.scaled_down} scaled down
            </div>
          )}
        </div>
      )}
    </div>
  );
};
