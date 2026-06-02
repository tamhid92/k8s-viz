import React from 'react';
import { Layers, ArrowRight } from 'lucide-react';
import { SectionHeader } from '../Shell/SectionHeader';
import { NamespaceMapSummary } from '../../types/workloads';

interface Props {
  namespace: string | null;
  summary: NamespaceMapSummary | null;
  onViewInNetwork: () => void;
}

export const NamespaceMapSectionHeader: React.FC<Props> = ({ namespace, summary, onViewInNetwork }) => {
  return (
    <SectionHeader>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
        <Layers size={16} color="var(--cluster-node)" />
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
          Namespace Map
        </span>
        {namespace && (
          <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--namespace)' }}>
            All Namespaces / {namespace}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {summary && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {summary.workloads > 0 && (
              <span style={{ fontSize: '10px', color: 'var(--text-primary)', background: 'color-mix(in srgb, var(--pod) 15%, transparent)', padding: '2px 8px', borderRadius: '12px', border: '1px solid color-mix(in srgb, var(--pod) 30%, transparent)' }}>
                📦 {summary.workloads} workloads
              </span>
            )}
            {summary.services > 0 && (
              <span style={{ fontSize: '10px', color: 'var(--text-primary)', background: 'color-mix(in srgb, var(--service) 15%, transparent)', padding: '2px 8px', borderRadius: '12px', border: '1px solid color-mix(in srgb, var(--service) 30%, transparent)' }}>
                🔗 {summary.services} services
              </span>
            )}
            {summary.network_policies > 0 && (
              <span style={{ fontSize: '10px', color: 'var(--text-primary)', background: 'color-mix(in srgb, var(--netpol) 15%, transparent)', padding: '2px 8px', borderRadius: '12px', border: '1px solid color-mix(in srgb, var(--netpol) 30%, transparent)' }}>
                🛡 {summary.network_policies} netpols
              </span>
            )}
          </div>
        )}

        <button
          onClick={onViewInNetwork}
          disabled={!namespace}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '4px 12px',
            color: namespace ? 'var(--text-primary)' : 'var(--text-muted)',
            fontSize: '12px',
            cursor: namespace ? 'pointer' : 'not-allowed',
            opacity: namespace ? 1 : 0.5
          }}
        >
          View in Network
          <ArrowRight size={14} />
        </button>
      </div>
    </SectionHeader>
  );
};
