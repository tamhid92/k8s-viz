import React, { useLayoutEffect, useState, RefObject } from 'react';
import { EdgeType, PolicyConnectionStatus } from '../../types/graph';
import { EDGE_COLORS, POLICY_STATUS_COLORS } from '../../lib/constants';

interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  status?: PolicyConnectionStatus;
  edgeType?: EdgeType;
  ports?: number[];
  animated?: boolean;
}

interface ConnectionLinesProps {
  connections: Connection[];
  getRect: (id: string) => DOMRect | null;
  containerRef: RefObject<HTMLDivElement>;
  refVersion: number;
}

export const ConnectionLines: React.FC<ConnectionLinesProps> = ({ connections, getRect, containerRef, refVersion }) => {
  const [, forceRender] = useState(0);

  useLayoutEffect(() => {
    forceRender(v => v + 1);
    
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      forceRender(v => v + 1);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [containerRef, refVersion, connections]);

  const markers = [
    { id: 'marker-allowed', color: POLICY_STATUS_COLORS.allowed },
    { id: 'marker-blocked', color: POLICY_STATUS_COLORS.blocked },
    { id: 'marker-implicit', color: POLICY_STATUS_COLORS.implicit },
    ...Object.entries(EDGE_COLORS).map(([type, color]) => ({ id: `marker-${type}`, color }))
  ];

  return (
    <svg className="absolute inset-0 pointer-events-none overflow-visible w-full h-full z-0">
      <defs>
        {markers.map(m => (
          <marker
            key={m.id}
            id={m.id}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={m.color} />
          </marker>
        ))}
      </defs>

      {(() => {
        const grouped = new Map<string, Connection & { allPorts: Set<number> }>();
        for (const c of connections) {
          const key = `${c.sourceId}→${c.targetId}`;
          if (!grouped.has(key)) {
            grouped.set(key, { ...c, allPorts: new Set(c.ports || []) });
          } else {
            const existing = grouped.get(key)!;
            if (c.ports) c.ports.forEach(p => existing.allPorts.add(p));
            existing.animated = existing.animated || c.animated;
            if (c.status === 'allowed') existing.status = 'allowed';
          }
        }
        return Array.from(grouped.values()).map(c => ({
          ...c,
          ports: Array.from(c.allPorts).sort((a, b) => a - b)
        }));
      })().map(conn => {
        const sourceRect = getRect(conn.sourceId);
        const targetRect = getRect(conn.targetId);
        
        if (!sourceRect || !targetRect) return null;

        const sx = sourceRect.right;
        const sy = sourceRect.top + sourceRect.height / 2;
        const tx = targetRect.left;
        const ty = targetRect.top + targetRect.height / 2;

        const offset = Math.max(Math.abs(tx - sx) * 0.45, 20);
        
        const path = `M ${sx} ${sy} C ${sx + offset} ${sy}, ${tx - offset} ${ty}, ${tx} ${ty}`;

        let color = 'var(--border-bright)';
        let markerId = '';
        if (conn.status) {
          color = POLICY_STATUS_COLORS[conn.status];
          markerId = `marker-${conn.status}`;
        } else if (conn.edgeType) {
          color = EDGE_COLORS[conn.edgeType] || color;
          markerId = `marker-${conn.edgeType}`;
        }

        const isImplicit = conn.status === 'implicit';
        const isBlocked = conn.status === 'blocked';
        const isAllowed = conn.status === 'allowed';
        const isAnimated = conn.animated;

        const strokeWidth = (isAnimated || isAllowed) ? 1.5 : 1;
        const opacity = isImplicit ? 0.75 : 1;
        let dasharray = 'none';

        if (isAnimated) dasharray = '7 5';
        else if (isImplicit || isBlocked) dasharray = '5 3';

        const midX = (sx + tx) / 2;
        const midY = (sy + ty) / 2;

        return (
          <g key={conn.id}>
            <path
              d={path}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={dasharray}
              opacity={opacity}
              markerEnd={`url(#${markerId})`}
            >
              {isAnimated && (
                <animate
                  attributeName="stroke-dashoffset"
                  from="20"
                  to="0"
                  dur="1.4s"
                  repeatCount="indefinite"
                />
              )}
            </path>
            
            {conn.ports && conn.ports.length > 0 && (
              <foreignObject x={midX - 25} y={midY - 10} width="50" height="20" className="overflow-visible">
                <div className="flex justify-center items-center h-full">
                  <div className="bg-[var(--bg-surface)] border border-[var(--border)] px-[5px] py-[1px] rounded-[3px] text-[9px] text-[var(--text-muted)] font-mono whitespace-nowrap">
                    {conn.ports.join(', ')}
                  </div>
                </div>
              </foreignObject>
            )}
          </g>
        );
      })}
    </svg>
  );
};
