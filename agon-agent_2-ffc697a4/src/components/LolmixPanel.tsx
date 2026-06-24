import { useMemo, useState } from 'react';
import type { Analysis, LolmixState, DecisionGroup, Section } from '../lolmix/types';
import { groupSections, getSection, metaFor } from '../lolmix/transform';
import { laneToLabel } from '../lolmix/format';
import { Warnings } from './Warnings';
import { LoadingState, NonSuccessState } from './StateViews';
import { QuickDecisions } from './QuickDecisions';
import { PanelSection } from './PanelSection';
import { Summoners } from './Summoners';
import { RuneBoard } from './RuneBoard';
import { SkillEarly } from './SkillEarly';
import { SkillOrder } from './SkillOrder';
import { BuildPath } from './BuildPath';
import { FullBuild } from './FullBuild';
import { WinningItems } from './WinningItems';
import { GenericSection } from './GenericSection';
import { RefreshCw, Swords } from 'lucide-react';

const PHASES: { id: DecisionGroup; label: string; kicker: string }[] = [
  { id: 'now', label: 'Now', kicker: 'Pick this' },
  { id: 'core', label: 'Build path', kicker: 'Buy in order' },
  { id: 'matchup', label: 'Adaptations', kicker: 'vs this draft' },
  { id: 'details', label: 'Details', kicker: 'Drill down' },
];

export function LolmixPanel({
  analysis,
  state,
  onRefresh,
}: {
  analysis: Analysis | null;
  state: LolmixState;
  onRefresh?: () => void;
}) {
  const [phase, setPhase] = useState<DecisionGroup>('now');

  const grouped = useMemo(() => (analysis ? groupSections(analysis) : null), [analysis]);

  const header = (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Swords className="h-4 w-4 text-blue-400" />
        <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-100">lolmix</h2>
        {analysis && (
          <span className="text-[11px] text-neutral-500">
            <span className="font-medium text-neutral-300">{analysis.champion_name}</span>{' '}
            {laneToLabel(analysis.lane)} · patch {analysis.patch} · {analysis.tier}
          </span>
        )}
      </div>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      )}
    </div>
  );

  // Non-success states
  if (state !== 'success' || !analysis || !grouped) {
    return (
      <div className="flex flex-col gap-3 rounded-md bg-[#101010] p-3 ring-1 ring-neutral-800">
        {header}
        {state === 'loading' ? <LoadingState /> : <NonSuccessState state={state} champ={analysis?.champion_name} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-[#101010] p-3 ring-1 ring-neutral-800">
      {header}

      <EnemyBar analysis={analysis} />

      {analysis.warnings.length > 0 && <Warnings warnings={analysis.warnings} />}

      {/* Hero: fastest decisions, always visible */}
      <QuickDecisions analysis={analysis} />

      {/* Phase tabs */}
      <div className="flex gap-1 rounded-md bg-neutral-900/60 p-1">
        {PHASES.map((p) => {
          const count = grouped[p.id].filter((s) => s.entries.length > 0).length;
          const disabled = count === 0;
          return (
            <button
              key={p.id}
              disabled={disabled}
              onClick={() => setPhase(p.id)}
              className={`flex flex-1 flex-col items-center rounded px-2 py-1.5 transition ${
                phase === p.id
                  ? 'bg-neutral-700 text-neutral-100'
                  : disabled
                  ? 'cursor-not-allowed text-neutral-700'
                  : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200'
              }`}
            >
              <span className="text-[12px] font-semibold">{p.label}</span>
              <span className="text-[9px] uppercase tracking-wider opacity-70">{p.kicker}</span>
            </button>
          );
        })}
      </div>

      {/* Phase content */}
      <PhaseContent analysis={analysis} phase={phase} sections={grouped[phase]} />
    </div>
  );
}

function EnemyBar({ analysis }: { analysis: Analysis }) {
  if (analysis.enemies.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-neutral-900/40 px-2.5 py-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">vs</span>
      {analysis.enemies.map((e) => {
        const isLane = e.slot === 'lane';
        return (
          <span
            key={`${e.slot}-${e.champion_id ?? e.champion_name}`}
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] ${
              isLane
                ? 'bg-red-500/15 font-medium text-red-200 ring-1 ring-red-500/40'
                : 'bg-neutral-800/60 text-neutral-300'
            }`}
          >
            {isLane && <span className="text-red-400">◆</span>}
            {e.champion_name ?? laneToLabel(e.lane)}
            <span className="text-[9px] uppercase text-neutral-500">{laneToLabel(e.slot)}</span>
          </span>
        );
      })}
      <span className="ml-auto text-[10px] text-neutral-600">◆ = direct lane matchup</span>
    </div>
  );
}

function PhaseContent({
  analysis,
  phase,
  sections,
}: {
  analysis: Analysis;
  phase: DecisionGroup;
  sections: Section[];
}) {
  const nonEmpty = sections.filter((s) => s.entries.length > 0);
  if (nonEmpty.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-neutral-800 px-3 py-6 text-center text-[12px] text-neutral-600">
        No data in this phase for the current draft.
      </div>
    );
  }

  // Core phase: render the unified build path + skill order + full build.
  if (phase === 'core') {
    const fullBuild = getSection(analysis, 'full_build');
    const skillOrder = getSection(analysis, 'skill_order');
    return (
      <div className="flex flex-col gap-3">
        <PanelSection title="Build path" kicker="Buy in order" headline="Top pick per step · expand for matchup deltas">
          <BuildPath analysis={analysis} sections={sections} />
        </PanelSection>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {skillOrder && skillOrder.entries.length > 0 && (
            <PanelSection title="Skill order" kicker="Max priority">
              <SkillOrder section={skillOrder} />
            </PanelSection>
          )}
          {fullBuild && fullBuild.entries.length > 0 && (
            <PanelSection title="Full build" kicker="Common sequences">
              <FullBuild section={fullBuild} />
            </PanelSection>
          )}
        </div>
      </div>
    );
  }

  // Now phase: 2-col responsive grid of pre-game decisions.
  if (phase === 'now') {
    return (
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {nonEmpty.map((section) => (
          <PanelSection
            key={section.name}
            title={metaFor(section.name).title}
            kicker="Pick this"
          >
            <SectionRenderer analysis={analysis} section={section} />
          </PanelSection>
        ))}
      </div>
    );
  }

  // Matchup + details: single column of bands.
  return (
    <div className="flex flex-col gap-3">
      {nonEmpty.map((section) => (
        <PanelSection
          key={section.name}
          title={metaFor(section.name).title}
          kicker={metaFor(section.name).group === 'matchup' ? 'vs this draft' : 'Drill down'}
          headline={metaFor(section.name).renderer === 'winningItems' ? 'Sorted by matchup win rate' : undefined}
        >
          <SectionRenderer analysis={analysis} section={section} />
        </PanelSection>
      ))}
    </div>
  );
}

function SectionRenderer({ analysis, section }: { analysis: Analysis; section: Section }) {
  const meta = metaFor(section.name);
  switch (meta.renderer) {
    case 'summoners':
      return <Summoners section={section} />;
    case 'runes':
      return <RuneBoard section={section} />;
    case 'skillEarly':
      return <SkillEarly section={section} />;
    case 'skillOrder':
      return <SkillOrder section={section} />;
    case 'pathStep':
      // standalone (e.g. starter in Now phase) — render as a small build path of one
      return <BuildPath analysis={analysis} sections={[section]} />;
    case 'fullBuild':
      return <FullBuild section={section} />;
    case 'winningItems':
      return <WinningItems analysis={analysis} section={section} />;
    default:
      return <GenericSection analysis={analysis} section={section} />;
  }
}
