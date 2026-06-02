import React, { useEffect, useRef } from 'react';
import { Boxes, Unlock } from 'lucide-react';
import { WorkloadGroup } from '../../types/graph';

interface WorkloadGroupNodeProps {
  nodeId?: string;
  group: WorkloadGroup;
  selected: boolean;
  hovered: boolean;
  compact?: boolean;
  hasPolicies?: boolean;
  inboundRules?: number;
  outboundRules?: number;
  onSelect: (id: string) => void;
  onHover: (id: string) => void;
  onHoverEnd: () => void;
  registerRef: (id: string, el: HTMLElement | null) => void;
}

export const WorkloadGroupNode: React.FC<WorkloadGroupNodeProps> = ({
  nodeId,
  group,
  selected,
  hovered,
  compact = false,
  hasPolicies = true,
  inboundRules,
  outboundRules,
  onSelect,
  onHover,
  onHoverEnd,
  registerRef
}) => {
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const idToRegister = nodeId || group.groupId;
    registerRef(idToRegister, elRef.current);
    return () => registerRef(idToRegister, null);
  }, [group.groupId, nodeId, registerRef]);

  const runningCount = group.pods.filter(p => p.data.kind === 'pod' && p.data.phase === 'Running').length;
  const pendingCount = group.pods.filter(p => p.data.kind === 'pod' && p.data.phase === 'Pending').length;

  return (
    <div
      ref={elRef}
      onClick={() => onSelect(group.groupId)}
      onMouseEnter={() => onHover(group.groupId)}
      onMouseLeave={onHoverEnd}
      className={`shrink-0 relative bg-[var(--bg-surface)] border border-[var(--border)] rounded border-l-4 border-l-[var(--workload)] p-2 cursor-pointer transition-all duration-120 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ${
        selected ? 'border-[var(--border-accent)]' : hovered ? 'border-[var(--border-bright)]' : ''
      }`}
      style={{ width: compact ? '160px' : '200px' }}
    >
      {!hasPolicies && (
        <div className="absolute top-1.5 right-1.5" title="All traffic permitted — no policies">
          <Unlock size={10} className="text-[var(--text-muted)]" />
        </div>
      )}
      
      <div className="flex items-center gap-2 mb-1">
        <Boxes size={14} className="text-[var(--workload)] shrink-0" />
        <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate flex-1">
          {group.label}
        </span>
        <span className="px-1.5 py-0.5 rounded-full bg-[rgba(37,99,235,0.08)] border border-[rgba(37,99,235,0.2)] text-[var(--workload)] text-[9px] font-mono leading-none">
          ×{group.replicaCount}
        </span>
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
          {runningCount > 0 && <span className="text-[var(--status-running)]">{runningCount} running</span>}
          {pendingCount > 0 && <span className="text-[var(--status-pending)]">{pendingCount} pending</span>}
          {runningCount === 0 && pendingCount === 0 && <span>0 ready</span>}
        </div>
        
        {!compact && group.hostNodeNames.length > 0 && (
          <div className="text-[10px] font-mono text-[var(--text-muted)] truncate" title={group.hostNodeNames.join(', ')}>
            {group.hostNodeNames.join(', ')}
          </div>
        )}

        {!compact && inboundRules !== undefined && outboundRules !== undefined && (
          <div className="flex items-center gap-3 text-[10px] mt-1 text-[var(--text-secondary)] font-mono">
            <span>In: {inboundRules}</span>
            <span>Out: {outboundRules}</span>
          </div>
        )}
      </div>
    </div>
  );
};
