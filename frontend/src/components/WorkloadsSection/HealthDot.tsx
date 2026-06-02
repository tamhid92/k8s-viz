import React from 'react';
import { WorkloadHealth } from '../../types/workloads';
import { healthColor } from '../../lib/workloadUtils';

export const HealthDot: React.FC<{ health: WorkloadHealth; size?: number }> = ({ health, size }) => {
  return (
    <span style={{
      display: 'inline-block',
      width: size ?? 8, height: size ?? 8,
      borderRadius: '50%',
      background: healthColor(health),
      flexShrink: 0,
    }} />
  );
};
