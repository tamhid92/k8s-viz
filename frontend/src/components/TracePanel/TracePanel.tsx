import React, { useEffect, useState } from 'react';
import { Route, X, Loader2, AlertTriangle, Box, Globe, Shuffle, GitBranch, Cpu, ArrowRightLeft, Shield, ShieldCheck } from 'lucide-react';
import { TraceRequest, TraceResult, HopType } from '../../types/trace';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface TracePanelProps {
  request: TraceRequest | null;
  onClose: () => void;
}

const getIconForHop = (type: HopType) => {
  switch (type) {
    case 'source': return <Box size={14} />;
    case 'destination': return <Box size={14} />;
    case 'dns': return <Globe size={14} />;
    case 'kube_proxy': return <Shuffle size={14} />;
    case 'load_balance': return <GitBranch size={14} />;
    case 'cni_same_node': return <Cpu size={14} />;
    case 'cni_cross_node': return <ArrowRightLeft size={14} />;
    case 'ingress_controller': return <Shield size={14} />;
    case 'netpol_check': return <ShieldCheck size={14} />;
    default: return <Box size={14} />;
  }
};

const getHopColor = (type: HopType) => {
  switch (type) {
    case 'source':
    case 'destination': return 'var(--workload)';
    case 'dns': return 'var(--namespace)';
    case 'kube_proxy': return 'var(--service)';
    case 'load_balance': return 'var(--ingress)';
    case 'cni_same_node':
    case 'cni_cross_node': return 'var(--cluster-node)';
    case 'netpol_check': return 'var(--netpol)';
    default: return 'var(--border-bright)';
  }
};

export const TracePanel: React.FC<TracePanelProps> = ({ request, onClose }) => {
  const open = request !== null;
  const [result, setResult] = useState<TraceResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEscapeKey(() => {
    if (open) onClose();
  });

  useEffect(() => {
    if (!request) return;

    setLoading(true);
    setResult(null);

    const controller = new AbortController();

    fetch(`/api/v1/trace?from=${request.fromPodId}&to=${request.toServiceId}`, {
      signal: controller.signal
    })
      .then(res => res.json())
      .then((data: TraceResult) => {
        setResult(data);
        setLoading(false);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setResult({
          from_pod_id: request.fromPodId,
          to_service_id: request.toServiceId,
          hops: [],
          candidates: [],
          cni_type: null,
          kube_proxy_mode: null,
          dns_fqdn: null,
          cross_node: false,
          has_netpol: false,
          error: String(err)
        });
        setLoading(false);
      });

    return () => controller.abort();
  }, [request]);

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      top: 0,
      left: 'var(--nav-width)',
      right: 0,
      background: 'var(--bg-surface)',
      borderTop: '2px solid var(--border-accent)',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.10)',
      zIndex: 200,
      transform: `translateY(${open ? '0' : '100%'})`,
      transition: 'left 220ms ease, transform 320ms cubic-bezier(0.4,0,0.2,1)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        position: 'absolute',
        top: '4px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '40px',
        height: '4px',
        borderRadius: '2px',
        background: 'var(--border)'
      }} />

      <div style={{
        height: '44px',
        borderBottom: '1px solid var(--border)',
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <Route size={16} color="var(--border-accent)" />
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Packet Trace</span>
        <span style={{ color: 'var(--text-muted)' }}>·</span>
        {request && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontFamily: 'monospace' }}>
            <span style={{ color: 'var(--pod)' }}>{request.fromLabel}</span>
            <span style={{ color: 'var(--text-muted)' }}>→</span>
            <span style={{ color: 'var(--service)' }}>{request.toLabel}</span>
          </div>
        )}
        
        <div style={{ flex: 1 }} />
        
        {result && !result.error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
              padding: '2px 8px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 500
            }}>
              {result.cni_type || 'CNI: unknown'}
            </div>
            <div style={{
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
              padding: '2px 8px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 500
            }}>
              kube-proxy: {result.kube_proxy_mode || 'unknown'}
            </div>
            {result.cross_node && (
              <div style={{
                background: 'rgba(217,119,6,0.10)',
                color: '#d97706',
                border: '1px solid rgba(217,119,6,0.2)',
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 500
              }}>
                cross-node
              </div>
            )}
          </div>
        )}

        <button onClick={onClose} style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          padding: '4px',
          color: 'var(--text-muted)'
        }}>
          <X size={16} />
        </button>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 16px',
        position: 'relative'
      }}>
        {!request ? null : loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', color: 'var(--text-muted)' }}>
            <Loader2 size={20} className="animate-spin" />
            <span style={{ fontSize: '13px' }}>Tracing packet path...</span>
          </div>
        ) : result?.error ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(217,119,6,0.10)', color: '#d97706', padding: '12px', borderRadius: '4px', fontSize: '13px' }}>
            <AlertTriangle size={16} />
            {result.error}
          </div>
        ) : result ? (
          <div style={{ paddingLeft: '8px' }}>
            {result.hops.map((hop, i) => {
              const isLast = i === result.hops.length - 1;
              const color = getHopColor(hop.hop_type);
              
              let statusBadge = null;
              if (hop.status === 'allowed') {
                statusBadge = <div style={{ background: 'rgba(5,150,105,0.10)', color: 'var(--status-running)', padding: '2px 6px', borderRadius: '999px', fontSize: '9px', textTransform: 'uppercase', fontWeight: 600 }}>ALLOWED</div>;
              } else if (hop.status === 'blocked') {
                statusBadge = <div style={{ background: 'var(--status-failed)', color: '#fff', padding: '2px 6px', borderRadius: '999px', fontSize: '9px', textTransform: 'uppercase', fontWeight: 600 }}>BLOCKED</div>;
              }

              return (
                <div key={hop.step} style={{
                  position: 'relative',
                  borderLeft: isLast ? '2px solid transparent' : '2px solid var(--border)',
                  marginLeft: '16px',
                  paddingLeft: '20px',
                  paddingBottom: isLast ? '0' : '20px'
                }}>
                  <div style={{
                    position: 'absolute',
                    left: '-6px',
                    top: '0',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: color
                  }} />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', top: '-4px', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: '16px' }}>{hop.step}</span>
                      <div style={{ color }}>{getIconForHop(hop.hop_type)}</div>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{hop.title}</span>
                      <div style={{ flex: 1 }} />
                      {statusBadge}
                    </div>
                    
                    <div style={{ paddingLeft: '44px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{hop.subtitle}</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{hop.detail}</span>
                      
                        <div style={{
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          padding: '8px 10px',
                          marginTop: '6px',
                          fontFamily: 'monospace',
                          fontSize: '11px',
                          color: 'var(--text-code)',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {hop.technical}
                        </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {result.candidates && result.candidates.length > 0 && (
              <div style={{ marginTop: '32px', marginLeft: '36px' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '8px', fontWeight: 600 }}>
                  POSSIBLE BACKENDS
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '4px 8px', fontWeight: 500 }}>Pod Name</th>
                      <th style={{ padding: '4px 8px', fontWeight: 500 }}>IP</th>
                      <th style={{ padding: '4px 8px', fontWeight: 500 }}>Node</th>
                      <th style={{ padding: '4px 8px', fontWeight: 500, width: '40px', textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.candidates.map(c => (
                      <tr key={c.pod_id} style={{ 
                        background: c.same_node ? 'rgba(5,150,105,0.04)' : 'transparent',
                        borderBottom: '1px solid var(--border)'
                      }}>
                        <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: 'var(--text-primary)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.pod_name}
                        </td>
                        <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: 'var(--text-code)' }}>{c.pod_ip || '-'}</td>
                        <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{c.node_name || '-'}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          <div style={{ 
                            width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block',
                            background: c.ready ? 'var(--status-running)' : 'var(--text-muted)'
                          }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
