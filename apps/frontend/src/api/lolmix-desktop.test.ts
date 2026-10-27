import { expect, test } from "bun:test";
import { connectLolmix } from "./lolmix-desktop";
import type { CheckedLolmixConnectionState } from "./lolmix-api";

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
