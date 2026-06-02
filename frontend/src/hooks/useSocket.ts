import { useState, useEffect } from 'react';
import { socket } from '../lib/socket';
import { WatchEventType } from '../types/graph';

export function useSocket() {
  const [connected, setConnected] = useState<boolean>(socket.connected);
  const [lastEvent, setLastEvent] = useState<WatchEventType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onConnect() {
      setConnected(true);
      setError(null);
    }

    function onDisconnect() {
      setConnected(false);
    }

    function onConnectError(err: Error) {
      setError(err.message);
    }

    function onGraphDelta(delta: any) {
      setLastEvent(delta.type);
      window.dispatchEvent(new CustomEvent('graph_delta', { detail: delta }));
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('graph_delta', onGraphDelta);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('graph_delta', onGraphDelta);
    };
  }, []);

  return { connected, lastEvent, error };
}
