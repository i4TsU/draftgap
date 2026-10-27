import { expect, test } from "bun:test";
import { QueryClient } from "@tanstack/solid-query";
import { connectLolmix, createLolmixConnectionQuery } from "./lolmix-desktop";
import type {
    CheckedLolmixConnectionState,
    LolmixServerConfig,
} from "./lolmix-api";

const config = { host: "127.0.0.1", port: 8765 };
const connected: CheckedLolmixConnectionState = {
    status: "connected",
    ...config,
    data: { app: "lolmix", status: "ok", schema_version: 1, version: "0.1.0" },
};

test("connection waits for native readiness before making HTTP requests", async () => {
    const calls: string[] = [];
    const result = await connectLolmix(
        config,
        async () => {
            calls.push("start");
            await Promise.resolve();
            calls.push("ready");
        },
        async () => {
            calls.push("check");
            return connected;
        },
    );
    expect(calls).toEqual(["start", "ready", "check"]);
    expect(result).toEqual(connected);
});

test("startup failures reach the connection panel without an HTTP request", async () => {
    const result = await connectLolmix(
        config,
        async () => {
            throw "LoLMix's Python environment is missing.";
        },
        async () => {
            throw new Error("must not check before startup");
        },
    );
    expect(result).toEqual({
        status: "error",
        ...config,
        message: "LoLMix's Python environment is missing.",
    });
});

test("web connections keep working without a native supervisor", async () => {
    expect(
        await connectLolmix(config, undefined, async () => connected),
    ).toEqual(connected);
});

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

const check = async (current: LolmixServerConfig) => ({
    ...connected,
    ...current,
});

test("rapid settings changes discard queued ports and stale disconnects", async () => {
    const started = deferred();
    const release = deferred();
    const calls: LolmixServerConfig[] = [];
    let active = 0;
    let maxActive = 0;
    const select = createLolmixConnectionQuery(async (current) => {
        calls.push(current);
        maxActive = Math.max(maxActive, ++active);
        if (calls.length === 1) {
            started.resolve();
            await release.promise;
        }
        active--;
    }, check);

    const first = select(config).queryFn();
    await started.promise;
    const obsoletePort = select({ ...config, port: 876 }).queryFn();
    const obsoleteDisconnect = select({ ...config, host: "" });
    const latestConfig = { ...config, port: 8766 };
    const latest = select(latestConfig).queryFn();
    // Even an obsolete query scheduled after the newest one cannot stop it.
    const late = obsoleteDisconnect.queryFn();
    release.resolve();

    const results = await Promise.all([first, obsoletePort, latest, late]);
    expect(results.map((result) => result.status)).toEqual([
        "error",
        "error",
        "connected",
        "error",
    ]);
    expect(calls).toEqual([config, latestConfig]);
    expect(maxActive).toBe(1);
});

test("A to B to A selects a fresh query while the first A is still pending", async () => {
    const started = deferred();
    const release = deferred();
    const calls: LolmixServerConfig[] = [];
    const select = createLolmixConnectionQuery(async (current) => {
        calls.push(current);
        if (calls.length === 1) {
            started.resolve();
            await release.promise;
        }
    }, check);
    const client = new QueryClient();
    try {
        const first = client.fetchQuery(select(config));
        await started.promise;
        const middle = client.fetchQuery(select({ ...config, port: 8766 }));
        const last = client.fetchQuery(select(config));
        release.resolve();
        const results = await Promise.all([first, middle, last]);
        expect(results.map((result) => result.status)).toEqual([
            "error",
            "error",
            "connected",
        ]);
        expect(calls).toEqual([config, config]);
    } finally {
        release.resolve();
        client.clear();
    }
});

test("the newest remote or blank host still reaches native cleanup", async () => {
    for (const host of ["example.invalid", ""]) {
        const calls: LolmixServerConfig[] = [];
        const select = createLolmixConnectionQuery(async (current) => {
            calls.push(current);
        }, check);
        await select(config).queryFn();
        const next = { ...config, host };
        await select(next).queryFn();
        expect(calls).toEqual([config, next]);
    }
});

test("a failed native request does not block the latest settings or retries", async () => {
    let attempts = 0;
    const select = createLolmixConnectionQuery(async () => {
        if (++attempts === 1) throw new Error("synthetic startup failure");
    }, check);
    expect((await select(config).queryFn()).status).toBe("error");
    const latest = select({ ...config, port: 8766 });
    expect((await latest.queryFn()).status).toBe("connected");
    expect((await latest.queryFn()).status).toBe("connected");
    expect(attempts).toBe(3);
});

test("a pending HTTP check does not block newer native settings", async () => {
    const checking = deferred();
    const release = deferred();
    const calls: LolmixServerConfig[] = [];
    const select = createLolmixConnectionQuery(
        async (current) => {
            calls.push(current);
        },
        async (current) => {
            if (current.host === "example.invalid") {
                checking.resolve();
                await release.promise;
            }
            return check(current);
        },
    );
    const remote = select({ ...config, host: "example.invalid" }).queryFn();
    await checking.promise;
    try {
        expect((await select(config).queryFn()).status).toBe("connected");
        expect(calls).toEqual([{ ...config, host: "example.invalid" }, config]);
    } finally {
        release.resolve();
        await remote;
    }
});
