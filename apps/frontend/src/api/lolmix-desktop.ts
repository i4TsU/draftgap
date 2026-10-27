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
