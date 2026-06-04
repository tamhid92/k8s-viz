import React, { useState } from 'react';
import { X, FileText, Lock, AlertTriangle } from 'lucide-react';
import { ConfigMapItem, SecretItem } from '../../types/resources';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface Props {
  item: any;
  kind: 'configmaps' | 'secrets';
  onClose: () => void;
}

export const ConfigDetailPanel: React.FC<Props> = ({ item, kind, onClose }) => {
  useEscapeKey(() => {
    onClose();
  });

  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  if (!item) return null;

  const toggleKey = (k: string) => {
    setExpandedKeys(prev => ({ ...prev, [k]: !prev[k] }));
  };

  return (
    <div style={{
      width: '450px',
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
        <div style={{ background: 'rgba(59,130,246,0.1)', padding: '8px', borderRadius: '8px', color: kind === 'configmaps' ? '#3b82f6' : 'var(--netpol)' }}>
          {kind === 'configmaps' ? <FileText size={20} /> : <Lock size={20} />}
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
        
        {kind === 'secrets' && (
          <>
            <div style={{
              background: 'rgba(217,119,6,0.06)',
              border: '1px solid rgba(217,119,6,0.25)',
              borderRadius: '4px',
              padding: '8px 12px',
              marginBottom: '12px',
              display: 'flex',
              gap: '8px'
            }}>
              <AlertTriangle size={14} color="#d97706" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div style={{ fontSize: '12px', color: '#d97706', lineHeight: 1.4 }}>
                Secret values are not displayed. Only key names are shown.
              </div>
            </div>
            
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Type: {(item as SecretItem).secret_type}
            </div>

            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Keys</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(item as SecretItem).keys.map((k, i) => (
                  <div key={i} style={{
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '3px', padding: '4px 10px',
                    fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-primary)'
                  }}>
                    {k}
                  </div>
                ))}
                {(item as SecretItem).keys.length === 0 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No keys.</div>
                )}
              </div>
            </div>
          </>
        )}

        {kind === 'configmaps' && (
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Data</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(item as ConfigMapItem).keys.map((k, i) => {
                const val = (item as ConfigMapItem).data[k] || '';
                const isLong = val.length > 200;
                const expanded = expandedKeys[k];
                
                return (
                  <div key={i} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ padding: '6px 12px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                      {k}
                    </div>
                    <div style={{ padding: '12px', fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {isLong && !expanded ? (
                        <>
                          {val.substring(0, 200)}
                          <span style={{ color: 'var(--text-muted)' }}>... [{val.length - 200} more chars]</span>
                          <button
                            onClick={() => toggleKey(k)}
                            style={{ display: 'block', marginTop: '8px', background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '11px', padding: 0 }}
                          >
                            Show More
                          </button>
                        </>
                      ) : (
                        <>
                          {val}
                          {isLong && expanded && (
                            <button
                              onClick={() => toggleKey(k)}
                              style={{ display: 'block', marginTop: '8px', background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '11px', padding: 0 }}
                            >
                              Show Less
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {(item as ConfigMapItem).keys.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No data.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
