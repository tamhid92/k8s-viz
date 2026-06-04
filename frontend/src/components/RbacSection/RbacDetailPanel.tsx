import React from 'react';
import { X, Shield } from 'lucide-react';
import { RulesTable } from './RulesTable';
import { ServiceAccountItem, RoleItem, RoleBindingItem } from '../../types/resources';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface Props {
  item: any;
  kind: string;
  onClose: () => void;
  onSelectRole?: (roleName: string) => void;
}

export const RbacDetailPanel: React.FC<Props> = ({ item, kind, onClose, onSelectRole }) => {
  useEscapeKey(() => {
    onClose();
  });

  if (!item) return null;

  return (
    <div style={{
      width: '400px',
      borderLeft: '1px solid var(--border)',
      background: 'var(--bg-elevated)',
      display: 'flex',
      flexDirection: 'column',
      animation: 'slideInRight 0.2s ease-out'
    }}>
      <div style={{
        padding: '16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div style={{ background: 'rgba(220,38,38,0.1)', padding: '8px', borderRadius: '8px', color: 'var(--netpol)' }}>
          <Shield size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.name}
          </div>
          {item.namespace && (
            <div style={{ display: 'inline-block', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {item.namespace}
            </div>
          )}
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <X size={20} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {(kind === 'Roles' || kind === 'ClusterRoles') && (
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Rules</div>
            <RulesTable rules={(item as RoleItem).rules || []} />
            {((item as RoleItem).rules || []).length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No rules defined.</div>
            )}
          </div>
        )}

        {(kind === 'Bindings' || kind === 'Cluster Bindings') && (
          <>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Role Reference</div>
              <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '4px', padding: '10px 12px', fontFamily: 'monospace', fontSize: '12px', color: 'var(--netpol)' }}>
                {(item as RoleBindingItem).role_kind}/{(item as RoleBindingItem).role_ref}
              </div>
            </div>
            
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Subjects</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {((item as RoleBindingItem).subjects || []).map((sub, i) => (
                  <div key={i} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '4px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '11px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px', color: 'var(--text-secondary)' }}>{sub.kind}</span>
                    <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-primary)', fontWeight: 500 }}>{sub.name}</span>
                    {sub.namespace && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ns: {sub.namespace}</span>}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {kind === 'Service Accounts' && (
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Bound Roles</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {((item as ServiceAccountItem).bound_roles || []).map((r, i) => (
                <div
                  key={i}
                  onClick={() => onSelectRole && onSelectRole(r)}
                  style={{
                    background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '4px', padding: '8px 12px',
                    fontSize: '12px', fontFamily: 'monospace', color: 'var(--netpol)', cursor: 'pointer', transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-input)'}
                >
                  {r}
                </div>
              ))}
              {((item as ServiceAccountItem).bound_roles || []).length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No bound roles.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
