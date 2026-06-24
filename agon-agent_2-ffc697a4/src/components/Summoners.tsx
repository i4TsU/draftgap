import type { Section } from '../lolmix/types';
import { sortedEntries, laneMatchup } from '../lolmix/transform';
import { pct, signedPct, scoreColor } from '../lolmix/format';
import { ScoreChip, SamplePill } from '../lolmix/ui';

// Summoner spell icons are simplified to initials (no asset access).
function SpellGlyphs({ name }: { name: string }) {
  const parts = name.split('+').map((p) => p.trim());
  return (
    <div className="flex items-center gap-1">
      {parts.map((p, i) => (
        <span
          key={i}
          className="grid h-6 w-6 place-items-center rounded bg-neutral-800 text-[10px] font-bold uppercase text-neutral-300 ring-1 ring-neutral-700"
          title={p}
        >
          {p.slice(0, 2)}
        </span>
      ))}
    </div>
  );
}

export function Summoners({ section }: { section: Section }) {
  const entries = sortedEntries(section, 'score').slice(0, 3);
  if (entries.length === 0) return <EmptyMini label="No summoner data" />;
  const top = entries[0];
  return (
    <div className="flex flex-col gap-1.5">
      {entries.map((e, idx) => {
        const lane = laneMatchup(e);
        const isTop = idx === 0;
        return (
          <div
            key={e.id}
            className={`flex items-center gap-3 rounded-md px-2.5 py-2 ${
              isTop ? 'bg-neutral-800/60 ring-1 ring-neutral-700' : 'bg-neutral-900/40'
            }`}
          >
            <SpellGlyphs name={e.name} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-medium text-neutral-100">{e.name}</span>
                {isTop && (
                  <span className="rounded bg-blue-500/15 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-blue-300">
                    Pick
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-neutral-500">
                <span className="tabular-nums">WR {pct(e.combined_wr)}</span>
                <span className="text-neutral-700">•</span>
                <span className="tabular-nums">PR {pct(e.combined_pr)}</span>
                {lane && (
                  <>
                    <span className="text-neutral-700">•</span>
                    <span className="tabular-nums" style={{ color: scoreColor(lane.delta1) }}>
                      vs lane {signedPct(lane.delta1)}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <ScoreChip value={e.score} label="Score" />
              <SamplePill n={e.total_n_max} />
            </div>
          </div>
        );
      })}
      {top && entries.length < section.entries.length && (
        <span className="px-1 text-[10px] text-neutral-600">
          +{section.entries.length - entries.length} more combinations
        </span>
      )}
    </div>
  );
}

export function EmptyMini({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-neutral-800 px-3 py-4 text-center text-[11px] text-neutral-600">
      {label}
    </div>
  );
}
