import { useState } from 'react';
import type { Analysis, Entry, Section, Slot } from '../lolmix/types';
import { sortedEntries, activeSlots, enemyBySlot, SLOT_ORDER } from '../lolmix/transform';
import { metaFor } from '../lolmix/transform';
import { pct, signedPct, scoreColor, laneToLabel } from '../lolmix/format';
import { ScoreChip, SamplePill, DeltaBar } from '../lolmix/ui';
import { ChevronRight, ChevronDown } from 'lucide-react';

// A connected, numbered build path. Each step shows its top pick and expands to
// alternatives + per-matchup deltas. Steps render in core-path order.
export function BuildPath({ analysis, sections }: { analysis: Analysis; sections: Section[] }) {
  // path steps only (pathStep renderer)
  const steps = sections.filter((s) => metaFor(s.name).renderer === 'pathStep' && s.entries.length > 0);
  if (steps.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-neutral-800 px-3 py-4 text-center text-[11px] text-neutral-600">
        No build path available
      </div>
    );
  }
  return (
    <ol className="flex flex-col">
      {steps.map((section, i) => (
        <BuildStep
          key={section.name}
          analysis={analysis}
          section={section}
          index={i + 1}
          isLast={i === steps.length - 1}
        />
      ))}
    </ol>
  );
}

function BuildStep({
  analysis,
  section,
  index,
  isLast,
}: {
  analysis: Analysis;
  section: Section;
  index: number;
  isLast: boolean;
}) {
  const [open, setOpen] = useState(false);
  const meta = metaFor(section.name);
  const entries = sortedEntries(section, 'score');
  const top = entries[0];
  const alts = entries.slice(1, 5);

  return (
    <li className="relative pl-7">
      {/* connector rail */}
      <span className="absolute left-[10px] top-0 flex h-full w-px justify-center">
        {!isLast && <span className="absolute top-7 bottom-0 w-px bg-neutral-800" />}
      </span>
      <span className="absolute left-0 top-2 grid h-5 w-5 place-items-center rounded-full bg-neutral-800 text-[10px] font-bold text-neutral-300 ring-1 ring-neutral-700">
        {index}
      </span>

      <div className="mb-1.5">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-2 rounded-md bg-neutral-800/40 px-2.5 py-2 text-left transition hover:bg-neutral-800/70"
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
          )}
          <span className="w-20 shrink-0 text-[9px] font-bold uppercase tracking-wider text-neutral-500">
            {meta.title}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-neutral-100">{top.name}</span>
          <span className="hidden shrink-0 text-[11px] tabular-nums text-neutral-400 sm:inline">
            WR {pct(top.combined_wr)}
          </span>
          <ScoreChip value={top.score} />
        </button>
      </div>

      {open && (
        <div className="mb-2 ml-1 flex flex-col gap-2 rounded-md bg-neutral-900/50 p-2.5">
          <MatchupRow analysis={analysis} entry={top} />
          {alts.length > 0 && (
            <div>
              <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                Alternatives
              </span>
              <div className="flex flex-col gap-1">
                {alts.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-[12px]">
                    <span className="min-w-0 flex-1 truncate text-neutral-300">{e.name}</span>
                    <span className="text-[11px] tabular-nums text-neutral-500">WR {pct(e.combined_wr)}</span>
                    <ScoreChip value={e.score} />
                    <SamplePill n={e.total_n_max} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

// Per-matchup delta strip for an entry: lane slot first and emphasized.
export function MatchupRow({ analysis, entry }: { analysis: Analysis; entry: Entry }) {
  const slots = activeSlots(entry);
  const byEnemy = enemyBySlot(analysis);
  if (slots.length === 0) {
    return <span className="text-[11px] text-neutral-600">No matchup breakdown for this option.</span>;
  }
  // ensure lane first
  const ordered: Slot[] = [
    ...slots.filter((s) => s === 'lane'),
    ...SLOT_ORDER.filter((s) => s !== 'lane' && slots.includes(s)),
  ];
  return (
    <div>
      <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-neutral-500">
        Change vs each enemy
      </span>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
        {ordered.map((slot) => {
          const pm = entry.per_matchup[slot];
          if (!pm) return null;
          const enemy = byEnemy[slot];
          const isLane = slot === 'lane';
          return (
            <div
              key={slot}
              className={`flex flex-col gap-1 rounded px-1.5 py-1 ${isLane ? 'bg-red-500/10 ring-1 ring-red-500/30' : ''}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-[10px] text-neutral-400">
                  {isLane && <span className="mr-1 text-red-400">◆</span>}
                  {enemy?.champion_name ?? laneToLabel(slot)}
                  <span className="ml-1 text-neutral-600">{laneToLabel(slot)}</span>
                </span>
                <span className="shrink-0 text-[10px] font-semibold tabular-nums" style={{ color: scoreColor(pm.delta1) }}>
                  {signedPct(pm.delta1)}
                </span>
              </div>
              <DeltaBar value={pm.delta1} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
