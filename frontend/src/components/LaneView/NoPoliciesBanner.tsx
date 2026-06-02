import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface NoPoliciesBannerProps {
  namespace: string;
}

export const NoPoliciesBanner: React.FC<NoPoliciesBannerProps> = ({ namespace }) => {
  return (
    <div className="flex items-center gap-2 m-3 mt-3 mb-0 mx-4 px-3.5 py-2 rounded border bg-[rgba(217,119,6,0.06)] border-[rgba(217,119,6,0.25)]">
      <AlertTriangle size={14} className="text-[var(--status-pending)]" />
      <span className="text-[12px] text-[var(--text-secondary)]">
        No NetworkPolicies defined in <strong>{namespace}</strong> — all traffic is permitted. Hover a workload to see implicit connections.
      </span>
    </div>
  );
};
