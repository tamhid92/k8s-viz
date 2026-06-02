import React from 'react';

interface Props {
  laneId: string;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
}

export const MapLaneColumn: React.FC<Props> = ({ laneId, onScroll, children }) => {
  return (
    <div
      data-lane-id={laneId}
      onScroll={onScroll}
      style={{
        flex: 1,
        height: '100%',
        minHeight: 0,
        borderRight: '1px solid var(--border)',
        padding: '12px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        alignItems: 'center',
        overflowY: 'auto',
        position: 'relative'
      }}
    >
      {children}
    </div>
  );
};
