/** @type {import('tailwindcss').Config} */
export default {
  darkMode: false,
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        base: 'var(--bg-base)',
        surface: 'var(--bg-surface)',
        elevated: 'var(--bg-elevated)',
        input: 'var(--bg-input)',
        border: 'var(--border)',
        'border-bright': 'var(--border-bright)',
        'border-accent': 'var(--border-accent)',
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
        code: 'var(--text-code)',
        pod: 'var(--pod)',
        service: 'var(--service)',
        ingress: 'var(--ingress)',
        netpol: 'var(--netpol)',
        'cluster-node': 'var(--cluster-node)',
        namespace: 'var(--namespace)',
        'status-running': 'var(--status-running)',
        'status-pending': 'var(--status-pending)',
        'status-failed': 'var(--status-failed)',
        'status-succeeded': 'var(--status-succeeded)',
        'status-unknown': 'var(--status-unknown)',
        'edge-service': 'var(--edge-service)',
        'edge-ingress': 'var(--edge-ingress)',
        'edge-netpol-allow': 'var(--edge-netpol-allow)',
        'edge-netpol-deny': 'var(--edge-netpol-deny)',
        'edge-placement': 'var(--edge-placement)',
      }
    },
  },
  plugins: [],
}
