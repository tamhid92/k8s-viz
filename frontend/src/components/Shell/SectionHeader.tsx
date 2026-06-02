import React from 'react';

export const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 'var(--nav-width)',
      right: 0,
      height: 'var(--section-header-height)',
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: '12px',
      transition: 'left 220ms ease',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
    }}>
      {children}
    </div>
  );
};
