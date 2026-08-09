/**
 * Format IDR amounts.
 * Full (default): comma-grouped Rupiah — Rp229,975,060,500
 * Compact: abbreviated B/M/T for Command Center cards.
 */
export function formatIDR(value, compact = false) {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (compact) {
    if (abs >= 1e12) return `${sign}Rp${(abs / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `${sign}Rp${(abs / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `${sign}Rp${(abs / 1e6).toFixed(1)}M`;
  }
  return `${sign}Rp${Math.round(abs).toLocaleString('en-US')}`;
}

export function formatPrice(value) {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('id-ID');
}

export function formatPct(value, decimals = 2, showSign = true) {
  if (!Number.isFinite(value)) return '—';
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatNumber(value, decimals = 0) {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatVolume(value) {
  if (!Number.isFinite(value)) return '—';
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return String(value);
}

export function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function gradeColor(grade) {
  switch (grade) {
    case 'A': return 'var(--color-positive)';
    case 'B': return '#81c995';
    case 'C': return 'var(--color-warning)';
    case 'D': return '#f28b82';
    case 'F': return 'var(--color-negative)';
    default: return 'var(--text-tertiary)';
  }
}
