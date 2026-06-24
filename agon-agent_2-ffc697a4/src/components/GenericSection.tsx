import type { Analysis, Section } from '../lolmix/types';
import { metaFor, sortedEntries } from '../lolmix/transform';
import { pct, signedPct } from '../lolmix/format';
import { ScoreChip, SamplePill } from '../lolmix/ui';

// Generic ranked-list fallback for unknown / detail sections. Never crashes.
export function GenericSection({ section }: { analysis: Analysis; section: Section }) {
  const meta = metaFor(section.name);
  const entries = sortedEntries(section, meta.headline).slice(0, 8);
  if (entries.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-neutral-800 px-3 py-4 text-center text-[11px] text-neutral-600">
        Empty section
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[360px] text-[12px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-neutral-500">
            <th className="py-1 pr-2 text-left font-medium">Name</th>
            <th className="py-1 px-2 text-right font-medium">WR</th>
            <th className="py-1 px-2 text-right font-medium">PR</th>
            <th className="py-1 px-2 text-right font-medium">Score</th>
            <th className="py-1 pl-2 text-right font-medium">N</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-t border-neutral-800/70">
              <td className="max-w-[180px] truncate py-1.5 pr-2 text-neutral-200">{e.name}</td>
              <td className="py-1.5 px-2 text-right tabular-nums text-neutral-300">{pct(e.combined_wr)}</td>
              <td className="py-1.5 px-2 text-right tabular-nums text-neutral-400">{pct(e.combined_pr)}</td>
              <td className="py-1.5 px-2 text-right">
                <span className="inline-block">
                  <ScoreChip value={e.score} />
                </span>
              </td>
              <td className="py-1.5 pl-2 text-right">
                <SamplePill n={e.total_n_max} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { signedPct };
