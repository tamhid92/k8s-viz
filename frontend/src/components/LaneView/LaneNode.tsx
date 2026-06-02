import React, { useEffect, useRef } from 'react';
import { Box, Network, Server, Globe } from 'lucide-react';
import { GraphNode, ServiceData, IngressData, ClusterNodeData } from '../../types/graph';
import { NODE_COLORS } from '../../lib/constants';

interface LaneNodeProps {
  node: GraphNode;
  selected: boolean;
  onSelect: (id: string) => void;
  registerRef: (id: string, el: HTMLElement | null) => void;
}

export const LaneNode: React.FC<LaneNodeProps> = ({ node, selected, onSelect, registerRef }) => {
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    registerRef(node.id, elRef.current);
    return () => registerRef(node.id, null);
  }, [node.id, registerRef]);

  if (node.type === 'network_policy' || node.type === 'namespace') return null;

  const typeColor = NODE_COLORS[node.type] || 'var(--external)';

  let Icon = Box;
  if (node.type === 'service') Icon = Network;
  else if (node.type === 'cluster_node') Icon = Server;
  else if (node.type === 'ingress') Icon = Globe;

  let metadata = null;
  if (node.type === 'service') {
    const data = node.data as ServiceData;
    metadata = (
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[var(--text-code)] font-mono text-[11px]">{data.cluster_ip || 'None'}</span>
        <span className="bg-[var(--bg-elevated)] border border-[var(--border)] px-1 rounded text-[9px] text-[var(--text-muted)]">{data.type}</span>
      </div>
    );
  } else if (node.type === 'ingress') {
    const data = node.data as IngressData;
    const rule = data.rules?.[0];
    const host = rule?.host || 'No rules';
    metadata = (
      <div className="flex items-center mt-1.5">
        <span className="text-[var(--text-code)] font-mono text-[11px] truncate" title={host}>{host}</span>
      </div>
    );
  } else if (node.type === 'cluster_node') {
    const data = node.data as ClusterNodeData;
    metadata = (
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[var(--text-code)] font-mono text-[11px]">{data.internal_ip || 'None'}</span>
        <div className={`w-1.5 h-1.5 rounded-full ${data.ready ? 'bg-[var(--status-running)]' : 'bg-[var(--status-failed)]'}`} title={data.ready ? 'Ready' : 'Not Ready'} />
      </div>
    );
  }

  return (
    <div
      ref={elRef}
      onClick={() => onSelect(node.id)}
      className={`w-[180px] bg-[var(--bg-surface)] border border-[var(--border)] rounded px-[10px] py-[8px] cursor-pointer transition-all duration-120 shadow-[0_1px_2px_rgba(0,0,0,0.05)] ${
        selected ? 'border-[var(--border-accent)]' : 'hover:border-[var(--border-bright)]'
      }`}
      style={{ borderLeft: `3px solid ${typeColor}` }}
    >
      <div className="flex items-center gap-1.5">
        <Icon size={14} style={{ color: typeColor }} className="shrink-0" />
        <span className="text-[12px] font-semibold text-[var(--text-primary)] truncate flex-1" title={node.label}>
          {node.label}
        </span>
      </div>
      {metadata}
    </div>
  );
};
