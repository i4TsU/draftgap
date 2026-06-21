import { createQuery } from "@tanstack/solid-query";
import { JSXElement, createContext, createMemo, useContext } from "solid-js";
import type {
    LolmixClientResult,
    LolmixConnectionState,
    LolmixDraftRequestResult,
} from "../api/lolmix-api";
import {
    buildLolmixAnalyzeRequest,
    checkLolmixConnection,
    fetchLolmixRecommendations,
    lolmixAnalyzeEndpoint,
    lolmixServerConfig,
    notConfiguredLolmixConnectionState,
} from "../api/lolmix-api";
import { useBuild } from "./BuildContext";
import { useDataset } from "./DatasetContext";
import { useDraft } from "./DraftContext";
import { useDraftAnalysis } from "./DraftAnalysisContext";
import { useDraftView } from "./DraftViewContext";
import { useUser } from "./UserContext";

export type LolmixRecommendationsState =
    | {
          status: "not-configured";
          request: Extract<LolmixDraftRequestResult, { ok: true }>;
      }
    | {
          status: "invalid-draft";
          request: Extract<LolmixDraftRequestResult, { ok: false }>;
      }
    | {
          status: "loading";
          request: Extract<LolmixDraftRequestResult, { ok: true }>;
      }
    | {
          status: "idle";
          request: Extract<LolmixDraftRequestResult, { ok: true }>;
      }
    | (LolmixClientResult & {
          request: Extract<LolmixDraftRequestResult, { ok: true }>;
      });

export function createLolmixContext() {
    const { config } = useUser();
    const { dataset } = useDataset();
    const { allyTeam, opponentTeam } = useDraft();
    const { allyTeamComp, opponentTeamComp } = useDraftAnalysis();
    const { buildPick } = useBuild();
    const { currentDraftView } = useDraftView();

    const serverConfig = createMemo(() =>
        lolmixServerConfig(config.lolmixServerHost, config.lolmixServerPort),
    );
    const endpoint = () =>
        lolmixAnalyzeEndpoint(serverConfig().host, serverConfig().port);
    const request = createMemo(() =>
        buildLolmixAnalyzeRequest({
            buildPick: buildPick(),
            allyTeam,
            opponentTeam,
            allyTeamComp: allyTeamComp(),
            opponentTeamComp: opponentTeamComp(),
            dataset: dataset(),
        }),
    );

    const connectionQuery = createQuery(() => {
        const currentConfig = serverConfig();

        return {
            queryKey: [
                "lolmix-connection",
                currentConfig.host,
                currentConfig.port,
            ],
            queryFn: () => checkLolmixConnection(currentConfig),
            get enabled() {
                return currentConfig.host.length > 0;
            },
            refetchInterval: false,
            refetchOnMount: true,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            retry: false,
        };
    });

    const connectionState = createMemo<LolmixConnectionState>(() => {
        const currentConfig = serverConfig();
        if (!currentConfig.host) {
            return notConfiguredLolmixConnectionState(
                currentConfig.host,
                currentConfig.port,
            );
        }

        if (
            connectionQuery.isLoading ||
            (connectionQuery.isFetching && !connectionQuery.data)
        ) {
            return {
                status: "checking",
                host: currentConfig.host,
                port: currentConfig.port,
            };
        }

        return (
            connectionQuery.data ?? {
                status: "checking",
                host: currentConfig.host,
                port: currentConfig.port,
            }
        );
    });

    const query = createQuery(() => {
        const currentRequest = request();
        const currentEndpoint = endpoint();
        return {
            queryKey: [
                "lolmix",
                currentEndpoint,
                currentRequest.ok ? currentRequest.payload : currentRequest,
            ],
            queryFn: async () => {
                if (!currentRequest.ok) {
                    return {
                        status: "unexpected-error",
                        message: currentRequest.message,
                    } satisfies LolmixClientResult;
                }
                if (!currentEndpoint) {
                    return {
                        status: "unexpected-error",
                        message: "Configure a lolmix-server host first.",
                    } satisfies LolmixClientResult;
                }

                return fetchLolmixRecommendations(
                    currentEndpoint,
                    currentRequest.payload,
                );
            },
            get enabled() {
                return (
                    currentRequest.ok &&
                    currentEndpoint !== undefined &&
                    connectionState().status === "connected" &&
                    currentDraftView().type === "builds"
                );
            },
            refetchInterval: false,
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            retry: false,
        };
    });

    const state = createMemo<LolmixRecommendationsState>(() => {
        const currentRequest = request();
        if (!currentRequest.ok) {
            return {
                status: "invalid-draft",
                request: currentRequest,
            };
        }

        if (!endpoint()) {
            return {
                status: "not-configured",
                request: currentRequest,
            };
        }

        if (query.isLoading || (query.isFetching && !query.data)) {
            return {
                status: "loading",
                request: currentRequest,
            };
        }

        if (!query.data) {
            return {
                status: "idle",
                request: currentRequest,
            };
        }

        return {
            ...query.data,
            request: currentRequest,
        };
    });

    return {
        endpoint,
        connectionQuery,
        connectionState,
        query,
        request,
        state,
        retryConnection: () => connectionQuery.refetch(),
        host: () => serverConfig().host,
        port: () => serverConfig().port,
    };
}

const LolmixContext = createContext<ReturnType<typeof createLolmixContext>>();

export function LolmixProvider(props: { children: JSXElement }) {
    const ctx = createLolmixContext();

    return (
        <LolmixContext.Provider value={ctx}>
            {props.children}
        </LolmixContext.Provider>
    );
}

export const useLolmix = () => {
    const useCtx = useContext(LolmixContext);
    if (!useCtx) throw new Error("No LolmixContext found");

    return useCtx;
};
