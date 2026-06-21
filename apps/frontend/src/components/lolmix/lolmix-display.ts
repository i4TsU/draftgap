import type {
    LolmixAnalyzeResponse,
    LolmixRecommendationEntry,
    LolmixRecommendationSection,
} from "../../api/lolmix-api";

export const LOLMIX_SECTION_TITLES: Record<string, string> = {
    summoners: "Summoners",
    skill_early: "Early Skills",
    starters: "Starters",
    boots: "Boots",
    first_completed_item: "First Item",
    second_item: "Second Item",
    winning_items: "Winning Items",
    keystones: "Keystones",
    rune_page: "Rune Page",
};

export function lolmixSectionTitle(sectionName: string) {
    return LOLMIX_SECTION_TITLES[sectionName] ?? sectionName;
}

export function visibleLolmixSections(data: LolmixAnalyzeResponse) {
    return data.sections.filter((section) => section.entries.length > 0);
}

export function visibleLolmixEntries(section: LolmixRecommendationSection) {
    return section.entries.slice(0, lolmixSectionLimit(section));
}

export function lolmixSectionLimit(section: LolmixRecommendationSection) {
    if (section.name === "skill_early") return 24;
    if (section.name === "winning_items") return 8;
    if (section.name === "rune_page") return 4;
    return 5;
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
        class: entry.score >= 0 ? "text-winrate-good" : "text-winrate-meh",
    };
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

export function lolmixUnavailableSetupHint(port: number) {
    return `lolmix-server is not reachable on port ${port}. Start it with uv run lolmix-server --port ${port}.`;
}

function lolmixWinrateClass(value: number) {
    if (value >= 0.53) return "text-winrate-great";
    if (value >= 0.5) return "text-winrate-good";
    if (value >= 0.48) return "text-winrate-okay";
    return "text-winrate-meh";
}
