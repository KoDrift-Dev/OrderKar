export function fmtPKR(n: number): string {
  return 'Rs ' + new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(Math.round(n));
}

export function fmtNum(n: number): string {
  return new Intl.NumberFormat('en-PK').format(n);
}

export function fmtElapsed(ms: number): string {
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function fmtAgo(iso: string): string {
  return fmtElapsed(Date.now() - new Date(iso).getTime()) + ' ago';
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
