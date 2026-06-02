import React, { useMemo, useRef, useState, useCallback } from 'react';
import { Globe } from 'lucide-react';
import { Graph } from '../../types/graph';
import { toTopologyLaneData } from '../../lib/laneTransform';
import { LaneNode } from './LaneNode';
import { WorkloadGroupNode } from './WorkloadGroupNode';
import { EntryPortal } from './EntryPortal';
import { ExitPortal } from './ExitPortal';
import { ConnectionLines } from './ConnectionLines';

interface TopologyViewProps {
  graph: Graph;
  namespace: string;
  selectedNodeId: string | null;
  onNodeSelect: (id: string | null) => void;
  onNavigate: (ns: string, nodeId?: string) => void;
}

export const TopologyView: React.FC<TopologyViewProps> = ({
  graph,
  namespace,
  selectedNodeId,
  onNodeSelect,
  onNavigate
}) => {
  const data = useMemo(() => toTopologyLaneData(graph, namespace), [graph, namespace]);
  const containerRef = useRef<HTMLDivElement>(null);

  const nodeRefs = useRef<Map<string, HTMLElement | null>>(new Map());
  const [refVersion, setRefVersion] = useState(0);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const activeNodeId = hoveredNodeId || selectedNodeId;

  const registerRef = useCallback((id: string, el: HTMLElement | null) => {
    if (el) {
      nodeRefs.current.set(id, el);
    } else {
      nodeRefs.current.delete(id);
    }
    setRefVersion(v => v + 1);
  }, []);

  const registerExternalRef = useCallback((el: HTMLElement | null) => registerRef('external', el), [registerRef]);

  const getRect = useCallback((id: string) => {
    const el = nodeRefs.current.get(id);
    if (!el || !containerRef.current) return null;
    const containerRect = containerRef.current.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    return new DOMRect(
      elRect.left - containerRect.left,
      elRect.top - containerRect.top,
      elRect.width,
      elRect.height
    );
  }, []);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-base)]">
      <div className="h-[40px] flex shrink-0 border-b border-[var(--border)] mt-2 mx-4">
        {['External', 'Ingress', 'Service', 'Workload', 'Node'].map((label, i) => (
          <div key={label} className={`flex-1 flex items-center justify-center text-[11px] uppercase tracking-wider text-[var(--text-muted)] ${i < 4 ? 'border-r border-[var(--border)]' : ''}`}>
            {label}
          </div>
        ))}
      </div>

      <div ref={containerRef} className="flex-1 flex overflow-y-auto relative mx-4">
        {/* External */}
        <div className="flex-1 border-r border-[var(--border)] p-3 flex flex-col gap-2.5 items-center">
          {data.external && (
            <div ref={registerExternalRef} className="w-[160px] border border-dashed border-[var(--external)] rounded p-2 flex items-center gap-2 bg-[var(--bg-elevated)]">
              <Globe size={16} className="text-[var(--external)]" />
              <span className="text-[12px] font-semibold text-[var(--text-primary)]">Internet</span>
            </div>
          )}
        </div>

        {/* Ingress */}
        <div className="flex-1 border-r border-[var(--border)] p-3 flex flex-col gap-2.5 items-center">
          {data.entryPortals.map(p => (
            <EntryPortal key={p.portalId} portal={p} registerRef={registerRef} onNavigate={onNavigate} />
          ))}
          {data.ingresses.map(n => (
            <LaneNode key={n.id} node={n} selected={selectedNodeId === n.id} onSelect={onNodeSelect} registerRef={registerRef} onHover={() => setHoveredNodeId(n.id)} onHoverEnd={() => setHoveredNodeId(null)} />
          ))}
        </div>

        {/* Service */}
        <div className="flex-1 border-r border-[var(--border)] p-3 flex flex-col gap-2.5 items-center">
          {data.services.map(n => (
            <LaneNode key={n.id} node={n} selected={selectedNodeId === n.id} onSelect={onNodeSelect} registerRef={registerRef} onHover={() => setHoveredNodeId(n.id)} onHoverEnd={() => setHoveredNodeId(null)} />
          ))}
        </div>

        {/* Workload */}
        <div className="flex-1 border-r border-[var(--border)] p-3 flex flex-col gap-2.5 items-center">
          {data.workloadGroups.map(wg => (
            <WorkloadGroupNode
              key={wg.groupId}
              group={wg}
              selected={selectedNodeId === wg.groupId}
              hovered={hoveredNodeId === wg.groupId}
              hasPolicies={true}
              onSelect={onNodeSelect}
              onHover={() => setHoveredNodeId(wg.groupId)}
              onHoverEnd={() => setHoveredNodeId(null)}
              registerRef={registerRef}
            />
          ))}
          {data.exitPortals.map(p => (
            <ExitPortal key={p.portalId} portal={p} registerRef={registerRef} onNavigate={onNavigate} />
          ))}
        </div>

        {/* Node */}
        <div className="flex-1 p-3 flex flex-col gap-2.5 items-center">
          {data.clusterNodes.map(n => (
            <LaneNode key={n.id} node={n} selected={selectedNodeId === n.id} onSelect={onNodeSelect} registerRef={registerRef} onHover={() => setHoveredNodeId(n.id)} onHoverEnd={() => setHoveredNodeId(null)} />
          ))}
        </div>

        <ConnectionLines
          connections={data.connections.map(c => {
            if (!activeNodeId) return c;
            const involvesActive = c.sourceId === activeNodeId || c.targetId === activeNodeId;
            return {
              ...c,
              highlighted: involvesActive
            };
          })}
          getRect={getRect}
          containerRef={containerRef}
          refVersion={refVersion}
        />
      </div>
    </div>
  );
};
