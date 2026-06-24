import type { Section } from '../lolmix/types';
import { sortedEntries } from '../lolmix/transform';
import { pct } from '../lolmix/format';
import { ScoreChip, SamplePill } from '../lolmix/ui';

export function SkillOrder({ section }: { section: Section }) {
  const entries = sortedEntries(section, 'score').slice(0, 3);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      {entries.map((e, i) => (
        <div
          key={e.id}
          className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 ${
            i === 0 ? 'bg-neutral-800/50 ring-1 ring-neutral-700' : 'bg-neutral-900/40'
          }`}
        >
          <div className="flex gap-1">
            {e.name.split('').map((c, j) => (
              <span
                key={j}
                className="grid h-5 w-5 place-items-center rounded bg-neutral-800 text-[10px] font-bold text-neutral-200"
              >
                {c}
              </span>
            ))}
          </div>
          <span className="text-[11px] text-neutral-500">priority</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] tabular-nums text-neutral-400">WR {pct(e.combined_wr)}</span>
            <ScoreChip value={e.score} />
            <SamplePill n={e.total_n_max} />
          </div>
        </div>
      ))}
    </div>
  );
}
