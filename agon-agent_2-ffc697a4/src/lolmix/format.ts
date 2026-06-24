// Number / percent / delta formatting helpers.
// Metrics in the contract are decimal fractions: 0.527 => 52.7%; 0.034 => +3.4%.

export function pct(value: number | null | undefined, decimals = 1): string {
  if (value == null || Number.isNaN(value)) return '\u2013';
  return `${(value * 100).toFixed(decimals)}%`;
}

export function signedPct(value: number | null | undefined, decimals = 1): string {
  if (value == null || Number.isNaN(value)) return '\u2013';
  const v = value * 100;
  const sign = v > 0 ? '+' : v < 0 ? '\u2212' : '';
  return `${sign}${Math.abs(v).toFixed(decimals)}%`;
}

export function compactN(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '\u2013';
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

// Sample-size confidence buckets. Used for low-sample indicators.
export type Confidence = 'high' | 'medium' | 'low' | 'tiny';
export function confidenceOf(n: number | null | undefined): Confidence {
  if (n == null) return 'tiny';
  if (n >= 50_000) return 'high';
  if (n >= 5_000) return 'medium';
  if (n >= 500) return 'low';
  return 'tiny';
}

// Color tokens (DraftGap palette) mapped to a signed score / delta value.
// Diverging scale anchored at 0.
export function scoreColor(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return '#9ca3af';
  // thresholds in raw decimal
  if (score >= 0.08) return '#ff9b00'; // volxd / exceptional
  if (score >= 0.03) return '#3273fa'; // great
  if (score >= 0.005) return '#7ea4f4'; // good
  if (score > -0.005) return '#fafafa'; // neutral / okay
  if (score > -0.03) return '#fcb1b2'; // meh
  return '#ff4e50'; // bad
}

// Background tint (low alpha) for a score, for bands / chips.
export function scoreTint(score: number | null | undefined, alpha = 0.14): string {
  const c = scoreColor(score);
  // convert hex to rgba
  const hex = c.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function laneToLabel(lane: string): string {
  const map: Record<string, string> = {
    top: 'Top',
    jungle: 'Jungle',
    middle: 'Mid',
    bottom: 'Bot',
    support: 'Support',
    lane: 'Lane',
  };
  return map[lane] ?? lane;
}
