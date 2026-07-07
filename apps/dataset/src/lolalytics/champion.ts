import { retry } from "../utils";
import { type LolalyticsRole } from "./roles";

const LOLALYTICS_BASE_URL = "https://lolalytics.com/lol";
const DEFAULT_TIER = "all";

export type LolalyticsFetchText = (url: string) => Promise<string>;

export type LolalyticsChampionFetchOptions = {
    championId?: string;
    matchupId?: string;
    tier?: string;
    fetchText?: LolalyticsFetchText;
};

export interface LolalyticsChampionResponse {
    header: Header;
    summary: Summary;
    graph: Graph;
    nav: Nav;
    analysed: number;
    avgWinRate: number;
    top: Array<Array<TopClass | number | string>>;
    depth: Array<number | string>;
    n: number;
    skills: Skills;
    time: { [key: string]: number };
    timeWin: { [key: string]: number };
    topStats: TopStats;
    stats: Array<Array<number | string>>;
    statsCount: number;
    runes: LolalyticsChampionResponseRunes;
    objective: { [key: string]: Objective };
    spell: Array<number[]>;
    spells: Array<[string, number, number, number]>;
    itemSets: ItemSets;
    startItem: Array<number[]>;
    startSet: Array<[string, number, number, number]>;
    earlyItem: Array<number[]>;
    boots: Array<number[]>;
    mythicItem: Array<number[]>;
    popularItem: Array<number[]>;
    winningItem: Array<number[]>;
    item: Array<number[]>;
    item1: Array<number[]>;
    item2: Array<number[]>;
    item3: Array<number[]>;
    item4: Array<number[]>;
    item5: Array<number[]>;
    enemy_top: Array<number[]>;
    enemy_jungle: Array<number[]>;
    enemy_middle: Array<number[]>;
    enemy_bottom: Array<number[]>;
    enemy_support: Array<number[]>;
    key: string;
    cache: string;
    response: Response;
}

export interface Graph {
    dates: Date[];
    wr: Br;
    wrs: Br;
    pr: Br;
    n: Br;
    br: Br;
}

export interface Br {
    all: number[];
    diamond_plus: number[];
    platinum: number[];
    gold: number[];
    silver: number[];
    bronze: number[];
    iron: number[];
}

export interface Header {
    n: number;
    defaultLane: string;
    lane: string;
    counters: Counters;
    wr: number;
    pr: number;
    br: number;
    rank: number;
    rankTotal: number;
    tier: string;
    topWin: number;
    topElo: string;
    damage: Damage;
}

export interface Counters {
    strong: number[];
    weak: number[];
}

export interface Damage {
    physical: number;
    magic: number;
    true: number;
}

export interface ItemSets {
    itemBootSet1: { [key: string]: number[] };
    itemBootSet2: { [key: string]: number[] };
    itemBootSet3: { [key: string]: number[] };
}

export interface Nav {
    lanes: LaneData;
}

export interface LaneData {
    top: number;
    jungle: number;
    middle: number;
    bottom: number;
    support: number;
}

export interface Objective {
    lose: number[];
    win: number[];
}

export interface Response {
    platform: string;
    version: number;
    endPoint: string;
    valid: boolean;
    duration: string;
}

export interface LolalyticsChampionResponseRunes {
    stats: { [key: string]: [number, number, number][] };
}

export interface Skills {
    skillEarly: Array<Array<[number, number] | [number, number, number]>>;
    skill6Pick: number;
    skill10Pick: number;
    skillOrder: Array<
        [string, number, number] | [string, number, number, number]
    >;
}

export interface Summary {
    skillpriority: Skillpriority;
    skillorder: Skillorder;
    sum: Skillpriority;
    sums: number[];
    runes: SummaryRunes;
    items: Items;
}

export interface Items {
    win: ItemsPick;
    pick: ItemsPick;
}

export interface ItemsPick {
    start: Core;
    core: Core;
    item4: PickElement[];
    item5: PickElement[];
    item6: PickElement[];
}

export interface Core {
    n: number;
    wr: number;
    set: number[];
}

export interface PickElement {
    id: number;
    n: number;
    wr: number;
}

export interface SummaryRunes {
    pick: RunesPick;
    win: RunesPick;
}

export interface RunesPick {
    wr: number;
    n: number;
    page: Page;
    set: Set;
}

export interface Page {
    pri: number;
    sec: number;
}

export interface Set {
    pri: number[];
    sec: number[];
    mod: number[];
}

export interface Skillorder {
    win: PickElement;
    pick: PickElement;
}

export interface Skillpriority {
    win: SkillpriorityPick;
    pick: SkillpriorityPick;
}

export interface SkillpriorityPick {
    id: string;
    n: number;
    wr: number;
}

export interface TopClass {
    support: string;
    bottom?: string;
    top?: string;
    middle?: string;
}

export interface TopStats {
    toppick: number;
    toprank: number;
    topcount: number;
    topwin: number;
    topelo: string;
}

export function buildLolalyticsChampionUrl(
    patch: string,
    championId: string,
    role: LolalyticsRole | "default" = "default",
    matchupId?: string,
    matchupRole?: LolalyticsRole,
    tier = DEFAULT_TIER,
) {
    const normalizedPatch = patch.split(".").slice(0, 2).join(".");
    const championSlug = normalizeChampionSlug(championId);
    const queryParams = new URLSearchParams();

    if (role !== "default") {
        queryParams.append("lane", role);
    }
    queryParams.append("tier", tier);
    queryParams.append("patch", normalizedPatch);

    let path = `${LOLALYTICS_BASE_URL}/${championSlug}/build/`;
    if (matchupId && matchupRole) {
        path = `${LOLALYTICS_BASE_URL}/${championSlug}/vs/${normalizeChampionSlug(
            matchupId,
        )}/build/`;
        queryParams.append("vslane", matchupRole);
    }

    return `${path}?${queryParams.toString()}`;
}

function normalizeChampionSlug(championId: string) {
    const normalized = championId
        .trim()
        .toLowerCase()
        .replaceAll("'", "")
        .replaceAll(".", "")
        .replaceAll(" ", "");

    return normalized === "monkeyking" ? "wukong" : normalized;
}

async function fetchLolalyticsText(
    url: string,
    fetchText?: LolalyticsFetchText,
) {
    if (fetchText) {
        return await fetchText(url);
    }

    const res = await retry(() => fetch(url));
    if (!res.ok) {
        throw new Error(
            `Failed to fetch lolalytics champion ${url} ${res.status}`,
        );
    }

    const text = await res.text();
    if (!text) {
        throw new Error(`No text for lolalytics champion ${url}`);
    }

    return text;
}

function extractQwikPagePayload(text: string) {
    const matches = text.matchAll(
        /<script\s+type=["']qwik\/json["'][^>]*>([\s\S]*?)<\/script>/gi,
    );

    for (const match of matches) {
        try {
            const payload = JSON.parse(match[1]);
            const decoded = decodeQwikPayload(payload);
            if (decoded) {
                return decoded;
            }
        } catch {
            continue;
        }
    }

    throw new Error("No decodable lolalytics Qwik payload found");
}

function decodeQwikPayload(payload: unknown): Record<string, any> | undefined {
    if (
        !payload ||
        typeof payload !== "object" ||
        !Array.isArray((payload as { objs?: unknown }).objs)
    ) {
        return;
    }

    const objs = (payload as { objs: unknown[] }).objs;

    function isRef(value: unknown) {
        if (typeof value !== "string" || value.length === 0) {
            return false;
        }

        const idx = parseInt(value, 36);
        return Number.isInteger(idx) && idx >= 0 && idx < objs.length;
    }

    function resolveRef(ref: string, seen: globalThis.Set<number>): unknown {
        const idx = parseInt(ref, 36);
        if (seen.has(idx)) {
            return null;
        }

        return decode(objs[idx], new globalThis.Set([...seen, idx]));
    }

    function decode(value: unknown, seen: globalThis.Set<number>): unknown {
        if (Array.isArray(value)) {
            return value.map((item) =>
                isRef(item) ? resolveRef(item, seen) : decode(item, seen),
            );
        }

        if (value && typeof value === "object") {
            return Object.fromEntries(
                Object.entries(value).map(([key, item]) => [
                    key,
                    isRef(item) ? resolveRef(item, seen) : decode(item, seen),
                ]),
            );
        }

        return value;
    }

    for (const obj of objs) {
        if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
            continue;
        }

        if ("header" in obj && "summary" in obj) {
            const decoded = decode(obj, new globalThis.Set());
            if (decoded && typeof decoded === "object") {
                return decoded as Record<string, any>;
            }
        }
    }
}

function normalizeLolalyticsChampionResponse(
    raw: Record<string, any>,
): LolalyticsChampionResponse {
    return {
        ...raw,
        avgWinRate: raw.avgWinRate ?? raw.avgWr ?? 0,
        top: raw.top ?? raw.sidebar?.topList ?? [],
        depth: raw.depth ?? raw.sidebar?.depth ?? [],
        topStats: raw.topStats ?? raw.sidebar?.topStats ?? {},
        stats: raw.stats ?? raw.sidebar?.stats?.stats ?? [],
        statsCount: raw.statsCount ?? raw.sidebar?.stats?.count ?? 0,
        time: raw.time ?? raw.sidebar?.time?.time ?? {},
        timeWin: raw.timeWin ?? raw.sidebar?.time?.timeWin ?? {},
        skills: raw.skills ?? {
            skillEarly: raw.skillEarly ?? [],
            skillOrder: raw.skillOrder ?? [],
            skill6Pick: raw.skill6Pick ?? 0,
            skill10Pick: raw.skill10Pick ?? 0,
        },
    } as LolalyticsChampionResponse;
}

export async function getLolalyticsChampion(
    patch: string,
    championKey: string,
    role: LolalyticsRole | "default" = "default",
    matchup?: string,
    matchupRole?: LolalyticsRole,
    options: LolalyticsChampionFetchOptions = {},
) {
    const url = buildLolalyticsChampionUrl(
        patch,
        options.championId ?? championKey,
        role,
        options.matchupId ?? matchup,
        matchupRole,
        options.tier ?? DEFAULT_TIER,
    );
    const text = await fetchLolalyticsText(url, options.fetchText);

    try {
        return normalizeLolalyticsChampionResponse(
            extractQwikPagePayload(text),
        );
    } catch (e) {
        throw new Error(
            "Error parsing Qwik JSON for lolalytics champion " +
                championKey +
                " url: " +
                url,
            {
                cause: e,
            },
        );
    }
}
