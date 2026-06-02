import React from 'react';
import { EventItem } from '../../types/resources';
import { relativeTime } from '../../lib/workloadUtils';

interface Props {
  event: EventItem;
}

export const EventRow: React.FC<Props> = ({ event }) => {
  const isWarning = event.type === 'Warning';
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '8px 16px',
      borderBottom: '1px solid var(--border)',
      background: isWarning ? 'rgba(220,38,38,0.03)' : 'transparent'
    }}>
      <div style={{ width: '70px', flexShrink: 0 }}>
        {isWarning ? (
          <span style={{
            display: 'inline-block',
            background: 'rgba(220,38,38,0.10)',
            color: 'var(--netpol)',
            border: '1px solid rgba(220,38,38,0.3)',
            borderRadius: '10px',
            padding: '2px 6px',
            fontSize: '9px',
            textTransform: 'uppercase',
            fontWeight: 600
          }}>Warning</span>
        ) : (
          <span style={{
            display: 'inline-block',
            background: 'rgba(5,150,105,0.08)',
            color: 'var(--status-running)',
            border: '1px solid rgba(5,150,105,0.25)',
            borderRadius: '10px',
            padding: '2px 6px',
            fontSize: '9px',
            textTransform: 'uppercase',
            fontWeight: 600
          }}>Normal</span>
        )}
      </div>
      
      <div style={{ width: '120px', flexShrink: 0, fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {event.reason}
      </div>
      
      <div style={{ width: '180px', flexShrink: 0, paddingRight: '12px' }}>
        <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-code)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {event.regarding}
        </div>
        {event.namespace && (
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {event.namespace}
          </div>
        )}
      </div>
      
      <div style={{ flex: 1, paddingRight: '12px', minWidth: 0 }}>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={event.message}>
          {event.message}
        </div>
      </div>
      
      <div style={{ width: '60px', flexShrink: 0 }}>
        {event.count > 1 && (
          <span style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '1px 6px',
            fontSize: '10px',
            color: 'var(--text-muted)'
          }}>
            ×{event.count}
          </span>
        )}
      </div>
      
      <div style={{ width: '120px', flexShrink: 0, fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
        {relativeTime(event.last_time)}
      </div>
      
      <div style={{ width: '120px', flexShrink: 0, fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {event.source_component}
      </div>
    </div>
  );
};
