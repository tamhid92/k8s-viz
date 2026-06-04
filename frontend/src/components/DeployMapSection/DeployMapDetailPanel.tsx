import React from 'react';
import { X, Boxes, Network, Globe, FileText, Lock, Shield, Server, User } from 'lucide-react';
import {
  DeploymentMap, ConnectedPodGroup, ConnectedService, ConnectedIngress,
  ConnectedConfigMap, ConnectedSecret, ConnectedNetworkPolicy,
  ConnectedNode, ConnectedServiceAccount
} from '../../types/workloads';
import { useLogManager } from '../../hooks/useLogManager';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { ScrollText } from 'lucide-react';

interface Props {
  nodeKey: string | null;
  map: DeploymentMap | null;
  onClose: () => void;
}

type DetailItem =
  | DeploymentMap
  | ConnectedPodGroup
  | ConnectedService
  | ConnectedIngress
  | ConnectedConfigMap
  | ConnectedSecret
  | ConnectedNetworkPolicy
  | ConnectedNode
  | ConnectedServiceAccount;

export const DeployMapDetailPanel: React.FC<Props> = ({ nodeKey, map, onClose }) => {
  useEscapeKey(() => {
    onClose();
  });

  const { openLogTab, openDescribeTab } = useLogManager();
  if (!nodeKey || !map) return null;

  let item: DetailItem | null = null;
  let kind = '';
  let icon = Boxes;
  let accent = 'var(--ingress)';
  let title = '';
  let namespace = map.namespace;

  if (nodeKey === 'deploy') {
    kind = 'deployment';
    item = map;
    title = map.deployment_name;
  } else if (nodeKey.startsWith('podgroup-')) {
    kind = 'podgroup';
    item = map.pod_groups.find(g => nodeKey.startsWith(`podgroup-${g.label}-`)) || null;
    icon = Boxes;
    accent = 'var(--pod)';
    title = (item as ConnectedPodGroup)?.label || '';
  } else if (nodeKey.startsWith('svc-')) {
    kind = 'service';
    item = map.services.find(s => `svc-${s.name}` === nodeKey) || null;
    icon = Network;
    accent = 'var(--service)';
    title = (item as ConnectedService)?.name || '';
  } else if (nodeKey.startsWith('ingress-')) {
    kind = 'ingress';
    item = map.ingresses.find(i => `ingress-${i.name}` === nodeKey) || null;
    icon = Globe;
    accent = 'var(--ingress)';
    title = (item as ConnectedIngress)?.name || '';
  } else if (nodeKey.startsWith('cm-')) {
    kind = 'configmap';
    item = map.config_maps.find(c => `cm-${c.name}` === nodeKey) || null;
    icon = FileText;
    accent = 'var(--cluster-node)';
    title = (item as ConnectedConfigMap)?.name || '';
  } else if (nodeKey.startsWith('secret-')) {
    kind = 'secret';
    item = map.secrets.find(s => `secret-${s.name}` === nodeKey) || null;
    icon = Lock;
    accent = 'var(--netpol)';
    title = (item as ConnectedSecret)?.name || '';
  } else if (nodeKey.startsWith('netpol-')) {
    kind = 'netpol';
    item = map.network_policies.find(n => `netpol-${n.name}` === nodeKey) || null;
    icon = Shield;
    accent = 'var(--netpol)';
    title = (item as ConnectedNetworkPolicy)?.name || '';
  } else if (nodeKey.startsWith('node-')) {
    kind = 'node';
    item = map.nodes.find(n => nodeKey.startsWith(`node-${n.name}-`)) || null;
    icon = Server;
    accent = 'var(--cluster-node)';
    title = (item as ConnectedNode)?.name || '';
  } else if (nodeKey.startsWith('sa-')) {
    kind = 'sa';
    item = map.service_account || null;
    icon = User;
    accent = 'var(--service)';
    title = (item as ConnectedServiceAccount)?.name || '';
  }

  if (!item) return null;

  const Icon = icon;

  return (
    <div style={{
      width: '400px',
      borderLeft: '1px solid var(--border)',
      background: 'var(--bg-elevated)',
      display: 'flex',
      flexDirection: 'column',
      animation: 'slideInRight 0.2s ease-out'
    }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ background: `color-mix(in srgb, ${accent} 10%, transparent)`, padding: '8px', borderRadius: '8px', color: accent }}>
          <Icon size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title}
          </div>
          <div style={{ display: 'inline-block', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', marginRight: '8px' }}>
            {namespace}
          </div>
          <div style={{ display: 'inline-flex', gap: '6px', marginTop: '6px', verticalAlign: 'middle' }}>
            {kind === 'deployment' && (
              <button
                onClick={() => openLogTab({ kind: 'deployment', namespace, name: title, label: title })}
                style={{
                  fontSize: '11px', color: 'var(--logs)', background: 'transparent',
                  border: '1px solid rgba(8,145,178,0.4)', borderRadius: '3px', padding: '1px 7px',
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--logs)'; e.currentTarget.style.background = 'rgba(8,145,178,0.06)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(8,145,178,0.4)'; e.currentTarget.style.background = 'transparent'; }}
              >
                <ScrollText size={10} /> Logs
              </button>
            )}
            {kind !== 'podgroup' && (
              <button
                onClick={() => {
                  let mappedKind = kind;
                  if (kind === 'netpol') mappedKind = 'networkpolicy';
                  if (kind === 'sa') mappedKind = 'serviceaccount';
                  if (kind === 'configmap') mappedKind = 'configmap'; // backend expects this
                  openDescribeTab({ kind: mappedKind, namespace, name: title, label: title });
                }}
                style={{
                  fontSize: '11px', color: 'var(--text-secondary)', background: 'transparent',
                  border: '1px solid rgba(8,145,178,0.4)', borderRadius: '3px', padding: '1px 7px',
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--logs)'; e.currentTarget.style.background = 'rgba(8,145,178,0.06)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(8,145,178,0.4)'; e.currentTarget.style.background = 'transparent'; }}
              >
                <FileText size={10} /> Describe
              </button>
            )}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <X size={20} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {kind === 'deployment' && (
          <>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ready</div>
                <div style={{ fontSize: '14px', fontFamily: 'monospace' }}>{(item as DeploymentMap).ready_replicas} / {(item as DeploymentMap).desired_replicas}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Health</div>
                <div style={{ fontSize: '14px', textTransform: 'capitalize' }}>{(item as DeploymentMap).health}</div>
              </div>
            </div>
          </>
        )}

        {kind === 'podgroup' && (
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Pods</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(item as ReturnType<typeof map.pod_groups.find>)?.pods.map((p, i: number) => (
                <div key={i} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '4px', padding: '8px', fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{p.phase}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {kind === 'service' && (
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Ports</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(item as ReturnType<typeof map.services.find>)?.ports.map((p: Record<string, unknown>, i: number) => (
                <div key={i} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '4px', padding: '8px', fontSize: '12px', fontFamily: 'monospace' }}>
                  {p.port as string} → {p.target_port as string} ({p.protocol as string})
                </div>
              ))}
            </div>
          </div>
        )}

        {kind === 'ingress' && (
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Hosts</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(item as ReturnType<typeof map.ingresses.find>)?.hosts.map((h: string, i: number) => (
                <div key={i} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '4px', padding: '8px', fontSize: '12px', fontFamily: 'monospace' }}>
                  {h}
                </div>
              ))}
            </div>
          </div>
        )}

        {kind === 'configmap' && (
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Keys</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(item as ReturnType<typeof map.config_maps.find>)?.keys.map((k: string, i: number) => (
                <div key={i} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '4px', padding: '8px', fontSize: '12px', fontFamily: 'monospace' }}>
                  {k}
                </div>
              ))}
            </div>
          </div>
        )}

        {kind === 'secret' && (
          <>
            <div style={{ background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.25)', borderRadius: '4px', padding: '8px 12px', marginBottom: '12px', fontSize: '12px', color: '#d97706' }}>
              Secret values are not displayed. Only key names are shown.
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Keys</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(item as ReturnType<typeof map.secrets.find>)?.keys.map((k: string, i: number) => (
                  <div key={i} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '4px', padding: '8px', fontSize: '12px', fontFamily: 'monospace' }}>
                    {k}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {kind === 'netpol' && (
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Types</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(item as ReturnType<typeof map.network_policies.find>)?.policy_types.map((t: string, i: number) => (
                <span key={i} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', color: 'var(--text-secondary)' }}>{t}</span>
              ))}
            </div>
          </div>
        )}

        {kind === 'node' && (
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Details</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '12px' }}>IP: <span style={{ fontFamily: 'monospace' }}>{(item as ReturnType<typeof map.nodes.find>)?.internal_ip}</span></div>
              <div style={{ fontSize: '12px' }}>Ready: {(item as ReturnType<typeof map.nodes.find>)?.ready ? 'Yes' : 'No'}</div>
            </div>
          </div>
        )}

        {kind === 'sa' && (
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Details</div>
            <div style={{ fontSize: '12px' }}>Service Account mapping.</div>
          </div>
        )}
      </div>
    </div>
  );
};
