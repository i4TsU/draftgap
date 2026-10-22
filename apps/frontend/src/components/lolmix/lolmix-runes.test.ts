import { expect, test } from "bun:test";
import type { Dataset } from "@draftgap/core/src/models/dataset/Dataset";
import { lolmixRuneVisuals } from "./lolmix-runes";
import { shardIconUrl } from "../../utils/rune-icons";

const dataset: Dataset = {
    version: "test",
    date: "2026-10-21",
    championData: {},
    itemData: {},
    summonerSpellData: {},
    statShardData: {},
    runePathData: {
        8000: {
            id: 8000,
            key: "Precision",
            name: "Precision",
            icon: "perk-images/Styles/7201_Precision.png",
        },
        8400: {
            id: 8400,
            key: "Resolve",
            name: "Resolve",
            icon: "perk-images/Styles/7204_Resolve.png",
        },
    },
    runeData: {
        8005: {
            id: 8005,
            key: "PressTheAttack",
            name: "Press the Attack",
            icon: "perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png",
            pathId: 8000,
            slot: 0,
            index: 0,
        },
        9105: {
            id: 9105,
            key: "LegendHaste",
            name: "Legend: Haste",
            icon: "perk-images/Styles/Precision/LegendHaste/LegendHaste.png",
            pathId: 8000,
            slot: 2,
            index: 1,
        },
        8444: {
            id: 8444,
            key: "SecondWind",
            name: "Second Wind",
            icon: "perk-images/Styles/Resolve/SecondWind/SecondWind.png",
            pathId: 8400,
            slot: 2,
            index: 1,
        },
    },
};

test("encoded and readable pages resolve to the same Riot artwork", () => {
    const key =
        "rune_page:v2;kind=pick;pri_path=0;sec_path=3;primary=8005_9105;secondary=8444;shards=5008_5010_5013";
    const expected = lolmixRuneVisuals(key, dataset);
    const readable = lolmixRuneVisuals(
        "Most Picked Rune Page: Precision — Press the Attack + Legend: Haste | Resolve — Second Wind | Shards: Adaptive Force / Move Speed / Tenacity and Slow Resist",
        dataset,
    );
    expect(readable).toEqual(expected);
    expect(lolmixRuneVisuals(`Most Picked Rune Page: ${key}`, dataset)).toEqual(
        expected,
    );
    expect(expected.primary.runes[0].icon).toContain("PressTheAttack.png");
    expect(expected.primary.icon).toContain("7201_Precision.png");
    expect(expected.shards[1].id).toBe(5010);
    expect(expected.shards[1].icon).toContain("statmodsmovementspeedicon.png");
});

test("all shards use their actual asset names, including health and tenacity", () => {
    for (const [id, filename] of [
        [5001, "healthplus"],
        [5005, "attackspeed"],
        [5007, "cdrscaling"],
        [5008, "adaptiveforce"],
        [5010, "movementspeed"],
        [5011, "healthscaling"],
        [5013, "tenacity"],
    ] as const)
        expect(shardIconUrl(id)).toEndWith(`/statmods${filename}icon.png`);
    expect(shardIconUrl(9999)).toBeUndefined();
});

test("unknown metadata preserves readable names without substituting another rune", () => {
    const page = lolmixRuneVisuals(
        "Most Picked Rune Page: Sorcery — New Keystone | Shards: Adaptive Force / Adaptive Force / Health Scaling",
        undefined,
    );
    expect(page.primary.name).toBe("Sorcery");
    expect(page.primary.runes[0]).toEqual({
        id: undefined,
        name: "New Keystone",
        icon: undefined,
    });
    expect(page.shards.map((shard) => shard.id)).toEqual([5008, 5008, 5001]);
});
