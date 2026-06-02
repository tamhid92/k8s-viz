import React, { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { NamespacePortal as NamespacePortalType } from '../../types/graph';

interface Props {
  portal: NamespacePortalType;
  direction: 'source' | 'destination';
  onNavigate: (namespace: string) => void;
  registerRef: (id: string, el: HTMLElement | null) => void;
}

export const NamespacePortal: React.FC<Props> = ({ portal, direction, onNavigate, registerRef }) => {
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    registerRef(portal.id, elRef.current);
    return () => registerRef(portal.id, null);
  }, [portal.id, registerRef]);

  return (
    <div
      ref={elRef}
      onClick={() => onNavigate(portal.namespace)}
      style={{
        width: '150px',
        border: '1px dashed var(--portal)',
        borderRadius: '4px',
        padding: '8px 10px',
        background: 'var(--bg-elevated)',
        cursor: 'pointer',
        transition: '150ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--namespace)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--portal)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
        {direction === 'source' ? (
          <ArrowLeft size={12} color="var(--portal)" />
        ) : (
          <ArrowRight size={12} color="var(--portal)" />
        )}
        <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
          {direction === 'source' ? '← namespace' : 'namespace →'}
        </span>
      </div>

      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {portal.namespace}
      </div>
      
      {portal.podCount > 0 && (
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
          {portal.podCount} pods
        </div>
      )}
    </div>
  );
};
