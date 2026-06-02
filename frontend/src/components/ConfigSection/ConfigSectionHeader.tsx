import React from 'react';
import { Settings, Search } from 'lucide-react';
import { SectionHeader } from '../Shell/SectionHeader';

interface Props {
  namespace: string;
  namespaces: string[];
  onNamespaceChange: (ns: string) => void;
  search: string;
  onSearchChange: (s: string) => void;
}

export const ConfigSectionHeader: React.FC<Props> = ({
  namespace,
  namespaces,
  onNamespaceChange,
  search,
  onSearchChange
}) => {
  return (
    <SectionHeader>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
        <Settings size={16} color="var(--cluster-node)" />
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Config</span>
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <select
          value={namespace}
          onChange={(e) => onNamespaceChange(e.target.value)}
          style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '4px 28px 4px 10px',
            fontSize: '12px',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            appearance: 'none',
            outline: 'none'
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
            placeholder="Search Config..."
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
