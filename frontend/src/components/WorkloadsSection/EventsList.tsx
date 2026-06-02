import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { WorkloadKind, KubeEvent } from '../../types/workloads';
import { formatAge } from '../../lib/workloadUtils';

interface Props {
  kind: WorkloadKind;
  name: string;
  namespace: string;
}

export const EventsList: React.FC<Props> = ({ kind, name, namespace }) => {
  const [events, setEvents] = useState<KubeEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const regardingKind = kind.endsWith('s') ? kind.slice(0, -1) : kind;
        const res = await fetch(`/api/v1/workloads/events?namespace=${namespace}&regarding=${regardingKind}/${name}`);
        if (!res.ok) throw new Error('Failed to fetch events');
        const data = await res.json();
        if (active) {
          setEvents(data.events || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchEvents();
    return () => { active = false; };
  }, [kind, name, namespace]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
        <Loader2 size={24} className="animate-spin" color="var(--text-muted)" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
        No events
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '0', overflowY: 'auto', flex: 1 }}>
      {events.map((ev, i) => {
        const isWarning = ev.type === 'Warning';
        const badgeBg = isWarning ? 'rgba(220,38,38,0.08)' : 'rgba(16,185,129,0.08)';
        const badgeColor = isWarning ? 'var(--status-failed)' : 'var(--status-running)';
        const badgeBorder = isWarning ? 'rgba(220,38,38,0.2)' : 'rgba(16,185,129,0.2)';
        
        return (
          <div key={ev.uid + i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{
                  background: badgeBg,
                  color: badgeColor,
                  border: `1px solid ${badgeBorder}`,
                  borderRadius: '3px',
                  padding: '1px 5px',
                  fontSize: '10px'
                }}>
                  {ev.type}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {ev.reason}
                </span>
              </div>
              <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)', flexShrink: 0 }}>
                {formatAge(ev.last_time || ev.first_time)}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {ev.message}
              {ev.count > 1 && (
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                  ×{ev.count}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
