import { invoke, isTauri } from "@tauri-apps/api/core";
import {
    checkLolmixConnection,
    type CheckedLolmixConnectionState,
    type LolmixServerConfig,
} from "./lolmix-api";

export async function connectLolmix(
    config: LolmixServerConfig,
    start = isTauri()
        ? () => invoke("ensure_lolmix_server", config)
        : undefined,
    check = checkLolmixConnection,
): Promise<CheckedLolmixConnectionState> {
    try {
        await start?.();
    } catch (error) {
        return {
            status: "error",
            ...config,
            message: error instanceof Error ? error.message : String(error),
        };
    }
    return check(config);
}

export function createLolmixConnectionQuery(
    ensure:
        | ((config: LolmixServerConfig) => Promise<unknown>)
        | undefined = isTauri()
        ? (config) => invoke("ensure_lolmix_server", config)
        : undefined,
    check = checkLolmixConnection,
) {
    let generation = 0;
    let pending = Promise.resolve();

    // Select synchronously when settings change, before a query can be queued.
    return (config: LolmixServerConfig) => {
        const selected = ++generation;
        return {
            // A -> B -> A must not reuse A's old, still-pending query.
            queryKey: ["lolmix-connection", config.host, config.port, selected],
            queryFn: () =>
                connectLolmix(
                    config,
                    () => {
                        const ready = pending
                            .catch(() => {})
                            .then(async () => {
                                if (selected !== generation) {
                                    throw new Error(
                                        "LoLMix connection settings changed.",
                                    );
                                }
                                // Only one native invocation is in flight. A stale
                                // query can never arrive after the current one.
                                await ensure?.(config);
                                if (selected !== generation) {
                                    throw new Error(
                                        "LoLMix connection settings changed.",
                                    );
                                }
                            });
                        pending = ready;
                        return ready;
                    },
                    // HTTP checks run outside the queue: an unresponsive remote
                    // host must not hold up a subsequent local server startup.
                    check,
                ),
        };
    };
}
