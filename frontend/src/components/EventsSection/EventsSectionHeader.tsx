import React from 'react';
import { Bell, RefreshCw, Search } from 'lucide-react';
import { SectionHeader } from '../Shell/SectionHeader';

interface Props {
  namespace: string;
  namespaces: string[];
  onNamespaceChange: (ns: string) => void;
  typeFilter: '' | 'Warning';
  onTypeFilterChange: (type: '' | 'Warning') => void;
  search: string;
  onSearchChange: (s: string) => void;
  loading: boolean;
}

export const EventsSectionHeader: React.FC<Props> = ({
  namespace,
  namespaces,
  onNamespaceChange,
  typeFilter,
  onTypeFilterChange,
  search,
  onSearchChange,
  loading
}) => {
  return (
    <SectionHeader>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
        <Bell size={16} color="var(--ingress)" />
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Events</span>
        
        <div style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 8px' }} />

        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => onTypeFilterChange('')}
            style={{
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 500,
              border: typeFilter === '' ? '1px solid var(--border)' : '1px solid transparent',
              background: typeFilter === '' ? 'var(--bg-elevated)' : 'transparent',
              color: typeFilter === '' ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            All
          </button>
          <button
            onClick={() => onTypeFilterChange('Warning')}
            style={{
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 500,
              border: typeFilter === 'Warning' ? '1px solid var(--netpol)' : '1px solid transparent',
              background: typeFilter === 'Warning' ? 'rgba(220,38,38,0.08)' : 'transparent',
              color: typeFilter === 'Warning' ? 'var(--netpol)' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            ⚠ Warnings
          </button>
        </div>
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
            placeholder="Search events..."
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          <span style={{ fontSize: '11px' }}>30s</span>
        </div>
      </div>
    </SectionHeader>
  );
};
