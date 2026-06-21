/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import type { LolmixAnalyzeResponse } from "../../api/lolmix-api";
import {
    formatLolmixPercent,
    formatLolmixSignedPercent,
    lolmixHeadlineMetric,
    lolmixSectionTitle,
    lolmixSetupSteps,
    lolmixUnavailableSetupHint,
    lolmixWarningLines,
    visibleLolmixSections,
} from "./lolmix-display";

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

    test("uses combined WR as the winning_items headline", () => {
        const headline = lolmixHeadlineMetric("winning_items", {
            ...response.sections[0].entries[0],
            combined_wr: 0.541,
        });

        expect(headline.label).toBe("Combined WR");
        expect(headline.value).toBe("54.1%");
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
});
