import React, { useRef } from 'react';
import { NamespaceStats } from '../../lib/laneTransform';
import { NamespaceCard } from './NamespaceCard';
import { OverviewLinks } from './OverviewLinks';

interface NamespaceOverviewProps {
  stats: NamespaceStats[];
  onSelect: (namespace: string) => void;
  transitionState: 'idle' | 'transitioning-in' | 'transitioning-out';
  transitioningNamespace: string | null;
}

export const NamespaceOverview: React.FC<NamespaceOverviewProps> = ({ stats, onSelect, transitionState, transitioningNamespace }) => {
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());

  let containerStyle: React.CSSProperties = {
    opacity: 1,
    transform: 'scale(1)',
    transition: 'opacity 350ms ease-in, transform 350ms ease-in',
  };

  if (transitionState === 'transitioning-in') {
    containerStyle = {
      opacity: 0,
      transform: 'scale(1.04)',
      transition: 'opacity 350ms ease-in, transform 350ms ease-in',
    };
  }

  return (
    <div className="w-full h-full p-6 pt-[76px] overflow-y-auto relative" style={containerStyle}>
      <OverviewLinks stats={stats} cardRefs={cardRefs.current} />
      <div 
        className="grid gap-4 relative z-10"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
      >
        {stats.map(s => {
          const isTransitioning = transitionState === 'transitioning-in' && transitioningNamespace === s.name;
          let style: React.CSSProperties = {};
          
          if (isTransitioning) {
            style = {
              transform: 'scale(1.06)',
              opacity: 0,
              transition: 'all 350ms ease-in',
              zIndex: 50,
            };
          }

          return (
            <div 
              key={s.name} 
              onClick={() => onSelect(s.name)}
              className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-4 cursor-pointer hover:border-[var(--border-bright)] hover:shadow-sm transition-all"
              ref={el => {
                if (el) cardRefs.current.set(s.name, el);
                else cardRefs.current.delete(s.name);
              }}
              style={style}
            >
              <NamespaceCard stats={s} onClick={() => onSelect(s.name)} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
