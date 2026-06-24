import { useState } from 'react';
import type { Analysis, Section } from '../lolmix/types';
import { activeSlots, enemyBySlot } from '../lolmix/transform';
import { pct, signedPct, scoreColor, compactN, confidenceOf, laneToLabel } from '../lolmix/format';
import { ChevronDown, ChevronRight } from 'lucide-react';

// Winning items are sorted by combined_wr (headline), not score.
export function WinningItems({ analysis, section }: { analysis: Analysis; section: Section }) {
  const entries = [...section.entries].sort((a, b) => b.combined_wr - a.combined_wr);
  const [open, setOpen] = useState<number | null>(null);
  const byEnemy = enemyBySlot(analysis);
  if (entries.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-neutral-800 px-3 py-4 text-center text-[11px] text-neutral-600">
        No standout items for this matchup
      </div>
    );
  }
  // headline WR scale for bars
  const maxWr = Math.max(...entries.map((e) => e.combined_wr));
  const minWr = Math.min(...entries.map((e) => e.combined_wr));
  const span = Math.max(0.0001, maxWr - minWr);

  return (
    <div className="flex flex-col gap-1">
      {entries.map((e, idx) => {
        const isOpen = open === idx;
        const slots = activeSlots(e);
        const lowSample = confidenceOf(e.total_n_max) === 'tiny' || confidenceOf(e.total_n_max) === 'low';
        const barW = 12 + ((e.combined_wr - minWr) / span) * 88;
        return (
          <div key={e.id} className="rounded-md bg-neutral-900/40">
            <button
              onClick={() => setOpen(isOpen ? null : idx)}
              className="flex w-full items-center gap-2 px-2.5 py-2 text-left hover:bg-neutral-800/40"
            >
              {isOpen ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
              )}
              <span className="w-32 shrink-0 truncate text-[13px] text-neutral-100 sm:w-44">{e.name}</span>
              {/* combined WR bar */}
              <div className="hidden h-2 flex-1 overflow-hidden rounded-full bg-neutral-800/60 sm:block">
                <div className="h-full rounded-full" style={{ width: `${barW}%`, background: scoreColor(e.score) }} />
              </div>
              <span className="shrink-0 text-[13px] font-semibold tabular-nums text-neutral-100">
                {pct(e.combined_wr)}
              </span>
              <span className="hidden shrink-0 text-[11px] tabular-nums sm:inline" style={{ color: scoreColor(e.max_delta) }}>
                up to {signedPct(e.max_delta)}
              </span>
              {lowSample && <span className="shrink-0 text-[10px] text-amber-400" title="Low sample">⚠</span>}
            </button>
            {isOpen && (
              <div className="px-3 pb-2.5">
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
                  {slots.map((slot) => {
                    const pm = e.per_matchup[slot]!;
                    const enemy = byEnemy[slot];
                    const isLane = slot === 'lane';
                    return (
                      <div key={slot} className={`flex items-center justify-between gap-1 rounded px-1.5 py-0.5 text-[11px] ${isLane ? 'bg-red-500/10' : ''}`}>
                        <span className="truncate text-neutral-400">
                          {isLane && <span className="mr-0.5 text-red-400">◆</span>}
                          {enemy?.champion_name ?? laneToLabel(slot)}
                        </span>
                        <span className="tabular-nums" style={{ color: scoreColor(pm.delta1) }}>
                          {signedPct(pm.delta1)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-1.5 flex items-center gap-3 border-t border-neutral-800 pt-1.5 text-[10px] text-neutral-500">
                  <span>Base WR {pct(e.overall_wr)}</span>
                  <span>PR {pct(e.combined_pr)}</span>
                  <span>n={compactN(e.total_n_max)}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
