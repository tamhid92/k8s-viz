import React from 'react';
import { Graph, ViewMode, WorkloadGroup } from '../../types/graph';
import { PolicyView } from './PolicyView';
import { TopologyView } from './TopologyView';

interface LaneViewProps {
  graph: Graph;
  namespace: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  selectedNodeId: string | null;
  onNodeSelect: (id: string | null) => void;
  onNavigate: (ns: string, nodeId?: string) => void;
  transitionState: 'idle' | 'entering' | 'leaving';
  showNetPol?: boolean; // kept for backwards compatibility if needed, though replaced mostly by PolicyView
  tracePanelOpen?: boolean;
  onWorkloadGroupsChange?: (groups: WorkloadGroup[]) => void;
}

export const LaneView: React.FC<LaneViewProps> = ({
  graph,
  namespace,
  viewMode,
  selectedNodeId,
  onNodeSelect,
  onNavigate,
  transitionState,
  tracePanelOpen,
  onWorkloadGroupsChange
}) => {
  let transformClass = '';
  let opacityClass = 'opacity-100';

  if (transitionState === 'entering') {
    transformClass = 'translate-x-8';
    opacityClass = 'opacity-0';
  } else if (transitionState === 'leaving') {
    transformClass = '-translate-x-8';
    opacityClass = 'opacity-0';
  }

  return (
    <div 
      className={`absolute inset-0 flex flex-col bg-[var(--bg-base)] transition-all ease-out ${
        transitionState === 'entering' ? 'duration-400' : 'duration-350 ease-in'
      } ${transformClass} ${opacityClass}`}
      style={{ paddingBottom: tracePanelOpen ? '420px' : '0' }}
    >
      {viewMode === 'policy' ? (
        <PolicyView
          graph={graph}
          namespace={namespace}
          selectedGroupId={selectedNodeId}
          onGroupSelect={onNodeSelect}
          onWorkloadGroupsChange={onWorkloadGroupsChange}
          onNavigate={onNavigate}
        />
      ) : (
        <TopologyView
          graph={graph}
          namespace={namespace}
          selectedNodeId={selectedNodeId}
          onNodeSelect={onNodeSelect}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
};
