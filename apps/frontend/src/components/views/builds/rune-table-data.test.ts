import { expect, test } from "bun:test";
import { availableRuneEntries, runePickRate } from "./rune-table-data";

test("loading or missing rune rows render no entries", () => {
    expect(availableRuneEntries([{ id: 8112 }], undefined, {}, 100)).toEqual(
        [],
    );
    expect(
        availableRuneEntries([{ id: 8112 }], {}, undefined, undefined),
    ).toEqual([]);
    expect(availableRuneEntries(undefined, {}, {}, 100)).toEqual([]);
});

test("sparse primary or secondary statistics retain only fully available runes", () => {
    const entries = availableRuneEntries(
        [{ id: 8112 }, { id: 8139 }, { id: 8140 }],
        { 8112: { totalRating: 0.1 }, 8139: { totalRating: 0.2 } },
        { 8112: { games: 0 }, 8140: { games: 50 } },
        100,
    );
    expect(entries).toEqual([
        { id: 8112, rating: 0.1, games: 0, totalGames: 100 },
    ]);
});

test("missing flex shard 5011 leaves the surviving shards in their original columns", () => {
    const entries = availableRuneEntries(
        [
            { id: 5011, index: 0 },
            { id: 5008, index: 1 },
            { id: 5002, index: 2 },
        ],
        { 5008: { totalRating: 0.02 }, 5002: { totalRating: 0.03 } },
        { 5008: { games: 20 }, 5002: { games: 30 } },
        100,
    );
    expect(entries.map(({ id, index }) => [id, index + 1])).toEqual([
        [5008, 2],
        [5002, 3],
    ]);
    expect(availableRuneEntries([{ id: 5011, index: 0 }], {}, {}, 0)).toEqual(
        [],
    );
});

test("zero-game rune pick rates stay finite", () => {
    expect(runePickRate(0, 0)).toBe(0);
    expect(runePickRate(10, 0)).toBe(0);
    expect(runePickRate(25, 100)).toBe(0.25);
});
