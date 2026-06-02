import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Clock, Search, Download } from 'lucide-react';
import { useLogManager } from '../../hooks/useLogManager';
import { LogLine } from '../../types/logs';
import { levelColor, levelBg, POD_COLORS, hashPodName } from '../../lib/logUtils';

interface LogViewerProps {
  tabId: string;
}

export const LogViewer: React.FC<LogViewerProps> = ({ tabId }) => {
  const { getLines, subscribe } = useLogManager();
  const [lines, setLines] = useState<LogLine[]>(() => getLines(tabId));
  const [search, setSearch] = useState('');
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLines(getLines(tabId));
    return subscribe(tabId, setLines);
  }, [tabId, getLines, subscribe]);

  useLayoutEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  const handleScroll = () => {
    if (!logRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 20;
    setAutoScroll(isAtBottom);
  };

  const handleDownload = () => {
    const text = lines.map(l => l.raw).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${tabId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderMessage = (msg: string): React.ReactNode => {
    if (!search) return msg;
    const idx = msg.toLowerCase().indexOf(search.toLowerCase());
    if (idx === -1) return msg;
    const before = msg.substring(0, idx);
    const match = msg.substring(idx, idx + search.length);
    const after = msg.substring(idx + search.length);
    return (
      <>
        {before}
        <mark style={{ background: 'rgba(217,119,6,0.3)', borderRadius: '2px', color: 'inherit' }}>{match}</mark>
        {renderMessage(after)}
      </>
    );
  };

  const visibleLines = search 
    ? lines.filter(l => l.raw.toLowerCase().includes(search.toLowerCase()))
    : lines;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        height: '40px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: '12px',
        background: 'var(--bg-surface)'
      }}>
        <div style={{ flex: 1 }}></div>

        <button
          onClick={() => setShowTimestamps(!showTimestamps)}
          style={{
            background: showTimestamps ? 'var(--bg-elevated)' : 'transparent',
            border: '1px solid',
            borderColor: showTimestamps ? 'var(--border)' : 'transparent',
            borderRadius: '4px',
            padding: '4px 8px',
            color: showTimestamps ? 'var(--text-primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
          title="Toggle Timestamps"
        >
          <Clock size={14} />
        </button>

        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '8px', top: '7px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search logs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '180px',
              padding: '4px 8px 4px 26px',
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              fontSize: '12px'
            }}
          />
        </div>

        <button
          onClick={handleDownload}
          style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '4px 8px',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
          title="Download Logs"
        >
          <Download size={14} />
        </button>
      </div>

      <div 
        ref={logRef} 
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          background: 'var(--bg-base)',
          fontFamily: 'monospace',
          fontSize: '11px',
          lineHeight: 1.6,
          padding: '8px 0',
          position: 'relative'
        }}
      >
        {visibleLines.map((line, i) => (
          <div key={i} style={{
            display: 'flex',
            padding: '0 12px',
            background: levelBg(line.level),
            borderLeft: `2px solid ${line.level === 'error' ? 'var(--status-failed)' : line.level === 'warn' ? 'var(--status-pending)' : 'transparent'}`
          }}>
            {showTimestamps && (
              <div style={{ width: '200px', color: 'var(--text-muted)', flexShrink: 0, fontSize: '10px' }}>
                {line.timestamp || '---'}
              </div>
            )}
            {line.pod && (
              <div style={{
                minWidth: '140px',
                color: POD_COLORS[hashPodName(line.pod) % POD_COLORS.length],
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flexShrink: 0,
                marginRight: '12px'
              }}>
                {line.pod}
              </div>
            )}
            <div style={{ color: levelColor(line.level), whiteSpace: 'pre-wrap', wordBreak: 'break-all', flex: 1 }}>
              {renderMessage(line.message)}
            </div>
          </div>
        ))}
        {visibleLines.length === 0 && (
          <div style={{ padding: '20px', color: 'var(--text-muted)', textAlign: 'center' }}>
            No logs to display
          </div>
        )}
      </div>

      {!autoScroll && (
        <button
          onClick={() => {
            setAutoScroll(true);
            if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
          }}
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '6px 12px',
            fontSize: '11px',
            cursor: 'pointer',
            color: 'var(--text-primary)',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            zIndex: 10
          }}
        >
          ↓ Jump to latest
        </button>
      )}
    </div>
  );
};
