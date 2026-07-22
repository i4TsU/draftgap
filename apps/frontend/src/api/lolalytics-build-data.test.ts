/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { QueryClient } from "@tanstack/solid-query";
import type { ChampionData } from "@draftgap/core/src/models/dataset/ChampionData";
import type { Dataset } from "@draftgap/core/src/models/dataset/Dataset";
import { Role } from "@draftgap/core/src/models/Role";
import { fetchBuildData } from "@draftgap/core/src/builds/data";
import {
    buildLolalyticsChampionUrl,
    getLolalyticsChampion,
} from "../../../dataset/src/lolalytics/champion";
import {
    fetchLolalyticsPageText,
    lolalyticsProxyUrlForPage,
} from "./lolalytics-api";

const champion = (key: number, id: string, name: string): ChampionData => ({
    id,
    key: String(key),
    name,
    i18n: {},
    statsByRole: {} as ChampionData["statsByRole"],
});

const dataset = {
    version: "16.13.1",
    date: "2026-06-26",
    championData: {
        "86": champion(86, "Garen", "Garen"),
        "246": champion(246, "Qiyana", "Qiyana"),
    },
    itemData: {},
    runeData: {},
    runePathData: {},
    statShardData: {},
    summonerSpellData: {},
} as Dataset;

function lolalyticsHtml(overrides: Record<string, unknown> = {}) {
    const payload = {
        objs: [
            {
                header: {
                    n: 1000,
                    wr: 51.2,
                    lane: "bottom",
                    damage: {},
                },
                summary: {},
                runes: { stats: {} },
                spells: [],
                startSet: [],
                boots: [],
                item1: [],
                item2: [],
                item3: [],
                item4: [],
                item5: [],
                skills: {
                    skillEarly: [],
                    skillOrder: [],
                    skill6Pick: 0,
                    skill10Pick: 0,
                },
                ...overrides,
            },
        ],
    };

    return `<html><script type="qwik/json">${JSON.stringify(
        payload,
    )}</script></html>`;
}

describe("Lolalytics build data fetch", () => {
    test("builds same-origin proxy URLs for browser page fetches", () => {
        const pageUrl =
            "https://lolalytics.com/lol/qiyana/vs/garen/build/?lane=bottom&tier=all&patch=16.13&vslane=top";

        expect(lolalyticsProxyUrlForPage(pageUrl)).toBe(
            "/api/lolalytics/lol/qiyana/vs/garen/build/?lane=bottom&tier=all&patch=16.13&vslane=top",
        );
        expect(
            lolalyticsProxyUrlForPage(
                pageUrl,
                "https://draftgap.example/proxy/lolalytics/",
            ),
        ).toBe(
            "https://draftgap.example/proxy/lolalytics/lol/qiyana/vs/garen/build/?lane=bottom&tier=all&patch=16.13&vslane=top",
        );
    });

    test("fetches browser pages through the configured proxy", async () => {
        const urls: string[] = [];
        const text = await fetchLolalyticsPageText(
            "https://lolalytics.com/lol/qiyana/build/?lane=bottom&tier=all&patch=30",
            async (input) => {
                urls.push(String(input));
                return new Response("proxied html");
            },
        );

        expect(text).toBe("proxied html");
        expect(urls).toEqual([
            "/api/lolalytics/lol/qiyana/build/?lane=bottom&tier=all&patch=30",
        ]);
    });

    test("rejects unsupported browser proxy targets", () => {
        expect(() =>
            lolalyticsProxyUrlForPage(
                "https://example.com/lol/qiyana/build/?lane=bottom",
            ),
        ).toThrow("Only https://lolalytics.com/lol/...");
    });

    test("builds public Lolalytics champion and matchup page URLs", () => {
        expect(
            buildLolalyticsChampionUrl(
                "16.13.1",
                "Qiyana",
                "bottom",
                "Garen",
                "top",
                "all",
            ),
        ).toBe(
            "https://lolalytics.com/lol/qiyana/vs/garen/build/?lane=bottom&tier=all&patch=16.13&vslane=top",
        );
    });

    test("decodes the public page Qwik payload", async () => {
        const urls: string[] = [];
        const data = await getLolalyticsChampion(
            "30",
            "246",
            "bottom",
            undefined,
            undefined,
            {
                championId: "Qiyana",
                tier: "all",
                fetchText: async (url) => {
                    urls.push(url);
                    return lolalyticsHtml();
                },
            },
        );

        expect(urls).toEqual([
            "https://lolalytics.com/lol/qiyana/build/?lane=bottom&tier=all&patch=30",
        ]);
        expect(data.header.n).toBe(1000);
        expect(data.header.wr).toBe(51.2);
    });

    test("fetchBuildData defaults to all tiers over the last 30 days", async () => {
        const urls: string[] = [];

        await fetchBuildData(
            new QueryClient(),
            dataset,
            "246",
            Role.Bottom,
            new Map([[Role.Top, "86"]]),
            {
                fetchText: async (url) => {
                    urls.push(url);
                    return lolalyticsHtml();
                },
            },
        );

        expect(urls).toEqual([
            "https://lolalytics.com/lol/qiyana/build/?lane=bottom&tier=all&patch=30",
            "https://lolalytics.com/lol/qiyana/vs/garen/build/?lane=bottom&tier=all&patch=30&vslane=top",
        ]);
    });
});
