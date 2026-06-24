import { useState } from 'react';
import { BookOpen, ChevronDown } from 'lucide-react';

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: 'Why the current display is weak',
    body: (
      <ul className="list-disc space-y-1 pl-4">
        <li>The first viewport is a flat stack of section headings, not a decision. In champ select the user has seconds.</li>
        <li>Results are grouped by data source (section) instead of by the user’s real decision sequence (summoners → runes → starter → skills → build).</li>
        <li>Build progression is split into many sibling sections that never read as one path.</li>
        <li>Rich <code>per_matchup</code> evidence — the whole reason this is matchup-aware — is mostly hidden.</li>
        <li>Repeated labels (Score / Base / Combined / N / WR / PR) all compete; nothing is the headline.</li>
        <li>State + warning messages use large uppercase text that dominates the panel.</li>
      </ul>
    ),
  },
  {
    title: 'Three alternatives considered',
    body: (
      <ol className="list-decimal space-y-1.5 pl-4">
        <li>
          <b>Decision Phases (chosen).</b> A hero strip of the fastest picks, then Now / Build path / Adaptations / Details tabs.
          Build path is one connected, numbered rail with expandable matchup deltas. Best fit for champ select speed + progressive disclosure.
        </li>
        <li>
          <b>Single timeline.</b> One vertical “game timeline” from level 1 to full build. Elegant but forces scrolling and mixes pre-game and late decisions.
        </li>
        <li>
          <b>Matchup-first matrix.</b> Items × enemy-slot delta heatmap up top. Powerful for analysts but buries the simple “what do I take” question and is wide-table heavy on mobile.
        </li>
      </ol>
    ),
  },
  {
    title: 'Key rules honored',
    body: (
      <ul className="list-disc space-y-1 pl-4">
        <li>Metrics are decimals: 0.527 → 52.7%, 0.034 → +3.4%. Signed pp for score/deltas, 1 decimal.</li>
        <li><code>winning_items</code> headlines <b>combined_wr</b>, sorted by it; everything else headlines score.</li>
        <li><code>rune_page</code> encoded/prose names are parsed into path/keystone/runes/shards — never shown raw.</li>
        <li><code>skill_early</code> is a stable 4×6 board, not a truncated list; missing cells stay blank.</li>
        <li>Direct <b>lane</b> matchup is emphasized (red diamond) over contextual slots; low/missing samples flagged.</li>
        <li><code>total_n_max</code> shown as a max (n=), never summed. Null per-matchup slots render as muted bars.</li>
        <li>Unknown sections degrade to a generic ranked table. Empty/partial/loading/error states preserve layout and never hide the native tables.</li>
      </ul>
    ),
  },
];

export function DesignNotes() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md bg-[#191919] ring-1 ring-neutral-800/80">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <BookOpen className="h-4 w-4 text-neutral-400" />
        <span className="text-[12px] font-semibold uppercase tracking-wide text-neutral-200">
          Design rationale
        </span>
        <span className="text-[11px] text-neutral-500">why this layout</span>
        <ChevronDown className={`ml-auto h-4 w-4 text-neutral-500 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t border-neutral-800 p-3 text-[12px] leading-relaxed text-neutral-400">
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h4 className="mb-1 text-[12px] font-semibold text-neutral-200">{s.title}</h4>
              {s.body}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
