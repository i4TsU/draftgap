import { useState } from 'react';
import type { Section } from '../lolmix/types';
import { sortedEntries } from '../lolmix/transform';
import { pct } from '../lolmix/format';
import { ScoreChip, SamplePill } from '../lolmix/ui';

export function FullBuild({ section }: { section: Section }) {
  const [open, setOpen] = useState(false);
  const entries = sortedEntries(section, 'score');
  if (entries.length === 0) return null;
  const shown = open ? entries : entries.slice(0, 3);
  return (
    <div className="flex flex-col gap-1.5">
      {shown.map((e, i) => (
        <div
          key={e.id}
          className={`rounded-md px-2.5 py-2 ${i === 0 ? 'bg-neutral-800/50 ring-1 ring-neutral-700' : 'bg-neutral-900/40'}`}
        >
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
              {e.name.split('+').map((part, j, arr) => (
                <span key={j} className="flex items-center gap-1">
                  <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[11px] text-neutral-200">{part.trim()}</span>
                  {j < arr.length - 1 && <span className="text-neutral-600">→</span>}
                </span>
              ))}
            </div>
            <span className="shrink-0 text-[11px] tabular-nums text-neutral-400">WR {pct(e.overall_wr)}</span>
            <ScoreChip value={e.score} />
            <SamplePill n={e.total_n_max} />
          </div>
        </div>
      ))}
      {entries.length > 3 && (
        <button onClick={() => setOpen((v) => !v)} className="self-start text-[11px] text-blue-400 hover:text-blue-300">
          {open ? 'Show less' : `Show ${entries.length - 3} more builds`}
        </button>
      )}
    </div>
  );
}
