import React from 'react';
import { NamespaceStats } from '../../lib/laneTransform';

interface StatusBarProps {
  stats: NamespaceStats[];
  edgeCount: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({ stats, edgeCount }) => {
  let podCount = 0;
  let serviceCount = 0;
  let ingressCount = 0;
  let netpolCount = 0;
  let nodeCount = 0;

  for (const s of stats) {
    podCount += s.podCount;
    serviceCount += s.serviceCount;
    ingressCount += s.ingressCount;
    netpolCount += s.netpolCount;
    nodeCount += s.nodeCount;
  }

  const items = [
    { label: 'Pods', count: podCount, color: 'var(--pod)' },
    { label: 'Services', count: serviceCount, color: 'var(--service)' },
    { label: 'Ingresses', count: ingressCount, color: 'var(--ingress)' },
    { label: 'NetPols', count: netpolCount, color: 'var(--netpol)' },
    { label: 'Nodes', count: nodeCount, color: 'var(--cluster-node)' },
  ];

  return (
    <div 
      className="fixed bottom-0 z-[100] h-[var(--status-bar-height)] bg-[var(--bg-surface)] border-t border-[var(--border)] flex items-center justify-between px-4 text-[11px] select-none"
      style={{
        left: 'var(--nav-width)',
        width: 'calc(100% - var(--nav-width))',
        transition: 'left 220ms ease, width 220ms ease'
      }}
    >
      <div className="flex items-center gap-2">
        {items.map(item => (
          <div 
            key={item.label} 
            className="flex items-center gap-1.5 px-2 rounded-full font-semibold"
            style={{ backgroundColor: item.color, color: '#ffffff' }}
          >
            <span>{item.count}</span>
            <span className="font-normal opacity-90">{item.label}</span>
          </div>
        ))}
      </div>
      
      <div className="flex items-center">
        <span className="text-[var(--text-primary)] font-semibold">{edgeCount}</span>
        <span className="text-[var(--text-muted)] ml-1">Total Edges</span>
      </div>

      <div className="text-[var(--text-muted)] font-mono">
        Last updated: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
};
