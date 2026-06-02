import { useContext } from 'react';
import { LogManagerContext } from '../context/LogManagerContext';

export function useLogManager() {
  const ctx = useContext(LogManagerContext);
  if (!ctx) throw new Error('useLogManager must be used within LogManagerProvider');
  return ctx;
}
