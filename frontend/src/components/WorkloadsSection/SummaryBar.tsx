import React from 'react';
import { WorkloadSummary, WorkloadKind } from '../../types/workloads';
import { HealthDot } from './HealthDot';

interface Props {
  summary: WorkloadSummary;
  kind: WorkloadKind;
}

export const SummaryBar: React.FC<Props> = ({ summary, kind }) => {
  return (
    <div style={{
      height: '32px',
      background: 'var(--bg-elevated)',
      borderTop: '1px solid var(--border)',
      padding: '0 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      fontSize: '12px',
      flexShrink: 0
    }}>
      <div style={{ fontWeight: 600 }}>
        {summary.total} {kind}
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
  );
};
