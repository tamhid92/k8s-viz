import React, { useEffect, useRef } from 'react';
import { Boxes, ArrowLeftRight } from 'lucide-react';
import { CrossNsWorkload } from '../../types/graph';

interface Props {
  item: CrossNsWorkload;
  onNavigate: (namespace: string, groupId: string) => void;
  registerRef: (id: string, el: HTMLElement | null) => void;
}

export const CrossNsWorkloadCard: React.FC<Props> = ({ item, onNavigate, registerRef }) => {
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    registerRef(item.id, elRef.current);
    return () => registerRef(item.id, null);
  }, [item.id, registerRef]);

  return (
    <div
      ref={elRef}
      onClick={() => onNavigate(item.namespace, item.groupId)}
      style={{
        width: '160px',
        border: '1px dashed var(--namespace)',
        borderRadius: '4px',
        padding: '0',
        background: 'var(--bg-surface)',
        cursor: 'pointer',
        transition: '150ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-accent)';
        e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--namespace)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{
        background: 'rgba(8,145,178,0.08)',
        borderBottom: '1px dashed var(--namespace)',
        padding: '0 8px',
        height: '18px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        <ArrowLeftRight size={10} color="var(--namespace)" />
        <span style={{ fontSize: '9px', fontFamily: 'monospace', color: 'var(--namespace)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.namespace}
        </span>
      </div>

      <div style={{ padding: '6px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
          <Boxes size={12} color="var(--workload)" />
          <span style={{ fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
            {item.label}
          </span>
          {item.replicaCount > 0 && (
            <span style={{ fontSize: '10px', background: 'var(--bg-elevated)', padding: '1px 4px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
              ×{item.replicaCount}
            </span>
          )}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          {item.replicaCount} pods in {item.namespace}
        </div>
      </div>
    </div>
  );
};
