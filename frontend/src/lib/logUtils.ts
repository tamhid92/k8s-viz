import { LogLine } from '../types/logs';

export function parseLogLine(raw: string, pod?: string): LogLine {
  const tsMatch = raw.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s/);
  const timestamp = tsMatch?.[1] ?? null;
  const message   = tsMatch ? raw.slice(tsMatch[0].length) : raw;
  const clean     = message.replace(/\u001B\[[0-9;]*[mGKHFABCDJKSTfu]/g, '');
  const upper     = clean.toUpperCase();
  let level: LogLine['level'] = 'unknown';
  if (/\bERROR\b|\bERR\b|\bFATAL\b|\bPANIC\b/.test(upper))   level = 'error';
  else if (/\bWARN(ING)?\b/.test(upper))                      level = 'warn';
  else if (/\bINFO\b|\bINFORMATION\b/.test(upper))            level = 'info';
  else if (/\bDEBUG\b|\bTRACE\b/.test(upper))                 level = 'debug';
  return { raw: clean, timestamp, message: clean, level, pod };
}

export function levelColor(level: LogLine['level']): string {
  if (level === 'error') return 'var(--status-failed)';
  if (level === 'warn') return 'var(--status-pending)';
  if (level === 'info') return 'var(--text-primary)';
  if (level === 'debug') return 'var(--text-muted)';
  return 'var(--text-primary)';
}

export function levelBg(level: LogLine['level']): string {
  if (level === 'error') return 'rgba(220,38,38,0.06)';
  if (level === 'warn') return 'rgba(217,119,6,0.05)';
  return 'transparent';
}

export const POD_COLORS: string[] = [
  'var(--pod)',
  'var(--service)',
  'var(--ingress)',
  'var(--cluster-node)',
  'var(--namespace)',
  'var(--netpol)',
  '#a78bfa',
  '#34d399'
];

export function hashPodName(name: string): number {
  let hash = 5381;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) + hash) + name.charCodeAt(i);
  }
  return Math.abs(hash);
}

export interface SystemComponent {
  name:      string;
  shortName: string;
  icon:      string;      // lucide icon name
  color:     string;      // CSS var
  pods:      import('../types/logs').PodListItem[];
}

export function detectSystemComponents(pods: import('../types/logs').PodListItem[]): SystemComponent[] {
  const components: SystemComponent[] = [];

  // CoreDNS — kube-system pods labeled k8s-app=kube-dns or name contains coredns
  const coreDns = pods.filter(p =>
    p.namespace === 'kube-system' && (
      (p.labels && p.labels['k8s-app'] === 'kube-dns') ||
      p.name.toLowerCase().includes('coredns')
    )
  );
  if (coreDns.length > 0) {
    components.push({
      name: 'CoreDNS',
      shortName: 'coredns',
      icon: 'Globe',
      color: 'var(--namespace)',
      pods: coreDns,
    });
  }

  // kube-proxy — kube-system pods labeled k8s-app=kube-proxy or name contains kube-proxy
  const kubeProxy = pods.filter(p =>
    p.namespace === 'kube-system' && (
      (p.labels && p.labels['k8s-app'] === 'kube-proxy') ||
      p.name.toLowerCase().includes('kube-proxy')
    )
  );
  if (kubeProxy.length > 0) {
    components.push({
      name: 'kube-proxy',
      shortName: 'kube-proxy',
      icon: 'Shuffle',
      color: 'var(--service)',
      pods: kubeProxy,
    });
  }

  // Ingress controller — any namespace, detect by name
  const ingressPatterns = [
    'ingress-nginx', 'nginx-ingress', 'traefik',
    'contour', 'haproxy-ingress', 'kong-ingress',
  ];
  const ingressPods = pods.filter(p =>
    ingressPatterns.some(pat => p.name.toLowerCase().includes(pat))
  );
  if (ingressPods.length > 0) {
    // Derive display name from first pod name
    const matched = ingressPatterns.find(pat =>
      ingressPods[0].name.toLowerCase().includes(pat)
    ) ?? 'ingress-controller';
    const displayName = matched
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    components.push({
      name: displayName,
      shortName: matched,
      icon: 'Globe',
      color: 'var(--ingress)',
      pods: ingressPods,
    });
  }

  return components;
}
