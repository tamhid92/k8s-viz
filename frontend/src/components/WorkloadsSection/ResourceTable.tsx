import React, { useState, useMemo } from 'react';
import { Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { WorkloadHealth } from '../../types/workloads';

export interface TableColumn {
  key: string;
  label: string;
  width?: string;
  sortable?: boolean;
}

export interface TableRow {
  id: string;
  cells: Record<string, React.ReactNode>;
  sortValues?: Record<string, any>;
  health: WorkloadHealth;
}

interface Props {
  columns: TableColumn[];
  rows: TableRow[];
  selectedId: string | null;
  onRowClick: (id: string) => void;
  loading: boolean;
  emptyMessage: string;
}

export const ResourceTable: React.FC<Props> = ({
  columns,
  rows,
  selectedId,
  onRowClick,
  loading,
  emptyMessage
}) => {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const valA = a.sortValues?.[sortKey] ?? a.cells[sortKey];
      const valB = b.sortValues?.[sortKey] ?? b.cells[sortKey];

      if (typeof valA === 'string' && typeof valB === 'string') {
        const cmp = valA.localeCompare(valB);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      if (typeof valA === 'number' && typeof valB === 'number') {
        const cmp = valA - valB;
        return sortDir === 'asc' ? cmp : -cmp;
      }
      return 0;
    });
  }, [rows, sortKey, sortDir]);

  return (
    <div style={{ width: '100%', overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
          <tr style={{
            height: '36px',
            background: 'var(--bg-elevated)',
            borderBottom: '2px solid var(--border)'
          }}>
            {columns.map(col => (
              <th
                key={col.key}
                style={{
                  padding: '0 12px',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-muted)',
                  textAlign: 'left',
                  whiteSpace: 'nowrap',
                  width: col.width,
                  cursor: col.sortable ? 'pointer' : 'default',
                  userSelect: 'none'
                }}
                onClick={() => {
                  if (col.sortable) handleSort(col.key);
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} style={{ height: '100px', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  <Loader2 size={16} className="animate-spin" />
                  Loading...
                </div>
              </td>
            </tr>
          ) : sortedRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ height: '100px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedRows.map(row => {
              const isSelected = row.id === selectedId;
              return (
                <tr
                  key={row.id}
                  onClick={() => onRowClick(row.id)}
                  style={{
                    height: '44px',
                    borderBottom: '1px solid var(--border)',
                    background: isSelected ? 'rgba(59,130,246,0.06)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background 150ms'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'var(--bg-elevated)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {columns.map(col => (
                    <td key={col.key} style={{ padding: '0 12px', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: col.width || 'auto' }}>
                      {row.cells[col.key]}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};
