import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import type { Dataset } from "../../packages/core/src/models/dataset/Dataset";
import { Role } from "../../packages/core/src/models/Role";
import {
  buildLolmixAnalyzeRequest,
  checkLolmixConnection,
  fetchLolmixRecommendations,
  lolmixAnalyzeEndpoint,
  parseLolmixResponse,
} from "../../apps/frontend/src/api/lolmix-api";
import {
  lolmixRunePageDisplayEntries,
  lolmixRunePageRecommendedEntry,
  lolmixWarningLines,
  parseLolmixRunePageKey,
  visibleLolmixSections,
} from "../../apps/frontend/src/components/lolmix/lolmix-display";
import { lolmixRepo, requireRepositories } from "../lib/cross-repo";

requireRepositories();
type Server = {
  process: Bun.Subprocess<"pipe", "pipe", "inherit">;
  host: string;
  port: number;
};
const servers: Server[] = [];

async function startServer(schema?: number) {
  const args = [
    "uv",
    "run",
    "--locked",
    "--no-sync",
    "python",
    resolve(import.meta.dir, "lolmix-contract-server.py"),
  ];
  if (schema !== undefined) args.push("--schema-version", String(schema));
  const child = Bun.spawn(args, {
    cwd: lolmixRepo,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "inherit",
  });
  const reader = child.stdout.getReader();
  const decoder = new TextDecoder();
  let text = "";
  try {
    const ready = async () => {
      while (!text.includes("\n")) {
        const next = await reader.read();
        if (next.done) throw new Error(`LoLMix fixture server exited: ${text}`);
        text += decoder.decode(next.value, { stream: true });
      }
      return JSON.parse(text.split("\n")[0]!);
    };
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const address = await Promise.race([
      ready(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("LoLMix fixture server startup timed out.")),
          15_000,
        );
      }),
    ]).finally(() => clearTimeout(timeout));
    const owned = {
      process: child,
      host: address.host as string,
      port: address.port as number,
    };
    servers.push(owned);
    return owned;
  } catch (error) {
    child.stdin.end();
    await child.exited;
    throw error;
  } finally {
    reader.releaseLock();
  }
}

const dataset = {
  championData: Object.fromEntries(
    [
      [157, "Yasuo"],
      [122, "Darius"],
      [238, "Zed"],
      [121, "Khazix"],
    ].map(([id, name]) => [String(id), { key: String(id), id: name, name }]),
  ),
} as Dataset;
const pick = (championKey: string, role: Role) => ({ championKey, role });
const request = buildLolmixAnalyzeRequest({
  buildPick: { team: "ally", index: 0 },
  allyTeam: [pick("157", Role.Middle)],
  opponentTeam: [
    pick("122", Role.Top),
    pick("238", Role.Middle),
    pick("121", Role.Jungle),
  ],
  allyTeamComp: new Map([[Role.Middle, "157"]]),
  opponentTeamComp: new Map([
    [Role.Top, "122"],
    [Role.Middle, "238"],
    [Role.Jungle, "121"],
  ]),
  dataset,
});
if (!request.ok) throw new Error(request.message);
const payload = request.payload;
let server: Server;

beforeAll(async () => {
  server = await startServer();
}, 20_000);
afterAll(async () => {
  for (const owned of servers) owned.process.stdin.end();
  await Promise.all(servers.map((owned) => owned.process.exited));
}, 10_000);

describe("DraftGap client against the real LoLMix HTTP and export stack", () => {
  test("connects and preserves draft metadata, contextual metrics and partial-matchup warnings", async () => {
    expect((await checkLolmixConnection(server)).status).toBe("connected");
    const result = await fetchLolmixRecommendations(
      lolmixAnalyzeEndpoint(server.host, server.port)!,
      payload,
    );
    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error(JSON.stringify(result));
    expect(result.data.champion_id).toBe(157);
    expect(result.data.lane).toBe("middle");
    expect(result.data.tier).toBe(payload.tier);
    expect(result.data.sections_requested).toEqual(payload.sections);
    expect(
      result.data.enemies.find((enemy) => enemy.champion_id === 238)?.slot,
    ).toBe("lane");
    const entry = result.data.sections.find(
      (section) => section.name === "summoners",
    )!.entries[0]!;
    expect(entry.combined_wr).toBe(0.527);
    expect(entry.context_wr).toBe(0.541);
    expect(entry.context_coverage).toBe(0.67);
    expect(entry.per_matchup.jungle).toBeNull();
    expect(entry.per_matchup.lane?.n).toBe(800);
    expect(lolmixWarningLines(result.data)[0]).toContain(
      "synthetic matchup unavailable",
    );
    expect(
      visibleLolmixSections(result.data).map((section) => section.name),
    ).not.toContain("keystones");
    const runes = result.data.sections.find(
      (section) => section.name === "rune_page",
    )!;
    const recommended = lolmixRunePageRecommendedEntry(runes)!;
    expect(parseLolmixRunePageKey(recommended.name)?.kind).toBe("optimal");
    expect(lolmixRunePageDisplayEntries(runes)).toHaveLength(3);
    expect(parseLolmixRunePageKey(recommended.name)?.shards).toEqual([
      5008, 5008, 5001,
    ]);
  });

  test("real server respects selected sections and surfaces field validation errors", async () => {
    const endpoint = lolmixAnalyzeEndpoint(server.host, server.port)!;
    const selected = await fetchLolmixRecommendations(endpoint, {
      ...payload,
      sections: ["summoners"],
    });
    expect(selected.status).toBe("success");
    if (selected.status === "success")
      expect(selected.data.sections_returned).toEqual(["summoners"]);
    const invalid = await fetchLolmixRecommendations(endpoint, {
      ...payload,
      my_champion_id: -1,
    });
    expect(invalid.status).toBe("validation-error");
    if (invalid.status === "validation-error") {
      expect(invalid.httpStatus).toBe(400);
      expect(invalid.error.details.length).toBeGreaterThan(0);
    }
  });

  test("rejects a future schema from both real health and recommendation responses", async () => {
    const future = await startServer(999);
    expect((await checkLolmixConnection(future)).status).toBe("error");
    const endpoint = lolmixAnalyzeEndpoint(future.host, future.port)!;
    const raw = await fetch(endpoint, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });
    const body = (await raw.json()) as Record<string, unknown>;
    expect(body.schema_version).toBe(999);
    expect(parseLolmixResponse(body)).toBeUndefined();
    expect((await fetchLolmixRecommendations(endpoint, payload)).status).toBe(
      "unexpected-error",
    );
  }, 20_000);

  test("keeps loopback CORS origins and does not grant remote preview origins", async () => {
    const url = `http://${server.host}:${server.port}/health`;
    const local = await fetch(url, {
      headers: { Origin: "http://127.0.0.1:3000" },
    });
    expect(local.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://127.0.0.1:3000",
    );
    const remote = await fetch(url, {
      headers: { Origin: "https://example.com" },
    });
    expect(remote.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
