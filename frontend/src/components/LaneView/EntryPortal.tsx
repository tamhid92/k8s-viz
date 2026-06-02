import React, { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { EntryPortalItem } from '../../lib/laneTransform';

interface EntryPortalProps {
  portal: EntryPortalItem;
  registerRef: (id: string, el: HTMLElement | null) => void;
  onNavigate: (ns: string, nodeId?: string) => void;
}

export const EntryPortal: React.FC<EntryPortalProps> = ({ portal, registerRef, onNavigate }) => {
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    registerRef(portal.portalId, elRef.current);
    return () => registerRef(portal.portalId, null);
  }, [portal.portalId, registerRef]);

  return (
    <div
      ref={elRef}
      onClick={() => onNavigate(portal.sourceNamespace)}
      className="w-[150px] bg-[var(--bg-elevated)] border border-dashed border-[var(--portal)] rounded px-[10px] py-[8px] cursor-pointer transition-colors hover:border-[var(--namespace)]"
    >
      <div className="flex items-center gap-1.5 mb-1 text-[var(--portal)]">
        <ArrowLeft size={12} className="shrink-0" />
        <span className="text-[11px] font-mono text-[var(--text-muted)] truncate flex-1">
          ← {portal.sourceNamespace}
        </span>
      </div>
      <div className="text-[11px] text-[var(--text-secondary)] truncate font-medium">
        {portal.sourceLabel}
      </div>
    </div>
  );
};
