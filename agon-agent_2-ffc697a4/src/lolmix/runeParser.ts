// Parses lolmix rune_page entry names into a human-readable structure.
//
// The contract documents an encoded "rune_page:v2" key that must be parsed and
// never shown raw. The real sample, however, ships a structured prose form like:
//   "Most Picked Rune Page: Precision \u2014 Lethal Tempo + Absorb Life + Legend: Alacrity
//    + Last Stand | Resolve \u2014 Overgrowth + Second Wind | Shards: Attack Speed /
//    Adaptive Force / Health Scaling"
//
// This parser handles BOTH forms and always returns a normalized RunePage so the
// UI never renders an opaque key.

export interface RunePage {
  kind: string | null; // e.g. "Most Picked", "Highest Win", or null
  primaryPath: string | null;
  primaryRunes: string[];
  secondaryPath: string | null;
  secondaryRunes: string[];
  shards: string[];
  // keystone is the first primary rune when a path is present
  keystone: string | null;
  raw: string;
}

const EM_DASH = '\u2014';

function cleanPathSegment(seg: string): { path: string | null; runes: string[] } {
  // "Precision \u2014 Lethal Tempo + Absorb Life + Legend: Alacrity + Last Stand"
  const parts = seg.split(EM_DASH);
  if (parts.length >= 2) {
    const path = parts[0].trim();
    const runes = parts
      .slice(1)
      .join(EM_DASH)
      .split('+')
      .map((r) => r.trim())
      .filter(Boolean);
    return { path, runes };
  }
  // fallback: maybe a regular hyphen
  const hy = seg.split(' - ');
  if (hy.length >= 2) {
    return {
      path: hy[0].trim(),
      runes: hy.slice(1).join(' - ').split('+').map((r) => r.trim()).filter(Boolean),
    };
  }
  return { path: seg.trim() || null, runes: [] };
}

export function parseRunePage(name: string): RunePage {
  const fallback: RunePage = {
    kind: null,
    primaryPath: null,
    primaryRunes: [],
    secondaryPath: null,
    secondaryRunes: [],
    shards: [],
    keystone: null,
    raw: name,
  };
  if (!name) return fallback;

  let working = name;
  let kind: string | null = null;

  // strip a leading "... Rune Page:" label as the kind
  const kindMatch = working.match(/^(.*?)\s*Rune Page:\s*/i);
  if (kindMatch) {
    kind = kindMatch[1].trim() || null;
    working = working.slice(kindMatch[0].length);
  }

  // Encoded form guard: if it still looks like an opaque key, don't expose it raw.
  // e.g. "rune_page:v2:8000:8100:..." — we degrade to kind only.
  if (/rune_page:v\d/i.test(working) || /^[0-9:|_-]+$/.test(working.trim())) {
    return { ...fallback, kind };
  }

  // Split shards off the end: "... | Shards: a / b / c"
  let shards: string[] = [];
  const shardSplit = working.split(/\|\s*Shards:/i);
  if (shardSplit.length === 2) {
    shards = shardSplit[1]
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean);
    working = shardSplit[0];
  }

  // Remaining pipes separate primary | secondary path groups
  const groups = working.split('|').map((g) => g.trim()).filter(Boolean);
  const primary = groups[0] ? cleanPathSegment(groups[0]) : { path: null, runes: [] };
  const secondary = groups[1] ? cleanPathSegment(groups[1]) : { path: null, runes: [] };

  return {
    kind,
    primaryPath: primary.path,
    primaryRunes: primary.runes,
    secondaryPath: secondary.path,
    secondaryRunes: secondary.runes,
    shards,
    keystone: primary.runes[0] ?? null,
    raw: name,
  };
}

// Map a League rune path name to a representative color.
export function runePathColor(path: string | null): string {
  if (!path) return '#9ca3af';
  const p = path.toLowerCase();
  if (p.includes('precision')) return '#c8aa6e';
  if (p.includes('domination')) return '#d44242';
  if (p.includes('sorcery')) return '#9faafc';
  if (p.includes('resolve')) return '#a1d586';
  if (p.includes('inspiration')) return '#49aab9';
  return '#9ca3af';
}
