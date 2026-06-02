import React, { useRef } from 'react';
import { Download, Upload, Shield, Network } from 'lucide-react';
import { SectionHeader } from '../Shell/SectionHeader';
import { ViewMode } from '../../types/graph';
import { AppView } from '../../App';

interface Props {
  view: AppView;
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  onBack: () => void;
}

export const NetworkSectionHeader: React.FC<Props> = ({
  view,
  viewMode,
  onViewModeChange,
  onBack
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    window.open('/api/v1/snapshot', '_blank');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/v1/snapshot', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to import snapshot');
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Failed to import snapshot');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const currentNamespace = 'namespace' in view ? view.namespace : null;
  const isLaneView = view.screen === 'lane' || view.screen === 'transitioning-in' || view.screen === 'transitioning-out';

  return (
    <SectionHeader>
      <div className="flex items-center gap-4 flex-1">
        {isLaneView && currentNamespace && (
          <div className="flex items-center gap-2 text-[13px] ml-4 text-[var(--text-muted)]">
            <span 
              className="cursor-pointer hover:text-[var(--text-primary)] transition-colors"
              onClick={onBack}
            >
              All Namespaces
            </span>
            <span>/</span>
            <span className="font-mono text-[var(--namespace)]">{currentNamespace}</span>
          </div>
        )}
      </div>

      <div className="flex-1 flex justify-center">
        {currentNamespace && viewMode && onViewModeChange && (
          <div className="flex items-center gap-1 bg-[var(--bg-surface)] p-0.5 rounded-full border border-[var(--border)]">
            <button
              onClick={() => onViewModeChange('policy')}
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-[13px] transition-colors ${
                viewMode === 'policy'
                  ? 'bg-[var(--bg-elevated)] border border-[var(--border-bright)] text-[var(--text-primary)] font-semibold'
                  : 'bg-transparent border border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Shield size={14} />
              Policy
            </button>
            <button
              onClick={() => onViewModeChange('topology')}
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-[13px] transition-colors ${
                viewMode === 'topology'
                  ? 'bg-[var(--bg-elevated)] border border-[var(--border-bright)] text-[var(--text-primary)] font-semibold'
                  : 'bg-transparent border border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Network size={14} />
              Topology
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-6 flex-1 text-[13px]">
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border)] hover:border-[var(--border-bright)] text-[var(--text-secondary)] text-[12px] transition-colors"
          >
            <Download size={14} />
            Export
          </button>
          <button
            onClick={handleImportClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border)] hover:border-[var(--border-bright)] text-[var(--text-secondary)] text-[12px] transition-colors"
          >
            <Upload size={14} />
            Import
          </button>
          <input
            type="file"
            accept=".json"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>
    </SectionHeader>
  );
};
