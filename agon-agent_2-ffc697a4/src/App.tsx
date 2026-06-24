import { useEffect, useMemo, useState } from 'react';
import type { Analysis, LolmixState } from './lolmix/types';
import { STATE_OPTIONS } from './lolmix/demoStates';
import { LolmixPanel } from './components/LolmixPanel';
import { NativeBuildPlaceholder } from './components/NativeBuildPlaceholder';
import { DesignNotes } from './components/DesignNotes';
import { laneToLabel } from './lolmix/format';

export default function App() {
  const [raw, setRaw] = useState<Analysis | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [stateId, setStateId] = useState<string>('warnings');

  useEffect(() => {
    fetch('/sample_analysis.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: Analysis) => setRaw(d))
      .catch((e) => setErr(String(e)));
  }, []);

  const option = STATE_OPTIONS.find((o) => o.id === stateId) ?? STATE_OPTIONS[0];
  const state: LolmixState = option.state;

  const analysis = useMemo(() => {
    if (!raw) return null;
    if (state !== 'success') return raw;
    return option.transform ? option.transform(raw) : raw;
  }, [raw, option, state]);

  // Champion tabs mock: selected champ from analysis + a few enemies as opponent tabs.
  const champTabs = useMemo(() => {
    if (!raw) return [];
    const ally = { id: raw.champion_id, name: raw.champion_name, role: raw.lane, team: 'ally' as const };
    const opp = raw.enemies.slice(0, 4).map((e) => ({
      id: e.champion_id ?? 0,
      name: e.champion_name ?? laneToLabel(e.lane),
      role: e.lane,
      team: 'opp' as const,
    }));
    return [ally, ...opp];
  }, [raw]);

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-[#f4f4f4]">
      {/* Top app bar */}
      <header className="sticky top-0 z-20 border-b border-neutral-800 bg-[#101010]/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
          <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-blue-300">
            DraftGap
          </span>
          <nav className="flex gap-1 text-[12px]">
            {['Draft', 'Builds', 'Notes'].map((t) => (
              <span
                key={t}
                className={`rounded px-2 py-1 ${
                  t === 'Builds' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500'
                }`}
              >
                {t}
              </span>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <label className="text-[10px] uppercase tracking-wider text-neutral-600">Demo state</label>
            <select
              value={stateId}
              onChange={(e) => setStateId(e.target.value)}
              className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-[11px] text-neutral-200 outline-none focus:border-blue-500"
            >
              {STATE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4">
        {/* Champion tabs */}
        {champTabs.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {champTabs.map((c, i) => (
              <button
                key={`${c.team}-${c.id}-${i}`}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] transition ${
                  i === 0
                    ? 'bg-blue-500/15 text-blue-200 ring-1 ring-blue-500/40'
                    : 'bg-neutral-900/60 text-neutral-400 ring-1 ring-neutral-800 hover:text-neutral-200'
                }`}
              >
                <span
                  className="grid h-6 w-6 place-items-center rounded text-[10px] font-bold"
                  style={{
                    background: c.team === 'ally' ? 'rgba(59,130,246,0.25)' : 'rgba(239,68,68,0.2)',
                    color: c.team === 'ally' ? '#93c5fd' : '#fca5a5',
                  }}
                >
                  {c.name.slice(0, 2)}
                </span>
                <span className="font-medium">{c.name}</span>
                <span className="text-[9px] uppercase tracking-wider text-neutral-500">{laneToLabel(c.role)}</span>
              </button>
            ))}
            <span className="ml-1 text-[10px] text-neutral-600">selected champion drives the analysis below</span>
          </div>
        )}

        {err && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
            Failed to load sample data: {err}
          </div>
        )}

        {/* The improved lolmix panel */}
        <LolmixPanel analysis={analysis} state={state} onRefresh={() => setStateId('success')} />

        {/* Native DraftGap tables remain below, always */}
        <NativeBuildPlaceholder />

        <DesignNotes />

        <footer className="py-4 text-center text-[10px] text-neutral-700">
          lolmix Builds-tab redesign prototype · consumes a real schema_version 1 analysis · additive to DraftGap
        </footer>
      </main>
    </div>
  );
}
