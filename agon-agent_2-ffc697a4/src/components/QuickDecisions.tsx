import type { Analysis } from '../lolmix/types';
import { getSection, topEntry, metaFor } from '../lolmix/transform';
import { pct, signedPct, scoreColor } from '../lolmix/format';
import { parseRunePage } from '../lolmix/runeParser';

// The hero strip: the single most important answer per Now-phase decision,
// at a glance, above the fold. Each tile degrades gracefully if missing.
interface Tile {
  label: string;
  value: string;
  sub?: string;
  score?: number;
}

export function QuickDecisions({ analysis }: { analysis: Analysis }) {
  const tiles: Tile[] = [];

  const sum = topEntry(getSection(analysis, 'summoners'), 'score');
  if (sum) tiles.push({ label: 'Summoners', value: sum.name, sub: `WR ${pct(sum.combined_wr)}`, score: sum.score });

  const runeSection = getSection(analysis, 'rune_page');
  const rune = runeSection ? topEntry(runeSection, 'combined_wr') : undefined;
  if (rune) {
    const p = parseRunePage(rune.name);
    tiles.push({
      label: 'Keystone',
      value: p.keystone ?? p.primaryPath ?? 'Rune page',
      sub: `WR ${pct(rune.combined_wr)}`,
      score: rune.score,
    });
  }

  const starter = topEntry(getSection(analysis, 'starters'), 'score');
  if (starter) tiles.push({ label: 'Starter', value: starter.name, sub: `WR ${pct(starter.combined_wr)}`, score: starter.score });

  const firstItem = topEntry(getSection(analysis, 'first_completed_item'), 'score');
  if (firstItem)
    tiles.push({ label: 'First item', value: firstItem.name, sub: `WR ${pct(firstItem.combined_wr)}`, score: firstItem.score });

  // Early skill: best at L1
  const skillEarly = getSection(analysis, 'skill_early');
  if (skillEarly) {
    const l1 = skillEarly.entries
      .filter((e) => /L\s*1\s*[QWER]/i.test(e.name))
      .sort((a, b) => b.score - a.score)[0];
    if (l1) tiles.push({ label: 'Level 1', value: l1.name.replace(/L\s*1\s*/i, ''), sub: `Skill`, score: l1.score });
  }

  if (tiles.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((t, i) => (
        <div key={i} className="flex flex-col gap-1 rounded-md bg-[#191919] p-2.5 ring-1 ring-neutral-800/80">
          <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">{t.label}</span>
          <span className="truncate text-[13px] font-semibold text-neutral-100" title={t.value}>
            {t.value}
          </span>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-neutral-500">{t.sub}</span>
            {t.score != null && (
              <span className="text-[10px] font-semibold tabular-nums" style={{ color: scoreColor(t.score) }}>
                {signedPct(t.score)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export { metaFor };
