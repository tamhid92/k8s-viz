import React, { useState, useEffect, useRef } from 'react';
import { EventsSectionHeader } from './EventsSectionHeader';
import { EventRow } from './EventRow';
import { EventItem, EventsListResponse } from '../../types/resources';

export const EventsSection: React.FC = () => {
  const [namespace, setNamespace] = useState('');
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<'' | 'Warning'>('');
  const [search, setSearch] = useState('');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [warningCount, setWarningCount] = useState(0);
  const [loading, setLoading] = useState(false);
  
  const intervalRef = useRef<number | null>(null);

  const fetchNamespaces = async () => {
    try {
      const res = await fetch('/api/v1/namespaces');
      const data = await res.json();
      setNamespaces(data.namespaces || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (namespace) params.set('namespace', namespace);
      if (typeFilter) params.set('type', typeFilter);
      if (search) params.set('search', search);
      
      const res = await fetch(`/api/v1/events?${params.toString()}`);
      if (res.ok) {
        const data: EventsListResponse = await res.json();
        setEvents(data.events || []);
        setWarningCount(data.warning_count || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNamespaces();
  }, []);

  useEffect(() => {
    fetchEvents();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(fetchEvents, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [namespace, typeFilter, search]);

  return (
    <div style={{
      paddingTop: 'var(--section-header-height)',
      paddingBottom: 'var(--status-bar-height)',
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <EventsSectionHeader
        namespace={namespace}
        namespaces={namespaces}
        onNamespaceChange={setNamespace}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        search={search}
        onSearchChange={setSearch}
        loading={loading}
      />
      
      {warningCount > 0 && typeFilter !== 'Warning' && (
        <div
          onClick={() => setTypeFilter('Warning')}
          style={{
            background: 'rgba(220,38,38,0.06)',
            borderBottom: '1px solid rgba(220,38,38,0.2)',
            padding: '6px 16px',
            fontSize: '12px',
            color: 'var(--netpol)',
            cursor: 'pointer',
            fontWeight: 500
          }}
        >
          ⚠ {warningCount} warning event{warningCount > 1 ? 's' : ''}
        </div>
      )}
      
      <div style={{
        display: 'flex',
        padding: '8px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}>
        <div style={{ width: '70px', flexShrink: 0 }}>Type</div>
        <div style={{ width: '120px', flexShrink: 0 }}>Reason</div>
        <div style={{ width: '180px', flexShrink: 0 }}>Object</div>
        <div style={{ flex: 1 }}>Message</div>
        <div style={{ width: '60px', flexShrink: 0 }}>Count</div>
        <div style={{ width: '120px', flexShrink: 0 }}>Last Seen</div>
        <div style={{ width: '120px', flexShrink: 0 }}>Component</div>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {events.map((e, idx) => (
          <EventRow key={`${e.uid}-${idx}`} event={e} />
        ))}
        {events.length === 0 && !loading && (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            No events found.
          </div>
        )}
      </div>
    </div>
  );
};
