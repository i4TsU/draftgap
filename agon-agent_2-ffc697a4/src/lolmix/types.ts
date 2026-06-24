// Type definitions for the lolmix analyze response (schema_version 1)

export type Slot = 'lane' | 'top' | 'jungle' | 'middle' | 'bottom' | 'support';

export interface PerMatchupRaw {
  id: number;
  name: string;
  wr: number;
  pr: number;
  delta1: number;
  delta2: number;
  n: number;
}

export interface Entry {
  id: number;
  name: string;
  section: string;
  score: number;
  overall_wr: number;
  overall_pr: number;
  overall_delta: number;
  overall_n: number;
  combined_wr: number;
  combined_pr: number;
  min_delta: number;
  max_delta: number;
  total_n_max: number;
  per_matchup: Partial<Record<Slot, PerMatchupRaw | null>>;
}

export interface Section {
  name: string;
  entries: Entry[];
}

export interface Enemy {
  champion_id?: number;
  champion_name?: string;
  lane: string;
  slot: Slot;
}

export interface Warning {
  slot?: string;
  enemy_name?: string;
  error_type?: string;
  message: string;
}

export interface Analysis {
  schema_version: number;
  champion_id: number;
  champion_name: string;
  lane: string;
  patch: string;
  tier: string;
  queue: number;
  region: string;
  top_n: number | null;
  sections_requested: string[] | null;
  sections_returned: string[];
  enemies: Enemy[];
  warnings: Warning[];
  sections: Section[];
}

// UI request/response states
export type LolmixState =
  | 'not-configured'
  | 'invalid-draft'
  | 'idle'
  | 'loading'
  | 'unavailable'
  | 'validation-error'
  | 'unexpected-error'
  | 'success';

// Decision groups in priority order
export type DecisionGroup = 'now' | 'core' | 'matchup' | 'details';
