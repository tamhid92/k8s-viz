import React, { useLayoutEffect, useState, useRef } from 'react';
import { NamespaceStats } from '../../lib/laneTransform';

interface OverviewLinksProps {
  stats: NamespaceStats[];
  cardRefs: Map<string, HTMLElement>;
}

export const OverviewLinks: React.FC<OverviewLinksProps> = ({ stats, cardRefs }) => {
  const containerRef = useRef<SVGSVGElement>(null);
  const [, setTick] = useState(0);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => setTick(t => t + 1));
    observer.observe(containerRef.current);
    for (const el of Array.from(cardRefs.values())) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [cardRefs]);

  if (!containerRef.current) {
    setTimeout(() => setTick(t => t + 1), 0);
  }

  const lines: Array<{
    key: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    direction: 'outgoing' | 'incoming' | 'both';
  }> = [];

  const drawn = new Set<string>();

  if (containerRef.current) {
    const containerRect = containerRef.current.getBoundingClientRect();
    
    for (const s of stats) {
      for (const link of s.crossLinks) {
        const key1 = `${s.name}-${link.targetNamespace}`;
        const key2 = `${link.targetNamespace}-${s.name}`;
        if (drawn.has(key1) || drawn.has(key2)) continue;
        drawn.add(key1);
        
        const el1 = cardRefs.get(s.name);
        const el2 = cardRefs.get(link.targetNamespace);
        if (!el1 || !el2) continue;

        const rect1 = el1.getBoundingClientRect();
        const rect2 = el2.getBoundingClientRect();

        let x1 = rect1.left + rect1.width / 2 - containerRect.left;
        let y1 = rect1.top + rect1.height / 2 - containerRect.top;
        let x2 = rect2.left + rect2.width / 2 - containerRect.left;
        let y2 = rect2.top + rect2.height / 2 - containerRect.top;

        lines.push({
          key: key1,
          x1, y1, x2, y2,
          direction: link.direction,
        });
      }
    }
  }

  return (
    <svg 
      ref={containerRef}
      className="absolute inset-0 pointer-events-none overflow-visible z-[1]"
    >
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <polygon points="0 0, 6 3, 0 6" fill="var(--border-bright)" />
        </marker>
        <marker id="arrowhead-start" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto">
          <polygon points="6 0, 0 3, 6 6" fill="var(--border-bright)" />
        </marker>
      </defs>
      {lines.map(line => {
        const dx = line.x2 - line.x1;
        const dy = line.y2 - line.y1;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const pad = 100; 
        
        let cx1 = line.x1;
        let cy1 = line.y1;
        let cx2 = line.x2;
        let cy2 = line.y2;
        
        if (dist > 0) {
          cx1 = line.x1 + (dx / dist) * pad;
          cy1 = line.y1 + (dy / dist) * pad;
          cx2 = line.x2 - (dx / dist) * pad;
          cy2 = line.y2 - (dy / dist) * pad;
        }

        const mx1 = cx1 + (cx2 - cx1) * 0.25;
        const my1 = cy1;
        const mx2 = cx1 + (cx2 - cx1) * 0.75;
        const my2 = cy2;

        let markerStart = undefined;
        let markerEnd = undefined;
        if (line.direction === 'outgoing') markerEnd = 'url(#arrowhead)';
        if (line.direction === 'incoming') markerStart = 'url(#arrowhead-start)';
        if (line.direction === 'both') {
          markerStart = 'url(#arrowhead-start)';
          markerEnd = 'url(#arrowhead)';
        }

        return (
          <path
            key={line.key}
            d={`M ${cx1} ${cy1} C ${mx1} ${my1}, ${mx2} ${my2}, ${cx2} ${cy2}`}
            stroke="var(--border-bright)"
            strokeWidth="1"
            strokeDasharray="4 4"
            fill="none"
            opacity="0.6"
            markerEnd={markerEnd}
            markerStart={markerStart}
          />
        );
      })}
    </svg>
  );
};
