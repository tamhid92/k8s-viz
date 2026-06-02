import React, { useState, useEffect } from 'react';
import { ConfigSectionHeader } from './ConfigSectionHeader';
import { ConfigDetailPanel } from './ConfigDetailPanel';
import { ResourceTable, TableColumn, TableRow } from '../WorkloadsSection/ResourceTable';
import { ConfigMapItem, SecretItem } from '../../types/resources';
import { relativeTime } from '../../lib/workloadUtils';

export const ConfigSection: React.FC = () => {
  const [kind, setKind] = useState<'configmaps' | 'secrets'>('configmaps');
  const [namespace, setNamespace] = useState('');
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  const fetchNamespaces = async () => {
    try {
      const res = await fetch('/api/v1/namespaces');
      const json = await res.json();
      setNamespaces(json.namespaces || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (namespace) params.set('namespace', namespace);
      if (search) params.set('search', search);

      const qs = params.toString();
      const res = await fetch(`/api/v1/config/${kind}${qs ? '?' + qs : ''}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.items || []);
      } else {
        setData([]);
      }
    } catch (err) {
      console.error(err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNamespaces();
  }, []);

  useEffect(() => {
    fetchData();
    setSelectedId(null);
  }, [kind, namespace, search]);

  const selectedItem = selectedId ? data.find(d => `${d.namespace}/${d.name}` === selectedId) || null : null;

  const getColumns = (): TableColumn[] => {
    if (kind === 'configmaps') {
      return [
        { key: 'name', label: 'Name', width: '250px', sortable: true },
        { key: 'namespace', label: 'Namespace', width: '150px', sortable: true },
        { key: 'keys', label: 'Keys', sortable: true },
        { key: 'age', label: 'Age', width: '100px', sortable: true }
      ];
    }
    if (kind === 'secrets') {
      return [
        { key: 'name', label: 'Name', width: '250px', sortable: true },
        { key: 'namespace', label: 'Namespace', width: '150px', sortable: true },
        { key: 'type', label: 'Type', sortable: true },
        { key: 'keys', label: 'Keys', sortable: true },
        { key: 'age', label: 'Age', width: '100px', sortable: true }
      ];
    }
    return [];
  };

  const getRows = (): TableRow[] => {
    return data.map(item => {
      const id = `${item.namespace}/${item.name}`;
      const cells: Record<string, React.ReactNode> = {
        name: <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.name}</span>,
        namespace: <span style={{ color: 'var(--text-secondary)' }}>{item.namespace || '—'}</span>,
        age: <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{relativeTime(item.created_at)}</span>
      };

      if (kind === 'configmaps') {
        const cm = item as ConfigMapItem;
        cells.keys = <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{cm.keys.length} keys</span>;
      } else if (kind === 'secrets') {
        const sec = item as SecretItem;
        cells.keys = <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{sec.keys.length} keys</span>;
        
        let typeColor = 'var(--text-secondary)';
        let bg = 'var(--bg-elevated)';
        if (sec.secret_type === 'kubernetes.io/tls') {
          typeColor = '#d97706';
          bg = 'rgba(217,119,6,0.1)';
        } else if (sec.secret_type === 'kubernetes.io/dockerconfigjson') {
          typeColor = '#3b82f6';
          bg = 'rgba(59,130,246,0.1)';
        }
        cells.type = (
          <span style={{
            background: bg, color: typeColor, border: '1px solid var(--border)',
            borderRadius: '10px', padding: '2px 8px', fontSize: '11px'
          }}>
            {sec.secret_type}
          </span>
        );
      }

      return {
        id,
        cells,
        health: 'healthy',
        sortValues: {
          name: item.name,
          namespace: item.namespace || '',
          keys: item.keys?.length || 0,
          type: item.secret_type || '',
          age: new Date(item.created_at || 0).getTime()
        }
      };
    });
  };

  return (
    <div style={{
      paddingTop: 'var(--section-header-height)',
      paddingBottom: 'var(--status-bar-height)',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <ConfigSectionHeader
        namespace={namespace}
        namespaces={namespaces}
        onNamespaceChange={setNamespace}
        search={search}
        onSearchChange={setSearch}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ width: '160px', borderRight: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', padding: '16px 0' }}>
          {(['configmaps', 'secrets'] as const).map(k => (
            <button
              key={k}
              onClick={() => setKind(k)}
              style={{
                textAlign: 'left',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: kind === k ? 600 : 400,
                color: kind === k ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: kind === k ? 'rgba(59,130,246,0.05)' : 'transparent',
                borderLeft: kind === k ? '3px solid #3b82f6' : '3px solid transparent',
                borderTop: 'none',
                borderRight: 'none',
                borderBottom: 'none',
                cursor: 'pointer',
                outline: 'none',
                textTransform: 'capitalize'
              }}
            >
              {k === 'configmaps' ? 'ConfigMaps' : 'Secrets'}
            </button>
          ))}
        </div>
        
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <ResourceTable
            columns={getColumns()}
            rows={getRows()}
            selectedId={selectedId}
            onRowClick={setSelectedId}
            loading={loading}
            emptyMessage={`No ${kind} found.`}
          />
        </div>

        <ConfigDetailPanel
          item={selectedItem}
          kind={kind}
          onClose={() => setSelectedId(null)}
        />
      </div>
    </div>
  );
};
