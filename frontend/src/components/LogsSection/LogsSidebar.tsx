import React, { useState, useEffect } from 'react';
import { Search, ScrollText, FileText, Globe, Shuffle } from 'lucide-react';
import { useLogManager } from '../../hooks/useLogManager';
import { PodListItem } from '../../types/logs';
import { detectSystemComponents } from '../../lib/logUtils';

interface DeploymentItem {
  name: string;
  namespace: string;
  ready: string;
  health: string;
}

interface LogsSidebarProps {
  logsSubTab?: 'pods' | 'deployments' | 'system';
}

export const LogsSidebar: React.FC<LogsSidebarProps> = ({ logsSubTab = 'pods' }) => {
  const { openLogTab, openDescribeTab } = useLogManager();
  const [search, setSearch] = useState('');
  const [pods, setPods] = useState<PodListItem[]>([]);
  const [deployments, setDeployments] = useState<DeploymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    if (logsSubTab === 'pods' || logsSubTab === 'system') {
      fetch('/api/v1/logs/pods')
        .then(r => r.json())
        .then(data => {
          setPods(data.pods || []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      fetch('/api/v1/logs/deployments')
        .then(r => r.json())
        .then(data => {
          setDeployments(data.deployments || []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [logsSubTab]);

  // System components
  const allSystemComponents = detectSystemComponents(pods);
  const systemPodIds = new Set(allSystemComponents.flatMap(c => c.pods.map(p => p.id)));

  // Filter regular pods
  const filteredPods = pods.filter(p => 
    !systemPodIds.has(p.id) && 
    (p.name.toLowerCase().includes(search.toLowerCase()) || 
     p.namespace.toLowerCase().includes(search.toLowerCase()))
  );

  // Filter system components for the SYSTEM section
  const systemComponents = allSystemComponents.filter(c => {
    const searchLower = search.toLowerCase();
    const matchName = c.name.toLowerCase().includes(searchLower);
    const matchPod = c.pods.some(p => p.name.toLowerCase().includes(searchLower));
    return matchName || matchPod;
  }).map(c => {
    const searchLower = search.toLowerCase();
    const matchName = c.name.toLowerCase().includes(searchLower);
    if (matchName) return c; // show all pods if component name matches
    return {
      ...c,
      pods: c.pods.filter(p => p.name.toLowerCase().includes(searchLower))
    };
  });
  
  // Auto-expand components if search matches a pod inside it
  useEffect(() => {
    if (search.length > 0) {
      setExpandedComponents(prev => {
        const next = new Set(prev);
        const searchLower = search.toLowerCase();
        let changed = false;
        allSystemComponents.forEach(c => {
          const matchName = c.name.toLowerCase().includes(searchLower);
          const matchPod = c.pods.some(p => p.name.toLowerCase().includes(searchLower));
          if (!matchName && matchPod && !next.has(c.name)) {
            next.add(c.name);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [search, allSystemComponents]);

  const filteredDeployments = deployments.filter(d => 
    d.name.toLowerCase().includes(search.toLowerCase()) || 
    d.namespace.toLowerCase().includes(search.toLowerCase())
  );

  const groupedPods = filteredPods.reduce((acc, pod) => {
    if (!acc[pod.namespace]) acc[pod.namespace] = [];
    acc[pod.namespace].push(pod);
    return acc;
  }, {} as Record<string, PodListItem[]>);

  const groupedDeployments = filteredDeployments.reduce((acc, dep) => {
    if (!acc[dep.namespace]) acc[dep.namespace] = [];
    acc[dep.namespace].push(dep);
    return acc;
  }, {} as Record<string, DeploymentItem[]>);

  const getPhaseColor = (phase: string) => {
    if (phase === 'Running') return 'var(--status-running)';
    if (phase === 'Pending') return 'var(--status-pending)';
    return 'var(--status-failed)';
  };

  const getHealthColor = (health: string) => {
    if (health === 'healthy') return 'var(--status-running)';
    if (health === 'degraded') return 'var(--status-pending)';
    return 'var(--status-failed)';
  };

  const toggleComponent = (name: string) => {
    setExpandedComponents(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const ActionButtons = ({ 
    kind, namespace, name, label, 
    onLogsClick, onDescribeClick 
  }: { 
    kind: 'pod' | 'deployment', namespace: string, name: string, label?: string,
    onLogsClick?: () => void, onDescribeClick?: () => void 
  }) => (
    <div className="sidebar-actions" style={{ display: 'none', gap: '4px' }}>
      <button
        onClick={(e) => { 
          e.stopPropagation(); 
          if (onLogsClick) onLogsClick();
          else openLogTab({ kind, namespace, name, label: label || name }); 
        }}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--logs)' }}
        title="View Logs"
      ><ScrollText size={14} /></button>
      <button
        onClick={(e) => { 
          e.stopPropagation(); 
          if (onDescribeClick) onDescribeClick();
          else openDescribeTab({ kind, namespace, name, label: label || name }); 
        }}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--text-secondary)' }}
        title="Describe"
      ><FileText size={14} /></button>
    </div>
  );

  const renderIcon = (name: string) => {
    if (name === 'Globe') return <Globe size={14} />;
    if (name === 'Shuffle') return <Shuffle size={14} />;
    return null;
  };

  return (
    <div style={{
      width: '240px',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-canvas)'
    }}>
      <div style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search workloads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px 6px 30px',
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              fontSize: '12px'
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <style>{`
          .sidebar-row:hover { background: var(--bg-hover); }
          .sidebar-row:hover .sidebar-actions { display: flex !important; }
        `}</style>
        
        {loading && <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>Loading...</div>}

        {!loading && logsSubTab === 'system' && systemComponents.length > 0 && (
          <div>
            <div style={{ padding: '6px 12px', fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-surface)', textTransform: 'uppercase' }}>
              SYSTEM
            </div>
            {systemComponents.map(comp => {
              const expanded = expandedComponents.has(comp.name);
              return (
                <div key={comp.name}>
                  <div 
                    className="sidebar-row" 
                    onClick={() => toggleComponent(comp.name)}
                    style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  >
                    <div style={{ color: comp.color, display: 'flex' }}>
                      {renderIcon(comp.icon)}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{comp.name}</div>
                    <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>×{comp.pods.length}</div>
                    <ActionButtons 
                      kind="pod" 
                      namespace="" 
                      name="" 
                      onLogsClick={() => {
                        if (comp.pods.length === 1) {
                          openLogTab({ kind: 'pod', namespace: comp.pods[0].namespace, name: comp.pods[0].name, label: comp.name });
                        } else {
                          setExpandedComponents(prev => {
                            const next = new Set(prev);
                            next.add(comp.name);
                            return next;
                          });
                        }
                      }}
                      onDescribeClick={() => {
                        const firstRunning = comp.pods.find(p => p.phase === 'Running') || comp.pods[0];
                        if (firstRunning) {
                          openDescribeTab({ kind: 'pod', namespace: firstRunning.namespace, name: firstRunning.name, label: `${comp.name} describe` });
                        }
                      }}
                    />
                  </div>
                  {expanded && comp.pods.map(pod => (
                    <div key={pod.id} className="sidebar-row" style={{ padding: '8px 12px 8px 30px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', cursor: 'default' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: getPhaseColor(pod.phase), marginRight: '8px', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pod.name}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{pod.node_name}</div>
                      </div>
                      <ActionButtons 
                        kind="pod" 
                        namespace={pod.namespace} 
                        name={pod.name} 
                        label={`${comp.name} (${pod.node_name ?? pod.name})`} 
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {!loading && logsSubTab === 'pods' && Object.entries(groupedPods).map(([ns, nsPods]) => (
          <div key={ns}>
            <div style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-surface)' }}>
              {ns}
            </div>
            {nsPods.map(pod => (
              <div key={pod.id} className="sidebar-row" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', cursor: 'default' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: getPhaseColor(pod.phase), marginRight: '8px', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pod.name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{pod.node_name}</div>
                </div>
                <ActionButtons kind="pod" namespace={ns} name={pod.name} />
              </div>
            ))}
          </div>
        ))}

        {!loading && logsSubTab === 'deployments' && Object.entries(groupedDeployments).map(([ns, nsDeps]) => (
          <div key={ns}>
            <div style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-surface)' }}>
              {ns}
            </div>
            {nsDeps.map(dep => (
              <div key={dep.name} className="sidebar-row" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', cursor: 'default' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: getHealthColor(dep.health), marginRight: '8px', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dep.name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{dep.ready}</div>
                </div>
                <ActionButtons kind="deployment" namespace={ns} name={dep.name} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
