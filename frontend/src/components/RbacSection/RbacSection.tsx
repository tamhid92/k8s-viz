import React, { useState, useEffect } from 'react';
import { RbacSectionHeader } from './RbacSectionHeader';
import { RbacDetailPanel } from './RbacDetailPanel';
import { ResourceTable, TableColumn, TableRow } from '../WorkloadsSection/ResourceTable';
import { ServiceAccountItem, RoleItem, RoleBindingItem } from '../../types/resources';
import { relativeTime } from '../../lib/workloadUtils';

export const RbacSection: React.FC = () => {
  const [kind, setKind] = useState<'Service Accounts' | 'Roles' | 'ClusterRoles' | 'Bindings' | 'Cluster Bindings'>('Service Accounts');
  const [namespace, setNamespace] = useState('');
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [scope, setScope] = useState<'namespaced' | 'cluster' | 'all'>('namespaced');
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
      let url = '';
      const params = new URLSearchParams();
      if (search) params.set('search', search);

      if (kind === 'Service Accounts') {
        url = '/api/v1/rbac/serviceaccounts';
        if (namespace) params.set('namespace', namespace);
      } else if (kind === 'Roles') {
        url = '/api/v1/rbac/roles';
        params.set('scope', scope);
        if (namespace && scope !== 'cluster') params.set('namespace', namespace);
      } else if (kind === 'ClusterRoles') {
        url = '/api/v1/rbac/roles';
        params.set('scope', 'cluster');
      } else if (kind === 'Bindings') {
        url = '/api/v1/rbac/bindings';
        params.set('scope', scope);
        if (namespace && scope !== 'cluster') params.set('namespace', namespace);
      } else if (kind === 'Cluster Bindings') {
        url = '/api/v1/rbac/bindings';
        params.set('scope', 'cluster');
      }

      const qs = params.toString();
      const res = await fetch(`${url}${qs ? '?' + qs : ''}`);
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
  }, [kind, namespace, scope, search]);

  const selectedItem = selectedId ? data.find(d => `${d.namespace || 'cluster'}/${d.name}` === selectedId) || null : null;

  const handleSubNavClick = (k: typeof kind) => {
    if (k === 'ClusterRoles' || k === 'Cluster Bindings') {
      setScope('cluster');
    } else if (scope === 'cluster') {
      setScope('namespaced');
    }
    setKind(k);
  };

  const getColumns = (): TableColumn[] => {
    if (kind === 'Service Accounts') {
      return [
        { key: 'name', label: 'Name', width: '200px', sortable: true },
        { key: 'namespace', label: 'Namespace', width: '150px', sortable: true },
        { key: 'bound_roles', label: 'Bound Roles' },
        { key: 'secrets', label: 'Secrets', width: '80px', sortable: true },
        { key: 'age', label: 'Age', width: '100px', sortable: true }
      ];
    }
    if (kind === 'Roles' || kind === 'ClusterRoles') {
      return [
        { key: 'name', label: 'Name', width: '250px', sortable: true },
        ...(kind === 'Roles' ? [{ key: 'namespace', label: 'Namespace', width: '150px', sortable: true }] : []),
        { key: 'rules', label: 'Rules', width: '100px', sortable: true },
        { key: 'verbs', label: 'Verbs' },
        { key: 'age', label: 'Age', width: '100px', sortable: true }
      ];
    }
    if (kind === 'Bindings' || kind === 'Cluster Bindings') {
      return [
        { key: 'name', label: 'Name', width: '250px', sortable: true },
        ...(kind === 'Bindings' ? [{ key: 'namespace', label: 'Namespace', width: '150px', sortable: true }] : []),
        { key: 'role', label: 'Role', width: '250px', sortable: true },
        { key: 'subjects', label: 'Subjects' },
        { key: 'age', label: 'Age', width: '100px', sortable: true }
      ];
    }
    return [];
  };

  const getRows = (): TableRow[] => {
    return data.map(item => {
      const id = `${item.namespace || 'cluster'}/${item.name}`;
      const cells: Record<string, React.ReactNode> = {
        name: <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.name}</span>,
        namespace: <span style={{ color: 'var(--text-secondary)' }}>{item.namespace || '—'}</span>,
        age: <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{relativeTime(item.created_at)}</span>
      };

      if (kind === 'Service Accounts') {
        const sa = item as ServiceAccountItem;
        const secrets = sa.secrets || [];
        const boundRoles = sa.bound_roles || [];
        cells.secrets = <span style={{ color: 'var(--text-secondary)' }}>{secrets.length}</span>;
        
        const maxRoles = 3;
        cells.bound_roles = (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {boundRoles.slice(0, maxRoles).map(r => (
              <span key={r} style={{
                background: 'rgba(220,38,38,0.08)',
                color: 'var(--netpol)',
                border: '1px solid rgba(220,38,38,0.2)',
                borderRadius: '3px',
                padding: '1px 5px',
                fontSize: '10px'
              }}>{r}</span>
            ))}
            {boundRoles.length > maxRoles && (
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>+{boundRoles.length - maxRoles} more</span>
            )}
            {boundRoles.length === 0 && <span style={{ color: 'var(--text-muted)' }}>—</span>}
          </div>
        );
      } else if (kind === 'Roles' || kind === 'ClusterRoles') {
        const role = item as RoleItem;
        cells.rules = <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{role.rule_count} rules</span>;
        
        const verbs = new Set<string>();
        (role.rules || []).forEach(r => (r.verbs || []).forEach(v => verbs.add(v)));
        const verbList = Array.from(verbs).sort();
        const maxVerbs = 5;
        cells.verbs = (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {verbList.slice(0, maxVerbs).map(v => (
              <span key={v} style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: '3px',
                padding: '1px 5px',
                fontSize: '10px',
                color: 'var(--text-secondary)',
                fontFamily: 'monospace'
              }}>{v}</span>
            ))}
            {verbList.length > maxVerbs && (
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>+{verbList.length - maxVerbs}</span>
            )}
            {verbList.length === 0 && <span style={{ color: 'var(--text-muted)' }}>—</span>}
          </div>
        );
      } else if (kind === 'Bindings' || kind === 'Cluster Bindings') {
        const binding = item as RoleBindingItem;
        const subjects = binding.subjects || [];
        cells.role = (
          <span style={{ fontFamily: 'monospace', color: 'var(--netpol)' }}>
            {binding.role_kind}/{binding.role_ref}
          </span>
        );
        cells.subjects = (
          <span style={{ color: 'var(--text-secondary)' }}>
            {subjects.length > 0 ? (
              <>{subjects[0].name} {subjects.length > 1 && <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>+{subjects.length - 1} more</span>}</>
            ) : '—'}
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
      <RbacSectionHeader
        namespace={namespace}
        namespaces={namespaces}
        onNamespaceChange={setNamespace}
        scope={scope}
        onScopeChange={setScope}
        search={search}
        onSearchChange={setSearch}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ width: '160px', borderRight: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', padding: '16px 0' }}>
          {(['Service Accounts', 'Roles', 'ClusterRoles', 'Bindings', 'Cluster Bindings'] as const).map(k => (
            <button
              key={k}
              onClick={() => handleSubNavClick(k)}
              style={{
                textAlign: 'left',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: kind === k ? 600 : 400,
                color: kind === k ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: kind === k ? 'rgba(59,130,246,0.05)' : 'transparent',
                borderLeft: kind === k ? '3px solid #8b5cf6' : '3px solid transparent',
                borderTop: 'none',
                borderRight: 'none',
                borderBottom: 'none',
                cursor: 'pointer',
                outline: 'none',
                textTransform: 'capitalize'
              }}
            >
              {k}
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
            emptyMessage={`No ${kind.toLowerCase()} found.`}
          />
        </div>

        <RbacDetailPanel
          item={selectedItem}
          kind={kind}
          onClose={() => setSelectedId(null)}
          onSelectRole={(roleName) => {
            setKind('Roles');
            setSearch(roleName);
          }}
        />
      </div>
    </div>
  );
};
