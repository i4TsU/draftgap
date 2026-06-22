import type {
    LolmixAnalyzeResponse,
    LolmixRecommendationEntry,
    LolmixRecommendationSection,
} from "../../api/lolmix-api";

export const LOLMIX_SECTION_TITLES: Record<string, string> = {
    summoners: "Summoners",
    rune_page: "Rune Page",
    skill_early: "Early Skills",
    skill_order: "Skill Order",
    starters: "Starters",
    first_completed_item: "First Item",
    boots: "Boots",
    second_item: "Second Item",
    third_item: "Third Item",
    fourth_item: "Fourth Item",
    winning_items: "Winning Items",
    full_build: "Full Build",
};

const LOLMIX_BACKING_RUNE_SECTIONS = new Set([
    "keystones",
    "runes_primary",
    "runes_secondary",
    "stat_shards",
]);

export function lolmixSectionTitle(sectionName: string) {
    return LOLMIX_SECTION_TITLES[sectionName] ?? sectionName;
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

export const LOLMIX_SKILL_EARLY_LEVELS = [1, 2, 3, 4, 5, 6] as const;
export const LOLMIX_SKILL_EARLY_SLOTS = ["Q", "W", "E", "R"] as const;

export type LolmixSkillEarlySlot = (typeof LOLMIX_SKILL_EARLY_SLOTS)[number];

export type LolmixRunePage = {
    kind: "pick" | "win" | undefined;
    primaryPath: number | undefined;
    secondaryPath: number | undefined;
    primary: number[];
    secondary: number[];
    shards: number[];
};

export function lolmixSkillEarlyKey(entry: LolmixRecommendationEntry) {
    const match = /^L([1-6])\s+([QWER])$/i.exec(entry.name.trim());
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
        kind: kind === "pick" || kind === "win" ? kind : undefined,
        primaryPath: optionalLolmixInt(fields.get("pri_path")),
        secondaryPath: optionalLolmixInt(fields.get("sec_path")),
        primary: splitLolmixInts(fields.get("primary")),
        secondary: splitLolmixInts(fields.get("secondary")),
        shards: splitLolmixInts(fields.get("shards")),
    } satisfies LolmixRunePage;
}

export function lolmixHeadlineMetric(
    sectionName: string,
    entry: LolmixRecommendationEntry,
) {
    if (sectionName === "winning_items" || sectionName === "rune_page") {
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
    return value >= 0 ? "text-winrate-good" : "text-winrate-meh";
}

export function lolmixWinrateTextClass(value: number) {
    return lolmixWinrateClass(value);
}

export function lolmixSampleSize(entry: LolmixRecommendationEntry) {
    return Math.max(entry.overall_n, entry.total_n_max);
}

export function formatLolmixPercent(value: number) {
    return `${(value * 100).toFixed(1)}%`;
}

export function formatLolmixSignedPercent(value: number) {
    const formatted = formatLolmixPercent(value);
    return value > 0 ? `+${formatted}` : formatted;
}

export function formatLolmixCount(value: number) {
    return Math.round(value).toLocaleString();
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
