import React, { createContext, useRef, useState, useEffect } from 'react';
import { SectionId } from '../App';
import { LogTabMeta, LogsRequest, DescribeRequest, LogLine, DescribeResult } from '../types/logs';
import { parseLogLine } from '../lib/logUtils';

const MAX_TABS = 5;
const MAX_LINES = 5000;
const TRIM_TO = 4500;

const generateId = () => {
  return typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

interface TabState {
  meta: LogTabMeta;
  lines: LogLine[];
  esRef: EventSource | null;
  listeners: Set<(lines: LogLine[]) => void>;
  descResult: DescribeResult | null;
  descLoading: boolean;
  pollInterval?: number | ReturnType<typeof setInterval>;
  abortController?: AbortController;
}

interface LogManagerContextType {
  tabs: LogTabMeta[];
  activeTabId: string | null;
  openLogTab: (req: LogsRequest) => void;
  openDescribeTab: (req: DescribeRequest) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  getLines: (id: string) => LogLine[];
  getDescResult: (id: string) => { result: DescribeResult | null; loading: boolean };
  subscribe: (id: string, cb: (lines: LogLine[]) => void) => () => void;
}

export const LogManagerContext = createContext<LogManagerContextType | null>(null);

interface ProviderProps {
  children: React.ReactNode;
  onSectionChange: (section: SectionId) => void;
}

export const LogManagerProvider: React.FC<ProviderProps> = ({ children, onSectionChange }) => {
  const tabsRef = useRef<Map<string, TabState>>(new Map());
  const [tabMetas, setTabMetas] = useState<LogTabMeta[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const activeTabIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  const _updateMeta = (id: string, patch: Partial<LogTabMeta>) => {
    const state = tabsRef.current.get(id);
    if (!state) return;
    state.meta = { ...state.meta, ...patch };
    setTabMetas(Array.from(tabsRef.current.values()).map(s => s.meta));
  };

  const _notify = (id: string, lines: LogLine[]) => {
    tabsRef.current.get(id)?.listeners.forEach(cb => cb([...lines]));
  };

  const _pruneTabs = () => {
    if (tabsRef.current.size >= MAX_TABS) {
      const oldestId = Array.from(tabsRef.current.values())
        .sort((a, b) => a.meta.addedAt - b.meta.addedAt)[0].meta.id;
      closeTab(oldestId);
    }
  };

  const _refreshDeploymentLogs = (id: string, req: LogsRequest) => {
    const state = tabsRef.current.get(id);
    if (!state) return;
    if (state.abortController) state.abortController.abort();
    state.abortController = new AbortController();

    const url = `/api/v1/logs/deployment/${req.namespace}/${req.name}?tail=50&timestamps=true`;
    fetch(url, { signal: state.abortController.signal })
      .then(r => r.json())
      .then(data => {
        const s = tabsRef.current.get(id);
        if (!s) return;
        const lines = (data.lines || []).map((item: {pod: string; line: string}) =>
          parseLogLine(item.line, item.pod)
        );
        s.lines = lines;
        _notify(id, lines);
        _updateMeta(id, { status: 'streaming' });
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          _updateMeta(id, { status: 'error' });
        }
      });
  };

  const _startStream = (id: string, req: LogsRequest) => {
    const state = tabsRef.current.get(id);
    if (!state) return;

    if (req.kind === 'deployment') {
      _refreshDeploymentLogs(id, req);
      const interval = setInterval(() => _refreshDeploymentLogs(id, req), 10000);
      state.pollInterval = interval;
      return;
    }

    const es = new EventSource(`/api/v1/logs/pod/${req.namespace}/${req.name}/stream?tail=100`);
    state.esRef = es;

    es.onmessage = (e) => {
      const s = tabsRef.current.get(id);
      if (!s) { es.close(); return; }
      const line = parseLogLine(e.data);
      s.lines.push(line);
      if (s.lines.length > MAX_LINES) s.lines = s.lines.slice(-TRIM_TO);
      _notify(id, s.lines);
      if (activeTabIdRef.current !== id) {
        _updateMeta(id, { unreadCount: (s.meta.unreadCount || 0) + 1 });
      }
    };

    es.onerror = () => {
      _updateMeta(id, { status: 'error' });
    };

    _updateMeta(id, { status: 'streaming' });
  };

  const openLogTab = (req: LogsRequest) => {
    // Deduplicate
    const existing = Array.from(tabsRef.current.values()).find(
      s => s.meta.tabKind === req.kind && s.meta.namespace === req.namespace && s.meta.name === req.name
    );
    if (existing) {
      setActiveTab(existing.meta.id);
      onSectionChange('logs');
      return;
    }

    _pruneTabs();
    const id = generateId();
    
    tabsRef.current.set(id, {
      meta: {
        id,
        tabKind: req.kind,
        label: req.label,
        namespace: req.namespace,
        name: req.name,
        status: 'idle',
        unreadCount: 0,
        addedAt: Date.now()
      },
      lines: [],
      esRef: null,
      listeners: new Set(),
      descResult: null,
      descLoading: false
    });

    setTabMetas(Array.from(tabsRef.current.values()).map(s => s.meta));
    setActiveTab(id);
    onSectionChange('logs');

    _startStream(id, req);
  };

  const openDescribeTab = (req: DescribeRequest) => {
    const existing = Array.from(tabsRef.current.values()).find(
      s => s.meta.tabKind === 'describe' && s.meta.namespace === req.namespace && s.meta.name === req.name && s.descResult?.kind?.toLowerCase() === req.kind.toLowerCase()
    );
    if (existing) {
      setActiveTab(existing.meta.id);
      onSectionChange('logs');
      return;
    }

    _pruneTabs();
    const id = generateId();

    tabsRef.current.set(id, {
      meta: {
        id,
        tabKind: 'describe',
        label: req.label,
        namespace: req.namespace || '',
        name: req.name,
        status: 'idle',
        unreadCount: 0,
        addedAt: Date.now()
      },
      lines: [],
      esRef: null,
      listeners: new Set(),
      descResult: null,
      descLoading: true
    });

    setTabMetas(Array.from(tabsRef.current.values()).map(s => s.meta));
    setActiveTab(id);
    onSectionChange('logs');

    const fetchDescribe = () => {
      const s = tabsRef.current.get(id);
      if (!s) return;
      const nsParam = req.namespace ? `&namespace=${req.namespace}` : '';
      fetch(`/api/v1/describe?kind=${req.kind}&name=${req.name}${nsParam}`)
        .then(r => r.json())
        .then(data => {
          const st = tabsRef.current.get(id);
          if (!st) return;
          st.descResult = data;
          st.descLoading = false;
          _updateMeta(id, { status: 'idle' });
        })
        .catch(err => {
          console.error(err);
          const st = tabsRef.current.get(id);
          if (st) {
            st.descLoading = false;
            _updateMeta(id, { status: 'error' });
          }
        });
    };

    fetchDescribe();
    const interval = setInterval(fetchDescribe, 30000);
    const state = tabsRef.current.get(id);
    if (state) state.pollInterval = interval;
  };

  const closeTab = (id: string) => {
    const state = tabsRef.current.get(id);
    if (!state) return;
    
    if (state.esRef) state.esRef.close();
    if (state.pollInterval) clearInterval(state.pollInterval as number);
    if (state.abortController) state.abortController.abort();
    
    tabsRef.current.delete(id);
    setTabMetas(Array.from(tabsRef.current.values()).map(s => s.meta));
    
    if (activeTabIdRef.current === id) {
      const remaining = Array.from(tabsRef.current.values());
      if (remaining.length > 0) {
        setActiveTab(remaining[remaining.length - 1].meta.id);
      } else {
        setActiveTabId(null);
        activeTabIdRef.current = null;
      }
    }
  };

  const setActiveTab = (id: string) => {
    setActiveTabId(id);
    activeTabIdRef.current = id;
    _updateMeta(id, { unreadCount: 0 });
  };

  const subscribe = (id: string, cb: (lines: LogLine[]) => void) => {
    const state = tabsRef.current.get(id);
    if (state) state.listeners.add(cb);
    return () => {
      const s = tabsRef.current.get(id);
      if (s) s.listeners.delete(cb);
    };
  };

  const value: LogManagerContextType = {
    tabs: tabMetas,
    activeTabId,
    openLogTab,
    openDescribeTab,
    closeTab,
    setActiveTab,
    getLines: (id) => tabsRef.current.get(id)?.lines ?? [],
    getDescResult: (id) => ({
      result: tabsRef.current.get(id)?.descResult ?? null,
      loading: tabsRef.current.get(id)?.descLoading ?? false,
    }),
    subscribe,
  };

  return <LogManagerContext.Provider value={value}>{children}</LogManagerContext.Provider>;
};
