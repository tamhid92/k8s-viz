import React from 'react';
import { PolicyRule } from '../../types/resources';

interface Props {
  rules: PolicyRule[];
}

export const RulesTable: React.FC<Props> = ({ rules }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {rules.map((r, i) => {
        return (
          <div key={i} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '4px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <div style={{ width: '120px', flexShrink: 0 }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>APIGroups</div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {r.api_groups.map((g, gi) => (
                    <span key={gi} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '3px', padding: '1px 5px', fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      {g === '' ? 'core' : g}
                    </span>
                  ))}
                </div>
              </div>
              
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Resources</div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {r.resources.map((res, ri) => (
                    <span key={ri} style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--pod)', borderRadius: '3px', padding: '1px 5px', fontSize: '11px', fontFamily: 'monospace' }}>
                      {res}
                    </span>
                  ))}
                  {r.resource_names && r.resource_names.length > 0 && r.resource_names.map((rn, rni) => (
                    <span key={`rn-${rni}`} style={{ background: 'rgba(217,119,6,0.1)', color: 'var(--ingress)', borderRadius: '3px', padding: '1px 5px', fontSize: '11px', fontFamily: 'monospace' }}>
                      {rn}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ width: '200px', flexShrink: 0 }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Verbs</div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {r.verbs.map((v, vi) => {
                    let bg = 'var(--bg-input)';
                    let col = 'var(--text-secondary)';
                    let bor = 'var(--border)';
                    
                    if (v === '*') {
                      bg = 'rgba(217,119,6,0.1)';
                      col = 'var(--ingress)';
                      bor = 'rgba(217,119,6,0.2)';
                    } else if (['create', 'update', 'patch', 'delete'].includes(v)) {
                      bg = 'rgba(220,38,38,0.1)';
                      col = 'var(--netpol)';
                      bor = 'rgba(220,38,38,0.2)';
                    } else if (['get', 'list', 'watch'].includes(v)) {
                      bg = 'rgba(5,150,105,0.1)';
                      col = 'var(--status-running)';
                      bor = 'rgba(5,150,105,0.2)';
                    }

                    return (
                      <span key={vi} style={{ background: bg, color: col, border: `1px solid ${bor}`, borderRadius: '3px', padding: '1px 5px', fontSize: '11px', fontFamily: 'monospace' }}>
                        {v}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
