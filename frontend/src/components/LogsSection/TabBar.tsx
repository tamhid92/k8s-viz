import React from 'react';
import { ScrollText, FileText, X } from 'lucide-react';
import { LogTabMeta } from '../../types/logs';

interface TabBarProps {
  tabs: LogTabMeta[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

export const TabBar: React.FC<TabBarProps> = ({ tabs, activeId, onSelect, onClose }) => {
  return (
    <div style={{
      height: '36px',
      background: 'var(--bg-elevated)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'stretch',
      overflowX: 'auto'
    }}>
      {tabs.map(tab => {
        const isActive = activeId === tab.id;
        const Icon = tab.tabKind === 'describe' ? FileText : ScrollText;
        const showUnread = !isActive && tab.unreadCount > 0;
        
        let statusColor = 'var(--text-muted)';
        if (tab.status === 'streaming') statusColor = 'var(--status-running)';
        else if (tab.status === 'error') statusColor = 'var(--status-failed)';

        return (
          <div
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            style={{
              minWidth: '140px',
              maxWidth: '200px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 10px',
              borderRight: '1px solid var(--border)',
              cursor: 'pointer',
              fontSize: '12px',
              position: 'relative',
              background: isActive ? 'var(--bg-surface)' : 'transparent',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: isActive ? '2px solid var(--logs)' : 'none',
              marginBottom: isActive ? '-1px' : '0'
            }}
          >
            <Icon size={12} color="var(--logs)" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {tab.label}
            </div>
            
            {showUnread && (
              <div style={{
                background: 'var(--logs)',
                color: '#fff',
                fontSize: '9px',
                padding: '1px 4px',
                borderRadius: '8px',
                fontWeight: 600,
                lineHeight: 1
              }}>
                {tab.unreadCount > 99 ? '99+' : tab.unreadCount}
              </div>
            )}

            <div style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              backgroundColor: statusColor,
              flexShrink: 0
            }} />

            <div
              className="tab-close"
              onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2px',
                borderRadius: '3px',
                color: 'var(--text-secondary)',
                opacity: 1,
                transition: 'background 0.15s, color 0.15s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.background = 'var(--bg-hover)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <X size={14} color="currentColor" />
            </div>
          </div>
        );
      })}
      {tabs.length >= 5 && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: '11px', color: 'var(--text-muted)' }}>
          5/5
        </div>
      )}
    </div>
  );
};
