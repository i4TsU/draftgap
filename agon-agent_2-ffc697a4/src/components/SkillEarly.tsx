import { useMemo } from 'react';
import type { Section, Entry } from '../lolmix/types';
import { scoreColor, scoreTint, signedPct, pct, compactN } from '../lolmix/format';

// Stable 4 rows (Q/W/E/R) x 6 levels grid. Parses entry names like "L3 W".
const SKILLS = ['Q', 'W', 'E', 'R'] as const;
const LEVELS = [1, 2, 3, 4, 5, 6];

interface Cell {
  level: number;
  skill: string;
  entry: Entry;
}

function parseSkillName(name: string): { level: number; skill: string } | null {
  const m = name.match(/L\s*(\d+)\s*([QWER])/i);
  if (!m) return null;
  return { level: parseInt(m[1], 10), skill: m[2].toUpperCase() };
}

export function SkillEarly({ section }: { section: Section }) {
  const { grid, recommended } = useMemo(() => {
    const grid = new Map<string, Cell>();
    // recommended = best-scoring skill at each level
    const byLevel = new Map<number, Cell>();
    for (const entry of section.entries) {
      const parsed = parseSkillName(entry.name);
      if (!parsed) continue;
      const cell: Cell = { ...parsed, entry };
      grid.set(`${parsed.level}-${parsed.skill}`, cell);
      const cur = byLevel.get(parsed.level);
      if (!cur || entry.score > cur.entry.score) byLevel.set(parsed.level, cell);
    }
    return { grid, recommended: byLevel };
  }, [section]);

  if (grid.size === 0) {
    return (
      <div className="rounded-md border border-dashed border-neutral-800 px-3 py-4 text-center text-[11px] text-neutral-600">
        No early skill data
      </div>
    );
  }

  const sequence = LEVELS.map((l) => recommended.get(l)?.skill ?? '·').join(' ');

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-[11px] text-neutral-400">
        <span className="uppercase tracking-wide text-neutral-500">Recommended order</span>
        <span className="flex gap-1">
          {LEVELS.map((l) => {
            const s = recommended.get(l)?.skill;
            return (
              <span
                key={l}
                className="grid h-5 w-5 place-items-center rounded text-[11px] font-bold text-neutral-900"
                style={{ background: s ? '#7ea4f4' : '#3f3f46', color: s ? '#0a0a0a' : '#71717a' }}
              >
                {s ?? '·'}
              </span>
            );
          })}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[280px] border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="w-6" />
              {LEVELS.map((l) => (
                <th key={l} className="text-center text-[10px] font-medium text-neutral-500">
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SKILLS.map((skill) => (
              <tr key={skill}>
                <td className="text-center text-[11px] font-bold text-neutral-400">{skill}</td>
                {LEVELS.map((level) => {
                  const cell = grid.get(`${level}-${skill}`);
                  const isRec = recommended.get(level)?.skill === skill;
                  if (!cell) {
                    return <td key={level} className="h-8 rounded bg-neutral-900/30" />;
                  }
                  return (
                    <td key={level} className="p-0">
                      <div
                        className={`group relative grid h-8 cursor-default place-items-center rounded text-[10px] font-semibold tabular-nums transition ${
                          isRec ? 'ring-1' : ''
                        }`}
                        style={{
                          background: scoreTint(cell.entry.score, isRec ? 0.28 : 0.12),
                          color: scoreColor(cell.entry.score),
                          // ring color via boxShadow to keep it inline
                          boxShadow: isRec ? `inset 0 0 0 1px ${scoreColor(cell.entry.score)}` : undefined,
                        }}
                        title={`L${level} ${skill}\nScore ${signedPct(cell.entry.score)} · WR ${pct(
                          cell.entry.combined_wr,
                        )} · n=${compactN(cell.entry.total_n_max)}`}
                      >
                        {signedPct(cell.entry.score, 1).replace('%', '')}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-neutral-600">
        Cells show score (signed pp). Outlined cell = best skill at that level. Sequence: {sequence}
      </p>
    </div>
  );
}
