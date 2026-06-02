import React, { useEffect, useState } from 'react';
import { NavRail } from './NavRail';
import { SectionId } from '../../App';
import { ClusterInfo } from '../../types/graph';

interface ShellProps {
  activeSection: SectionId;
  onSectionChange: (s: SectionId) => void;
  connected: boolean;
  clusterInfo: ClusterInfo | null;
  logsSubTab?: 'pods' | 'deployments' | 'system';
  onLogsSubTabChange?: (tab: 'pods' | 'deployments' | 'system') => void;
  children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({
  activeSection,
  onSectionChange,
  connected,
  clusterInfo,
  logsSubTab,
  onLogsSubTabChange,
  children
}) => {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('nav-collapsed', collapsed);
  }, [collapsed]);

  const handleToggleCollapse = () => {
    setCollapsed(!collapsed);
  };

  return (
    <>
      <NavRail
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        collapsed={collapsed}
        onToggleCollapse={handleToggleCollapse}
        connected={connected}
        clusterInfo={clusterInfo}
        logsSubTab={logsSubTab}
        onLogsSubTabChange={onLogsSubTabChange}
      />
      <div style={{
        marginLeft: 'var(--nav-width)',
        minHeight: '100vh',
        transition: 'margin-left 220ms ease',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {children}
      </div>
    </>
  );
};
