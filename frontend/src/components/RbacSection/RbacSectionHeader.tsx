import React from 'react';
import { Shield, Search } from 'lucide-react';
import { SectionHeader } from '../Shell/SectionHeader';

interface Props {
  namespace: string;
  namespaces: string[];
  onNamespaceChange: (ns: string) => void;
  scope: 'namespaced' | 'cluster' | 'all';
  onScopeChange: (scope: 'namespaced' | 'cluster' | 'all') => void;
  search: string;
  onSearchChange: (s: string) => void;
}

export const RbacSectionHeader: React.FC<Props> = ({
  namespace,
  namespaces,
  onNamespaceChange,
  scope,
  onScopeChange,
  search,
  onSearchChange
}) => {
  return (
    <SectionHeader>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
        <Shield size={16} color="var(--netpol)" />
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>RBAC</span>
        
        <div style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 8px' }} />

        <div style={{ display: 'flex', gap: '4px' }}>
          {(['namespaced', 'cluster', 'all'] as const).map(s => (
            <button
              key={s}
              onClick={() => onScopeChange(s)}
              style={{
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 500,
                border: scope === s ? '1px solid var(--border)' : '1px solid transparent',
                background: scope === s ? 'var(--bg-elevated)' : 'transparent',
                color: scope === s ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <select
          value={namespace}
          onChange={(e) => onNamespaceChange(e.target.value)}
          disabled={scope === 'cluster'}
          style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '4px 28px 4px 10px',
            fontSize: '12px',
            color: 'var(--text-primary)',
            cursor: scope === 'cluster' ? 'not-allowed' : 'pointer',
            appearance: 'none',
            outline: 'none',
            opacity: scope === 'cluster' ? 0.5 : 1
          }}
        >
          <option value="">All Namespaces</option>
          {namespaces.sort().map(ns => (
            <option key={ns} value={ns}>{ns}</option>
          ))}
        </select>
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: '16px', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: '220px' }}>
          <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search RBAC..."
            style={{
              width: '100%',
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '4px 10px 4px 30px',
              fontSize: '12px',
              color: 'var(--text-primary)',
              outline: 'none'
            }}
          />
        </div>
      </div>
    </SectionHeader>
  );
};
