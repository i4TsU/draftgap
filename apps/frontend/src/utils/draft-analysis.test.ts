/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import {
    analyzeDraft,
    analyzeMatchups,
    sumMatchupRatings,
} from "@draftgap/core/src/draft/analysis";
import { getSuggestions } from "@draftgap/core/src/draft/suggestions";
import { Role, ROLES } from "@draftgap/core/src/models/Role";
import { defaultChampionRoleData } from "@draftgap/core/src/models/dataset/ChampionRoleData";
import type { Dataset } from "@draftgap/core/src/models/dataset/Dataset";
import { winrateToRating } from "@draftgap/core/src/rating/ratings";

function fixture() {
    const team = new Map<Role, string>(
        ROLES.map((role) => [role, `ally-${role}`]),
    );
    const enemy = new Map<Role, string>(
        ROLES.map((role) => [role, `enemy-${role}`]),
    );
    const dataset: Dataset = {
        version: "5",
        date: "2026-10-21",
        championData: {},
        itemData: {},
        runeData: {},
        runePathData: {},
        statShardData: {},
        summonerSpellData: {},
    };
    for (const championKey of [...team.values(), ...enemy.values()]) {
        const statsByRole = Object.fromEntries(
            ROLES.map((role) => [
                role,
                { ...defaultChampionRoleData(), games: 10000, wins: 5000 },
            ]),
        ) as Dataset["championData"][string]["statsByRole"];
        dataset.championData[championKey] = {
            id: championKey,
            key: championKey,
            name: championKey,
            i18n: {},
            statsByRole,
        };
    }
    // Positive lane effects compete with negative cross-role effects, so an
    // unweighted sum or per-champion renormalization gives a different result.
    for (const [roleA, keyA] of team) {
        for (const [roleB, keyB] of enemy) {
            const wins =
                roleA === roleB ? 5800 : 4800 + roleA * 20 + roleB * 10;
            dataset.championData[keyA].statsByRole[roleA].matchup[roleB][keyB] =
                {
                    championKey: keyB,
                    games: 10000,
                    wins,
                };
            dataset.championData[keyB].statsByRole[roleB].matchup[roleA][keyA] =
                {
                    championKey: keyA,
                    games: 10000,
                    wins: 10000 - wins,
                };
        }
    }
    return { dataset, team, enemy };
}

describe("draft matchup contributions", () => {
    test("row and champion contributions preserve the existing weighted draft total", () => {
        const { dataset, team, enemy } = fixture();
        const result = analyzeMatchups(dataset, team, enemy, 0);
        // Independent oracle for the pre-existing 5x5 weighting formula.
        let expected = 0;
        for (const [roleA] of team) {
            for (const [roleB] of enemy) {
                const winrate =
                    roleA === roleB
                        ? 0.58
                        : (4800 + roleA * 20 + roleB * 10) / 10000;
                expected +=
                    winrateToRating(winrate) * (roleA === roleB ? 1.35 : 0.85);
            }
        }
        expected *= 25 / (5 * 1.35 + 20 * 0.85);
        expect(result.totalRating).toBeCloseTo(expected, 10);
        expect(sumMatchupRatings(result.matchupResults)).toBeCloseTo(
            expected,
            10,
        );
        const championTotals = [...team.values()].map((key) =>
            sumMatchupRatings(
                result.matchupResults.filter((r) => r.championKeyA === key),
            ),
        );
        expect(championTotals.reduce((a, b) => a + b, 0)).toBeCloseTo(
            expected,
            10,
        );
        expect(result.matchupResults[0].rating).toBeCloseTo(
            winrateToRating(0.58),
            10,
        );
        expect(result.matchupResults[0].wins).toBeCloseTo(5800, 10);
        expect(result.matchupResults[0].games).toBe(10000);
        expect(result.matchupResults[0].weightedRating).not.toBe(
            result.matchupResults[0].rating,
        );
    });

    test("filtered lane and champion footers keep the full draft's normalization", () => {
        const { dataset, team, enemy } = fixture();
        const { matchupResults, totalRating } = analyzeMatchups(
            dataset,
            team,
            enemy,
            1000,
        );
        const direct = matchupResults.filter((r) => r.roleA === r.roleB);
        const cross = matchupResults.filter((r) => r.roleA !== r.roleB);
        expect(
            sumMatchupRatings(direct) + sumMatchupRatings(cross),
        ).toBeCloseTo(totalRating, 10);
        const normalization = 25 / (5 * 1.35 + 20 * 0.85);
        for (const row of matchupResults) {
            expect(row.weightedRating).toBeCloseTo(
                row.rating * row.weight * normalization,
                10,
            );
        }
    });

    test("partial drafts give a lane opponent more influence than each cross-role enemy", () => {
        const { dataset, enemy } = fixture();
        const team = new Map<Role, string>([[Role.Top, "ally-0"]]);
        const result = analyzeMatchups(dataset, team, enemy, 0);
        const direct = result.matchupResults.find((r) => r.roleB === Role.Top)!;
        const cross = result.matchupResults.find(
            (r) => r.roleB === Role.Support,
        )!;
        expect(
            direct.weightedRating /
                direct.rating /
                (cross.weightedRating / cross.rating),
        ).toBeCloseTo(1.35 / 0.85, 10);
        const expected =
            (result.matchupResults.reduce(
                (acc, r) => acc + r.rating * r.weight,
                0,
            ) *
                5) /
            (1.35 + 4 * 0.85);
        expect(result.totalRating).toBeCloseTo(expected, 10);
    });

    test.each([Role.Top, Role.Support])(
        "a single matchup against role %i keeps its original scale",
        (enemyRole) => {
            const { dataset } = fixture();
            const result = analyzeMatchups(
                dataset,
                new Map([[Role.Top, "ally-0"]]),
                new Map([[enemyRole, `enemy-${enemyRole}`]]),
                1000,
            );
            expect(result.totalRating).toBeCloseTo(
                result.matchupResults[0].rating,
                10,
            );
        },
    );

    test("opponent contributions are the exact inverse from either team perspective", () => {
        const { dataset, team, enemy } = fixture();
        const ally = analyzeMatchups(dataset, team, enemy, 1000);
        const opponent = analyzeMatchups(dataset, enemy, team, 1000);
        expect(opponent.totalRating).toBeCloseTo(-ally.totalRating, 10);
        for (const row of ally.matchupResults) {
            const reverse = opponent.matchupResults.find(
                (r) =>
                    r.championKeyA === row.championKeyB &&
                    r.championKeyB === row.championKeyA,
            )!;
            expect(reverse.weightedRating).toBeCloseTo(-row.weightedRating, 10);
        }
    });

    test("empty and missing matchup data produce finite neutral contributions", () => {
        const { dataset, team, enemy } = fixture();
        expect(analyzeMatchups(dataset, team, new Map(), 0)).toEqual({
            matchupResults: [],
            totalRating: 0,
        });
        expect(analyzeMatchups(dataset, new Map(), enemy, 0).totalRating).toBe(
            0,
        );
        expect(sumMatchupRatings([])).toBe(0);
        const missing = analyzeMatchups(
            { ...dataset, championData: {} },
            team,
            enemy,
            1000,
        );
        expect(missing.totalRating).toBe(0);
        expect(
            missing.matchupResults.every((r) => r.weightedRating === 0),
        ).toBe(true);
    });

    test("suggestions and draft analysis expose the same additive weighted contributions", () => {
        const { dataset, team, enemy } = fixture();
        team.delete(Role.Top);
        const config = {
            minGames: 0,
            ignoreChampionWinrates: true,
            riskLevel: "medium" as const,
        };
        const suggestion = getSuggestions(
            dataset,
            dataset,
            team,
            enemy,
            config,
        ).find((s) => s.championKey === "ally-0" && s.role === Role.Top)!;
        team.set(Role.Top, "ally-0");
        const draft = analyzeDraft(dataset, dataset, team, enemy, config);
        expect(suggestion.draftResult.matchupRating.totalRating).toBeCloseTo(
            draft.matchupRating.totalRating,
            10,
        );
        expect(
            sumMatchupRatings(draft.matchupRating.matchupResults),
        ).toBeCloseTo(draft.matchupRating.totalRating, 10);
    });
});
