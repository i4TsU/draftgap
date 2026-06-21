import { Icon } from "solid-heroicons";
import { arrowPath } from "solid-heroicons/solid";
import { Component, For, Match, Show, Switch } from "solid-js";
import type { LolmixConnectionState } from "../../api/lolmix-api";
import { useLolmix } from "../../contexts/LolmixContext";
import { Panel, PanelHeader } from "../common/Panel";
import { lolmixSetupSteps, lolmixUnavailableSetupHint } from "./lolmix-display";

type Props = {
    state: LolmixConnectionState;
    host: string;
    port: number;
    onRetry?: () => void;
};

export const LolmixConnectionPanel: Component<Props> = (props) => {
    const host = () => props.host || "not set";

    return (
        <Panel>
            <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <PanelHeader>Lolmix Connection</PanelHeader>
                    <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm uppercase text-neutral-400 -mt-3 mb-3">
                        <span>Host {host()}</span>
                        <span>Port {props.port}</span>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <span
                        class="uppercase text-sm font-semibold"
                        classList={statusClass(props.state.status)}
                    >
                        {statusLabel(props.state.status)}
                    </span>
                    <Show when={props.onRetry}>
                        <button
                            type="button"
                            aria-label="Retry lolmix connection"
                            class="inline-flex items-center gap-1 rounded-md border border-neutral-700 px-2 py-1 text-sm uppercase text-neutral-300 hover:bg-neutral-800 disabled:opacity-50 disabled:hover:bg-transparent"
                            disabled={props.state.status === "checking"}
                            onClick={() => props.onRetry?.()}
                        >
                            <Icon path={arrowPath} class="w-4" />
                            Retry
                        </button>
                    </Show>
                </div>
            </div>

            <Switch>
                <Match when={props.state.status === "not-configured"}>
                    <p class="text-neutral-500 uppercase">
                        Configure a lolmix-server host and port in Settings.
                    </p>
                </Match>
                <Match when={props.state.status === "checking"}>
                    <p class="text-neutral-500 uppercase">
                        Checking lolmix-server...
                    </p>
                </Match>
                <Match when={props.state.status === "connected"}>
                    <p class="text-winrate-good uppercase">
                        Connected to lolmix-server
                        <Show when={connectedVersion(props.state)}>
                            {" "}
                            {connectedVersion(props.state)}
                        </Show>
                        .
                    </p>
                </Match>
                <Match when={props.state.status === "unavailable"}>
                    <div class="text-amber-200">
                        <p class="uppercase">
                            {lolmixUnavailableSetupHint(
                                props.state.host,
                                props.state.port,
                            )}
                        </p>
                        <ul class="mt-2 list-disc pl-5 text-sm text-neutral-400 space-y-1">
                            <For
                                each={lolmixSetupSteps(
                                    props.state.host,
                                    props.state.port,
                                )}
                            >
                                {(step) => <li>{step}</li>}
                            </For>
                        </ul>
                    </div>
                </Match>
                <Match when={props.state.status === "error"}>
                    <p class="text-red-300 uppercase">
                        lolmix-server responded, but DraftGap could not use it:{" "}
                        {errorMessage(props.state)}
                    </p>
                </Match>
            </Switch>
        </Panel>
    );
};

export const LolmixConnectionStatusPanel: Component = () => {
    const { connectionState, host, port, retryConnection } = useLolmix();

    return (
        <LolmixConnectionPanel
            state={connectionState()}
            host={host()}
            port={port()}
            onRetry={() => retryConnection()}
        />
    );
};

function statusLabel(status: LolmixConnectionState["status"]) {
    switch (status) {
        case "not-configured":
            return "Not configured";
        case "checking":
            return "Checking";
        case "connected":
            return "Connected";
        case "unavailable":
            return "Unavailable";
        case "error":
            return "Error";
    }
}

function statusClass(status: LolmixConnectionState["status"]) {
    return {
        "text-neutral-500":
            status === "not-configured" || status === "checking",
        "text-winrate-good": status === "connected",
        "text-amber-300": status === "unavailable",
        "text-red-300": status === "error",
    };
}

function errorMessage(state: LolmixConnectionState) {
    return state.status === "error" ? state.message : "";
}

function connectedVersion(state: LolmixConnectionState) {
    return state.status === "connected" && state.data.version
        ? `v${state.data.version}`
        : undefined;
}
