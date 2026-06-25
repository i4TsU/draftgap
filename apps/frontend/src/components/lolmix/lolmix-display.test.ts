/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import type {
    LolmixAnalyzeResponse,
    LolmixRecommendationEntry,
} from "../../api/lolmix-api";
import {
    formatLolmixPercent,
    formatLolmixSignedPercent,
    groupLolmixSections,
    isLolmixRecommendationEligible,
    lolmixBuildPathSteps,
    lolmixCollapsedDisplayEntries,
    lolmixDisplayEntries,
    lolmixHeadlineMetric,
    lolmixRecommendedEntry,
    lolmixRunePageMetrics,
    lolmixRunePageRecommendedEntry,
    lolmixSectionTitle,
    lolmixSkillEarlyKey,
    lolmixSetupSteps,
    lolmixUnavailableSetupHint,
    lolmixViableEntries,
    lolmixWarningLines,
    parseLolmixDisplayRunePageKey,
    parseLolmixReadableRunePage,
    parseLolmixRunePageKey,
    sortedLolmixEntries,
    visibleLolmixEntries,
    visibleLolmixSections,
} from "./lolmix-display";

const entry = (
    id: number,
    section: string,
    overrides: Partial<LolmixRecommendationEntry> = {},
): LolmixRecommendationEntry => ({
    id,
    name: `${section} ${id}`,
    section,
    score: 0.01,
    overall_wr: 0.512,
    overall_pr: 0.42,
    overall_delta: 0.012,
    overall_n: 1200,
    combined_wr: 0.527,
    combined_pr: 0.433,
    min_delta: -0.02,
    max_delta: 0.04,
    total_n_max: 1600,
    per_matchup: {},
    ...overrides,
});

const response: LolmixAnalyzeResponse = {
    schema_version: 1,
    champion_id: 157,
    champion_name: "Yasuo",
    lane: "middle",
    patch: "30",
    tier: "emerald_plus",
    queue: 420,
    region: "all",
    top_n: 8,
    sections_requested: ["summoners"],
    sections_returned: ["summoners"],
    enemies: [
        {
            champion_id: 122,
            champion_name: "Darius",
            lane: "top",
            slot: "top",
        },
    ],
    warnings: [
        {
            slot: "top",
            enemy_name: "Darius",
            error_type: "ValueError",
            message: "partial fetch failed",
        },
    ],
    sections: [
        {
            name: "summoners",
            entries: [
                {
                    id: 4,
                    name: "Flash + Ignite",
                    section: "summoners",
                    score: 0.034,
                    overall_wr: 0.512,
                    overall_pr: 0.42,
                    overall_delta: 0.012,
                    overall_n: 1200,
                    combined_wr: 0.527,
                    combined_pr: 0.433,
                    min_delta: -0.02,
                    max_delta: 0.04,
                    total_n_max: 1600,
                    per_matchup: {},
                },
            ],
        },
    ],
};

describe("lolmix display helpers", () => {
    test("prepares a minimal successful response for rendering", () => {
        const sections = visibleLolmixSections(response);
        const entry = sections[0].entries[0];

        expect(lolmixSectionTitle(sections[0].name)).toBe("Summoners");
        expect(entry.name).toBe("Flash + Ignite");
        expect(formatLolmixPercent(entry.combined_wr)).toBe("52.7%");
        expect(formatLolmixPercent(entry.combined_pr)).toBe("43.3%");
        expect(formatLolmixSignedPercent(entry.score)).toBe("+3.4%");
    });

    test("hides rune backing sections and preserves server-side cutoffs", () => {
        const sections = visibleLolmixSections({
            ...response,
            sections: [
                { name: "rune_page", entries: [entry(1, "rune_page")] },
                { name: "keystones", entries: [entry(2, "keystones")] },
                { name: "runes_primary", entries: [entry(3, "runes_primary")] },
                {
                    name: "runes_secondary",
                    entries: [entry(4, "runes_secondary")],
                },
                { name: "stat_shards", entries: [entry(5, "stat_shards")] },
                {
                    name: "boots",
                    entries: Array.from({ length: 8 }, (_, index) =>
                        entry(index + 10, "boots"),
                    ),
                },
                {
                    name: "winning_items",
                    entries: Array.from({ length: 12 }, (_, index) =>
                        entry(index + 20, "winning_items"),
                    ),
                },
            ],
        });

        expect(sections.map((section) => section.name)).toEqual([
            "rune_page",
            "boots",
            "winning_items",
        ]);
        expect(visibleLolmixEntries(sections[1])).toHaveLength(8);
        expect(visibleLolmixEntries(sections[2])).toHaveLength(12);
    });

    test("uses combined WR as the winning_items headline", () => {
        const headline = lolmixHeadlineMetric("winning_items", {
            ...response.sections[0].entries[0],
            combined_wr: 0.541,
        });

        expect(headline.label).toBe("Combined WR");
        expect(headline.value).toBe("54.1%");

        const sorted = sortedLolmixEntries(
            {
                name: "winning_items",
                entries: [
                    { ...entry(1, "winning_items"), combined_wr: 0.49 },
                    { ...entry(2, "winning_items"), combined_wr: 0.54 },
                ],
            },
            "combined_wr",
        );

        expect(sorted.map((item) => item.id)).toEqual([2, 1]);
    });

    test("groups top-level sections by decision phase", () => {
        const grouped = groupLolmixSections({
            ...response,
            sections_returned: [
                "winning_items",
                "starters",
                "keystones",
                "first_completed_item",
            ],
            sections: [
                { name: "winning_items", entries: [entry(1, "winning_items")] },
                { name: "starters", entries: [entry(2, "starters")] },
                { name: "keystones", entries: [entry(3, "keystones")] },
                {
                    name: "first_completed_item",
                    entries: [entry(4, "first_completed_item")],
                },
            ],
        });

        expect(grouped.now.map((section) => section.name)).toEqual([
            "starters",
        ]);
        expect(grouped.core.map((section) => section.name)).toEqual([
            "first_completed_item",
        ]);
        expect(grouped.matchup.map((section) => section.name)).toEqual([
            "winning_items",
        ]);
        expect(grouped.details).toEqual([]);
    });

    test("parses skill cells and structured rune page keys", () => {
        expect(
            lolmixSkillEarlyKey({
                ...response.sections[0].entries[0],
                name: "L 3 W",
            }),
        ).toEqual({ level: 3, slot: "W" });

        expect(
            parseLolmixRunePageKey(
                "rune_page:v2;kind=pick;pri_path=1;sec_path=0;primary=8112_8139_8140_8106;secondary=9105_8017;shards=5008_5008_5001",
            ),
        ).toEqual({
            kind: "pick",
            primaryPath: 1,
            secondaryPath: 0,
            primary: [8112, 8139, 8140, 8106],
            secondary: [9105, 8017],
            shards: [5008, 5008, 5001],
        });

        expect(
            parseLolmixDisplayRunePageKey(
                "Most Picked Rune Page: rune_page:v2;kind=pick;pri_path=1;sec_path=0;primary=8112_8139_8140_8106;secondary=9105_8017;shards=5008_5008_5001",
            ),
        ).toEqual({
            kind: "pick",
            primaryPath: 1,
            secondaryPath: 0,
            primary: [8112, 8139, 8140, 8106],
            secondary: [9105, 8017],
            shards: [5008, 5008, 5001],
        });
    });

    test("parses optimal rune pages and uses model-derived metric labels", () => {
        const optimalKey =
            "rune_page:v2;kind=optimal;pri_path=1;sec_path=0;primary=8112_8139_8140_8106;secondary=9105_8017;shards=5008_5008_5001";
        const optimal = entry(10, "rune_page", {
            name: optimalKey,
            score: 0.034,
            combined_wr: 0.501,
            combined_pr: 0.123,
            total_n_max: 45678,
        });

        expect(parseLolmixRunePageKey(optimalKey)?.kind).toBe("optimal");
        expect(parseLolmixReadableRunePage(optimalKey)?.kind).toBe("Optimal");

        expect(lolmixHeadlineMetric("rune_page", optimal)).toMatchObject({
            label: "Score",
            value: "+3.4%",
        });
        expect(lolmixRunePageMetrics(optimal)).toMatchObject({
            mode: "optimal",
            headlineLabel: "Score",
            headlineValue: "+3.4%",
            summary: "Score +3.4% / Coverage 12.3% / N 46k",
        });

        const fallback = entry(11, "rune_page", {
            name: optimalKey.replace("kind=optimal", "kind=pick"),
            score: 0.01,
            combined_wr: 0.552,
            combined_pr: 0.3,
        });
        expect(lolmixRunePageMetrics(fallback)).toMatchObject({
            mode: "observed",
            headlineLabel: "Win Rate",
            headlineValue: "55.2%",
            summary: "WR 55.2% / PR 30.0%",
        });
    });

    test("selects optimal rune pages by score and fallback pages by win rate", () => {
        const optimalLowWr = entry(1, "rune_page", {
            name: "rune_page:v2;kind=optimal;pri_path=1;sec_path=0;primary=8112_8139_8140_8106;secondary=9105_8017;shards=5008_5008_5001",
            score: 0.05,
            combined_wr: 0.49,
        });
        const optimalHighWr = entry(2, "rune_page", {
            name: "rune_page:v2;kind=optimal;pri_path=1;sec_path=0;primary=8112_8139_8140_8106;secondary=9105_8017;shards=5008_5008_5001",
            score: 0.02,
            combined_wr: 0.56,
        });
        const fallbackLowWr = entry(3, "rune_page", {
            name: "rune_page:v2;kind=pick;pri_path=1;sec_path=0;primary=8112_8139_8140_8106;secondary=9105_8017;shards=5008_5008_5001",
            score: 0.07,
            combined_wr: 0.5,
        });
        const fallbackHighWr = entry(4, "rune_page", {
            name: "rune_page:v2;kind=win;pri_path=1;sec_path=0;primary=8112_8139_8140_8106;secondary=9105_8017;shards=5008_5008_5001",
            score: 0.01,
            combined_wr: 0.54,
        });

        expect(
            lolmixRunePageRecommendedEntry({
                name: "rune_page",
                entries: [optimalHighWr, optimalLowWr],
            })?.id,
        ).toBe(1);
        expect(
            lolmixRunePageRecommendedEntry({
                name: "rune_page",
                entries: [fallbackLowWr, fallbackHighWr],
            })?.id,
        ).toBe(4);
    });

    test("parses prose rune pages without exposing the raw key", () => {
        const prose =
            "Most Picked Rune Page: Precision \\u2014 Lethal Tempo + Absorb Life + Last Stand | Resolve \\u2014 Second Wind + Overgrowth | Shards: Attack Speed / Adaptive Force / Health Scaling".replace(
                /\\u2014/g,
                "\u2014",
            );

        expect(parseLolmixReadableRunePage(prose)).toEqual({
            kind: "Most Picked",
            primaryPathName: "Precision",
            secondaryPathName: "Resolve",
            primaryRunes: ["Lethal Tempo", "Absorb Life", "Last Stand"],
            secondaryRunes: ["Second Wind", "Overgrowth"],
            shards: ["Attack Speed", "Adaptive Force", "Health Scaling"],
            keystone: "Lethal Tempo",
            raw: prose,
            encoded: false,
        });
    });

    test("prepares warning text for display", () => {
        expect(lolmixWarningLines(response)).toEqual([
            "Darius: partial fetch failed",
        ]);
    });

    test("prepares the unavailable setup hint", () => {
        expect(lolmixUnavailableSetupHint("127.0.0.1", 8765)).toContain(
            "uv run lolmix-server --host 127.0.0.1 --port 8765",
        );
        expect(lolmixSetupSteps("127.0.0.1", 8765)).toContain(
            "Install or sync lolmix in its project environment.",
        );
    });

    test("applies the 0.01 percent PR floor to recommendations", () => {
        const section = {
            name: "summoners",
            entries: [
                entry(1, "summoners", {
                    score: 0.2,
                    combined_pr: 0.00009,
                }),
                entry(2, "summoners", {
                    score: 0.01,
                    combined_pr: 0.0001,
                }),
            ],
        };

        expect(isLolmixRecommendationEligible(section.entries[0])).toBe(false);
        expect(isLolmixRecommendationEligible(section.entries[1])).toBe(true);
        expect(lolmixRecommendedEntry(section)?.id).toBe(2);
        expect(lolmixDisplayEntries(section)[0]).toMatchObject({
            recommended: false,
            rare: true,
        });
    });

    test("uses min-p style pickrate pools for collapsed viable entries", () => {
        const broad = {
            name: "starters",
            entries: [
                entry(1, "starters", { score: 0.04, combined_pr: 0.4 }),
                entry(2, "starters", { score: 0.03, combined_pr: 0.12 }),
                entry(3, "starters", { score: 0.02, combined_pr: 0.05 }),
                entry(4, "starters", { score: 0.01, combined_pr: 0.02 }),
            ],
        };
        const narrow = {
            name: "starters",
            entries: [
                entry(1, "starters", { score: 0.04, combined_pr: 0.8 }),
                entry(2, "starters", { score: 0.03, combined_pr: 0.07 }),
                entry(3, "starters", { score: 0.02, combined_pr: 0.05 }),
            ],
        };

        expect(lolmixViableEntries(broad).map((item) => item.id)).toEqual([
            1, 2, 3,
        ]);
        expect(lolmixViableEntries(narrow).map((item) => item.id)).toEqual([1]);
    });

    test("keeps rare returned options visible without recommending them", () => {
        const section = {
            name: "skill_order",
            entries: [
                entry(1, "skill_order", { combined_pr: 0.00009 }),
                entry(2, "skill_order", { combined_pr: 0.00005 }),
            ],
        };
        const collapsed = lolmixCollapsedDisplayEntries(section);

        expect(lolmixRecommendedEntry(section)).toBeUndefined();
        expect(collapsed.map((item) => item.entry.id)).toEqual([1, 2]);
        expect(collapsed.every((item) => item.rare)).toBe(true);
        expect(collapsed.every((item) => !item.recommended)).toBe(true);
    });

    test("preserves all returned entries for expanded display", () => {
        const section = {
            name: "full_build",
            entries: Array.from({ length: 8 }, (_, index) =>
                entry(index + 1, "full_build", {
                    score: 0.08 - index * 0.005,
                    combined_pr: 0.4 - index * 0.03,
                }),
            ),
        };

        expect(lolmixCollapsedDisplayEntries(section).length).toBeLessThan(8);
        expect(lolmixDisplayEntries(section)).toHaveLength(8);
    });

    test("optimizes completed item paths without duplicate item recommendations", () => {
        const steps = lolmixBuildPathSteps([
            {
                name: "first_completed_item",
                entries: [
                    entry(100, "first_completed_item", {
                        score: 0.08,
                        combined_pr: 0.7,
                    }),
                    entry(200, "first_completed_item", {
                        score: 0.07,
                        combined_pr: 0.12,
                    }),
                ],
            },
            {
                name: "second_item",
                entries: [
                    entry(100, "second_item", {
                        score: 0.14,
                        combined_pr: 0.2,
                    }),
                    entry(300, "second_item", {
                        score: 0.04,
                        combined_pr: 0.18,
                    }),
                ],
            },
            {
                name: "third_item",
                entries: [entry(400, "third_item", { combined_pr: 0.2 })],
            },
        ]);
        const recommended = steps
            .map((step) => step.recommended?.id)
            .filter((id): id is number => id !== undefined);

        expect(recommended).toEqual([100, 300, 400]);
        expect(new Set(recommended).size).toBe(recommended.length);
    });
});
