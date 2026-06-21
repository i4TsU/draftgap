import { createQuery } from "@tanstack/solid-query";
import { JSXElement, createContext, createMemo, useContext } from "solid-js";
import type {
    LolmixClientResult,
    LolmixDraftRequestResult,
} from "../api/lolmix-api";
import {
    buildLolmixAnalyzeRequest,
    fetchLolmixRecommendations,
    lolmixAnalyzeEndpoint,
} from "../api/lolmix-api";
import { useBuild } from "./BuildContext";
import { useDataset } from "./DatasetContext";
import { useDraft } from "./DraftContext";
import { useDraftAnalysis } from "./DraftAnalysisContext";
import { useDraftView } from "./DraftViewContext";
import { useUser } from "./UserContext";

export type LolmixRecommendationsState =
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

    const endpoint = () => lolmixAnalyzeEndpoint(config.lolmixServerPort);
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

    const query = createQuery(() => {
        const currentRequest = request();
        return {
            queryKey: [
                "lolmix",
                endpoint(),
                currentRequest.ok ? currentRequest.payload : currentRequest,
            ],
            queryFn: async () => {
                if (!currentRequest.ok) {
                    return {
                        status: "unexpected-error",
                        message: currentRequest.message,
                    } satisfies LolmixClientResult;
                }

                return fetchLolmixRecommendations(
                    endpoint(),
                    currentRequest.payload,
                );
            },
            get enabled() {
                return (
                    currentRequest.ok && currentDraftView().type === "builds"
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
        query,
        request,
        state,
        port: () => config.lolmixServerPort,
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
