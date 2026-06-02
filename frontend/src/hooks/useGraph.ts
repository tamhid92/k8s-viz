import { useState, useEffect } from 'react';
import { Graph, GraphDelta } from '../types/graph';
import { NamespaceStats, toNamespaceStats, applyDelta } from '../lib/laneTransform';

export const useGraph = () => {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [namespaceStats, setNamespaceStats] = useState<NamespaceStats[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/graph')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch graph');
        return res.json();
      })
      .then(data => {
        setGraph(data);
        setNamespaceStats(toNamespaceStats(data));
        setIsLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    const handleDelta = (e: CustomEvent<GraphDelta>) => {
      setGraph(prev => {
        if (!prev && e.detail.event_type !== 'FULL_SYNC') return prev;
        const baseGraph = prev || { cluster_info: { server_version: '', platform: '' }, nodes: [], edges: [] };
        const newGraph = applyDelta(baseGraph, e.detail);
        setNamespaceStats(toNamespaceStats(newGraph));
        return newGraph;
      });
    };
    window.addEventListener('k8s_graph_delta', handleDelta as EventListener);
    return () => {
      window.removeEventListener('k8s_graph_delta', handleDelta as EventListener);
    };
  }, []);

  return { graph, namespaceStats, isLoading, error };
};
