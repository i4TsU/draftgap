import type { ReactNode } from 'react';
import { signedPct, scoreColor, scoreTint, compactN, confidenceOf, pct } from './format';

// A signed score chip (e.g. +4.2%) with diverging color.
export function ScoreChip({ value, label }: { value: number; label?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums leading-none"
      style={{ color: scoreColor(value), background: scoreTint(value) }}
      title={label ? `${label}: ${signedPct(value)}` : signedPct(value)}
    >
      {signedPct(value)}
    </span>
  );
}

// A horizontal delta bar centered at 0 for matchup-slot cells.
export function DeltaBar({ value, max = 0.12 }: { value: number | null; max?: number }) {
  if (value == null) {
    return <div className="h-1.5 w-full rounded-full bg-neutral-800/60" />;
  }
  const clamped = Math.max(-max, Math.min(max, value));
  const pctWidth = (Math.abs(clamped) / max) * 50;
  const positive = clamped >= 0;
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-neutral-800/60">
      <div className="absolute left-1/2 top-0 h-full w-px bg-neutral-600/70" />
      <div
        className="absolute top-0 h-full rounded-full"
        style={{
          width: `${pctWidth}%`,
          left: positive ? '50%' : undefined,
          right: positive ? undefined : '50%',
          background: scoreColor(value),
        }}
      />
    </div>
  );
}

// Sample size pill with low-sample warning styling.
export function SamplePill({ n }: { n: number | null | undefined }) {
  const conf = confidenceOf(n);
  const color =
    conf === 'high' ? 'text-neutral-400' : conf === 'medium' ? 'text-neutral-400' : 'text-amber-400/90';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] tabular-nums ${color}`} title={`${n ?? 0} games sampled`}>
      {(conf === 'low' || conf === 'tiny') && <span aria-hidden>⚠</span>}
      n={compactN(n)}
    </span>
  );
}

// A labeled metric pair (label above value), compact.
export function Metric({ label, children, mono = true }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[9px] font-medium uppercase tracking-wider text-neutral-500">{label}</span>
      <span className={`text-[12px] text-neutral-200 ${mono ? 'tabular-nums' : ''}`}>{children}</span>
    </div>
  );
}

export function WinRate({ value }: { value: number }) {
  return <span className="tabular-nums text-neutral-200">{pct(value)}</span>;
}

// Section heading band (uppercase, compact).
export function GroupHeading({ kicker, title, hint }: { kicker: string; title: string; hint?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">{kicker}</span>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-100">{title}</h3>
      </div>
      {hint && <span className="text-[11px] text-neutral-500">{hint}</span>}
    </div>
  );
}
