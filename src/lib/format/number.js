/**
 * Canonical module ID: trading-surface-number-format/v1.
 * Keep every copy of this file byte-identical across the three trading surfaces.
 */
const unavailable = '—';

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function formatNumber(value, decimals = 0) {
  if (!finite(value)) return unavailable;
  return value.toLocaleString('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

const COMPACT_UNITS = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];

function compactPrecision(scaled, decimals) {
  return scaled >= 100 ? 0 : scaled >= 10 ? Math.min(decimals, 1) : decimals;
}

export function formatCompact(value, decimals = 1) {
  if (!finite(value)) return unavailable;
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  let index = COMPACT_UNITS.findIndex(([threshold]) => abs >= threshold);
  if (index === -1) return formatNumber(value);
  let scaled = abs / COMPACT_UNITS[index][0];
  let precision = compactPrecision(scaled, decimals);
  // Rounding can carry a value into the next unit. Without this, 999,999,999
  // renders as "1000M" instead of "1.0B" — the same magnitude read wrong at a
  // glance, which is the only way these are ever read.
  if (Number(scaled.toFixed(precision)) >= 1000 && index > 0) {
    index -= 1;
    scaled = abs / COMPACT_UNITS[index][0];
    precision = compactPrecision(scaled, decimals);
  }
  return `${sign}${scaled.toFixed(precision)}${COMPACT_UNITS[index][1]}`;
}

export function formatIDR(value, compact = false) {
  if (!finite(value)) return unavailable;
  if (compact) return `${value < 0 ? '-' : ''}Rp${formatCompact(Math.abs(value))}`;
  return `${value < 0 ? '-' : ''}Rp${formatNumber(Math.round(Math.abs(value)))}`;
}

export function formatPrice(value) {
  return finite(value) ? formatNumber(value) : unavailable;
}

export function formatPct(value, decimals = 2, showSign = true) {
  if (!finite(value)) return unavailable;
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatShares(value) {
  return finite(value) ? `${formatCompact(value)} shares` : unavailable;
}

export function formatLots(value) {
  return finite(value) ? `${formatNumber(value)} lots` : unavailable;
}

export function formatRatio(value, decimals = 2) {
  return finite(value) ? `${value.toFixed(decimals)}x` : unavailable;
}

export function formatDate(value) {
  if (!value) return unavailable;
  const text = String(value);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T00:00:00`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return unavailable;
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
