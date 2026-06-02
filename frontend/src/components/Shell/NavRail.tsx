import React from 'react';
import { Hexagon, Network, Boxes, Bell, Shield, Settings, ChevronsLeft, ChevronsRight, Share2, Layers, Terminal } from 'lucide-react';
import { SectionId } from '../../App';
import { ClusterInfo } from '../../types/graph';

interface NavRailProps {
  activeSection: SectionId;
  onSectionChange: (s: SectionId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  connected: boolean;
  clusterInfo: ClusterInfo | null;
  logsSubTab?: 'pods' | 'deployments' | 'system';
  onLogsSubTabChange?: (tab: 'pods' | 'deployments' | 'system') => void;
}

const SECTIONS: { id: SectionId; label: string; icon: React.ElementType; color: string; built: boolean }[] = [
  { id: 'network', label: 'Network', icon: Network, color: 'var(--namespace)', built: true },
  { id: 'workloads', label: 'Workloads', icon: Boxes, color: 'var(--pod)', built: true },
  { id: 'deploymap', label: 'Deployments', icon: Share2, color: 'var(--ingress)', built: true },
  { id: 'nsmap', label: 'Namespace', icon: Layers, color: 'var(--cluster-node)', built: true },
  { id: 'logs', label: 'Logs', icon: Terminal, color: 'var(--logs)', built: true },
  { id: 'events', label: 'Events', icon: Bell, color: 'var(--ingress)', built: true },
  { id: 'rbac', label: 'RBAC', icon: Shield, color: 'var(--netpol)', built: true },
  { id: 'config', label: 'Config', icon: Settings, color: 'var(--cluster-node)', built: true },
];

export const NavRail: React.FC<NavRailProps> = ({
  activeSection,
  onSectionChange,
  collapsed,
  onToggleCollapse,
  connected,
  clusterInfo,
  logsSubTab,
  onLogsSubTabChange
}) => {
  return (
    <div style={{
      position: 'fixed',
      left: 0, top: 0, bottom: 0,
      width: 'var(--nav-width)',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      zIndex: 200,
      transition: 'width 220ms ease',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '14px 12px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: '10px'
      }}>
        <Hexagon size={20} color="var(--namespace)" style={{ flexShrink: 0 }} />
        {!collapsed && (
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>k8s-viz</div>
            {clusterInfo && (
              <>
                <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {clusterInfo.platform || 'unknown cluster'}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {clusterInfo.server_version || 'v?'}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ flex: 1, padding: '8px 0', overflowY: 'auto', overflowX: 'hidden' }}>
        {SECTIONS.map(sec => {
          const isActive = activeSection === sec.id;
          const Icon = sec.icon;
          return (
            <React.Fragment key={sec.id}>
              <div
                onClick={() => {
                  if (sec.built) onSectionChange(sec.id);
                }}
                title={collapsed ? sec.label : undefined}
                style={{
                  padding: collapsed ? '10px 0' : '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  gap: '10px',
                  cursor: sec.built ? 'pointer' : 'not-allowed',
                  position: 'relative',
                  borderLeft: '2px solid transparent',
                  borderLeftColor: isActive ? sec.color : 'transparent',
                  background: isActive ? `color-mix(in srgb, ${sec.color} 6%, transparent)` : 'transparent',
                  transition: 'background 120ms, border-color 120ms',
                  opacity: sec.built ? 1 : 0.4,
                  color: isActive ? sec.color : 'var(--text-secondary)'
                }}
                onMouseEnter={(e) => {
                  if (!isActive && sec.built) e.currentTarget.style.background = 'var(--bg-elevated)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive && sec.built) e.currentTarget.style.background = 'transparent';
                }}
              >
                <Icon size={18} color="currentColor" style={{ flexShrink: 0 }} />
                {!collapsed && (
                  <div style={{ fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {sec.label}
                  </div>
                )}
              </div>
              {isActive && sec.id === 'logs' && !collapsed && (
                <div style={{ paddingLeft: '40px', paddingBottom: '8px', paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {['pods', 'deployments', 'system'].map(sub => (
                    <div 
                      key={sub}
                      onClick={() => onLogsSubTabChange && onLogsSubTabChange(sub as any)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        color: logsSubTab === sub ? 'var(--text-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        background: logsSubTab === sub ? 'var(--bg-hover)' : 'transparent',
                        textTransform: 'capitalize'
                      }}
                      onMouseEnter={(e) => {
                        if (logsSubTab !== sub) e.currentTarget.style.color = 'var(--text-primary)';
                      }}
                      onMouseLeave={(e) => {
                        if (logsSubTab !== sub) e.currentTarget.style.color = 'var(--text-secondary)';
                      }}
                    >
                      {sub}
                    </div>
                  ))}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          marginBottom: '12px',
          padding: '4px 0'
        }}>
          <div style={{
            width: '12px', height: '12px', borderRadius: '50%',
            backgroundColor: connected ? 'var(--status-running)' : 'var(--status-failed)',
            boxShadow: connected ? '0 0 10px var(--status-running)' : '0 0 10px var(--status-failed)',
            flexShrink: 0
          }} />
          {!collapsed && (
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              {connected ? 'Connected' : 'Disconnected'}
            </div>
          )}
        </div>

        <button
          onClick={onToggleCollapse}
          title={collapsed ? "Expand Nav" : "Collapse Nav"}
          style={{
            width: '100%',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: '10px',
            color: 'var(--text-secondary)',
            fontSize: '13px',
            fontWeight: 500,
            background: 'var(--bg-hover)',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            transition: 'background 150ms, color 150ms'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-primary)';
            e.currentTarget.style.background = 'var(--bg-elevated)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.background = 'var(--bg-hover)';
          }}
        >
          {collapsed ? <ChevronsRight size={18} style={{ flexShrink: 0 }} /> : <ChevronsLeft size={18} style={{ flexShrink: 0 }} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </div>
  );
};
