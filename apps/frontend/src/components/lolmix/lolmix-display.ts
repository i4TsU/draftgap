import type {
    LolmixAnalyzeResponse,
    LolmixRecommendationEntry,
    LolmixRecommendationSection,
} from "../../api/lolmix-api";

export type LolmixDecisionPhase = "now" | "core" | "matchup" | "details";

export type LolmixHeadlineMetric = "score" | "combined_wr";
export type LolmixRunePageKind = "pick" | "win" | "optimal";
type LolmixCompletedItemSection =
    | "first_completed_item"
    | "second_item"
    | "third_item"
    | "fourth_item";
type LolmixSectionRenderer =
    | "summoners"
    | "runes"
    | "skillEarly"
    | "skillOrder"
    | "pathStep"
    | "fullBuild"
    | "winningItems"
    | "generic";

export type LolmixSectionMeta = {
    title: string;
    phase: LolmixDecisionPhase;
    headline: LolmixHeadlineMetric;
    renderer: LolmixSectionRenderer;
    order: number;
};

export const LOLMIX_SECTION_META: Record<string, LolmixSectionMeta> = {
    summoners: {
        title: "Summoners",
        phase: "now",
        headline: "score",
        renderer: "summoners",
        order: 10,
    },
    rune_page: {
        title: "Rune Page",
        phase: "now",
        headline: "combined_wr",
        renderer: "runes",
        order: 20,
    },
    starters: {
        title: "Starter",
        phase: "now",
        headline: "score",
        renderer: "pathStep",
        order: 30,
    },
    skill_early: {
        title: "Early Skills",
        phase: "now",
        headline: "score",
        renderer: "skillEarly",
        order: 40,
    },
    first_completed_item: {
        title: "First Item",
        phase: "core",
        headline: "score",
        renderer: "pathStep",
        order: 50,
    },
    boots: {
        title: "Boots",
        phase: "core",
        headline: "score",
        renderer: "pathStep",
        order: 60,
    },
    second_item: {
        title: "Second Item",
        phase: "core",
        headline: "score",
        renderer: "pathStep",
        order: 70,
    },
    third_item: {
        title: "Third Item",
        phase: "core",
        headline: "score",
        renderer: "pathStep",
        order: 80,
    },
    fourth_item: {
        title: "Fourth Item",
        phase: "core",
        headline: "score",
        renderer: "pathStep",
        order: 90,
    },
    skill_order: {
        title: "Skill Order",
        phase: "core",
        headline: "score",
        renderer: "skillOrder",
        order: 95,
    },
    full_build: {
        title: "Full Build",
        phase: "core",
        headline: "score",
        renderer: "fullBuild",
        order: 100,
    },
    winning_items: {
        title: "Winning Items",
        phase: "matchup",
        headline: "combined_wr",
        renderer: "winningItems",
        order: 110,
    },
};

export const LOLMIX_SECTION_TITLES = Object.fromEntries(
    Object.entries(LOLMIX_SECTION_META).map(([name, meta]) => [
        name,
        meta.title,
    ]),
) as Record<string, string>;

const LOLMIX_BACKING_RUNE_SECTIONS = new Set([
    "keystones",
    "runes_primary",
    "runes_secondary",
    "stat_shards",
]);

export const LOLMIX_MIN_RECOMMENDED_PICK_RATE = 0.0001;
export const LOLMIX_VIABLE_PICK_RATE_RATIO = 0.1;
export const LOLMIX_MAX_COLLAPSED_VIABLE_ENTRIES = 4;
export const LOLMIX_BUILD_PICK_CONFIDENCE_WEIGHT = 0.2;

export const LOLMIX_COMPLETED_ITEM_SECTIONS = [
    "first_completed_item",
    "second_item",
    "third_item",
    "fourth_item",
] as const satisfies readonly LolmixCompletedItemSection[];

export const LOLMIX_PHASES: {
    id: LolmixDecisionPhase;
    label: string;
    kicker: string;
}[] = [
    { id: "now", label: "Now", kicker: "Pick this" },
    { id: "core", label: "Build path", kicker: "Buy in order" },
    { id: "matchup", label: "Adaptations", kicker: "Vs this draft" },
    { id: "details", label: "Details", kicker: "Drill down" },
];

export const LOLMIX_SKILL_EARLY_LEVELS = [1, 2, 3, 4, 5, 6] as const;
export const LOLMIX_SKILL_EARLY_SLOTS = ["Q", "W", "E", "R"] as const;
export const LOLMIX_MATCHUP_SLOT_ORDER = [
    "lane",
    "top",
    "jungle",
    "middle",
    "bottom",
    "support",
] as const;

export type LolmixSkillEarlySlot = (typeof LOLMIX_SKILL_EARLY_SLOTS)[number];
export type LolmixMatchupSlot = (typeof LOLMIX_MATCHUP_SLOT_ORDER)[number];

export type LolmixDisplayEntry = {
    entry: LolmixRecommendationEntry;
    recommended: boolean;
    viable: boolean;
    rare: boolean;
};

export type LolmixRunePageMetrics = {
    mode: "optimal" | "observed";
    headlineLabel: "Score" | "Win Rate";
    headlineValue: string;
    headlineClass: string;
    summary: string;
};

export type LolmixBuildPathStep = {
    section: LolmixRecommendationSection;
    recommended: LolmixRecommendationEntry | undefined;
    collapsedEntries: LolmixDisplayEntry[];
    expandedEntries: LolmixDisplayEntry[];
};

export type LolmixGroupedSections = Record<
    LolmixDecisionPhase,
    LolmixRecommendationSection[]
>;

export type LolmixRunePage = {
    kind: LolmixRunePageKind | undefined;
    primaryPath: number | undefined;
    secondaryPath: number | undefined;
    primary: number[];
    secondary: number[];
    shards: number[];
};

export type LolmixReadableRunePage = {
    kind: string | undefined;
    primaryPathName: string | undefined;
    secondaryPathName: string | undefined;
    primaryRunes: string[];
    secondaryRunes: string[];
    shards: string[];
    keystone: string | undefined;
    raw: string;
    encoded: boolean;
};

export function lolmixSectionTitle(sectionName: string) {
    return LOLMIX_SECTION_TITLES[sectionName] ?? titleCase(sectionName);
}

export function lolmixSectionMeta(sectionName: string): LolmixSectionMeta {
    return (
        LOLMIX_SECTION_META[sectionName] ?? {
            title: titleCase(sectionName),
            phase: "details",
            headline: "score",
            renderer: "generic",
            order: 500,
        }
    );
}

export function visibleLolmixSections(data: LolmixAnalyzeResponse) {
    return data.sections.filter(
        (section) =>
            section.entries.length > 0 &&
            !LOLMIX_BACKING_RUNE_SECTIONS.has(section.name),
    );
}

export function visibleLolmixEntries(section: LolmixRecommendationSection) {
    return section.entries;
}

export function isLolmixRecommendationEligible(
    entry: LolmixRecommendationEntry,
) {
    return entry.combined_pr >= LOLMIX_MIN_RECOMMENDED_PICK_RATE;
}

export function groupLolmixSections(
    data: LolmixAnalyzeResponse,
): LolmixGroupedSections {
    const grouped: LolmixGroupedSections = {
        now: [],
        core: [],
        matchup: [],
        details: [],
    };
    const byName = new Map(
        data.sections.map((section) => [section.name, section]),
    );
    const orderedNames =
        data.sections_returned.length > 0
            ? data.sections_returned
            : data.sections.map((section) => section.name);
    const seen = new Set<string>();

    for (const name of orderedNames) {
        const section = byName.get(name);
        if (!section || !isTopLevelSection(section)) continue;

        seen.add(section.name);
        grouped[lolmixSectionMeta(section.name).phase].push(section);
    }

    for (const section of data.sections) {
        if (seen.has(section.name) || !isTopLevelSection(section)) continue;

        grouped[lolmixSectionMeta(section.name).phase].push(section);
    }

    for (const phase of LOLMIX_PHASES) {
        grouped[phase.id].sort(
            (left, right) =>
                lolmixSectionMeta(left.name).order -
                lolmixSectionMeta(right.name).order,
        );
    }

    return grouped;
}

export function lolmixTopEntry(
    section: LolmixRecommendationSection | undefined,
    headline?: LolmixHeadlineMetric,
) {
    if (!section || section.entries.length === 0) return;

    return (
        lolmixRecommendedEntry(section, headline) ??
        sortedLolmixEntries(section, headline)[0]
    );
}

export function lolmixRunePageHeadline(
    section: LolmixRecommendationSection | undefined,
): LolmixHeadlineMetric {
    return section?.entries.some(isLolmixOptimalRunePage)
        ? "score"
        : "combined_wr";
}

export function lolmixRunePageRecommendedEntry(
    section: LolmixRecommendationSection | undefined,
) {
    return lolmixRecommendedEntry(section, lolmixRunePageHeadline(section));
}

export function lolmixRunePageDisplayEntries(
    section: LolmixRecommendationSection,
) {
    return lolmixDisplayEntries(section, {
        headline: lolmixRunePageHeadline(section),
    });
}

export function sortedLolmixEntries(
    section: LolmixRecommendationSection,
    headline: LolmixHeadlineMetric = lolmixSectionMeta(section.name).headline,
) {
    return [...section.entries].sort(
        (left, right) =>
            lolmixEntryValue(right, headline) -
                lolmixEntryValue(left, headline) ||
            right.total_n_max - left.total_n_max ||
            right.combined_pr - left.combined_pr,
    );
}

export function lolmixRecommendedEntry(
    section: LolmixRecommendationSection | undefined,
    headline?: LolmixHeadlineMetric,
) {
    if (!section) return;

    return sortedLolmixEntries(section, headline).find(
        isLolmixRecommendationEligible,
    );
}

export function lolmixViableEntries(
    section: LolmixRecommendationSection,
    options: {
        headline?: LolmixHeadlineMetric;
        maxEntries?: number;
        excludedIds?: ReadonlySet<number>;
    } = {},
) {
    const eligible = sortedLolmixEntries(section, options.headline).filter(
        (entry) =>
            isLolmixRecommendationEligible(entry) &&
            !options.excludedIds?.has(entry.id),
    );
    if (eligible.length === 0) return [];

    const maxPickRate = Math.max(...eligible.map((entry) => entry.combined_pr));
    const threshold = maxPickRate * LOLMIX_VIABLE_PICK_RATE_RATIO;
    const maxEntries =
        options.maxEntries ?? LOLMIX_MAX_COLLAPSED_VIABLE_ENTRIES;

    return eligible
        .filter((entry) => entry.combined_pr >= threshold)
        .slice(0, maxEntries);
}

export function lolmixDisplayEntries(
    section: LolmixRecommendationSection,
    options: {
        headline?: LolmixHeadlineMetric;
        recommended?: LolmixRecommendationEntry;
        collapsedEntries?: readonly LolmixRecommendationEntry[];
    } = {},
) {
    const recommended =
        options.recommended ??
        lolmixRecommendedEntry(section, options.headline);
    const collapsed =
        options.collapsedEntries ??
        lolmixViableEntries(section, { headline: options.headline });
    const collapsedIds = new Set(collapsed.map((entry) => entry.id));

    return sortedLolmixEntries(section, options.headline).map((entry) => ({
        entry,
        recommended: recommended?.id === entry.id,
        viable: collapsedIds.has(entry.id),
        rare: !isLolmixRecommendationEligible(entry),
    }));
}

export function lolmixCollapsedDisplayEntries(
    section: LolmixRecommendationSection,
    options: {
        headline?: LolmixHeadlineMetric;
        recommended?: LolmixRecommendationEntry;
        excludedIds?: ReadonlySet<number>;
    } = {},
) {
    const recommended =
        options.recommended ??
        lolmixRecommendedEntry(section, options.headline);
    const collapsed = lolmixViableEntries(section, {
        headline: options.headline,
        excludedIds: options.excludedIds,
    });
    const entries = recommended
        ? [
              recommended,
              ...collapsed.filter((entry) => entry.id !== recommended.id),
          ].slice(0, LOLMIX_MAX_COLLAPSED_VIABLE_ENTRIES)
        : collapsed;
    const fallbackEntries =
        entries.length > 0
            ? entries
            : sortedLolmixEntries(section, options.headline).slice(
                  0,
                  LOLMIX_MAX_COLLAPSED_VIABLE_ENTRIES,
              );

    return lolmixDisplayEntries(section, {
        headline: options.headline,
        recommended,
        collapsedEntries: fallbackEntries,
    }).filter((item) =>
        fallbackEntries.some((entry) => entry.id === item.entry.id),
    );
}

export function lolmixBuildPathSteps(
    sections: LolmixRecommendationSection[],
): LolmixBuildPathStep[] {
    const completedSelections = lolmixOptimizedCompletedItemPath(sections);
    const usedCompletedIds = new Set<number>();

    return sections
        .filter(
            (section) =>
                lolmixSectionMeta(section.name).renderer === "pathStep",
        )
        .map((section) => {
            const completed = isCompletedItemSection(section.name);
            const recommended = completed
                ? completedSelections.get(section.name)
                : lolmixRecommendedEntry(section);
            const excludedIds = completed
                ? new Set(usedCompletedIds)
                : undefined;
            const collapsedEntries = lolmixCollapsedDisplayEntries(section, {
                recommended,
                excludedIds,
            });
            const expandedEntries = lolmixDisplayEntries(section, {
                recommended,
            });

            if (completed && recommended) {
                usedCompletedIds.add(recommended.id);
            }

            return {
                section,
                recommended,
                collapsedEntries,
                expandedEntries,
            };
        });
}

export function lolmixHeadlineMetric(
    sectionName: string,
    entry: LolmixRecommendationEntry,
) {
    if (sectionName === "rune_page") {
        const metrics = lolmixRunePageMetrics(entry);
        return {
            label: metrics.headlineLabel,
            value: metrics.headlineValue,
            class: metrics.headlineClass,
        };
    }

    if (lolmixSectionMeta(sectionName).headline === "combined_wr") {
        return {
            label: "Combined WR",
            value: formatLolmixPercent(entry.combined_wr),
            class: lolmixWinrateClass(entry.combined_wr),
        };
    }

    return {
        label: "Score",
        value: formatLolmixSignedPercent(entry.score),
        class: lolmixScoreClass(entry.score),
    };
}

export function lolmixScoreClass(value: number) {
    if (value >= 0.08) return "text-winrate-volxd";
    if (value >= 0.03) return "text-winrate-great";
    if (value >= 0.005) return "text-winrate-good";
    if (value > -0.005) return "text-winrate-okay";
    if (value > -0.03) return "text-winrate-meh";
    return "text-winrate-shiggo";
}

export function lolmixScoreToneClass(value: number) {
    if (value >= 0.03) return "bg-winrate-great/10 border-winrate-great/30";
    if (value >= 0.005) return "bg-winrate-good/10 border-winrate-good/30";
    if (value > -0.005) return "bg-neutral-800/60 border-neutral-700";
    if (value > -0.03) return "bg-winrate-meh/10 border-winrate-meh/30";
    return "bg-winrate-shiggo/10 border-winrate-shiggo/30";
}

export function lolmixWinrateTextClass(value: number) {
    return lolmixWinrateClass(value);
}

export function lolmixSampleSize(entry: LolmixRecommendationEntry) {
    return Math.max(entry.overall_n, entry.total_n_max);
}

export function lolmixSampleConfidence(value: number | undefined) {
    if (value === undefined) return "tiny";
    if (value >= 50000) return "high";
    if (value >= 5000) return "medium";
    if (value >= 500) return "low";
    return "tiny";
}

export function formatLolmixPercent(value: number) {
    return `${(value * 100).toFixed(1)}%`;
}

export function formatLolmixSignedPercent(value: number) {
    const formatted = formatLolmixPercent(Math.abs(value));
    if (value > 0) return `+${formatted}`;
    if (value < 0) return `-${formatted}`;
    return formatted;
}

export function formatLolmixCount(value: number) {
    return Math.round(value).toLocaleString();
}

export function formatLolmixCompactCount(value: number | undefined) {
    if (value === undefined || Number.isNaN(value)) return "0";
    if (value < 1000) return String(Math.round(value));
    if (value < 1000000) {
        return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)}k`;
    }
    return `${(value / 1000000).toFixed(1)}m`;
}

export function lolmixRunePageMetrics(
    entry: LolmixRecommendationEntry,
): LolmixRunePageMetrics {
    if (isLolmixOptimalRunePage(entry)) {
        return {
            mode: "optimal",
            headlineLabel: "Score",
            headlineValue: formatLolmixSignedPercent(entry.score),
            headlineClass: lolmixScoreClass(entry.score),
            summary: `Score ${formatLolmixSignedPercent(entry.score)} / Coverage ${formatLolmixPercent(entry.combined_pr)} / N ${formatLolmixCompactCount(entry.total_n_max)}`,
        };
    }

    return {
        mode: "observed",
        headlineLabel: "Win Rate",
        headlineValue: formatLolmixPercent(entry.combined_wr),
        headlineClass: lolmixWinrateClass(entry.combined_wr),
        summary: `WR ${formatLolmixPercent(entry.combined_wr)} / PR ${formatLolmixPercent(entry.combined_pr)}`,
    };
}

export function lolmixWarningLines(data: LolmixAnalyzeResponse) {
    return data.warnings.map(
        (warning) =>
            `${warning.enemy_name ?? warning.slot ?? "matchup"}: ${
                warning.message
            }`,
    );
}

export function lolmixUnavailableSetupHint(host: string, port: number) {
    return `lolmix-server is not reachable at ${host}:${port}. Install or sync lolmix, run uv run lolmix-server --host ${host} --port ${port}, then confirm DraftGap is configured for the same host and port.`;
}

export function lolmixSetupSteps(host: string, port: number) {
    return [
        "Install or sync lolmix in its project environment.",
        `Run uv run lolmix-server --host ${host} --port ${port}.`,
        `Confirm DraftGap is configured for ${host}:${port}.`,
    ];
}

export function lolmixSkillEarlyKey(entry: LolmixRecommendationEntry) {
    const match = /^L\s*([1-6])\s*([QWER])$/i.exec(entry.name.trim());
    if (!match) return;

    return {
        level: Number(match[1]),
        slot: match[2].toUpperCase() as LolmixSkillEarlySlot,
    };
}

export function parseLolmixRunePageKey(raw: string) {
    if (!raw.startsWith("rune_page:v2;")) return;

    const fields = new Map<string, string>();
    for (const part of raw.slice("rune_page:v2;".length).split(";")) {
        const separator = part.indexOf("=");
        if (separator < 0) return;
        fields.set(part.slice(0, separator), part.slice(separator + 1));
    }

    const kind = fields.get("kind");
    return {
        kind: isLolmixRunePageKind(kind) ? kind : undefined,
        primaryPath: optionalLolmixInt(fields.get("pri_path")),
        secondaryPath: optionalLolmixInt(fields.get("sec_path")),
        primary: splitLolmixInts(fields.get("primary")),
        secondary: splitLolmixInts(fields.get("secondary")),
        shards: splitLolmixInts(fields.get("shards")),
    } satisfies LolmixRunePage;
}

export function isLolmixOptimalRunePage(entry: LolmixRecommendationEntry) {
    return parseLolmixDisplayRunePageKey(entry.name)?.kind === "optimal";
}

export function parseLolmixDisplayRunePageKey(raw: string) {
    const trimmed = raw.trim();
    const encoded = parseLolmixRunePageKey(trimmed);
    if (encoded) return encoded;

    const kindMatch = /^(.*?)\s*Rune Page:\s*/i.exec(trimmed);
    if (!kindMatch) return;

    return parseLolmixRunePageKey(trimmed.slice(kindMatch[0].length).trim());
}

export function parseLolmixReadableRunePage(
    raw: string,
): LolmixReadableRunePage | undefined {
    const trimmed = raw.trim();
    if (!trimmed) return;

    const encoded = parseLolmixRunePageKey(trimmed);
    if (encoded) {
        return emptyReadableRunePage(trimmed, {
            kind: encoded.kind ? runePageKindLabel(encoded.kind) : undefined,
            encoded: true,
        });
    }

    let working = trimmed;
    let kind: string | undefined;
    const kindMatch = /^(.*?)\s*Rune Page:\s*/i.exec(working);
    if (kindMatch) {
        kind = kindMatch[1].trim() || undefined;
        working = working.slice(kindMatch[0].length);
    }

    if (/rune_page:v\d/i.test(working) || /^[0-9:|_-]+$/.test(working)) {
        return emptyReadableRunePage(trimmed, { kind, encoded: true });
    }

    const shardSplit = working.split(/\|\s*Shards:/i);
    const pageText = shardSplit[0] ?? "";
    const shards =
        shardSplit.length > 1
            ? shardSplit
                  .slice(1)
                  .join(" | ")
                  .split("/")
                  .map((part) => part.trim())
                  .filter(Boolean)
            : [];
    const groups = pageText
        .split("|")
        .map((group) => group.trim())
        .filter(Boolean);
    const primary = cleanRunePathSegment(groups[0] ?? "");
    const secondary = cleanRunePathSegment(groups[1] ?? "");

    return {
        kind,
        primaryPathName: primary.pathName,
        secondaryPathName: secondary.pathName,
        primaryRunes: primary.runes,
        secondaryRunes: secondary.runes,
        shards,
        keystone: primary.runes[0],
        raw: trimmed,
        encoded: false,
    };
}

export function lolmixLaneMatchup(entry: LolmixRecommendationEntry) {
    return entry.per_matchup.lane ?? null;
}

export function lolmixActiveSlots(entry: LolmixRecommendationEntry) {
    const ordered = LOLMIX_MATCHUP_SLOT_ORDER.filter(
        (slot) => entry.per_matchup[slot] != null,
    );
    const extras = Object.keys(entry.per_matchup).filter(
        (slot) =>
            !LOLMIX_MATCHUP_SLOT_ORDER.some((known) => known === slot) &&
            entry.per_matchup[slot] != null,
    );

    return [...ordered, ...extras];
}

export function lolmixEnemyBySlot(data: LolmixAnalyzeResponse) {
    const bySlot: Record<string, LolmixAnalyzeResponse["enemies"][number]> = {};
    for (const enemy of data.enemies) {
        if (enemy.slot) bySlot[enemy.slot] = enemy;
    }

    return bySlot;
}

export function lolmixLaneLabel(lane: string | undefined) {
    switch (lane) {
        case "top":
            return "Top";
        case "jungle":
            return "Jungle";
        case "middle":
            return "Mid";
        case "bottom":
            return "Bot";
        case "support":
            return "Support";
        case "lane":
            return "Lane";
        default:
            return lane ?? "Unknown";
    }
}

export function lolmixSectionByName(data: LolmixAnalyzeResponse, name: string) {
    return data.sections.find((section) => section.name === name);
}

function lolmixOptimizedCompletedItemPath(
    sections: LolmixRecommendationSection[],
) {
    const byName = new Map(sections.map((section) => [section.name, section]));
    const pools = LOLMIX_COMPLETED_ITEM_SECTIONS.map((sectionName) => {
        const section = byName.get(sectionName);
        return section
            ? {
                  sectionName,
                  candidates: lolmixViableEntries(section, {
                      maxEntries: Number.POSITIVE_INFINITY,
                  }),
              }
            : undefined;
    }).filter(
        (
            value,
        ): value is {
            sectionName: LolmixCompletedItemSection;
            candidates: LolmixRecommendationEntry[];
        } => !!value,
    );

    let best: {
        sectionName: string;
        entry: LolmixRecommendationEntry;
        pickRateRatio: number;
    }[] = [];

    const visit = (
        index: number,
        usedIds: Set<number>,
        choices: {
            sectionName: string;
            entry: LolmixRecommendationEntry;
            pickRateRatio: number;
        }[],
    ) => {
        if (index >= pools.length) {
            if (isBetterCompletedPath(choices, best)) {
                best = [...choices];
            }
            return;
        }

        const pool = pools[index];
        const maxPickRate = Math.max(
            ...pool.candidates.map((entry) => entry.combined_pr),
        );
        let picked = false;
        for (const entry of pool.candidates) {
            if (usedIds.has(entry.id)) continue;

            picked = true;
            usedIds.add(entry.id);
            choices.push({
                sectionName: pool.sectionName,
                entry,
                pickRateRatio: entry.combined_pr / maxPickRate,
            });
            visit(index + 1, usedIds, choices);
            choices.pop();
            usedIds.delete(entry.id);
        }

        if (!picked) {
            visit(index + 1, usedIds, choices);
        }
    };

    visit(0, new Set(), []);

    return new Map(best.map((choice) => [choice.sectionName, choice.entry]));
}

function isBetterCompletedPath(
    candidate: { entry: LolmixRecommendationEntry; pickRateRatio: number }[],
    current: { entry: LolmixRecommendationEntry; pickRateRatio: number }[],
) {
    const left = completedPathMetrics(candidate);
    const right = completedPathMetrics(current);

    if (left.count !== right.count) return left.count > right.count;
    if (left.utility !== right.utility) return left.utility > right.utility;
    if (left.score !== right.score) return left.score > right.score;
    if (left.pickRate !== right.pickRate) return left.pickRate > right.pickRate;
    return left.sampleSize > right.sampleSize;
}

function completedPathMetrics(
    path: { entry: LolmixRecommendationEntry; pickRateRatio: number }[],
) {
    return path.reduce(
        (total, choice) => ({
            count: total.count + 1,
            score: total.score + choice.entry.score,
            utility:
                total.utility +
                choice.entry.score +
                choice.pickRateRatio * LOLMIX_BUILD_PICK_CONFIDENCE_WEIGHT,
            pickRate: total.pickRate + choice.entry.combined_pr,
            sampleSize: total.sampleSize + lolmixSampleSize(choice.entry),
        }),
        { count: 0, score: 0, utility: 0, pickRate: 0, sampleSize: 0 },
    );
}

function isCompletedItemSection(
    sectionName: string,
): sectionName is LolmixCompletedItemSection {
    return LOLMIX_COMPLETED_ITEM_SECTIONS.some(
        (candidate) => candidate === sectionName,
    );
}

function lolmixEntryValue(
    entry: LolmixRecommendationEntry,
    headline: LolmixHeadlineMetric,
) {
    return headline === "combined_wr" ? entry.combined_wr : entry.score;
}

function isTopLevelSection(section: LolmixRecommendationSection) {
    return (
        section.entries.length > 0 &&
        !LOLMIX_BACKING_RUNE_SECTIONS.has(section.name)
    );
}

function titleCase(value: string) {
    return value
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function lolmixWinrateClass(value: number) {
    if (value >= 0.53) return "text-winrate-great";
    if (value >= 0.5) return "text-winrate-good";
    if (value >= 0.48) return "text-winrate-okay";
    return "text-winrate-meh";
}

function optionalLolmixInt(value: string | undefined) {
    if (!value) return undefined;
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : undefined;
}

function splitLolmixInts(value: string | undefined) {
    if (!value) return [];
    return value
        .split("_")
        .map((part) => Number.parseInt(part, 10))
        .filter((part) => Number.isInteger(part));
}

function isLolmixRunePageKind(
    value: string | undefined,
): value is LolmixRunePageKind {
    return value === "pick" || value === "win" || value === "optimal";
}

function runePageKindLabel(kind: LolmixRunePageKind) {
    switch (kind) {
        case "pick":
            return "Most Picked";
        case "win":
            return "Highest Win";
        case "optimal":
            return "Optimal";
    }
}

function emptyReadableRunePage(
    raw: string,
    options: { kind?: string; encoded: boolean },
): LolmixReadableRunePage {
    return {
        kind: options.kind,
        primaryPathName: undefined,
        secondaryPathName: undefined,
        primaryRunes: [],
        secondaryRunes: [],
        shards: [],
        keystone: undefined,
        raw,
        encoded: options.encoded,
    };
}

function cleanRunePathSegment(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
        return { pathName: undefined, runes: [] };
    }

    const dashParts = trimmed.split("\u2014");
    if (dashParts.length >= 2) {
        return {
            pathName: dashParts[0].trim() || undefined,
            runes: dashParts
                .slice(1)
                .join("\u2014")
                .split("+")
                .map((part) => part.trim())
                .filter(Boolean),
        };
    }

    const hyphenParts = trimmed.split(" - ");
    if (hyphenParts.length >= 2) {
        return {
            pathName: hyphenParts[0].trim() || undefined,
            runes: hyphenParts
                .slice(1)
                .join(" - ")
                .split("+")
                .map((part) => part.trim())
                .filter(Boolean),
        };
    }

    return { pathName: trimmed, runes: [] };
}
