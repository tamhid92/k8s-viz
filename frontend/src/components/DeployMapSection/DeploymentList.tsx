import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { DeploymentItem } from '../../types/workloads';
import { healthLabel, healthColor } from '../../lib/workloadUtils';

interface Props {
  selected: string | null;
  onSelect: (key: string) => void;
}

const HealthDot: React.FC<{ health: string; size: number }> = ({ health, size }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', backgroundColor: healthColor(health as any) || 'var(--text-muted)' }} title={healthLabel(health as any)} />
);

export const DeploymentList: React.FC<Props> = ({ selected, onSelect }) => {
  const [deployments, setDeployments] = useState<DeploymentItem[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/v1/workloads/deployments')
      .then(r => r.json())
      .then(data => {
        setDeployments(data.items || []);
      })
      .catch(console.error);
  }, []);

  const filtered = deployments.filter(d => {
    if (!search) return true;
    return d.name.includes(search) || d.namespace.includes(search);
  });

  const grouped: Record<string, DeploymentItem[]> = {};
  filtered.forEach(d => {
    if (!grouped[d.namespace]) grouped[d.namespace] = [];
    grouped[d.namespace].push(d);
  });
  
  const sortedNamespaces = Object.keys(grouped).sort();

  return (
    <div style={{ width: '240px', borderRight: '1px solid var(--border)', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 14px' }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deployments..."
            style={{
              width: '100%',
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '6px 10px 6px 30px',
              fontSize: '12px',
              color: 'var(--text-primary)',
              outline: 'none'
            }}
          />
        </div>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sortedNamespaces.map(ns => (
          <div key={ns}>
            <div style={{ padding: '10px 14px 4px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
              {ns}
            </div>
            {grouped[ns].map(d => {
              const key = `${d.namespace}/${d.name}`;
              const isSelected = selected === key;
              return (
                <div
                  key={key}
                  onClick={() => onSelect(key)}
                  style={{
                    padding: '8px 14px',
                    cursor: 'pointer',
                    borderLeft: '2px solid transparent',
                    borderLeftColor: isSelected ? 'var(--ingress)' : 'transparent',
                    background: isSelected ? 'rgba(217,119,6,0.06)' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'var(--bg-elevated)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <HealthDot health={d.health} size={6} />
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {d.name}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--namespace)' }}>{d.namespace}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>×{d.ready_replicas}/{d.desired_replicas}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
