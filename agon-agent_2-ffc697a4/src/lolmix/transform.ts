import type { Analysis, Entry, Section, Slot, DecisionGroup } from './types';

// Section metadata: title, decision group, headline metric, and renderer hint.
export interface SectionMeta {
  title: string;
  group: DecisionGroup;
  headline: 'score' | 'combined_wr';
  renderer:
    | 'summoners'
    | 'runes'
    | 'skillEarly'
    | 'skillOrder'
    | 'pathStep'
    | 'fullBuild'
    | 'winningItems'
    | 'generic';
  // rune detail sections are not shown as top-level; they enrich rune_page.
  detail?: boolean;
  order: number;
}

export const SECTION_META: Record<string, SectionMeta> = {
  summoners: { title: 'Summoners', group: 'now', headline: 'score', renderer: 'summoners', order: 10 },
  rune_page: { title: 'Rune Page', group: 'now', headline: 'combined_wr', renderer: 'runes', order: 20 },
  starters: { title: 'Starter', group: 'now', headline: 'score', renderer: 'pathStep', order: 30 },
  skill_early: { title: 'Early Skills', group: 'now', headline: 'score', renderer: 'skillEarly', order: 40 },

  first_completed_item: { title: 'First Item', group: 'core', headline: 'score', renderer: 'pathStep', order: 50 },
  boots: { title: 'Boots', group: 'core', headline: 'score', renderer: 'pathStep', order: 60 },
  second_item: { title: 'Second Item', group: 'core', headline: 'score', renderer: 'pathStep', order: 70 },
  third_item: { title: 'Third Item', group: 'core', headline: 'score', renderer: 'pathStep', order: 80 },
  fourth_item: { title: 'Fourth Item', group: 'core', headline: 'score', renderer: 'pathStep', order: 90 },
  skill_order: { title: 'Skill Order', group: 'core', headline: 'score', renderer: 'skillOrder', order: 95 },
  full_build: { title: 'Full Build', group: 'core', headline: 'score', renderer: 'fullBuild', order: 100 },

  winning_items: { title: 'Winning Items', group: 'matchup', headline: 'combined_wr', renderer: 'winningItems', order: 110 },

  keystones: { title: 'Keystones', group: 'details', headline: 'combined_wr', renderer: 'generic', detail: true, order: 200 },
  runes_primary: { title: 'Primary Runes', group: 'details', headline: 'combined_wr', renderer: 'generic', detail: true, order: 210 },
  runes_secondary: { title: 'Secondary Runes', group: 'details', headline: 'combined_wr', renderer: 'generic', detail: true, order: 220 },
  stat_shards: { title: 'Stat Shards', group: 'details', headline: 'combined_wr', renderer: 'generic', detail: true, order: 230 },
};

export function metaFor(sectionName: string): SectionMeta {
  return (
    SECTION_META[sectionName] ?? {
      title: titleCase(sectionName),
      group: 'details',
      headline: 'score',
      renderer: 'generic',
      order: 500,
    }
  );
}

export function titleCase(s: string): string {
  return s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const SLOT_ORDER: Slot[] = ['lane', 'top', 'jungle', 'middle', 'bottom', 'support'];

export function getSection(a: Analysis, name: string): Section | undefined {
  return a.sections.find((s) => s.name === name);
}

// Best entry by headline metric for a section (used for the "top pick" summary).
export function topEntry(section: Section | undefined, headline: 'score' | 'combined_wr' = 'score'): Entry | undefined {
  if (!section || section.entries.length === 0) return undefined;
  return [...section.entries].sort((a, b) => valueOf(b, headline) - valueOf(a, headline))[0];
}

export function valueOf(e: Entry, headline: 'score' | 'combined_wr'): number {
  return headline === 'combined_wr' ? e.combined_wr : e.score;
}

export function sortedEntries(section: Section, headline: 'score' | 'combined_wr'): Entry[] {
  return [...section.entries].sort((a, b) => valueOf(b, headline) - valueOf(a, headline));
}

// The direct-lane per-matchup slot for an entry (most prominent context).
export function laneMatchup(e: Entry) {
  return e.per_matchup?.lane ?? null;
}

// Active slots present on an entry (non-null), in canonical order.
export function activeSlots(e: Entry): Slot[] {
  return SLOT_ORDER.filter((s) => e.per_matchup?.[s] != null);
}

// Build an enemy lookup by slot for labeling.
export function enemyBySlot(a: Analysis): Partial<Record<Slot, Analysis['enemies'][number]>> {
  const map: Partial<Record<Slot, Analysis['enemies'][number]>> = {};
  for (const e of a.enemies) map[e.slot] = e;
  return map;
}

// Group present sections by decision group, preserving response order within group.
export interface GroupedSections {
  now: Section[];
  core: Section[];
  matchup: Section[];
  details: Section[];
}

export function groupSections(a: Analysis): GroupedSections {
  const result: GroupedSections = { now: [], core: [], matchup: [], details: [] };
  // Respect response order (sections_returned) but bucket by group.
  const order = a.sections_returned.length ? a.sections_returned : a.sections.map((s) => s.name);
  const seen = new Set<string>();
  for (const name of order) {
    const section = getSection(a, name);
    if (!section) continue;
    seen.add(name);
    const meta = metaFor(name);
    result[meta.group].push(section);
  }
  // include any sections not in sections_returned
  for (const section of a.sections) {
    if (seen.has(section.name)) continue;
    result[metaFor(section.name).group].push(section);
  }
  // sort each group by meta.order for a stable build-flow reading order
  (Object.keys(result) as (keyof GroupedSections)[]).forEach((k) => {
    result[k].sort((x, y) => metaFor(x.name).order - metaFor(y.name).order);
  });
  return result;
}

// Worst (most negative) lane delta across an entry's matchup — a quick danger flag.
export function laneDelta(e: Entry): number | null {
  const lane = e.per_matchup?.lane;
  return lane ? lane.delta1 : null;
}
