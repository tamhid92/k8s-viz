import React from 'react';
import { useLogManager } from '../../hooks/useLogManager';
import { LogsSidebar } from './LogsSidebar';
import { TabBar } from './TabBar';
import { LogViewer } from './LogViewer';
import { DescribeViewer } from './DescribeViewer';
import { LogsSectionHeader } from './LogsSectionHeader';
import { ScrollText } from 'lucide-react';

interface LogsSectionProps {
  logsSubTab?: 'pods' | 'deployments' | 'system';
}

export const LogsSection: React.FC<LogsSectionProps> = ({ logsSubTab = 'pods' }) => {
  const { tabs, activeTabId, setActiveTab, closeTab } = useLogManager();

  const activeTab = tabs.find(t => t.id === activeTabId);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      paddingTop: 'var(--section-header-height)',
      paddingBottom: 'var(--status-bar-height)',
      height: '100vh',
      overflow: 'hidden'
    }}>
      <LogsSectionHeader activeTabLabel={activeTab?.label} />
      
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        <LogsSidebar logsSubTab={logsSubTab} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-canvas)' }}>
          <TabBar tabs={tabs} activeId={activeTabId} onSelect={setActiveTab} onClose={closeTab} />
          
          <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            {!activeTabId && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)'
              }}>
                <ScrollText size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                <div style={{ fontSize: '14px' }}>Open a pod or deployment to view logs</div>
              </div>
            )}

            {activeTab && (activeTab.tabKind === 'pod' || activeTab.tabKind === 'deployment') && (
              <LogViewer key={activeTab.id} tabId={activeTab.id} />
            )}

            {activeTab && activeTab.tabKind === 'describe' && (
              <DescribeViewer key={activeTab.id} tabId={activeTab.id} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
