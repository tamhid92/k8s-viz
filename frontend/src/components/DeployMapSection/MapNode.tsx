import React, { useEffect, useRef } from 'react';
import { LucideIcon } from 'lucide-react';

interface Props {
  nodeKey: string;
  icon: LucideIcon;
  label: string;
  subtitle: string;
  badge?: string;
  accentColor: string;
  selected: boolean;
  onSelect: () => void;
  registerRef: (key: string, el: HTMLElement | null) => void;
  extraRows?: React.ReactNode;
}

export const MapNode: React.FC<Props> = ({
  nodeKey, icon: Icon, label, subtitle, badge, accentColor, selected, onSelect, registerRef, extraRows
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    registerRef(nodeKey, ref.current);
    return () => registerRef(nodeKey, null);
  }, [nodeKey, registerRef]);

  const isDeploy = nodeKey === 'deploy';

  return (
    <div
      ref={ref}
      onClick={onSelect}
      style={{
        width: isDeploy ? '100%' : '190px',
        maxWidth: isDeploy ? '220px' : undefined,
        background: selected ? 'var(--bg-elevated)' : 'var(--bg-surface)',
        borderTop: `1px solid ${selected ? 'var(--border-accent)' : 'var(--border)'}`,
        borderRight: `1px solid ${selected ? 'var(--border-accent)' : 'var(--border)'}`,
        borderBottom: `1px solid ${selected ? 'var(--border-accent)' : 'var(--border)'}`,
        borderLeft: isDeploy ? `1px solid ${selected ? 'var(--border-accent)' : 'var(--border)'}` : `3px solid ${accentColor}`,
        borderRadius: '4px',
        cursor: 'pointer',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0
      }}
    >
      {isDeploy && (
        <div style={{ height: '3px', width: '100%', background: 'var(--ingress)' }} />
      )}
      <div style={{ padding: '8px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <Icon size={isDeploy ? 18 : 14} color={accentColor} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: isDeploy ? '14px' : '12px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {label}
          </div>
          {badge && (
            <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1px 6px', fontSize: '9px', color: 'var(--text-secondary)' }}>
              {badge}
            </div>
          )}
        </div>
        
        <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-code)' }}>
          {subtitle}
        </div>
      </div>
      
      {extraRows && (
        <div>
          {extraRows}
        </div>
      )}
    </div>
  );
};
