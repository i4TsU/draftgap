import { useMemo, useState } from 'react';
import type { Section, Entry } from '../lolmix/types';
import { parseRunePage, runePathColor } from '../lolmix/runeParser';
import { pct, signedPct, scoreColor } from '../lolmix/format';
import { SamplePill, ScoreChip } from '../lolmix/ui';

// Render a human-readable rune page board. Never shows raw encoded keys.
export function RuneBoard({ section }: { section: Section }) {
  const entries = section.entries;
  // sort by combined_wr (headline for runes)
  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.combined_wr - a.combined_wr),
    [entries],
  );
  const [selected, setSelected] = useState(0);
  if (sorted.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-neutral-800 px-3 py-4 text-center text-[11px] text-neutral-600">
        No rune pages available
      </div>
    );
  }
  const entry = sorted[selected] ?? sorted[0];
  const page = parseRunePage(entry.name);

  return (
    <div className="flex flex-col gap-2.5">
      {/* Segmented control of rune page variants */}
      <div className="flex flex-wrap gap-1">
        {sorted.map((e, i) => {
          const p = parseRunePage(e.name);
          const tag = p.kind ?? `Page ${i + 1}`;
          return (
            <button
              key={e.id}
              onClick={() => setSelected(i)}
              className={`rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
                i === selected
                  ? 'bg-neutral-700 text-neutral-100'
                  : 'bg-neutral-900/60 text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>

      <RunePageDetail entry={entry} />
    </div>
  );
}

function RunePageDetail({ entry }: { entry: Entry }) {
  const page = parseRunePage(entry.name);
  const primaryColor = runePathColor(page.primaryPath);
  const secondaryColor = runePathColor(page.secondaryPath);

  return (
    <div className="rounded-md bg-neutral-900/40 p-3">
      {/* Headline metrics */}
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] uppercase tracking-wide text-neutral-500">Win Rate</span>
          <span className="text-lg font-semibold tabular-nums text-neutral-100">{pct(entry.combined_wr)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-neutral-500">PR {pct(entry.combined_pr)}</span>
          <ScoreChip value={entry.score} label="Score" />
          <SamplePill n={entry.total_n_max} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <RunePathColumn label="Primary" path={page.primaryPath} runes={page.primaryRunes} color={primaryColor} keystone />
        <RunePathColumn label="Secondary" path={page.secondaryPath} runes={page.secondaryRunes} color={secondaryColor} />
      </div>

      {page.shards.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">Shards</span>
          {page.shards.map((s, i) => (
            <span key={i} className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-300">
              {s}
            </span>
          ))}
        </div>
      )}

      {/* per-matchup lane signal if available */}
      {entry.per_matchup?.lane && (
        <div className="mt-2 flex items-center gap-2 border-t border-neutral-800 pt-2 text-[11px]">
          <span className="text-neutral-500">vs lane opponent</span>
          <span className="tabular-nums" style={{ color: scoreColor(entry.per_matchup.lane.delta1) }}>
            {signedPct(entry.per_matchup.lane.delta1)} · WR {pct(entry.per_matchup.lane.wr)}
          </span>
        </div>
      )}
    </div>
  );
}

function RunePathColumn({
  label,
  path,
  runes,
  color,
  keystone = false,
}: {
  label: string;
  path: string | null;
  runes: string[];
  color: string;
  keystone?: boolean;
}) {
  return (
    <div className="rounded bg-neutral-900/60 p-2">
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">{label}</span>
        <span className="text-[11px] font-medium" style={{ color }}>
          {path ?? '\u2014'}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {runes.length === 0 && <span className="text-[11px] text-neutral-600">—</span>}
        {runes.map((r, i) => (
          <div
            key={i}
            className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] ${
              keystone && i === 0
                ? 'bg-neutral-800 font-semibold text-neutral-100'
                : 'text-neutral-300'
            }`}
          >
            {keystone && i === 0 && (
              <span className="rounded-sm bg-amber-500/20 px-1 text-[8px] font-bold uppercase text-amber-300">Key</span>
            )}
            <span className="truncate">{r}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
