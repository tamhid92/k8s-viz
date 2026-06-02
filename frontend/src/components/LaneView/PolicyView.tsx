import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { Graph, WorkloadGroup } from '../../types/graph';
import { toPolicyLaneData } from '../../lib/laneTransform';
import { WorkloadGroupNode } from './WorkloadGroupNode';
import { EntryPortal } from './EntryPortal';
import { ExitPortal } from './ExitPortal';
import { ConnectionLines } from './ConnectionLines';
import { NoPoliciesBanner } from './NoPoliciesBanner';
import { CrossNsWorkloadCard } from './CrossNsWorkloadCard';
import { NamespacePortal } from './NamespacePortal';

interface PolicyViewProps {
  graph: Graph;
  namespace: string;
  selectedGroupId: string | null;
  onGroupSelect: (id: string | null) => void;
  onWorkloadGroupsChange?: (groups: WorkloadGroup[]) => void;
  onNavigate: (namespace: string, groupId?: string) => void;
}

export const PolicyView: React.FC<PolicyViewProps> = ({
  graph,
  namespace,
  selectedGroupId,
  onGroupSelect,
  onWorkloadGroupsChange,
  onNavigate
}) => {
  const data = useMemo(() => toPolicyLaneData(graph, namespace), [graph, namespace]);
  
  useEffect(() => {
    onWorkloadGroupsChange?.(data.workloadGroups);
  }, [data.workloadGroups, onWorkloadGroupsChange]);

  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Store DOM rects for SVG routing
  const nodeRefs = useRef<Map<string, HTMLElement | null>>(new Map());
  const [refVersion, setRefVersion] = useState(0);

  const registerRef = useCallback((id: string, el: HTMLElement | null) => {
    const currentEl = nodeRefs.current.get(id) || null;
    if (currentEl === el) return;

    if (el) {
      nodeRefs.current.set(id, el);
    } else {
      nodeRefs.current.delete(id);
    }
    setRefVersion(v => v + 1);
  }, []);

  const registerUnrestrictedInRef = useCallback((el: HTMLElement | null) => registerRef('unrestricted', el), [registerRef]);
  const registerUnrestrictedOutRef = useCallback((el: HTMLElement | null) => registerRef('unrestricted-out', el), [registerRef]);

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

  const activeGroup = selectedGroupId ?? hoveredGroupId;

  const handleGroupSelect = (id: string) => {
    if (selectedGroupId === id) onGroupSelect(null);
    else onGroupSelect(id);
  };

  const activeConnections = useMemo(() => {
    if (!activeGroup) return [];
    return data.policyConnections.filter(c => c.sourceId === activeGroup || c.targetId === activeGroup);
  }, [activeGroup, data.policyConnections]);

  const inboundSources = useMemo(() => {
    if (!activeGroup) return [];
    return Array.from(new Set(activeConnections.filter(c => c.targetId === activeGroup).map(c => c.sourceId)));
  }, [activeGroup, activeConnections]);

  const outboundDestinations = useMemo(() => {
    if (!activeGroup) return [];
    return Array.from(new Set(activeConnections.filter(c => c.sourceId === activeGroup).map(c => c.targetId)));
  }, [activeGroup, activeConnections]);

  const renderSourceItem = (sourceId: string) => {
    if (sourceId === 'external') {
      return (
        <EntryPortal
          key="external"
          portal={{ portalId: 'external', sourceNamespace: 'external', sourceLabel: 'Internet / External', sourceNodeId: '', targetNodeId: '', edgeType: 'netpol_allows_ingress' }}
          registerRef={registerRef}
          onNavigate={onNavigate}
        />
      );
    }
    if (sourceId.startsWith('cross-ns:')) {
      const item = data.crossNsWorkloads.get(sourceId);
      if (!item) return null;
      return (
        <CrossNsWorkloadCard
          key={sourceId}
          item={item}
          onNavigate={(ns, gid) => onNavigate(ns, gid)}
          registerRef={registerRef}
        />
      );
    }
    if (sourceId.startsWith('portal-ns-')) {
      const portal = data.namespacePortals.get(sourceId);
      if (!portal) return null;
      return (
        <NamespacePortal
          key={sourceId}
          portal={portal}
          direction="source"
          onNavigate={(ns) => onNavigate(ns)}
          registerRef={registerRef}
        />
      );
    }
    if (sourceId === 'unrestricted') {
      return (
        <div key="unrestricted" ref={registerUnrestrictedInRef} className="shrink-0 w-[160px] border border-dashed border-[var(--text-muted)] rounded p-2 flex items-center gap-2 bg-[var(--bg-elevated)] opacity-80">
          <span className="text-[12px] font-semibold text-[var(--text-primary)] text-center w-full">Unrestricted (All)</span>
        </div>
      );
    }
    // Same-namespace workload shown in compact form
    const group = data.workloadGroups.find(g => g.groupId === sourceId);
    if (!group) return null;
    return (
      <WorkloadGroupNode
        key={sourceId}
        nodeId={`in-${sourceId}`}
        group={group}
        compact
        hasPolicies={data.hasPolicies}
        selected={false}
        hovered={false}
        onSelect={() => handleGroupSelect(sourceId)}
        onHover={() => {}}
        onHoverEnd={() => {}}
        registerRef={registerRef}
      />
    );
  };

  const renderDestinationItem = (targetId: string) => {
    if (targetId === 'external') {
      return (
        <ExitPortal
          key="external-out"
          portal={{ portalId: 'external-out', targetNamespace: 'external', targetLabel: 'Internet / External', sourceNodeId: '', targetNodeId: '', edgeType: 'netpol_allows_egress' }}
          registerRef={registerRef}
          onNavigate={onNavigate}
        />
      );
    }
    if (targetId.startsWith('cross-ns:')) {
      const item = data.crossNsWorkloads.get(targetId);
      if (!item) return null;
      return (
        <CrossNsWorkloadCard
          key={targetId}
          item={item}
          onNavigate={(ns, gid) => onNavigate(ns, gid)}
          registerRef={registerRef}
        />
      );
    }
    if (targetId.startsWith('portal-ns-')) {
      const portal = data.namespacePortals.get(targetId);
      if (!portal) return null;
      return (
        <NamespacePortal
          key={targetId}
          portal={portal}
          direction="destination"
          onNavigate={(ns) => onNavigate(ns)}
          registerRef={registerRef}
        />
      );
    }
    if (targetId === 'unrestricted-out' || targetId === 'unrestricted') {
      return (
        <div key="unrestricted-out" ref={registerUnrestrictedOutRef} className="shrink-0 w-[160px] border border-dashed border-[var(--text-muted)] rounded p-2 flex items-center gap-2 bg-[var(--bg-elevated)] opacity-80">
          <span className="text-[12px] font-semibold text-[var(--text-primary)] text-center w-full">Unrestricted (All)</span>
        </div>
      );
    }
    // Same-namespace workload shown in compact form
    const group = data.workloadGroups.find(g => g.groupId === targetId);
    if (!group) return null;
    return (
      <WorkloadGroupNode
        key={targetId}
        nodeId={`out-${targetId}`}
        group={group}
        compact
        hasPolicies={data.hasPolicies}
        selected={false}
        hovered={false}
        onSelect={() => handleGroupSelect(targetId)}
        onHover={() => {}}
        onHoverEnd={() => {}}
        registerRef={registerRef}
      />
    );
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-base)]">
      {!data.hasPolicies && <NoPoliciesBanner namespace={namespace} />}
      
      <div className="h-[40px] flex shrink-0 border-b border-[var(--border)] mt-2 mx-4">
        <div className="flex-1 flex items-center justify-center text-[11px] uppercase tracking-wider text-[var(--text-muted)] border-r border-[var(--border)]">
          Sources
        </div>
        <div className="flex-1 flex items-center justify-center text-[11px] uppercase tracking-wider text-[var(--text-muted)] border-r border-[var(--border)]">
          Workload Groups
        </div>
        <div className="flex-1 flex items-center justify-center text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
          Destinations
        </div>
      </div>

      <div className="flex-1 overflow-y-auto relative">
        <div ref={containerRef} className="flex min-h-full relative p-4">
          <div className="flex-1 flex flex-col items-center gap-4 transition-all duration-300">
            {activeGroup && inboundSources.map(renderSourceItem)}
          </div>

          <div className="flex-1 flex flex-col items-center gap-4 z-10">
            {data.workloadGroups.map(group => {
              const isSelected = group.groupId === selectedGroupId;
              const isHovered = group.groupId === hoveredGroupId;
              const inboundRules = data.policyConnections.filter(c => c.targetId === group.groupId).length;
              const outboundRules = data.policyConnections.filter(c => c.sourceId === group.groupId).length;
              return (
                <WorkloadGroupNode
                  key={group.groupId}
                  nodeId={group.groupId}
                  group={group}
                  hasPolicies={data.hasPolicies}
                  selected={isSelected}
                  hovered={isHovered}
                  inboundRules={inboundRules}
                  outboundRules={outboundRules}
                  onSelect={handleGroupSelect}
                  onHover={setHoveredGroupId}
                  onHoverEnd={() => setHoveredGroupId(null)}
                  registerRef={registerRef}
                />
              );
            })}
          </div>

          <div className="flex-1 flex flex-col items-center gap-4 transition-all duration-300">
            {activeGroup && outboundDestinations.map(renderDestinationItem)}
          </div>

          <ConnectionLines
            connections={activeConnections.map(c => ({
              ...c,
              sourceId: c.sourceId === activeGroup ? c.sourceId : (
                c.sourceId === 'external' ? 'external' :
                c.sourceId === 'unrestricted' ? 'unrestricted' :
                c.sourceId.startsWith('portal-') ? c.sourceId :
                `in-${c.sourceId}`
              ),
              targetId: c.targetId === activeGroup ? c.targetId : (
                c.targetId === 'external' ? 'external-out' :
                c.targetId === 'unrestricted-out' ? 'unrestricted-out' :
                c.targetId === 'unrestricted' ? 'unrestricted-out' :
                c.targetId.startsWith('portal-') ? c.targetId :
                `out-${c.targetId}`
              ),
            }))}
            getRect={getRect}
            containerRef={containerRef}
            refVersion={refVersion}
          />
        </div>
      </div>
    </div>
  );
};
