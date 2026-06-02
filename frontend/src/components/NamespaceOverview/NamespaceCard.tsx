import React from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { NamespaceStats } from '../../lib/laneTransform';

interface NamespaceCardProps {
  stats: NamespaceStats;
  onClick: () => void;
}

export const NamespaceCard: React.FC<NamespaceCardProps> = ({ stats, onClick }) => {
  return (
    <div 
      className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-[4px] p-4 cursor-pointer hover:border-[var(--border-bright)] hover:bg-[var(--bg-elevated)] transition-[background,border] duration-150 relative"
      onClick={() => onClick()}
    >
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-[var(--namespace)] rounded-t-[2px]" />
      <div className="font-mono text-[13px] font-semibold text-[var(--namespace)] mb-4">{stats.name}</div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--pod)]" />
          <span className="font-mono text-[13px] font-bold text-[var(--text-primary)]">{stats.podCount}</span>
          <span className="text-[11px] text-[var(--text-muted)]">Pods</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--service)]" />
          <span className="font-mono text-[13px] font-bold text-[var(--text-primary)]">{stats.serviceCount}</span>
          <span className="text-[11px] text-[var(--text-muted)]">Services</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--ingress)]" />
          <span className="font-mono text-[13px] font-bold text-[var(--text-primary)]">{stats.ingressCount}</span>
          <span className="text-[11px] text-[var(--text-muted)]">Ingresses</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--netpol)]" />
          <span className="font-mono text-[13px] font-bold text-[var(--text-primary)]">{stats.netpolCount}</span>
          <span className="text-[11px] text-[var(--text-muted)]">NetPols</span>
        </div>
      </div>
      {stats.crossLinks.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[var(--border)] flex items-center gap-1.5 text-[var(--text-muted)]">
          <ArrowLeftRight size={14} />
          <span className="text-[11px]">{stats.crossLinks.length} cross-ns links</span>
        </div>
      )}
    </div>
  );
};
