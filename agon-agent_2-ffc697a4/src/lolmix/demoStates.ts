import type { Analysis, LolmixState } from './types';

// Derive alternate demo analyses from the real one to exercise edge cases
// without hard-coding the sample champion / enemies / sections.
export function withWarnings(a: Analysis): Analysis {
  return {
    ...a,
    warnings: [
      {
        slot: 'jungle',
        enemy_name: a.enemies.find((e) => e.slot === 'jungle')?.champion_name,
        error_type: 'low_sample',
        message: 'Low sample for the jungle matchup page; contextual deltas may be noisy.',
      },
      {
        error_type: 'partial_fetch',
        message: 'One rune detail page failed to load. Rune board falls back to base stats.',
      },
    ],
  };
}

// Empty + missing sections variant: drop most sections, empty one.
export function partialData(a: Analysis): Analysis {
  const keep = new Set(['summoners', 'starters', 'winning_items']);
  const sections = a.sections
    .filter((s) => keep.has(s.name))
    .map((s) => (s.name === 'winning_items' ? { ...s, entries: [] } : s));
  return {
    ...a,
    sections_returned: sections.map((s) => s.name),
    sections,
    warnings: [
      { error_type: 'partial_sections', message: 'lolmix returned a partial result. Some build sections are unavailable.' },
    ],
  };
}

// Fewer than 5 enemies (only lane + support locked).
export function fewEnemies(a: Analysis): Analysis {
  const enemies = a.enemies.filter((e) => e.slot === 'lane' || e.slot === 'support');
  const keepSlots = new Set(enemies.map((e) => e.slot));
  const sections = a.sections.map((s) => ({
    ...s,
    entries: s.entries.map((e) => {
      const per_matchup: typeof e.per_matchup = {};
      for (const [slot, v] of Object.entries(e.per_matchup)) {
        if (keepSlots.has(slot as never)) per_matchup[slot as never] = v as never;
      }
      return { ...e, per_matchup };
    }),
  }));
  return { ...a, enemies, sections };
}

// Unknown future section.
export function withUnknownSection(a: Analysis): Analysis {
  const sample = a.sections[0]?.entries.slice(0, 4) ?? [];
  const unknown = {
    name: 'jungle_path_v2',
    entries: sample.map((e) => ({ ...e, section: 'jungle_path_v2' })),
  };
  return {
    ...a,
    sections_returned: [...a.sections_returned, 'jungle_path_v2'],
    sections: [...a.sections, unknown],
  };
}

export interface StateOption {
  id: string;
  label: string;
  state: LolmixState;
  transform?: (a: Analysis) => Analysis;
  message?: string;
}

export const STATE_OPTIONS: StateOption[] = [
  { id: 'success', label: 'Success', state: 'success' },
  { id: 'warnings', label: 'Success + warnings', state: 'success', transform: withWarnings },
  { id: 'partial', label: 'Partial / empty sections', state: 'success', transform: partialData },
  { id: 'few', label: '< 5 enemies', state: 'success', transform: fewEnemies },
  { id: 'unknown', label: 'Unknown section', state: 'success', transform: withUnknownSection },
  { id: 'loading', label: 'Loading', state: 'loading' },
  { id: 'not-configured', label: 'Not configured', state: 'not-configured' },
  { id: 'unavailable', label: 'Server unavailable', state: 'unavailable' },
  { id: 'invalid-draft', label: 'Invalid draft', state: 'invalid-draft' },
  { id: 'validation-error', label: 'Validation error', state: 'validation-error' },
  { id: 'unexpected-error', label: 'Unexpected error', state: 'unexpected-error' },
  { id: 'idle', label: 'Idle', state: 'idle' },
];
