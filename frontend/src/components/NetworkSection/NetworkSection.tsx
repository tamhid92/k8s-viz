import React from 'react';
import { NamespaceOverview } from '../NamespaceOverview/NamespaceOverview';
import { LaneView } from '../LaneView/LaneView';
import { DetailPanel } from '../DetailPanel/DetailPanel';
import { TracePanel } from '../TracePanel/TracePanel';
import { AppView } from '../../App';
import { ViewMode, Graph, WorkloadGroup } from '../../types/graph';
import { TraceRequest } from '../../types/trace';

interface NetworkSectionProps {
  view: AppView;
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  graph: Graph | null;
  namespaceStats: any;
  selectedNodeId: string | null;
  onNodeSelect: (id: string | null) => void;
  traceRequest: TraceRequest | null;
  onTraceRequest: (req: TraceRequest | null) => void;
  latestWorkloadGroups: WorkloadGroup[];
  onWorkloadGroupsChange: (groups: WorkloadGroup[]) => void;
  onNamespaceSelect: (ns: string) => void;
  onNavigate: (ns: string, nodeId?: string) => void;
}

export const NetworkSection: React.FC<NetworkSectionProps> = ({
  view,
  viewMode,
  onViewModeChange,
  graph,
  namespaceStats,
  selectedNodeId,
  onNodeSelect,
  traceRequest,
  onTraceRequest,
  latestWorkloadGroups,
  onWorkloadGroupsChange,
  onNamespaceSelect,
  onNavigate
}) => {
  const currentNs = 'namespace' in view ? view.namespace : null;

  let transitionState: 'idle' | 'transitioning-in' | 'transitioning-out' = 'idle';
  if (view.screen === 'transitioning-in') transitionState = 'transitioning-in';
  else if (view.screen === 'transitioning-out') transitionState = 'transitioning-out';

  let laneTransitionState: 'idle' | 'entering' | 'leaving' = 'idle';
  if (view.screen === 'transitioning-in') laneTransitionState = 'entering';
  else if (view.screen === 'transitioning-out') laneTransitionState = 'leaving';

  return (
    <div style={{
      paddingTop: 'var(--section-header-height)',
      paddingBottom: 'var(--status-bar-height)',
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ 
        flex: 1, 
        position: 'relative', 
        overflow: 'hidden',
        marginRight: selectedNodeId ? '320px' : '0',
        transition: 'margin-right 300ms ease'
      }}>
        <div style={{ display: view.screen === 'overview' || view.screen === 'transitioning-in' || view.screen === 'transitioning-out' ? 'block' : 'none', height: '100%' }}>
          <NamespaceOverview
            stats={namespaceStats}
            onSelect={onNamespaceSelect}
            transitionState={transitionState}
            transitioningNamespace={view.screen === 'transitioning-in' ? view.namespace : null}
          />
        </div>
        <div style={{ display: view.screen === 'lane' || view.screen === 'transitioning-in' || view.screen === 'transitioning-out' ? 'block' : 'none', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          {graph && currentNs && (
            <LaneView
              graph={graph}
              namespace={currentNs}
              viewMode={viewMode}
              onViewModeChange={onViewModeChange}
              selectedNodeId={selectedNodeId}
              onNodeSelect={onNodeSelect}
              transitionState={laneTransitionState}
              onNavigate={onNavigate}
              tracePanelOpen={traceRequest !== null}
              onWorkloadGroupsChange={onWorkloadGroupsChange}
            />
          )}
        </div>
      </div>

      <DetailPanel
        nodeId={viewMode === 'topology' && !selectedNodeId?.startsWith('wg/') ? selectedNodeId : null}
        groupId={viewMode === 'policy' ? selectedNodeId : (selectedNodeId?.startsWith('wg/') ? selectedNodeId : null)}
        graph={graph}
        namespace={currentNs}
        onClose={() => onNodeSelect(null)}
        onNavigate={onNavigate}
        workloadGroups={latestWorkloadGroups}
        onTrace={onTraceRequest}
      />
      
      <TracePanel
        request={traceRequest}
        onClose={() => onTraceRequest(null)}
      />
    </div>
  );
};
