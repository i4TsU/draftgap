import type { Dataset } from "@draftgap/core/src/models/dataset/Dataset";
import { Role } from "@draftgap/core/src/models/Role";
import type { Team } from "@draftgap/core/src/models/Team";

export const LOLMIX_DEFAULT_PORT = 8765;
export const LOLMIX_DEFAULT_TIER = "emerald_plus";
export const LOLMIX_DEFAULT_PATCH = "30";

export const LOLMIX_RECOMMENDATION_SECTIONS = [
    "summoners",
    "skill_early",
    "starters",
    "boots",
    "first_completed_item",
    "second_item",
    "winning_items",
    "keystones",
    "rune_page",
] as const;

export type LolmixLane = "top" | "jungle" | "middle" | "bottom" | "support";
export type LolmixSectionName = (typeof LOLMIX_RECOMMENDATION_SECTIONS)[number];

export type LolmixEnemyRequest = {
    champion_id: number;
    lane: LolmixLane;
};

export type LolmixAnalyzeRequest = {
    my_champion_id: number;
    my_lane: LolmixLane;
    enemies: LolmixEnemyRequest[];
    tier: string;
    patch: string;
    sections: LolmixSectionName[];
    use_cache: boolean;
};

export type LolmixWarning = {
    slot?: string;
    enemy_name?: string;
    error_type: string;
    message: string;
};

export type LolmixPerMatchupEntry = {
    id: number;
    name: string;
    wr: number;
    pr: number;
    delta1: number;
    delta2: number;
    n: number;
};

export type LolmixRecommendationEntry = {
    id: number;
    name: string;
    section: string;
    score: number;
    overall_wr: number;
    overall_pr: number;
    overall_delta: number;
    overall_n: number;
    combined_wr: number;
    combined_pr: number;
    min_delta: number;
    max_delta: number;
    total_n_max: number;
    per_matchup: Record<string, LolmixPerMatchupEntry | null>;
};

export type LolmixRecommendationSection = {
    name: string;
    entries: LolmixRecommendationEntry[];
};

export type LolmixResponseEnemy = {
    champion_id?: number;
    champion_name?: string;
    lane?: LolmixLane;
    slot?: string;
};

export type LolmixAnalyzeResponse = {
    schema_version: 1;
    champion_id: number;
    champion_name: string;
    lane: LolmixLane;
    patch: string;
    tier: string;
    queue: number;
    region: string;
    top_n: number | null;
    sections_requested: string[] | null;
    sections_returned: string[];
    enemies: LolmixResponseEnemy[];
    warnings: LolmixWarning[];
    sections: LolmixRecommendationSection[];
};

export type LolmixServerError = {
    type: string;
    message: string;
    details: { field?: string; message: string }[];
};

export type LolmixClientResult =
    | { status: "success"; data: LolmixAnalyzeResponse }
    | { status: "unavailable"; message: string }
    | {
          status: "validation-error";
          error: LolmixServerError;
          httpStatus: number;
      }
    | { status: "unexpected-error"; message: string; httpStatus?: number };

export type LolmixFetch = (
    input: RequestInfo | URL,
    init?: RequestInit,
) => Promise<Response>;

type DraftPickLike = {
    championKey: string | undefined;
    role: Role | undefined;
    hoverKey?: string | undefined;
};

type DraftTeamLike = readonly DraftPickLike[];

export type LolmixDraftRequestInput = {
    buildPick: { team: Team; index: number } | undefined;
    allyTeam: DraftTeamLike;
    opponentTeam: DraftTeamLike;
    allyTeamComp: ReadonlyMap<Role, string> | undefined;
    opponentTeamComp: ReadonlyMap<Role, string> | undefined;
    dataset: Dataset | undefined;
    tier?: string;
    patch?: string;
};

export type LolmixDraftRequestResult =
    | {
          ok: true;
          payload: LolmixAnalyzeRequest;
          championKey: string;
          championName: string;
          lane: LolmixLane;
          enemyCount: number;
      }
    | {
          ok: false;
          reason:
              | "missing-dataset"
              | "missing-selected-pick"
              | "missing-selected-champion"
              | "missing-selected-role"
              | "unknown-selected-champion";
          message: string;
      };

export function roleToLolmixLane(role: Role): LolmixLane {
    switch (role) {
        case Role.Top:
            return "top";
        case Role.Jungle:
            return "jungle";
        case Role.Middle:
            return "middle";
        case Role.Bottom:
            return "bottom";
        case Role.Support:
            return "support";
    }
}

export function normalizeLolmixPort(port: unknown) {
    const parsed =
        typeof port === "number" ? port : Number.parseInt(String(port), 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
        return LOLMIX_DEFAULT_PORT;
    }
    return parsed;
}

export function lolmixAnalyzeEndpoint(port: unknown) {
    return `http://127.0.0.1:${normalizeLolmixPort(port)}/analyze`;
}

export function buildLolmixAnalyzeRequest(
    input: LolmixDraftRequestInput,
): LolmixDraftRequestResult {
    if (!input.dataset) {
        return {
            ok: false,
            reason: "missing-dataset",
            message: "Champion data is still loading.",
        };
    }
    if (!input.buildPick) {
        return {
            ok: false,
            reason: "missing-selected-pick",
            message: "Select a champion to request lolmix recommendations.",
        };
    }

    const myTeam =
        input.buildPick.team === "ally" ? input.allyTeam : input.opponentTeam;
    const theirTeam =
        input.buildPick.team === "ally" ? input.opponentTeam : input.allyTeam;
    const myTeamComp =
        input.buildPick.team === "ally"
            ? input.allyTeamComp
            : input.opponentTeamComp;
    const theirTeamComp =
        input.buildPick.team === "ally"
            ? input.opponentTeamComp
            : input.allyTeamComp;
    const pick = myTeam[input.buildPick.index];

    if (!pick?.championKey) {
        return {
            ok: false,
            reason: "missing-selected-champion",
            message: "Select a locked champion before requesting lolmix.",
        };
    }

    const champion = input.dataset.championData[pick.championKey];
    if (!champion) {
        return {
            ok: false,
            reason: "unknown-selected-champion",
            message: "The selected champion is not present in the dataset.",
        };
    }

    const selectedRole = roleForChampion(pick.championKey, myTeamComp) ?? pick.role;
    if (selectedRole === undefined) {
        return {
            ok: false,
            reason: "missing-selected-role",
            message: "Select or infer a role before requesting lolmix.",
        };
    }

    const enemies = theirTeam
        .filter((enemy) => enemy.championKey !== undefined)
        .map((enemy) => {
            const role =
                roleForChampion(enemy.championKey!, theirTeamComp) ?? enemy.role;
            const enemyChampion = input.dataset!.championData[enemy.championKey!];

            if (role === undefined || !enemyChampion) {
                return undefined;
            }

            return {
                champion_id: Number(enemyChampion.key),
                lane: roleToLolmixLane(role),
            };
        })
        .filter((enemy): enemy is LolmixEnemyRequest => enemy !== undefined);

    return {
        ok: true,
        payload: {
            my_champion_id: Number(champion.key),
            my_lane: roleToLolmixLane(selectedRole),
            enemies,
            tier: input.tier ?? LOLMIX_DEFAULT_TIER,
            patch: input.patch ?? LOLMIX_DEFAULT_PATCH,
            sections: [...LOLMIX_RECOMMENDATION_SECTIONS],
            use_cache: true,
        },
        championKey: pick.championKey,
        championName: champion.name,
        lane: roleToLolmixLane(selectedRole),
        enemyCount: enemies.length,
    };
}

export async function fetchLolmixRecommendations(
    endpoint: string,
    payload: LolmixAnalyzeRequest,
    fetcher: LolmixFetch = fetch,
): Promise<LolmixClientResult> {
    let response: Response;
    try {
        response = await fetcher(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });
    } catch (error) {
        return {
            status: "unavailable",
            message:
                error instanceof Error
                    ? error.message
                    : "lolmix-server is not reachable.",
        };
    }

    const body = await readJson(response);
    if (!response.ok) {
        if (response.status >= 400 && response.status < 500) {
            return {
                status: "validation-error",
                httpStatus: response.status,
                error: parseServerError(body),
            };
        }

        return {
            status: "unexpected-error",
            httpStatus: response.status,
            message: parseServerError(body).message,
        };
    }

    const parsed = parseLolmixResponse(body);
    if (!parsed) {
        return {
            status: "unexpected-error",
            message: "lolmix-server returned an unexpected response shape.",
        };
    }

    return {
        status: "success",
        data: parsed,
    };
}

export function parseLolmixResponse(
    payload: unknown,
): LolmixAnalyzeResponse | undefined {
    const record = asRecord(payload);
    if (!record || record.schema_version !== 1) return;

    const sections = asArray(record.sections)
        ?.map(parseSection)
        .filter((section): section is LolmixRecommendationSection => !!section);
    const warnings = asArray(record.warnings)
        ?.map(parseWarning)
        .filter((warning): warning is LolmixWarning => !!warning);
    const enemies = asArray(record.enemies)
        ?.map(parseResponseEnemy)
        .filter((enemy): enemy is LolmixResponseEnemy => !!enemy);
    const sectionsReturned = asArray(record.sections_returned)?.filter(
        (name): name is string => typeof name === "string",
    );

    if (
        typeof record.champion_id !== "number" ||
        typeof record.champion_name !== "string" ||
        !isLolmixLane(record.lane) ||
        typeof record.patch !== "string" ||
        typeof record.tier !== "string" ||
        typeof record.queue !== "number" ||
        typeof record.region !== "string" ||
        (record.top_n !== null && typeof record.top_n !== "number") ||
        (record.sections_requested !== null &&
            !isStringArray(record.sections_requested)) ||
        !sectionsReturned ||
        !enemies ||
        !warnings ||
        !sections
    ) {
        return;
    }

    return {
        schema_version: 1,
        champion_id: record.champion_id,
        champion_name: record.champion_name,
        lane: record.lane,
        patch: record.patch,
        tier: record.tier,
        queue: record.queue,
        region: record.region,
        top_n: record.top_n,
        sections_requested: record.sections_requested,
        sections_returned: sectionsReturned,
        enemies,
        warnings,
        sections,
    };
}

function roleForChampion(
    championKey: string,
    teamComp: ReadonlyMap<Role, string> | undefined,
) {
    return [...(teamComp?.entries() ?? [])].find(
        ([, key]) => key === championKey,
    )?.[0];
}

async function readJson(response: Response): Promise<unknown> {
    try {
        return await response.json();
    } catch {
        return undefined;
    }
}

function parseServerError(payload: unknown): LolmixServerError {
    const error = asRecord(asRecord(payload)?.error);
    const rawDetails = asArray(error?.details);
    const details: LolmixServerError["details"] = [];

    for (const detail of rawDetails ?? []) {
        const record = asRecord(detail);
        if (!record || typeof record.message !== "string") continue;

        details.push({
            field:
                typeof record.field === "string" ? record.field : undefined,
            message: record.message,
        });
    }

    return {
        type: typeof error?.type === "string" ? error.type : "error",
        message:
            typeof error?.message === "string"
                ? error.message
                : "lolmix-server returned an error.",
        details,
    };
}

function parseSection(value: unknown): LolmixRecommendationSection | undefined {
    const record = asRecord(value);
    const entries = asArray(record?.entries)
        ?.map(parseEntry)
        .filter((entry): entry is LolmixRecommendationEntry => !!entry);

    if (!record || typeof record.name !== "string" || !entries) return;

    return {
        name: record.name,
        entries,
    };
}

function parseEntry(value: unknown): LolmixRecommendationEntry | undefined {
    const record = asRecord(value);
    if (!record) return;

    const numericFields = [
        "id",
        "score",
        "overall_wr",
        "overall_pr",
        "overall_delta",
        "overall_n",
        "combined_wr",
        "combined_pr",
        "min_delta",
        "max_delta",
        "total_n_max",
    ] as const;

    if (
        typeof record.name !== "string" ||
        typeof record.section !== "string" ||
        numericFields.some((field) => typeof record[field] !== "number")
    ) {
        return;
    }

    return {
        id: record.id,
        name: record.name,
        section: record.section,
        score: record.score,
        overall_wr: record.overall_wr,
        overall_pr: record.overall_pr,
        overall_delta: record.overall_delta,
        overall_n: record.overall_n,
        combined_wr: record.combined_wr,
        combined_pr: record.combined_pr,
        min_delta: record.min_delta,
        max_delta: record.max_delta,
        total_n_max: record.total_n_max,
        per_matchup: parsePerMatchup(record.per_matchup),
    };
}

function parsePerMatchup(value: unknown) {
    const record = asRecord(value);
    if (!record) return {};

    return Object.fromEntries(
        Object.entries(record).map(([slot, matchup]) => [
            slot,
            matchup === null ? null : parsePerMatchupEntry(matchup) ?? null,
        ]),
    );
}

function parsePerMatchupEntry(
    value: unknown,
): LolmixPerMatchupEntry | undefined {
    const record = asRecord(value);
    if (
        !record ||
        typeof record.id !== "number" ||
        typeof record.name !== "string" ||
        typeof record.wr !== "number" ||
        typeof record.pr !== "number" ||
        typeof record.delta1 !== "number" ||
        typeof record.delta2 !== "number" ||
        typeof record.n !== "number"
    ) {
        return;
    }

    return {
        id: record.id,
        name: record.name,
        wr: record.wr,
        pr: record.pr,
        delta1: record.delta1,
        delta2: record.delta2,
        n: record.n,
    };
}

function parseWarning(value: unknown): LolmixWarning | undefined {
    const record = asRecord(value);
    if (
        !record ||
        typeof record.error_type !== "string" ||
        typeof record.message !== "string"
    ) {
        return;
    }

    return {
        slot: typeof record.slot === "string" ? record.slot : undefined,
        enemy_name:
            typeof record.enemy_name === "string"
                ? record.enemy_name
                : undefined,
        error_type: record.error_type,
        message: record.message,
    };
}

function parseResponseEnemy(value: unknown): LolmixResponseEnemy | undefined {
    const record = asRecord(value);
    if (!record) return;

    return {
        champion_id:
            typeof record.champion_id === "number"
                ? record.champion_id
                : undefined,
        champion_name:
            typeof record.champion_name === "string"
                ? record.champion_name
                : undefined,
        lane: isLolmixLane(record.lane) ? record.lane : undefined,
        slot: typeof record.slot === "string" ? record.slot : undefined,
    };
}

function asRecord(value: unknown): Record<string, any> | undefined {
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
        return;
    }
    return value as Record<string, any>;
}

function asArray(value: unknown): unknown[] | undefined {
    return Array.isArray(value) ? value : undefined;
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isLolmixLane(value: unknown): value is LolmixLane {
    return (
        value === "top" ||
        value === "jungle" ||
        value === "middle" ||
        value === "bottom" ||
        value === "support"
    );
}
