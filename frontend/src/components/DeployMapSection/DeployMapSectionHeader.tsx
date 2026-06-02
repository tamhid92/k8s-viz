import React from 'react';
import { Share2 } from 'lucide-react';
import { SectionHeader } from '../Shell/SectionHeader';

interface Props {
  namespace: string | null;
  name: string | null;
  onViewInNetwork: () => void;
}

export const DeployMapSectionHeader: React.FC<Props> = ({ namespace, name, onViewInNetwork }) => {
  return (
    <SectionHeader>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
        <Share2 size={16} color="var(--ingress)" />
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Deploy Map</span>
        
        {(namespace && name) && (
          <>
            <div style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 8px' }} />
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              All Deployments / <span style={{ fontFamily: 'monospace', color: 'var(--namespace)' }}>{namespace}</span> / <span style={{ fontWeight: 600, color: 'var(--ingress)' }}>{name}</span>
            </div>
          </>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        {(namespace && name) && (
          <button
            onClick={onViewInNetwork}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '12px',
              color: 'var(--namespace)',
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            View in Network →
          </button>
        )}
      </div>
    </SectionHeader>
  );
};
