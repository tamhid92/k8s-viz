import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { NamespaceStats } from '../../lib/laneTransform';

interface Props {
  selected: string | null;
  onSelect: (ns: string) => void;
  namespaceStats: NamespaceStats[];
}

export const NamespaceList: React.FC<Props> = ({ selected, onSelect, namespaceStats }) => {
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/v1/graph/namespaces')
      .then(r => r.json())
      .then(data => setNamespaces(data.namespaces || []))
      .catch(console.error);
  }, []);

  const filtered = namespaces.filter(ns => ns.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{
      width: '200px',
      borderRight: '1px solid var(--border)',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      background: 'var(--bg-surface)'
    }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          background: 'var(--bg-input)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          padding: '4px 8px'
        }}>
          <Search size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search namespaces..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              marginLeft: '6px',
              fontSize: '12px',
              width: '100%',
              color: 'var(--text-primary)'
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {filtered.map(ns => {
          const isSelected = selected === ns;
          const stats = namespaceStats.find(s => s.name === ns);
          return (
            <div
              key={ns}
              onClick={() => onSelect(ns)}
              style={{
                padding: '8px 16px',
                cursor: 'pointer',
                background: isSelected ? 'rgba(5,150,105,0.06)' : 'transparent',
                borderLeft: isSelected ? '2px solid var(--cluster-node)' : '2px solid transparent',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}
            >
              <span style={{ fontSize: '13px', fontFamily: 'monospace', color: 'var(--namespace)', fontWeight: isSelected ? 600 : 400 }}>
                {ns}
              </span>
              {stats && (
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {stats.podCount}p {stats.serviceCount}s
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
