import React, { useState, useEffect, useReducer } from 'react';
import { useLogManager } from '../../hooks/useLogManager';
import { relativeTime } from '../../lib/workloadUtils';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface DescribeViewerProps {
  tabId: string;
}

export const DescribeViewer: React.FC<DescribeViewerProps> = ({ tabId }) => {
  const { getDescResult } = useLogManager();
  const { result, loading } = getDescResult(tabId);
  const [, forceUpdate] = useReducer(x => x + 1, 0);
  const [labelsOpen, setLabelsOpen] = useState(false);

  useEffect(() => {
    const int = setInterval(forceUpdate, 5000);
    return () => clearInterval(int);
  }, []);

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        Loading...
      </div>
    );
  }

  if (!result || result.error) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        {result?.error || 'Could not load resource'}
      </div>
    );
  }

  const renderDetails = () => {
    switch (result.kind.toLowerCase()) {
      case 'deployment':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
              <div style={{ width: '120px', color: 'var(--text-muted)' }}>Strategy</div>
              <div>{String(result.details.strategy)}</div>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
              <div style={{ width: '120px', color: 'var(--text-muted)' }}>Selector</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {Object.entries(result.details.selector as Record<string, string> || {}).map(([k, v]) => (
                  <div key={k} style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)' }}>{k}={v}</div>
                ))}
              </div>
            </div>
          </div>
        );
      case 'pod':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
              <div style={{ width: '120px', color: 'var(--text-muted)' }}>Node</div>
              <div>{String(result.details.node_name || 'None')}</div>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
              <div style={{ width: '120px', color: 'var(--text-muted)' }}>Pod IP</div>
              <div>{String(result.details.pod_ip || 'None')}</div>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
              <div style={{ width: '120px', color: 'var(--text-muted)' }}>Host IP</div>
              <div>{String(result.details.host_ip || 'None')}</div>
            </div>
          </div>
        );
      case 'service':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
              <div style={{ width: '120px', color: 'var(--text-muted)' }}>Type</div>
              <div>{String(result.details.type)}</div>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
              <div style={{ width: '120px', color: 'var(--text-muted)' }}>Cluster IP</div>
              <div>{String(result.details.cluster_ip || 'None')}</div>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
              <div style={{ width: '120px', color: 'var(--text-muted)' }}>Ports</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {(result.details.ports as any[] || []).map((p, i) => (
                  <div key={i}>{p.port}/{p.protocol} ➔ {p.target_port} {p.name ? `(${p.name})` : ''}</div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
              <div style={{ width: '120px', color: 'var(--text-muted)' }}>Selector</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {Object.entries(result.details.selector as Record<string, string> || {}).map(([k, v]) => (
                  <div key={k} style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)' }}>{k}={v}</div>
                ))}
              </div>
            </div>
          </div>
        );
      case 'node':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
              <div style={{ width: '120px', color: 'var(--text-muted)' }}>Roles</div>
              <div>{(result.details.roles as string[] || []).join(', ')}</div>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
              <div style={{ width: '120px', color: 'var(--text-muted)' }}>Internal IP</div>
              <div>{String(result.details.internal_ip || 'None')}</div>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
              <div style={{ width: '120px', color: 'var(--text-muted)' }}>OS Image</div>
              <div>{String(result.details.os_image || 'None')}</div>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
              <div style={{ width: '120px', color: 'var(--text-muted)' }}>Kernel</div>
              <div>{String(result.details.kernel || 'None')}</div>
            </div>
          </div>
        );
      default:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Object.entries(result.details || {}).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
                <div style={{ width: '120px', color: 'var(--text-muted)' }}>{k}</div>
                <div>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>
              </div>
            ))}
          </div>
        );
    }
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '16px', background: 'var(--bg-canvas)' }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: '4px', padding: '14px 16px', marginBottom: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <div style={{ fontSize: '10px', background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: '10px', textTransform: 'uppercase', fontWeight: 600 }}>
            {result.kind}
          </div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{result.name}</div>
          {result.namespace && (
            <div style={{ fontSize: '10px', color: 'var(--namespace)', border: '1px solid var(--border)', padding: '1px 4px', borderRadius: '3px' }}>
              {result.namespace}
            </div>
          )}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
          {result.summary}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {result.created_at ? `${relativeTime(result.created_at)} ago` : 'Unknown age'}
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <div 
          onClick={() => setLabelsOpen(!labelsOpen)}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', marginBottom: '8px' }}
        >
          {labelsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          LABELS
        </div>
        {labelsOpen && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginLeft: '18px' }}>
            {Object.entries(result.labels || {}).map(([k, v]) => (
              <div key={k} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px', fontFamily: 'monospace', fontSize: '10px', color: 'var(--text-secondary)' }}>
                {k}={v}
              </div>
            ))}
            {Object.keys(result.labels || {}).length === 0 && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No labels</span>}
          </div>
        )}
      </div>

      {result.conditions && result.conditions.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>CONDITIONS</div>
          <div style={{ border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
            {result.conditions.map((c, i) => (
              <div key={i} style={{ display: 'flex', borderBottom: i < result.conditions.length - 1 ? '1px solid var(--border)' : 'none', padding: '8px 12px', fontSize: '12px', background: 'var(--bg-surface)' }}>
                <div style={{ width: '160px', fontWeight: 500, color: 'var(--text-primary)' }}>{c.type}</div>
                <div style={{ width: '100px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: c.status === 'True' ? 'var(--status-running)' : c.status === 'False' ? 'var(--status-failed)' : 'var(--text-muted)' }} />
                  {c.status}
                </div>
                <div style={{ flex: 1, color: 'var(--text-muted)' }}>{c.reason} {c.message && `- ${c.message}`}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '12px' }}>DETAILS</div>
        {renderDetails()}
      </div>

      <div>
        <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '12px' }}>EVENTS ({result.events.length})</div>
        {result.events.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No recent events found.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {result.events.map((e, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, background: e.type === 'Warning' ? 'rgba(217,119,6,0.1)' : 'var(--bg-elevated)', color: e.type === 'Warning' ? 'var(--status-pending)' : 'var(--text-secondary)' }}>
                      {e.type}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{e.reason}</div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{e.last_time ? relativeTime(e.last_time) : 'Unknown'}</div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  {e.message} {e.count > 1 && <span style={{ color: 'var(--text-muted)' }}>(×{e.count})</span>}
                </div>
                {e.source && <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Source: {e.source}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
