import React from 'react';
import { restartThreshold, restartColor } from '../../lib/workloadUtils';

export const RestartPill: React.FC<{ count: number }> = ({ count }) => {
  if (count === 0) return null;

  const threshold = restartThreshold(count);
  const color = restartColor(threshold);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      background: `${color}18`,
      border: `1px solid ${color}40`,
      color: color,
      borderRadius: 4, padding: '1px 6px',
      fontSize: 10, fontFamily: 'monospace',
    }}>
      ↺ {count}
    </span>
  );
};
