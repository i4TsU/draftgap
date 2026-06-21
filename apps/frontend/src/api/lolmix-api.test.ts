/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import type { Dataset } from "@draftgap/core/src/models/dataset/Dataset";
import type { ChampionData } from "@draftgap/core/src/models/dataset/ChampionData";
import { Role } from "@draftgap/core/src/models/Role";
import {
    LOLMIX_RECOMMENDATION_SECTIONS,
    buildLolmixAnalyzeRequest,
    fetchLolmixRecommendations,
    parseLolmixResponse,
    roleToLolmixLane,
} from "./lolmix-api";

const champion = (key: number, id: string, name: string): ChampionData => ({
    id,
    key: String(key),
    name,
    i18n: {},
    statsByRole: {} as ChampionData["statsByRole"],
});

const dataset = {
    version: "15.24",
    date: "2026-06-20",
    championData: {
        "64": champion(64, "LeeSin", "Lee Sin"),
        "122": champion(122, "Darius", "Darius"),
        "157": champion(157, "Yasuo", "Yasuo"),
        "238": champion(238, "Zed", "Zed"),
    },
    itemData: {},
    runeData: {},
    runePathData: {},
    statShardData: {},
    summonerSpellData: {},
} as Dataset;

const emptyPick = {
    championKey: undefined,
    role: undefined,
    hoverKey: undefined,
};

const minimalResponse = {
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
                    per_matchup: {
                        top: {
                            id: 4,
                            name: "Flash + Ignite",
                            wr: 0.54,
                            pr: 0.4,
                            delta1: 0.02,
                            delta2: 0.01,
                            n: 500,
                        },
                    },
                },
            ],
        },
    ],
};

describe("roleToLolmixLane", () => {
    test("maps every DraftGap role to the lolmix lane name", () => {
        expect(roleToLolmixLane(Role.Top)).toBe("top");
        expect(roleToLolmixLane(Role.Jungle)).toBe("jungle");
        expect(roleToLolmixLane(Role.Middle)).toBe("middle");
        expect(roleToLolmixLane(Role.Bottom)).toBe("bottom");
        expect(roleToLolmixLane(Role.Support)).toBe("support");
    });
});

describe("buildLolmixAnalyzeRequest", () => {
    test("constructs a server payload from locked DraftGap picks", () => {
        const result = buildLolmixAnalyzeRequest({
            buildPick: { team: "ally", index: 0 },
            allyTeam: [
                { championKey: "157", role: Role.Middle },
                emptyPick,
                emptyPick,
                emptyPick,
                emptyPick,
            ],
            opponentTeam: [
                { championKey: "122", role: Role.Top },
                { championKey: undefined, role: Role.Jungle, hoverKey: "64" },
                { championKey: "238", role: undefined },
                emptyPick,
                emptyPick,
            ],
            allyTeamComp: new Map([[Role.Middle, "157"]]),
            opponentTeamComp: new Map([
                [Role.Top, "122"],
                [Role.Middle, "238"],
            ]),
            dataset,
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.payload).toEqual({
            my_champion_id: 157,
            my_lane: "middle",
            enemies: [
                { champion_id: 122, lane: "top" },
                { champion_id: 238, lane: "middle" },
            ],
            tier: "emerald_plus",
            patch: "30",
            sections: [...LOLMIX_RECOMMENDATION_SECTIONS],
            use_cache: true,
        });
    });

    test("does not send hover-only opponent champions", () => {
        const result = buildLolmixAnalyzeRequest({
            buildPick: { team: "ally", index: 0 },
            allyTeam: [
                { championKey: "157", role: Role.Middle },
                emptyPick,
                emptyPick,
                emptyPick,
                emptyPick,
            ],
            opponentTeam: [
                { championKey: undefined, role: Role.Jungle, hoverKey: "64" },
                emptyPick,
                emptyPick,
                emptyPick,
                emptyPick,
            ],
            allyTeamComp: new Map([[Role.Middle, "157"]]),
            opponentTeamComp: new Map([[Role.Jungle, "64"]]),
            dataset,
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.payload.enemies).toEqual([]);
    });

    test("reports incomplete selected draft state before fetching", () => {
        const result = buildLolmixAnalyzeRequest({
            buildPick: { team: "ally", index: 0 },
            allyTeam: [
                { championKey: "157", role: undefined },
                emptyPick,
                emptyPick,
                emptyPick,
                emptyPick,
            ],
            opponentTeam: [emptyPick, emptyPick, emptyPick, emptyPick, emptyPick],
            allyTeamComp: new Map(),
            opponentTeamComp: new Map(),
            dataset,
        });

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.reason).toBe("missing-selected-role");
    });
});

describe("fetchLolmixRecommendations", () => {
    test("returns unavailable when the server cannot be reached", async () => {
        const result = await fetchLolmixRecommendations(
            "http://127.0.0.1:8765/analyze",
            {
                my_champion_id: 157,
                my_lane: "middle",
                enemies: [],
                tier: "emerald_plus",
                patch: "30",
                sections: [...LOLMIX_RECOMMENDATION_SECTIONS],
                use_cache: true,
            },
            (async () => {
                throw new TypeError("Failed to fetch");
            }),
        );

        expect(result.status).toBe("unavailable");
    });

    test("parses a successful response and preserves combined rates", async () => {
        const result = await fetchLolmixRecommendations(
            "http://127.0.0.1:8765/analyze",
            {
                my_champion_id: 157,
                my_lane: "middle",
                enemies: [{ champion_id: 122, lane: "top" }],
                tier: "emerald_plus",
                patch: "30",
                sections: [...LOLMIX_RECOMMENDATION_SECTIONS],
                use_cache: true,
            },
            (async () =>
                new Response(JSON.stringify(minimalResponse), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                })),
        );

        expect(result.status).toBe("success");
        if (result.status !== "success") return;
        const entry = result.data.sections[0].entries[0];
        expect(entry.combined_wr).toBe(0.527);
        expect(entry.combined_pr).toBe(0.433);
    });

    test("surfaces lolmix validation errors", async () => {
        const result = await fetchLolmixRecommendations(
            "http://127.0.0.1:8765/analyze",
            {
                my_champion_id: 157,
                my_lane: "middle",
                enemies: [],
                tier: "emerald_plus",
                patch: "30",
                sections: [...LOLMIX_RECOMMENDATION_SECTIONS],
                use_cache: true,
            },
            (async () =>
                new Response(
                    JSON.stringify({
                        error: {
                            type: "invalid_request",
                            message: "invalid analyze request",
                            details: [
                                {
                                    field: "my_lane",
                                    message: "must be one of: top",
                                },
                            ],
                        },
                    }),
                    {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    },
                )),
        );

        expect(result.status).toBe("validation-error");
        if (result.status !== "validation-error") return;
        expect(result.error.details[0].field).toBe("my_lane");
    });
});

describe("parseLolmixResponse", () => {
    test("preserves combined_wr and combined_pr", () => {
        const parsed = parseLolmixResponse(minimalResponse);

        expect(parsed?.sections[0].entries[0].combined_wr).toBe(0.527);
        expect(parsed?.sections[0].entries[0].combined_pr).toBe(0.433);
    });
});
