import React from 'react';
import { SectionHeader } from '../Shell/SectionHeader';
import { ScrollText, ChevronRight } from 'lucide-react';

interface LogsSectionHeaderProps {
  activeTabLabel?: string;
}

export const LogsSectionHeader: React.FC<LogsSectionHeaderProps> = ({ activeTabLabel }) => {
  return (
    <SectionHeader>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <ScrollText size={16} color="var(--logs)" />
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Logs & Describe</span>
        {activeTabLabel && (
          <>
            <ChevronRight size={14} color="var(--text-muted)" />
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{activeTabLabel}</span>
          </>
        )}
      </div>
    </SectionHeader>
  );
};
