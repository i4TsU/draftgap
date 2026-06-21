import { Component, For, Match, Show, Switch } from "solid-js";
import type {
    LolmixAnalyzeResponse,
    LolmixRecommendationEntry,
    LolmixRecommendationSection,
} from "../../api/lolmix-api";
import type {
    LolmixRecommendationsState,
} from "../../contexts/LolmixContext";
import {
    useLolmix,
} from "../../contexts/LolmixContext";
import { Panel, PanelHeader } from "../common/Panel";
import {
    formatLolmixCount,
    formatLolmixPercent,
    formatLolmixSignedPercent,
    lolmixHeadlineMetric,
    lolmixSampleSize,
    lolmixSectionTitle,
    lolmixUnavailableSetupHint,
    lolmixWarningLines,
    visibleLolmixEntries,
    visibleLolmixSections,
} from "./lolmix-display";

type Props = {
    state: LolmixRecommendationsState;
    port: number;
    onRefresh?: () => void;
};

export const LolmixRecommendationsPanel: Component = () => {
    const { state, port, query } = useLolmix();

    return (
        <LolmixRecommendationsContent
            state={state()}
            port={port()}
            onRefresh={() => query.refetch()}
        />
    );
};

export const LolmixRecommendationsContent: Component<Props> = (props) => {
    const validRequest = () =>
        props.state.request.ok ? props.state.request : undefined;
    const invalidRequest = () =>
        props.state.status === "invalid-draft"
            ? props.state.request
            : undefined;
    const validationError = () =>
        props.state.status === "validation-error" ? props.state : undefined;
    const unexpectedError = () =>
        props.state.status === "unexpected-error" ? props.state : undefined;
    const success = () =>
        props.state.status === "success" ? props.state : undefined;

    return (
        <Panel>
            <div class="flex items-start justify-between gap-4">
                <div>
                    <PanelHeader>Lolmix</PanelHeader>
                    <Show when={validRequest()}>
                        <p class="text-neutral-500 uppercase -mt-3 mb-4">
                            {validRequest()!.championName}{" "}
                            {validRequest()!.lane} vs{" "}
                            {validRequest()!.enemyCount} locked enemies
                        </p>
                    </Show>
                </div>
                <Show when={props.onRefresh}>
                    <button
                        class="uppercase text-neutral-400 hover:text-neutral-200 transition text-sm font-semibold"
                        onClick={() => props.onRefresh?.()}
                    >
                        Refresh
                    </button>
                </Show>
            </div>

            <Switch>
                <Match when={props.state.status === "invalid-draft"}>
                    <StatusMessage tone="muted">
                        {invalidRequest()?.message}
                    </StatusMessage>
                </Match>
                <Match when={props.state.status === "idle"}>
                    <StatusMessage tone="muted">
                        Lolmix recommendations are ready to request.
                    </StatusMessage>
                </Match>
                <Match when={props.state.status === "loading"}>
                    <StatusMessage tone="muted">
                        Loading lolmix recommendations...
                    </StatusMessage>
                </Match>
                <Match when={props.state.status === "unavailable"}>
                    <StatusMessage tone="warning">
                        {lolmixUnavailableSetupHint(props.port)}
                    </StatusMessage>
                </Match>
                <Match when={props.state.status === "validation-error"}>
                    <StatusMessage tone="warning">
                        Lolmix rejected this draft:{" "}
                        {validationError()?.error.message}
                    </StatusMessage>
                    <Show
                        when={
                            (validationError()?.error.details.length ?? 0) > 0
                        }
                    >
                        <ul class="mt-2 text-sm text-neutral-400 space-y-1">
                            <For each={validationError()?.error.details ?? []}>
                                {(detail) => (
                                    <li>
                                        <span class="text-neutral-300">
                                            {detail.field ?? "request"}
                                        </span>
                                        : {detail.message}
                                    </li>
                                )}
                            </For>
                        </ul>
                    </Show>
                </Match>
                <Match when={props.state.status === "unexpected-error"}>
                    <StatusMessage tone="warning">
                        Lolmix returned an unexpected error:{" "}
                        {unexpectedError()?.message}
                    </StatusMessage>
                </Match>
                <Match when={props.state.status === "success"}>
                    <Show when={success()}>
                        <Recommendations data={success()!.data} />
                    </Show>
                </Match>
            </Switch>
        </Panel>
    );
};

const StatusMessage: Component<{
    tone: "muted" | "warning";
    children: any;
}> = (props) => {
    return (
        <div
            class="text-lg uppercase"
            classList={{
                "text-neutral-500": props.tone === "muted",
                "text-amber-300": props.tone === "warning",
            }}
        >
            {props.children}
        </div>
    );
};

const Recommendations: Component<{ data: LolmixAnalyzeResponse }> = (props) => {
    const sections = () => visibleLolmixSections(props.data);

    return (
        <div class="flex flex-col gap-5">
            <Show when={props.data.warnings.length > 0}>
                <div class="border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
                    <div class="uppercase font-semibold mb-1">
                        Partial matchup warnings
                    </div>
                    <For each={lolmixWarningLines(props.data)}>
                        {(warning) => <div>{warning}</div>}
                    </For>
                </div>
            </Show>

            <Show
                when={sections().length > 0}
                fallback={
                    <StatusMessage tone="muted">
                        No lolmix recommendations returned.
                    </StatusMessage>
                }
            >
                <div class="grid gap-5 xl:grid-cols-2">
                    <For each={sections()}>
                        {(section) => <Section section={section} />}
                    </For>
                </div>
            </Show>
        </div>
    );
};

const Section: Component<{ section: LolmixRecommendationSection }> = (props) => {
    const entries = () => visibleLolmixEntries(props.section);

    return (
        <section class="min-w-0">
            <h3 class="uppercase text-lg font-semibold mb-2">
                {lolmixSectionTitle(props.section.name)}
            </h3>
            <div class="border-y border-neutral-800 divide-y divide-neutral-800">
                <For each={entries()}>
                    {(entry) => (
                        <EntryRow
                            entry={entry}
                            sectionName={props.section.name}
                        />
                    )}
                </For>
            </div>
        </section>
    );
};

const EntryRow: Component<{
    entry: LolmixRecommendationEntry;
    sectionName: string;
}> = (props) => {
    const headline = () => lolmixHeadlineMetric(props.sectionName, props.entry);

    return (
        <div class="py-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div class="min-w-0">
                <div class="text-neutral-100 truncate">{props.entry.name}</div>
                <div class="text-xs text-neutral-500 uppercase">
                    N {formatLolmixCount(lolmixSampleSize(props.entry))}
                </div>
            </div>
            <div class="flex flex-wrap md:justify-end gap-x-3 gap-y-1 text-sm uppercase text-neutral-400">
                <span class={headline().class}>
                    {headline().label} {headline().value}
                </span>
                <Show when={props.sectionName !== "winning_items"}>
                    <span>
                        Score {formatLolmixSignedPercent(props.entry.score)}
                    </span>
                </Show>
                <span>
                    Overall {formatLolmixPercent(props.entry.overall_wr)} /{" "}
                    {formatLolmixPercent(props.entry.overall_pr)}
                </span>
                <span>
                    Combined {formatLolmixPercent(props.entry.combined_wr)} /{" "}
                    {formatLolmixPercent(props.entry.combined_pr)}
                </span>
            </div>
        </div>
    );
};
