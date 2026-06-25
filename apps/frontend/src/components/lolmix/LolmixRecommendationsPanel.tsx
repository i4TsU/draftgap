import { Icon } from "solid-heroicons";
import { arrowPath, chevronRight } from "solid-heroicons/solid";
import {
    Component,
    For,
    JSX,
    Match,
    Show,
    Switch,
    createMemo,
    createSignal,
} from "solid-js";
import type { Dataset } from "@draftgap/core/src/models/dataset/Dataset";
import type {
    LolmixAnalyzeResponse,
    LolmixConnectionState,
    LolmixRecommendationEntry,
    LolmixRecommendationSection,
} from "../../api/lolmix-api";
import type { LolmixRecommendationsState } from "../../contexts/LolmixContext";
import { useDataset } from "../../contexts/DatasetContext";
import { useLolmix } from "../../contexts/LolmixContext";
import { cn } from "../../utils/style";
import { Panel } from "../common/Panel";
import {
    LOLMIX_MATCHUP_SLOT_ORDER,
    LOLMIX_PHASES,
    LOLMIX_SKILL_EARLY_LEVELS,
    LOLMIX_SKILL_EARLY_SLOTS,
    formatLolmixCompactCount,
    formatLolmixCount,
    formatLolmixPercent,
    formatLolmixSignedPercent,
    groupLolmixSections,
    isLolmixRecommendationEligible,
    lolmixActiveSlots,
    lolmixBuildPathSteps,
    lolmixCollapsedDisplayEntries,
    lolmixDisplayEntries,
    lolmixEnemyBySlot,
    lolmixLaneLabel,
    lolmixLaneMatchup,
    lolmixRecommendedEntry,
    lolmixSampleConfidence,
    lolmixScoreClass,
    lolmixScoreToneClass,
    lolmixSectionByName,
    lolmixSectionMeta,
    lolmixSectionTitle,
    lolmixSetupSteps,
    lolmixSkillEarlyKey,
    lolmixUnavailableSetupHint,
    lolmixWarningLines,
    lolmixWinrateTextClass,
    parseLolmixDisplayRunePageKey,
    parseLolmixReadableRunePage,
    parseLolmixRunePageKey,
    type LolmixBuildPathStep,
    type LolmixDecisionPhase,
    type LolmixDisplayEntry,
    type LolmixRunePage,
} from "./lolmix-display";

type Props = {
    state: LolmixRecommendationsState;
    connectionStatus: LolmixConnectionState["status"];
    host: string;
    port: number;
    onRefresh?: () => void;
};

type RuneRecord = Dataset["runeData"][number];
type RunePathRecord = Dataset["runePathData"][number];
type StatShardRecord = Dataset["statShardData"][number];

const RUNE_PATH_ORDER = [8000, 8100, 8200, 8400, 8300] as const;
const SHARD_SLOT_LABELS = ["Offense", "Flex", "Defense"] as const;

export const LolmixRecommendationsPanel: Component = () => {
    const { connectionState, host, port, query, state } = useLolmix();

    return (
        <LolmixRecommendationsContent
            state={state()}
            connectionStatus={connectionState().status}
            host={host()}
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
        <Panel class="flex flex-col gap-3 p-3 lg:p-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                    <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <h2 class="text-sm font-bold uppercase tracking-wide text-neutral-100">
                            Lolmix
                        </h2>
                        <Show when={validRequest()}>
                            <span class="text-xs uppercase text-neutral-500">
                                <span class="text-neutral-300">
                                    {validRequest()!.championName}
                                </span>{" "}
                                {lolmixLaneLabel(validRequest()!.lane)} vs{" "}
                                {validRequest()!.enemyCount} locked enemies
                            </span>
                        </Show>
                    </div>
                    <Show when={success()}>
                        <p class="mt-1 text-xs uppercase text-neutral-500">
                            Patch {success()!.data.patch} /{" "}
                            {success()!.data.tier}
                        </p>
                    </Show>
                </div>
                <Show when={props.onRefresh}>
                    <button
                        type="button"
                        class="inline-flex items-center gap-1 rounded-md border border-neutral-800 px-2 py-1 text-xs font-semibold uppercase text-neutral-400 transition hover:border-neutral-600 hover:text-neutral-100 disabled:opacity-50"
                        disabled={props.state.status === "loading"}
                        onClick={() => props.onRefresh?.()}
                    >
                        <Icon path={arrowPath} class="w-3.5" />
                        Refresh
                    </button>
                </Show>
            </div>

            <Switch>
                <Match when={props.state.status === "invalid-draft"}>
                    <StateMessage tone="muted" title="Not enough draft info">
                        {invalidRequest()?.message}
                    </StateMessage>
                </Match>
                <Match when={props.state.status === "not-configured"}>
                    <StateMessage tone="muted" title="Lolmix is not configured">
                        Configure a lolmix-server host and port in Settings to
                        request optional recommendations. DraftGap build
                        analysis remains available below.
                    </StateMessage>
                </Match>
                <Match when={props.state.status === "idle"}>
                    <IdleState
                        connectionStatus={props.connectionStatus}
                        host={props.host}
                        port={props.port}
                    />
                </Match>
                <Match when={props.state.status === "loading"}>
                    <LoadingState />
                </Match>
                <Match when={props.state.status === "unavailable"}>
                    <UnavailableState host={props.host} port={props.port} />
                </Match>
                <Match when={props.state.status === "validation-error"}>
                    <StateMessage tone="warning" title="Request rejected">
                        Lolmix rejected this draft:{" "}
                        {validationError()?.error.message}
                    </StateMessage>
                    <Show
                        when={
                            (validationError()?.error.details.length ?? 0) > 0
                        }
                    >
                        <ul class="space-y-1 rounded-md border border-neutral-800 bg-neutral-950/30 px-3 py-2 text-xs text-neutral-400">
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
                    <StateMessage tone="warning" title="Unexpected response">
                        Lolmix returned an unexpected error:{" "}
                        {unexpectedError()?.message}. DraftGap build analysis
                        remains available below.
                    </StateMessage>
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

const IdleState: Component<{
    connectionStatus: LolmixConnectionState["status"];
    host: string;
    port: number;
}> = (props) => {
    return (
        <Switch>
            <Match when={props.connectionStatus === "connected"}>
                <StateMessage tone="muted" title="Ready">
                    Connected. Recommendations will load for the selected
                    champion.
                </StateMessage>
            </Match>
            <Match when={props.connectionStatus === "checking"}>
                <StateMessage tone="muted" title="Checking lolmix-server">
                    DraftGap is checking the configured local lolmix-server.
                </StateMessage>
            </Match>
            <Match
                when={
                    props.connectionStatus === "unavailable" ||
                    props.connectionStatus === "error"
                }
            >
                <UnavailableState host={props.host} port={props.port} />
            </Match>
            <Match when={true}>
                <StateMessage tone="muted" title="Connect lolmix-server">
                    Connect lolmix-server to request optional recommendations.
                </StateMessage>
            </Match>
        </Switch>
    );
};

const LoadingState: Component = () => (
    <div class="flex flex-col gap-3">
        <StateMessage tone="muted" title="Fetching recommendations">
            Loading lolmix recommendations for the selected champion.
        </StateMessage>
        <div class="grid grid-cols-1 gap-2 lg:grid-cols-2">
            <For each={Array.from({ length: 4 })}>
                {(_, index) => (
                    <div
                        class="animate-pulse rounded-md border border-neutral-800 bg-neutral-900/30 p-3"
                        aria-hidden="true"
                    >
                        <div
                            class={cn(
                                "mb-2 h-3 rounded bg-neutral-800",
                                index() % 2 === 0 ? "w-24" : "w-32",
                            )}
                        />
                        <div class="mb-1.5 h-8 rounded bg-neutral-800/70" />
                        <div class="h-8 rounded bg-neutral-800/50" />
                    </div>
                )}
            </For>
        </div>
    </div>
);

const UnavailableState: Component<{ host: string; port: number }> = (props) => (
    <StateMessage tone="warning" title="lolmix-server is unreachable">
        <p>{lolmixUnavailableSetupHint(props.host, props.port)}</p>
        <ol class="mt-2 list-decimal space-y-1 pl-4 text-neutral-400">
            <For each={lolmixSetupSteps(props.host, props.port)}>
                {(step) => <li>{step}</li>}
            </For>
        </ol>
    </StateMessage>
);

const StateMessage: Component<{
    tone: "muted" | "warning";
    title: string;
    children: JSX.Element;
}> = (props) => (
    <div
        class={cn(
            "rounded-md border px-3 py-2.5 text-sm",
            props.tone === "warning"
                ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
                : "border-neutral-800 bg-neutral-900/35 text-neutral-400",
        )}
    >
        <div
            class={cn(
                "mb-1 text-xs font-semibold uppercase tracking-wide",
                props.tone === "warning"
                    ? "text-amber-300"
                    : "text-neutral-200",
            )}
        >
            {props.title}
        </div>
        <div class="font-body text-xs leading-relaxed">{props.children}</div>
    </div>
);

const Recommendations: Component<{ data: LolmixAnalyzeResponse }> = (props) => {
    const { dataset } = useDataset();
    const grouped = createMemo(() => groupLolmixSections(props.data));
    const [phase, setPhase] = createSignal<LolmixDecisionPhase>("now");
    const activePhase = createMemo(() => {
        if (grouped()[phase()].length > 0) return phase();
        return (
            LOLMIX_PHASES.find((item) => grouped()[item.id].length > 0)?.id ??
            phase()
        );
    });
    const sections = () => grouped()[activePhase()];

    return (
        <div class="flex flex-col gap-3">
            <EnemyBar data={props.data} />
            <WarningBand data={props.data} />
            <QuickDecisions data={props.data} dataset={dataset()} />
            <PhaseTabs
                grouped={grouped()}
                activePhase={activePhase()}
                onSelect={setPhase}
            />
            <Show
                when={sections().length > 0}
                fallback={
                    <StateMessage tone="muted" title="No recommendations">
                        No lolmix recommendations returned for this phase.
                    </StateMessage>
                }
            >
                <PhaseContent
                    data={props.data}
                    dataset={dataset()}
                    phase={activePhase()}
                    sections={sections()}
                />
            </Show>
        </div>
    );
};

const EnemyBar: Component<{ data: LolmixAnalyzeResponse }> = (props) => (
    <Show when={props.data.enemies.length > 0}>
        <div class="flex flex-wrap items-center gap-1.5 rounded-md bg-neutral-950/30 px-2.5 py-1.5">
            <span class="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Vs
            </span>
            <For each={props.data.enemies}>
                {(enemy) => {
                    const isLane = () => enemy.slot === "lane";
                    return (
                        <span
                            class={cn(
                                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs",
                                isLane()
                                    ? "bg-opponent/15 font-medium text-red-200 ring-1 ring-opponent/40"
                                    : "bg-neutral-800/60 text-neutral-300",
                            )}
                        >
                            <Show when={isLane()}>
                                <span class="text-opponent">Lane</span>
                            </Show>
                            {enemy.champion_name ?? lolmixLaneLabel(enemy.lane)}
                            <span class="text-[10px] uppercase text-neutral-500">
                                {lolmixLaneLabel(enemy.slot)}
                            </span>
                        </span>
                    );
                }}
            </For>
        </div>
    </Show>
);

const WarningBand: Component<{ data: LolmixAnalyzeResponse }> = (props) => {
    const [dismissed, setDismissed] = createSignal(false);
    const [expanded, setExpanded] = createSignal(false);
    const warnings = () => lolmixWarningLines(props.data);

    return (
        <Show when={warnings().length > 0 && !dismissed()}>
            <div class="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                <div class="flex items-start gap-2">
                    <div class="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border border-amber-300/40 text-[10px] font-bold text-amber-300">
                        !
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="font-semibold uppercase tracking-wide text-amber-300">
                                {warnings().length} warning
                                {warnings().length === 1 ? "" : "s"}
                            </span>
                            <Show when={warnings().length > 1}>
                                <button
                                    type="button"
                                    class="text-amber-300/80 underline-offset-2 hover:underline"
                                    onClick={() => setExpanded(!expanded())}
                                >
                                    {expanded() ? "Collapse" : "Show all"}
                                </button>
                            </Show>
                        </div>
                        <p class="mt-0.5 font-body leading-snug">
                            {warnings()[0]}
                        </p>
                        <Show when={expanded()}>
                            <ul class="mt-1 space-y-0.5 font-body">
                                <For each={warnings().slice(1)}>
                                    {(warning) => <li>{warning}</li>}
                                </For>
                            </ul>
                        </Show>
                    </div>
                    <button
                        type="button"
                        class="shrink-0 text-amber-300/70 hover:text-amber-200"
                        aria-label="Dismiss lolmix warnings"
                        onClick={() => setDismissed(true)}
                    >
                        X
                    </button>
                </div>
            </div>
        </Show>
    );
};

const QuickDecisions: Component<{
    data: LolmixAnalyzeResponse;
    dataset: Dataset | undefined;
}> = (props) => {
    const tiles = createMemo(() =>
        quickDecisionTiles(props.data, props.dataset),
    );

    return (
        <Show when={tiles().length > 0}>
            <div class="grid grid-cols-2 gap-2 lg:grid-cols-5">
                <For each={tiles()}>
                    {(tile) => (
                        <div class="min-w-0 rounded-md border border-neutral-800 bg-neutral-900/35 p-2.5">
                            <div class="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                                {tile.label}
                            </div>
                            <div
                                class="mt-1 truncate text-sm font-semibold text-neutral-100"
                                title={tile.value}
                            >
                                {tile.value}
                            </div>
                            <div class="mt-1 flex items-center justify-between gap-2 text-xs">
                                <span class="truncate text-neutral-500">
                                    {tile.sub}
                                </span>
                                <Show when={tile.score !== undefined}>
                                    <span
                                        class={cn(
                                            "shrink-0 tabular-nums",
                                            lolmixScoreClass(tile.score!),
                                        )}
                                    >
                                        {formatLolmixSignedPercent(tile.score!)}
                                    </span>
                                </Show>
                            </div>
                        </div>
                    )}
                </For>
            </div>
        </Show>
    );
};

const PhaseTabs: Component<{
    grouped: ReturnType<typeof groupLolmixSections>;
    activePhase: LolmixDecisionPhase;
    onSelect: (phase: LolmixDecisionPhase) => void;
}> = (props) => (
    <div class="grid grid-cols-2 gap-1 rounded-md bg-neutral-950/40 p-1 lg:grid-cols-4">
        <For each={LOLMIX_PHASES}>
            {(item) => {
                const count = () => props.grouped[item.id].length;
                const disabled = () => count() === 0;

                return (
                    <button
                        type="button"
                        disabled={disabled()}
                        class={cn(
                            "rounded px-2 py-1.5 text-center transition",
                            props.activePhase === item.id
                                ? "bg-neutral-700 text-neutral-100"
                                : disabled()
                                  ? "text-neutral-700"
                                  : "text-neutral-400 hover:bg-neutral-800/70 hover:text-neutral-200",
                        )}
                        onClick={() => props.onSelect(item.id)}
                    >
                        <span class="block text-xs font-semibold">
                            {item.label}
                        </span>
                        <span class="block text-[10px] uppercase tracking-wider opacity-70">
                            {item.kicker}
                        </span>
                    </button>
                );
            }}
        </For>
    </div>
);

const PhaseContent: Component<{
    data: LolmixAnalyzeResponse;
    dataset: Dataset | undefined;
    phase: LolmixDecisionPhase;
    sections: LolmixRecommendationSection[];
}> = (props) => (
    <Switch>
        <Match when={props.phase === "core"}>
            <div class="flex flex-col gap-3">
                <SectionBand
                    title="Build path"
                    kicker="Buy in order"
                    headline="Top pick per step"
                >
                    <BuildPath
                        data={props.data}
                        dataset={props.dataset}
                        sections={props.sections}
                    />
                </SectionBand>
                <div class="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    <Show when={lolmixSectionByName(props.data, "skill_order")}>
                        {(section) => (
                            <Show when={section().entries.length > 0}>
                                <SectionBand
                                    title="Skill order"
                                    kicker="Max priority"
                                >
                                    <SkillOrderSection section={section()} />
                                </SectionBand>
                            </Show>
                        )}
                    </Show>
                    <Show when={lolmixSectionByName(props.data, "full_build")}>
                        {(section) => (
                            <Show when={section().entries.length > 0}>
                                <SectionBand
                                    title="Full build"
                                    kicker="Common sequences"
                                >
                                    <FullBuildSection
                                        dataset={props.dataset}
                                        section={section()}
                                    />
                                </SectionBand>
                            </Show>
                        )}
                    </Show>
                </div>
            </div>
        </Match>
        <Match when={props.phase === "now"}>
            <div class="grid grid-cols-1 gap-3 xl:grid-cols-2">
                <For each={props.sections}>
                    {(section) => (
                        <SectionBand
                            title={lolmixSectionTitle(section.name)}
                            kicker="Pick this"
                        >
                            <SectionRenderer
                                data={props.data}
                                dataset={props.dataset}
                                section={section}
                            />
                        </SectionBand>
                    )}
                </For>
            </div>
        </Match>
        <Match when={true}>
            <div class="flex flex-col gap-3">
                <For each={props.sections}>
                    {(section) => (
                        <SectionBand
                            title={lolmixSectionTitle(section.name)}
                            kicker={
                                props.phase === "matchup"
                                    ? "Vs this draft"
                                    : "Drill down"
                            }
                            headline={
                                section.name === "winning_items"
                                    ? "Sorted by combined win rate"
                                    : undefined
                            }
                        >
                            <SectionRenderer
                                data={props.data}
                                dataset={props.dataset}
                                section={section}
                            />
                        </SectionBand>
                    )}
                </For>
            </div>
        </Match>
    </Switch>
);

const SectionBand: Component<{
    title: string;
    kicker?: string;
    headline?: string;
    children: JSX.Element;
}> = (props) => (
    <section class="rounded-md border border-neutral-800 bg-neutral-900/25 p-3">
        <div class="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <div class="flex flex-wrap items-baseline gap-2">
                <Show when={props.kicker}>
                    <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-600">
                        {props.kicker}
                    </span>
                </Show>
                <h3 class="text-xs font-semibold uppercase tracking-wide text-neutral-200">
                    {props.title}
                </h3>
            </div>
            <Show when={props.headline}>
                <span class="text-xs text-neutral-500">{props.headline}</span>
            </Show>
        </div>
        {props.children}
    </section>
);

const SectionRenderer: Component<{
    data: LolmixAnalyzeResponse;
    dataset: Dataset | undefined;
    section: LolmixRecommendationSection;
}> = (props) => {
    const renderer = () => lolmixSectionMeta(props.section.name).renderer;

    return (
        <Switch>
            <Match when={renderer() === "summoners"}>
                <SummonersSection
                    dataset={props.dataset}
                    section={props.section}
                />
            </Match>
            <Match when={renderer() === "runes"}>
                <RunePageSection
                    data={props.data}
                    dataset={props.dataset}
                    section={props.section}
                />
            </Match>
            <Match when={renderer() === "skillEarly"}>
                <SkillEarlySection section={props.section} />
            </Match>
            <Match when={renderer() === "skillOrder"}>
                <SkillOrderSection section={props.section} />
            </Match>
            <Match when={renderer() === "pathStep"}>
                <BuildPath
                    data={props.data}
                    dataset={props.dataset}
                    sections={[props.section]}
                />
            </Match>
            <Match when={renderer() === "fullBuild"}>
                <FullBuildSection
                    dataset={props.dataset}
                    section={props.section}
                />
            </Match>
            <Match when={renderer() === "winningItems"}>
                <WinningItemsSection
                    data={props.data}
                    section={props.section}
                />
            </Match>
            <Match when={true}>
                <GenericSection section={props.section} />
            </Match>
        </Switch>
    );
};

const SummonersSection: Component<{
    dataset: Dataset | undefined;
    section: LolmixRecommendationSection;
}> = (props) => {
    const [expanded, setExpanded] = createSignal(false);
    const collapsedEntries = () =>
        lolmixCollapsedDisplayEntries(props.section, { headline: "score" });
    const allEntries = () =>
        lolmixDisplayEntries(props.section, { headline: "score" });
    const entries = () => (expanded() ? allEntries() : collapsedEntries());

    return (
        <Show
            when={entries().length > 0}
            fallback={<EmptyState>No summoner data</EmptyState>}
        >
            <div class="flex flex-col gap-1.5">
                <For each={entries()}>
                    {(item) => {
                        const entry = () => item.entry;
                        const lane = () => lolmixLaneMatchup(entry());
                        return (
                            <div
                                class={cn(
                                    "flex min-w-0 items-center gap-3 rounded-md px-2.5 py-2",
                                    item.recommended
                                        ? "bg-neutral-800/60 ring-1 ring-neutral-700"
                                        : "bg-neutral-950/25",
                                    item.rare && "opacity-70",
                                )}
                            >
                                <SummonerSpellGlyphs
                                    dataset={props.dataset}
                                    entry={entry()}
                                />
                                <div class="min-w-0 flex-1">
                                    <div class="flex min-w-0 items-center gap-2">
                                        <span class="truncate text-sm font-medium text-neutral-100">
                                            {entry().name}
                                        </span>
                                        <EntryBadge item={item} />
                                    </div>
                                    <EntryStats class="mt-0.5" entry={entry()}>
                                        <Show when={lane()}>
                                            <span
                                                class={lolmixScoreClass(
                                                    lane()!.delta1,
                                                )}
                                            >
                                                Vs lane{" "}
                                                {formatLolmixSignedPercent(
                                                    lane()!.delta1,
                                                )}
                                            </span>
                                        </Show>
                                    </EntryStats>
                                </div>
                                <div class="flex shrink-0 flex-col items-end gap-1">
                                    <ScoreChip value={entry().score} />
                                    <SamplePill value={entry().total_n_max} />
                                </div>
                            </div>
                        );
                    }}
                </For>
                <Show when={allEntries().length > collapsedEntries().length}>
                    <button
                        type="button"
                        class="self-start text-xs font-semibold uppercase text-blue-300 hover:text-blue-200"
                        onClick={() => setExpanded(!expanded())}
                    >
                        {expanded()
                            ? "Show fewer summoners"
                            : `Show ${allEntries().length - collapsedEntries().length} more summoners`}
                    </button>
                </Show>
            </div>
        </Show>
    );
};

const SummonerSpellGlyphs: Component<{
    dataset: Dataset | undefined;
    entry: LolmixRecommendationEntry;
}> = (props) => {
    const ids = () => summonerSpellIds(props.entry);
    const names = () => props.entry.name.split("+").map((part) => part.trim());

    return (
        <div class="flex shrink-0 items-center gap-1">
            <For each={ids() ?? names()}>
                {(value, index) => {
                    const id = () =>
                        typeof value === "number" ? value : undefined;
                    const spell = () =>
                        id() !== undefined
                            ? props.dataset?.summonerSpellData[id()!]
                            : undefined;

                    return (
                        <Show
                            when={spell()}
                            fallback={
                                <span
                                    class="grid h-7 w-7 place-items-center rounded bg-neutral-800 text-[10px] font-bold uppercase text-neutral-300 ring-1 ring-neutral-700"
                                    title={names()[index()] ?? String(value)}
                                >
                                    {(names()[index()] ?? String(value)).slice(
                                        0,
                                        2,
                                    )}
                                </span>
                            }
                        >
                            {(currentSpell) => (
                                <img
                                    src={`https://ddragon.leagueoflegends.com/cdn/${props.dataset!.version}/img/spell/${currentSpell().id}.png`}
                                    alt={currentSpell().name}
                                    title={currentSpell().name}
                                    class="h-7 w-7 rounded-sm ring-1 ring-neutral-700"
                                />
                            )}
                        </Show>
                    );
                }}
            </For>
        </div>
    );
};

const RunePageSection: Component<{
    data: LolmixAnalyzeResponse;
    dataset: Dataset | undefined;
    section: LolmixRecommendationSection;
}> = (props) => {
    const entries = createMemo(() =>
        lolmixDisplayEntries(props.section, { headline: "combined_wr" }),
    );
    const [selectedIndex, setSelectedIndex] = createSignal<number>();
    const activeIndex = () => {
        const selected = selectedIndex();
        if (selected !== undefined && entries()[selected]) return selected;

        const recommended = entries().findIndex((entry) => entry.recommended);
        return recommended >= 0 ? recommended : 0;
    };
    const selectedEntry = () => entries()[activeIndex()]?.entry;

    return (
        <Show
            when={entries().length > 0}
            fallback={<EmptyState>No rune pages available</EmptyState>}
        >
            <div class="flex flex-col gap-2.5">
                <Show when={entries().length > 1}>
                    <div class="flex flex-wrap gap-1">
                        <For each={entries()}>
                            {(item, index) => {
                                const page = () =>
                                    parseLolmixReadableRunePage(
                                        item.entry.name,
                                    );
                                return (
                                    <button
                                        type="button"
                                        class={cn(
                                            "rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition",
                                            index() === activeIndex()
                                                ? "bg-neutral-700 text-neutral-100"
                                                : "bg-neutral-950/40 text-neutral-500 hover:text-neutral-300",
                                            item.rare && "text-amber-300/80",
                                        )}
                                        onClick={() =>
                                            setSelectedIndex(index())
                                        }
                                    >
                                        {page()?.kind ?? `Page ${index() + 1}`}
                                    </button>
                                );
                            }}
                        </For>
                    </div>
                </Show>
                <Show when={selectedEntry()}>
                    {(entry) => (
                        <RunePageDetail
                            data={props.data}
                            dataset={props.dataset}
                            entry={entry()}
                        />
                    )}
                </Show>
            </div>
        </Show>
    );
};

const RunePageDetail: Component<{
    data: LolmixAnalyzeResponse;
    dataset: Dataset | undefined;
    entry: LolmixRecommendationEntry;
}> = (props) => {
    const readable = () => parseLolmixReadableRunePage(props.entry.name);
    const encoded = () => parseLolmixRunePageKey(props.entry.name);
    const hasReadableRunes = () => {
        const page = readable();
        return !!(
            page?.primaryPathName ||
            page?.secondaryPathName ||
            page?.primaryRunes.length ||
            page?.secondaryRunes.length ||
            page?.shards.length
        );
    };

    return (
        <div class="rounded-md bg-neutral-950/25 p-3">
            <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-baseline gap-2">
                    <span class="text-[10px] uppercase tracking-wide text-neutral-500">
                        Win Rate
                    </span>
                    <span class="text-lg font-semibold tabular-nums text-neutral-100">
                        {formatLolmixPercent(props.entry.combined_wr)}
                    </span>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <span class="text-xs uppercase text-neutral-500">
                        PR {formatLolmixPercent(props.entry.combined_pr)}
                    </span>
                    <ScoreChip value={props.entry.score} />
                    <SamplePill value={props.entry.total_n_max} />
                </div>
            </div>

            <Switch>
                <Match when={hasReadableRunes()}>
                    <ReadableRunePage page={readable()!} />
                </Match>
                <Match when={props.dataset && encoded()}>
                    <RuneMetricsBoard
                        data={props.data}
                        dataset={props.dataset!}
                        selectedPage={encoded()}
                    />
                </Match>
                <Match when={true}>
                    <div class="rounded-md border border-dashed border-neutral-800 px-3 py-4 text-center text-xs uppercase text-neutral-600">
                        Rune details are unavailable for this response format.
                    </div>
                </Match>
            </Switch>

            <Show when={lolmixLaneMatchup(props.entry)}>
                {(lane) => (
                    <div class="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-800 pt-2 text-xs uppercase text-neutral-500">
                        <span>Vs lane opponent</span>
                        <span class={lolmixScoreClass(lane().delta1)}>
                            {formatLolmixSignedPercent(lane().delta1)} / WR{" "}
                            {formatLolmixPercent(lane().wr)}
                        </span>
                    </div>
                )}
            </Show>
        </div>
    );
};

const ReadableRunePage: Component<{
    page: NonNullable<ReturnType<typeof parseLolmixReadableRunePage>>;
}> = (props) => (
    <div class="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <RunePathColumn
            label="Primary"
            path={props.page.primaryPathName}
            runes={props.page.primaryRunes}
            keystone
        />
        <RunePathColumn
            label="Secondary"
            path={props.page.secondaryPathName}
            runes={props.page.secondaryRunes}
        />
        <Show when={props.page.shards.length > 0}>
            <div class="lg:col-span-2">
                <div class="mb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    Shards
                </div>
                <div class="flex flex-wrap gap-1">
                    <For each={props.page.shards}>
                        {(shard) => (
                            <span class="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
                                {shard}
                            </span>
                        )}
                    </For>
                </div>
            </div>
        </Show>
    </div>
);

const RunePathColumn: Component<{
    label: string;
    path: string | undefined;
    runes: string[];
    keystone?: boolean;
}> = (props) => (
    <div class="rounded bg-neutral-900/60 p-2">
        <div class="mb-1.5 flex flex-wrap items-baseline gap-1.5">
            <span class="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                {props.label}
            </span>
            <span class="text-xs font-medium text-neutral-200">
                {props.path ?? "Unknown"}
            </span>
        </div>
        <Show
            when={props.runes.length > 0}
            fallback={
                <span class="text-xs text-neutral-600">No rune data</span>
            }
        >
            <div class="flex flex-col gap-1">
                <For each={props.runes}>
                    {(rune, index) => (
                        <div
                            class={cn(
                                "flex min-w-0 items-center gap-1.5 rounded px-1.5 py-0.5 text-xs",
                                props.keystone && index() === 0
                                    ? "bg-neutral-800 font-semibold text-neutral-100"
                                    : "text-neutral-300",
                            )}
                        >
                            <Show when={props.keystone && index() === 0}>
                                <span class="rounded-sm bg-amber-500/20 px-1 text-[9px] font-bold uppercase text-amber-300">
                                    Key
                                </span>
                            </Show>
                            <span class="truncate">{rune}</span>
                        </div>
                    )}
                </For>
            </div>
        </Show>
    </div>
);

const SkillEarlySection: Component<{
    section: LolmixRecommendationSection;
}> = (props) => {
    const lookup = createMemo(() => {
        const byCell = new Map<string, LolmixRecommendationEntry>();
        const recommended = new Map<number, LolmixRecommendationEntry>();
        for (const entry of props.section.entries) {
            const key = lolmixSkillEarlyKey(entry);
            if (!key) continue;

            byCell.set(`${key.level}:${key.slot}`, entry);
            if (!isLolmixRecommendationEligible(entry)) continue;

            const current = recommended.get(key.level);
            if (!current || entry.score > current.score) {
                recommended.set(key.level, entry);
            }
        }

        return { byCell, recommended };
    });
    const entryFor = (level: number, slot: string) =>
        lookup().byCell.get(`${level}:${slot}`);
    const recommendedFor = (level: number) => {
        const key = lookup().recommended.get(level);
        return key ? lolmixSkillEarlyKey(key)?.slot : undefined;
    };

    return (
        <Show
            when={lookup().byCell.size > 0}
            fallback={<EmptyState>No early skill data</EmptyState>}
        >
            <div class="flex flex-col gap-2">
                <div class="flex flex-wrap items-center gap-2 text-xs uppercase text-neutral-500">
                    <span>Recommended order</span>
                    <div class="flex gap-1">
                        <For each={LOLMIX_SKILL_EARLY_LEVELS}>
                            {(level) => (
                                <span
                                    class={cn(
                                        "grid h-6 w-6 place-items-center rounded text-xs font-bold",
                                        recommendedFor(level)
                                            ? "bg-winrate-good text-neutral-950"
                                            : "bg-neutral-800 text-neutral-600",
                                    )}
                                    title={`Level ${level}`}
                                >
                                    {recommendedFor(level) ?? "-"}
                                </span>
                            )}
                        </For>
                    </div>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full min-w-[18rem] border-separate border-spacing-1">
                        <thead>
                            <tr>
                                <th class="w-6" />
                                <For each={LOLMIX_SKILL_EARLY_LEVELS}>
                                    {(level) => (
                                        <th class="text-center text-[10px] font-medium text-neutral-500">
                                            {level}
                                        </th>
                                    )}
                                </For>
                            </tr>
                        </thead>
                        <tbody>
                            <For each={LOLMIX_SKILL_EARLY_SLOTS}>
                                {(slot) => (
                                    <tr>
                                        <td class="text-center text-xs font-bold text-neutral-400">
                                            {slot}
                                        </td>
                                        <For each={LOLMIX_SKILL_EARLY_LEVELS}>
                                            {(level) => (
                                                <SkillEarlyCell
                                                    entry={entryFor(
                                                        level,
                                                        slot,
                                                    )}
                                                    recommended={
                                                        recommendedFor(
                                                            level,
                                                        ) === slot
                                                    }
                                                />
                                            )}
                                        </For>
                                    </tr>
                                )}
                            </For>
                        </tbody>
                    </table>
                </div>
                <p class="font-body text-[11px] text-neutral-600">
                    Cells show score and PR. Outlined cells are the best
                    eligible skill at that level.
                </p>
            </div>
        </Show>
    );
};

const SkillEarlyCell: Component<{
    entry: LolmixRecommendationEntry | undefined;
    recommended: boolean;
}> = (props) => (
    <td class="p-0">
        <Show
            when={props.entry}
            fallback={<div class="h-8 rounded bg-neutral-950/25" />}
        >
            {(entry) => (
                <div
                    class={cn(
                        "flex h-10 flex-col items-center justify-center rounded border text-[10px] font-semibold tabular-nums",
                        lolmixScoreClass(entry().score),
                        lolmixScoreToneClass(entry().score),
                        props.recommended && "ring-1 ring-current",
                        !isLolmixRecommendationEligible(entry()) &&
                            "opacity-70",
                    )}
                    title={`Score ${formatLolmixSignedPercent(
                        entry().score,
                    )} / WR ${formatLolmixPercent(
                        entry().combined_wr,
                    )} / n=${formatLolmixCompactCount(entry().total_n_max)}`}
                >
                    <span>
                        {formatLolmixSignedPercent(entry().score).replace(
                            "%",
                            "",
                        )}
                    </span>
                    <span class="text-[9px] uppercase text-neutral-400">
                        PR {formatLolmixPercent(entry().combined_pr)}
                    </span>
                </div>
            )}
        </Show>
    </td>
);

const SkillOrderSection: Component<{
    section: LolmixRecommendationSection;
}> = (props) => {
    const [expanded, setExpanded] = createSignal(false);
    const collapsedEntries = () =>
        lolmixCollapsedDisplayEntries(props.section, { headline: "score" });
    const allEntries = () =>
        lolmixDisplayEntries(props.section, { headline: "score" });
    const entries = () => (expanded() ? allEntries() : collapsedEntries());

    return (
        <Show when={entries().length > 0} fallback={null}>
            <div class="flex flex-col gap-1.5">
                <For each={entries()}>
                    {(item) => (
                        <div
                            class={cn(
                                "flex min-w-0 items-center gap-2 rounded-md px-2.5 py-2",
                                item.recommended
                                    ? "bg-neutral-800/60 ring-1 ring-neutral-700"
                                    : "bg-neutral-950/25",
                                item.rare && "opacity-70",
                            )}
                        >
                            <div class="flex shrink-0 gap-1">
                                <For each={item.entry.name.split("")}>
                                    {(skill) => (
                                        <span class="grid h-6 w-6 place-items-center rounded bg-neutral-800 text-xs font-bold text-neutral-200">
                                            {skill}
                                        </span>
                                    )}
                                </For>
                            </div>
                            <span class="text-xs uppercase text-neutral-500">
                                priority
                            </span>
                            <EntryBadge item={item} />
                            <div class="ml-auto flex flex-wrap items-center justify-end gap-2">
                                <EntryStats entry={item.entry} />
                                <ScoreChip value={item.entry.score} />
                                <SamplePill value={item.entry.total_n_max} />
                            </div>
                        </div>
                    )}
                </For>
                <Show when={allEntries().length > collapsedEntries().length}>
                    <button
                        type="button"
                        class="self-start text-xs font-semibold uppercase text-blue-300 hover:text-blue-200"
                        onClick={() => setExpanded(!expanded())}
                    >
                        {expanded()
                            ? "Show fewer orders"
                            : `Show ${allEntries().length - collapsedEntries().length} more orders`}
                    </button>
                </Show>
            </div>
        </Show>
    );
};

const BuildPath: Component<{
    data: LolmixAnalyzeResponse;
    dataset: Dataset | undefined;
    sections: LolmixRecommendationSection[];
}> = (props) => {
    const steps = () => lolmixBuildPathSteps(props.sections);

    return (
        <Show
            when={steps().length > 0}
            fallback={<EmptyState>No build path available</EmptyState>}
        >
            <ol class="flex flex-col">
                <For each={steps()}>
                    {(section, index) => (
                        <BuildStep
                            data={props.data}
                            dataset={props.dataset}
                            index={index() + 1}
                            isLast={index() === steps().length - 1}
                            step={section}
                        />
                    )}
                </For>
            </ol>
        </Show>
    );
};

const BuildStep: Component<{
    data: LolmixAnalyzeResponse;
    dataset: Dataset | undefined;
    index: number;
    isLast: boolean;
    step: LolmixBuildPathStep;
}> = (props) => {
    const [open, setOpen] = createSignal(false);
    const entries = () =>
        open() ? props.step.expandedEntries : props.step.collapsedEntries;
    const hiddenCount = () =>
        Math.max(
            0,
            props.step.expandedEntries.length -
                props.step.collapsedEntries.length,
        );

    return (
        <Show when={props.step.expandedEntries.length > 0}>
            <li class="relative pl-7">
                <span class="absolute left-[10px] top-0 flex h-full w-px justify-center">
                    <Show when={!props.isLast}>
                        <span class="absolute bottom-0 top-7 w-px bg-neutral-800" />
                    </Show>
                </span>
                <span class="absolute left-0 top-2 grid h-5 w-5 place-items-center rounded-full bg-neutral-800 text-[10px] font-bold text-neutral-300 ring-1 ring-neutral-700">
                    {props.index}
                </span>
                <div class="mb-2 flex flex-col gap-1.5">
                    <div class="rounded-md bg-neutral-950/30">
                        <button
                            type="button"
                            class="flex w-full min-w-0 items-center gap-2 rounded-md px-2.5 py-2 text-left transition hover:bg-neutral-800/60"
                            onClick={() => setOpen(!open())}
                        >
                            <Icon
                                path={chevronRight}
                                class={cn(
                                    "h-3.5 w-3.5 shrink-0 text-neutral-500 transition",
                                    open() && "rotate-90",
                                )}
                            />
                            <span class="w-20 shrink-0 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                                {lolmixSectionTitle(props.step.section.name)}
                            </span>
                            <span class="min-w-0 flex-1 truncate text-xs uppercase text-neutral-500">
                                <Show
                                    when={props.step.recommended}
                                    fallback="No eligible recommendation"
                                >
                                    {(entry) => (
                                        <>
                                            Optimized:{" "}
                                            <span class="text-neutral-200">
                                                {entry().name}
                                            </span>
                                        </>
                                    )}
                                </Show>
                            </span>
                            <span class="shrink-0 text-[10px] uppercase text-neutral-500">
                                {props.step.collapsedEntries.length} viable
                            </span>
                        </button>
                    </div>
                    <Show
                        when={entries().length > 0}
                        fallback={
                            <div class="rounded-md border border-amber-400/20 bg-amber-400/10 px-2.5 py-2 text-xs text-amber-200">
                                Returned options are all below 0.01% PR.
                            </div>
                        }
                    >
                        <div class="flex flex-col gap-1">
                            <For each={entries()}>
                                {(item) => (
                                    <BuildOptionRow
                                        dataset={props.dataset}
                                        item={item}
                                    />
                                )}
                            </For>
                        </div>
                    </Show>
                    <Show when={hiddenCount() > 0}>
                        <button
                            type="button"
                            class="self-start text-xs font-semibold uppercase text-blue-300 hover:text-blue-200"
                            onClick={() => setOpen(!open())}
                        >
                            {open()
                                ? "Show fewer options"
                                : `Show ${hiddenCount()} more options`}
                        </button>
                    </Show>
                    <Show when={open() && props.step.recommended}>
                        {(entry) => (
                            <div class="rounded-md border border-neutral-800 bg-neutral-950/25 p-2.5">
                                <MatchupRow data={props.data} entry={entry()} />
                            </div>
                        )}
                    </Show>
                </div>
            </li>
        </Show>
    );
};

const BuildOptionRow: Component<{
    dataset: Dataset | undefined;
    item: LolmixDisplayEntry;
}> = (props) => (
    <div
        class={cn(
            "flex min-w-0 items-center gap-2 rounded-md px-2.5 py-2 text-xs",
            props.item.recommended
                ? "bg-neutral-800/60 ring-1 ring-neutral-700"
                : "bg-neutral-950/25",
            props.item.rare && "opacity-70",
        )}
    >
        <ItemIcon dataset={props.dataset} itemId={props.item.entry.id} small />
        <span
            class="min-w-0 flex-1 truncate text-neutral-200"
            title={props.item.entry.name}
        >
            {props.item.entry.name}
        </span>
        <EntryBadge item={props.item} />
        <EntryStats entry={props.item.entry} />
        <ScoreChip value={props.item.entry.score} />
        <SamplePill value={props.item.entry.total_n_max} />
    </div>
);

const MatchupRow: Component<{
    data: LolmixAnalyzeResponse;
    entry: LolmixRecommendationEntry;
}> = (props) => {
    const slots = () => lolmixActiveSlots(props.entry);
    const byEnemy = () => lolmixEnemyBySlot(props.data);
    const orderedSlots = () => [
        ...slots().filter((slot) => slot === "lane"),
        ...LOLMIX_MATCHUP_SLOT_ORDER.filter(
            (slot) => slot !== "lane" && slots().includes(slot),
        ),
        ...slots().filter(
            (slot) =>
                !LOLMIX_MATCHUP_SLOT_ORDER.some((known) => known === slot),
        ),
    ];

    return (
        <Show
            when={orderedSlots().length > 0}
            fallback={
                <span class="text-xs text-neutral-600">
                    No matchup breakdown for this option.
                </span>
            }
        >
            <div>
                <div class="mb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    Change vs each enemy
                </div>
                <div class="grid grid-cols-2 gap-x-3 gap-y-1.5 xl:grid-cols-3">
                    <For each={orderedSlots()}>
                        {(slot) => {
                            const matchup = () => props.entry.per_matchup[slot];
                            const enemy = () => byEnemy()[slot];
                            const isLane = () => slot === "lane";

                            return (
                                <Show when={matchup()}>
                                    {(current) => (
                                        <div
                                            class={cn(
                                                "flex flex-col gap-1 rounded px-1.5 py-1",
                                                isLane() &&
                                                    "bg-opponent/10 ring-1 ring-opponent/30",
                                            )}
                                        >
                                            <div class="flex items-center justify-between gap-1">
                                                <span class="truncate text-xs text-neutral-400">
                                                    <Show when={isLane()}>
                                                        <span class="mr-1 text-opponent">
                                                            Lane
                                                        </span>
                                                    </Show>
                                                    {enemy()?.champion_name ??
                                                        lolmixLaneLabel(slot)}
                                                    <span class="ml-1 text-neutral-600">
                                                        {lolmixLaneLabel(slot)}
                                                    </span>
                                                </span>
                                                <span
                                                    class={cn(
                                                        "shrink-0 text-xs font-semibold tabular-nums",
                                                        lolmixScoreClass(
                                                            current().delta1,
                                                        ),
                                                    )}
                                                >
                                                    {formatLolmixSignedPercent(
                                                        current().delta1,
                                                    )}
                                                </span>
                                            </div>
                                            <DeltaBar
                                                value={current().delta1}
                                            />
                                        </div>
                                    )}
                                </Show>
                            );
                        }}
                    </For>
                </div>
            </div>
        </Show>
    );
};

const FullBuildSection: Component<{
    dataset: Dataset | undefined;
    section: LolmixRecommendationSection;
}> = (props) => {
    const [expanded, setExpanded] = createSignal(false);
    const collapsedEntries = () =>
        lolmixCollapsedDisplayEntries(props.section, { headline: "score" });
    const allEntries = () =>
        lolmixDisplayEntries(props.section, { headline: "score" });
    const shown = () => (expanded() ? allEntries() : collapsedEntries());

    return (
        <Show when={shown().length > 0} fallback={null}>
            <div class="flex flex-col gap-1.5">
                <For each={shown()}>
                    {(item) => (
                        <div
                            class={cn(
                                "rounded-md px-2.5 py-2",
                                item.recommended
                                    ? "bg-neutral-800/60 ring-1 ring-neutral-700"
                                    : "bg-neutral-950/25",
                                item.rare && "opacity-70",
                            )}
                        >
                            <div class="flex min-w-0 items-center gap-2">
                                <div class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                                    <For
                                        each={splitEntryParts(item.entry.name)}
                                    >
                                        {(part, partIndex) => (
                                            <>
                                                <span class="rounded bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-200">
                                                    {part}
                                                </span>
                                                <Show
                                                    when={
                                                        partIndex() <
                                                        splitEntryParts(
                                                            item.entry.name,
                                                        ).length -
                                                            1
                                                    }
                                                >
                                                    <span class="text-neutral-600">
                                                        &gt;
                                                    </span>
                                                </Show>
                                            </>
                                        )}
                                    </For>
                                </div>
                                <EntryBadge item={item} />
                                <EntryStats entry={item.entry} />
                                <ScoreChip value={item.entry.score} />
                                <SamplePill value={item.entry.total_n_max} />
                            </div>
                        </div>
                    )}
                </For>
                <Show when={allEntries().length > collapsedEntries().length}>
                    <button
                        type="button"
                        class="self-start text-xs font-semibold uppercase text-blue-300 hover:text-blue-200"
                        onClick={() => setExpanded(!expanded())}
                    >
                        {expanded()
                            ? "Show fewer builds"
                            : `Show ${allEntries().length - collapsedEntries().length} more builds`}
                    </button>
                </Show>
            </div>
        </Show>
    );
};

const WinningItemsSection: Component<{
    data: LolmixAnalyzeResponse;
    section: LolmixRecommendationSection;
}> = (props) => {
    const [openIndex, setOpenIndex] = createSignal<number>();
    const entries = () =>
        lolmixDisplayEntries(props.section, { headline: "combined_wr" });
    const minWr = () =>
        Math.min(...entries().map((item) => item.entry.combined_wr));
    const maxWr = () =>
        Math.max(...entries().map((item) => item.entry.combined_wr));
    const span = () => Math.max(0.0001, maxWr() - minWr());

    return (
        <Show
            when={entries().length > 0}
            fallback={
                <EmptyState>No standout items for this matchup</EmptyState>
            }
        >
            <div class="flex flex-col gap-1">
                <For each={entries()}>
                    {(item, index) => {
                        const isOpen = () => openIndex() === index();
                        const barWidth = () =>
                            12 +
                            ((item.entry.combined_wr - minWr()) / span()) * 88;
                        const lowSample = () =>
                            ["low", "tiny"].includes(
                                lolmixSampleConfidence(item.entry.total_n_max),
                            );

                        return (
                            <div
                                class={cn(
                                    "rounded-md bg-neutral-950/25",
                                    item.recommended &&
                                        "ring-1 ring-neutral-700",
                                    item.rare && "opacity-70",
                                )}
                            >
                                <button
                                    type="button"
                                    class="flex w-full min-w-0 items-center gap-2 px-2.5 py-2 text-left hover:bg-neutral-800/40"
                                    onClick={() =>
                                        setOpenIndex(
                                            isOpen() ? undefined : index(),
                                        )
                                    }
                                >
                                    <Icon
                                        path={chevronRight}
                                        class={cn(
                                            "h-3.5 w-3.5 shrink-0 text-neutral-500 transition",
                                            isOpen() && "rotate-90",
                                        )}
                                    />
                                    <span
                                        class="w-32 shrink-0 truncate text-sm text-neutral-100 sm:w-44"
                                        title={item.entry.name}
                                    >
                                        {item.entry.name}
                                    </span>
                                    <EntryBadge item={item} />
                                    <div class="hidden h-2 flex-1 overflow-hidden rounded-full bg-neutral-800/60 sm:block">
                                        <div
                                            class="h-full rounded-full bg-winrate-good"
                                            style={{
                                                width: `${barWidth()}%`,
                                            }}
                                        />
                                    </div>
                                    <span
                                        class={cn(
                                            "shrink-0 text-sm font-semibold tabular-nums",
                                            lolmixWinrateTextClass(
                                                item.entry.combined_wr,
                                            ),
                                        )}
                                    >
                                        {formatLolmixPercent(
                                            item.entry.combined_wr,
                                        )}
                                    </span>
                                    <span class="shrink-0 text-xs uppercase tabular-nums text-neutral-400">
                                        PR{" "}
                                        {formatLolmixPercent(
                                            item.entry.combined_pr,
                                        )}
                                    </span>
                                    <span
                                        class={cn(
                                            "hidden shrink-0 text-xs tabular-nums sm:inline",
                                            lolmixScoreClass(
                                                item.entry.max_delta,
                                            ),
                                        )}
                                    >
                                        Best{" "}
                                        {formatLolmixSignedPercent(
                                            item.entry.max_delta,
                                        )}
                                    </span>
                                    <Show when={lowSample()}>
                                        <span
                                            class="shrink-0 rounded bg-amber-400/10 px-1 text-[10px] uppercase text-amber-300"
                                            title="Low sample"
                                        >
                                            Low n
                                        </span>
                                    </Show>
                                </button>
                                <Show when={isOpen()}>
                                    <div class="px-3 pb-2.5">
                                        <MatchupRow
                                            data={props.data}
                                            entry={item.entry}
                                        />
                                        <div class="mt-2 flex flex-wrap items-center gap-3 border-t border-neutral-800 pt-2 text-[10px] uppercase text-neutral-500">
                                            <span>
                                                Base WR{" "}
                                                {formatLolmixPercent(
                                                    item.entry.overall_wr,
                                                )}
                                            </span>
                                            <span>
                                                PR{" "}
                                                {formatLolmixPercent(
                                                    item.entry.combined_pr,
                                                )}
                                            </span>
                                            <span>
                                                n=
                                                {formatLolmixCompactCount(
                                                    item.entry.total_n_max,
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                </Show>
                            </div>
                        );
                    }}
                </For>
            </div>
        </Show>
    );
};

const GenericSection: Component<{
    section: LolmixRecommendationSection;
}> = (props) => {
    const entries = () =>
        lolmixDisplayEntries(props.section, {
            headline: lolmixSectionMeta(props.section.name).headline,
        });

    return (
        <Show
            when={entries().length > 0}
            fallback={<EmptyState>Empty section</EmptyState>}
        >
            <div class="overflow-x-auto">
                <table class="w-full min-w-[24rem] text-xs">
                    <thead>
                        <tr class="text-[10px] uppercase tracking-wider text-neutral-500">
                            <th class="py-1 pr-2 text-left font-medium">
                                Name
                            </th>
                            <th class="px-2 py-1 text-right font-medium">WR</th>
                            <th class="px-2 py-1 text-right font-medium">PR</th>
                            <th class="px-2 py-1 text-right font-medium">
                                Score
                            </th>
                            <th class="py-1 pl-2 text-right font-medium">N</th>
                        </tr>
                    </thead>
                    <tbody>
                        <For each={entries()}>
                            {(item) => (
                                <tr
                                    class={cn(
                                        "border-t border-neutral-800/70",
                                        item.recommended && "bg-neutral-800/30",
                                        item.rare && "opacity-70",
                                    )}
                                >
                                    <td
                                        class="max-w-[14rem] truncate py-1.5 pr-2 text-neutral-200"
                                        title={item.entry.name}
                                    >
                                        <span>{item.entry.name}</span>
                                        <EntryBadge item={item} />
                                    </td>
                                    <td class="px-2 py-1.5 text-right tabular-nums text-neutral-300">
                                        {formatLolmixPercent(
                                            item.entry.combined_wr,
                                        )}
                                    </td>
                                    <td class="px-2 py-1.5 text-right tabular-nums text-neutral-400">
                                        {formatLolmixPercent(
                                            item.entry.combined_pr,
                                        )}
                                    </td>
                                    <td class="px-2 py-1.5 text-right">
                                        <ScoreChip value={item.entry.score} />
                                    </td>
                                    <td class="py-1.5 pl-2 text-right">
                                        <SamplePill
                                            value={item.entry.total_n_max}
                                        />
                                    </td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>
            </div>
        </Show>
    );
};

const RuneMetricsBoard: Component<{
    data: LolmixAnalyzeResponse;
    dataset: Dataset;
    selectedPage: LolmixRunePage | undefined;
}> = (props) => {
    const sections = createMemo(
        () =>
            new Map(
                props.data.sections.map((section) => [section.name, section]),
            ),
    );
    const entriesFor = (name: string) => sections().get(name)?.entries ?? [];
    const keystones = createMemo(() => entryMap(entriesFor("keystones")));
    const primary = createMemo(() => entryMap(entriesFor("runes_primary")));
    const secondary = createMemo(() => entryMap(entriesFor("runes_secondary")));
    const shards = () => entriesFor("stat_shards");
    const paths = createMemo(() => orderedRunePaths(props.dataset));
    const hasMetrics = () =>
        keystones().size > 0 ||
        primary().size > 0 ||
        secondary().size > 0 ||
        shards().length > 0;

    return (
        <Show
            when={hasMetrics()}
            fallback={
                <div class="rounded-md border border-dashed border-neutral-800 px-3 py-4 text-center text-xs uppercase text-neutral-600">
                    Detailed rune metric sections were not returned.
                </div>
            }
        >
            <div class="flex flex-col gap-4">
                <RunePathGrid
                    dataset={props.dataset}
                    entriesForRune={(rune) =>
                        rune.slot === 0
                            ? keystones().get(rune.id)
                            : primary().get(rune.id)
                    }
                    paths={paths()}
                    selected={(path, rune) => {
                        const page = props.selectedPage;
                        if (!page) return false;
                        return (
                            page.primaryPath === runePathIndex(path.id) &&
                            page.primary.includes(rune.id)
                        );
                    }}
                    title="Primary Path"
                />
                <RunePathGrid
                    dataset={props.dataset}
                    entriesForRune={(rune) => secondary().get(rune.id)}
                    paths={paths()}
                    selected={(path, rune) => {
                        const page = props.selectedPage;
                        if (!page) return false;
                        return (
                            page.secondaryPath === runePathIndex(path.id) &&
                            page.secondary.includes(rune.id)
                        );
                    }}
                    skipKeystones
                    title="Secondary Path"
                />
                <StatShardGrid
                    dataset={props.dataset}
                    entries={shards()}
                    selectedShards={props.selectedPage?.shards}
                />
            </div>
        </Show>
    );
};

const RunePathGrid: Component<{
    dataset: Dataset;
    entriesForRune: (rune: RuneRecord) => LolmixRecommendationEntry | undefined;
    paths: RunePathRecord[];
    selected: (path: RunePathRecord, rune: RuneRecord) => boolean;
    skipKeystones?: boolean;
    title: string;
}> = (props) => (
    <div>
        <div class="mb-2 text-xs uppercase text-neutral-400">{props.title}</div>
        <div class="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            <For each={props.paths}>
                {(path) => (
                    <div class="border border-neutral-800 p-2">
                        <div class="mb-2 text-xs uppercase text-neutral-300">
                            {path.name}
                        </div>
                        <div class="flex flex-col gap-1">
                            <For
                                each={runeSlotsForPath(
                                    path.id,
                                    props.dataset,
                                    props.skipKeystones,
                                )}
                            >
                                {(slot) => (
                                    <div
                                        class={cn("grid gap-1", {
                                            "grid-cols-4": slot.length === 4,
                                            "grid-cols-3": slot.length !== 4,
                                        })}
                                    >
                                        <For each={slot}>
                                            {(rune) => (
                                                <RuneMetricCell
                                                    entry={props.entriesForRune(
                                                        rune,
                                                    )}
                                                    name={rune.name}
                                                    selected={props.selected(
                                                        path,
                                                        rune,
                                                    )}
                                                />
                                            )}
                                        </For>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                )}
            </For>
        </div>
    </div>
);

const StatShardGrid: Component<{
    dataset: Dataset;
    entries: LolmixRecommendationEntry[];
    selectedShards: number[] | undefined;
}> = (props) => (
    <div>
        <div class="mb-2 text-xs uppercase text-neutral-400">Stat Shards</div>
        <div class="grid gap-3 md:grid-cols-3">
            <For each={[0, 1, 2] as const}>
                {(slot) => (
                    <div class="border border-neutral-800 p-2">
                        <div class="mb-2 text-xs uppercase text-neutral-300">
                            {SHARD_SLOT_LABELS[slot]}
                        </div>
                        <div class="grid grid-cols-3 gap-1">
                            <For each={statShardOptions(props.dataset, slot)}>
                                {(shard) => (
                                    <RuneMetricCell
                                        entry={statShardEntry(
                                            props.entries,
                                            slot,
                                            shard.name,
                                        )}
                                        name={shard.name}
                                        selected={
                                            props.selectedShards?.[slot] ===
                                            shard.id
                                        }
                                    />
                                )}
                            </For>
                        </div>
                    </div>
                )}
            </For>
        </div>
    </div>
);

const RuneMetricCell: Component<{
    entry: LolmixRecommendationEntry | undefined;
    name: string;
    selected?: boolean;
}> = (props) => (
    <div
        class={cn(
            "min-h-24 overflow-hidden border border-neutral-800 p-2",
            props.selected && "border-winrate-good bg-winrate-good/10",
        )}
        title={props.name}
    >
        <div class="min-h-8 text-xs font-semibold leading-tight text-neutral-100">
            {props.name}
        </div>
        <Show
            when={props.entry}
            fallback={<div class="text-xs uppercase text-neutral-600">-</div>}
        >
            {(entry) => (
                <>
                    <div
                        class={cn(
                            "text-xs uppercase",
                            lolmixWinrateTextClass(entry().combined_wr),
                        )}
                    >
                        WR {formatLolmixPercent(entry().combined_wr)}
                    </div>
                    <div class="text-xs uppercase text-neutral-400">
                        PR {formatLolmixPercent(entry().combined_pr)}
                    </div>
                    <div class="text-xs uppercase text-neutral-600">
                        N {formatLolmixCompactCount(entry().total_n_max)}
                    </div>
                </>
            )}
        </Show>
    </div>
);

const EntryBadge: Component<{ item: LolmixDisplayEntry }> = (props) => (
    <Show when={props.item.recommended || props.item.rare}>
        <span
            class={cn(
                "shrink-0 rounded px-1 py-px text-[10px] font-bold uppercase tracking-wide",
                props.item.recommended
                    ? "bg-ally/15 text-blue-300"
                    : "bg-amber-400/10 text-amber-300",
            )}
        >
            {props.item.recommended ? "Pick" : "Rare"}
        </span>
    </Show>
);

const EntryStats: Component<{
    entry: LolmixRecommendationEntry;
    class?: string;
    children?: JSX.Element;
}> = (props) => (
    <div
        class={cn(
            "flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs uppercase text-neutral-500",
            props.class,
        )}
    >
        <span>WR {formatLolmixPercent(props.entry.combined_wr)}</span>
        <span>PR {formatLolmixPercent(props.entry.combined_pr)}</span>
        {props.children}
    </div>
);

const ScoreChip: Component<{ value: number }> = (props) => (
    <span
        class={cn(
            "inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums",
            lolmixScoreClass(props.value),
            lolmixScoreToneClass(props.value),
        )}
        title={`Score ${formatLolmixSignedPercent(props.value)}`}
    >
        {formatLolmixSignedPercent(props.value)}
    </span>
);

const SamplePill: Component<{ value: number | undefined }> = (props) => {
    const confidence = () => lolmixSampleConfidence(props.value);
    const lowSample = () => confidence() === "low" || confidence() === "tiny";

    return (
        <span
            class={cn(
                "inline-flex items-center gap-1 text-[10px] uppercase tabular-nums",
                lowSample() ? "text-amber-300" : "text-neutral-500",
            )}
            title={`${formatLolmixCount(props.value ?? 0)} games sampled`}
        >
            <Show when={lowSample()}>
                <span>Low</span>
            </Show>
            n={formatLolmixCompactCount(props.value)}
        </span>
    );
};

const DeltaBar: Component<{ value: number; max?: number }> = (props) => {
    const max = () => props.max ?? 0.12;
    const clamped = () => Math.max(-max(), Math.min(max(), props.value));
    const width = () => (Math.abs(clamped()) / max()) * 50;
    const positive = () => clamped() >= 0;

    return (
        <div class="relative h-1.5 w-full overflow-hidden rounded-full bg-neutral-800/60">
            <div class="absolute left-1/2 top-0 h-full w-px bg-neutral-600/70" />
            <div
                class="absolute top-0 h-full rounded-full"
                style={{
                    width: `${width()}%`,
                    left: positive() ? "50%" : undefined,
                    right: positive() ? undefined : "50%",
                    "background-color": scoreColor(props.value),
                }}
            />
        </div>
    );
};

const ItemIcon: Component<{
    dataset: Dataset | undefined;
    itemId: number;
    small?: boolean;
}> = (props) => {
    const item = () => props.dataset?.itemData[props.itemId];

    return (
        <Show when={item()}>
            {(currentItem) => (
                <img
                    src={`https://ddragon.leagueoflegends.com/cdn/${props.dataset!.version}/img/item/${props.itemId}.png`}
                    alt={currentItem().name}
                    title={currentItem().name}
                    class={cn(
                        "shrink-0 rounded-sm ring-1 ring-neutral-700",
                        props.small ? "h-5 w-5" : "h-7 w-7",
                    )}
                />
            )}
        </Show>
    );
};

const EmptyState: Component<{ children: JSX.Element }> = (props) => (
    <div class="rounded-md border border-dashed border-neutral-800 px-3 py-4 text-center text-xs uppercase text-neutral-600">
        {props.children}
    </div>
);

function lolmixRunePageKeystoneName(
    raw: string,
    data: LolmixAnalyzeResponse,
    dataset: Dataset | undefined,
) {
    const readable = parseLolmixReadableRunePage(raw);
    if (readable?.keystone) return readable.keystone;

    const encoded = parseLolmixDisplayRunePageKey(raw);
    const keystoneId = encoded?.primary[0];
    if (keystoneId === undefined) return;

    return (
        dataset?.runeData[keystoneId]?.name ??
        lolmixSectionByName(data, "keystones")?.entries.find(
            (entry) => entry.id === keystoneId,
        )?.name
    );
}

function quickDecisionTiles(
    data: LolmixAnalyzeResponse,
    dataset: Dataset | undefined,
) {
    const tiles: {
        label: string;
        value: string;
        sub?: string;
        score?: number;
    }[] = [];

    const summoners = lolmixRecommendedEntry(
        lolmixSectionByName(data, "summoners"),
    );
    if (summoners) {
        tiles.push({
            label: "Summoners",
            value: summoners.name,
            sub: `WR ${formatLolmixPercent(summoners.combined_wr)} / PR ${formatLolmixPercent(summoners.combined_pr)}`,
            score: summoners.score,
        });
    }

    const rune = lolmixRecommendedEntry(
        lolmixSectionByName(data, "rune_page"),
        "combined_wr",
    );
    if (rune) {
        const keystone = lolmixRunePageKeystoneName(rune.name, data, dataset);
        const page = parseLolmixReadableRunePage(rune.name);
        tiles.push({
            label: keystone ? "Keystone" : "Rune page",
            value:
                keystone ??
                page?.primaryPathName ??
                page?.kind ??
                "Rune page",
            sub: `WR ${formatLolmixPercent(rune.combined_wr)} / PR ${formatLolmixPercent(rune.combined_pr)}`,
            score: rune.score,
        });
    }

    const starter = lolmixRecommendedEntry(
        lolmixSectionByName(data, "starters"),
    );
    if (starter) {
        tiles.push({
            label: "Starter",
            value: starter.name,
            sub: `WR ${formatLolmixPercent(starter.combined_wr)} / PR ${formatLolmixPercent(starter.combined_pr)}`,
            score: starter.score,
        });
    }

    const firstItem = lolmixBuildPathSteps(data.sections).find(
        (step) => step.section.name === "first_completed_item",
    )?.recommended;
    if (firstItem) {
        tiles.push({
            label: "First item",
            value: firstItem.name,
            sub: `WR ${formatLolmixPercent(firstItem.combined_wr)} / PR ${formatLolmixPercent(firstItem.combined_pr)}`,
            score: firstItem.score,
        });
    }

    const skillEarly = lolmixSectionByName(data, "skill_early");
    const levelOne = skillEarly?.entries
        .filter((entry) => lolmixSkillEarlyKey(entry)?.level === 1)
        .filter(isLolmixRecommendationEligible)
        .sort((left, right) => right.score - left.score)[0];
    if (levelOne) {
        tiles.push({
            label: "Level 1",
            value: lolmixSkillEarlyKey(levelOne)?.slot ?? levelOne.name,
            sub: "Skill",
            score: levelOne.score,
        });
    }

    return tiles;
}

function summonerSpellIds(entry: LolmixRecommendationEntry) {
    const first = Math.floor(entry.id / 10000);
    const second = entry.id % 10000;
    if (first <= 0 || second <= 0) return;

    return [first, second];
}

function splitEntryParts(name: string) {
    return name
        .split("+")
        .map((part) => part.trim())
        .filter(Boolean);
}

function scoreColor(value: number) {
    if (value >= 0.08) return "#ff9b00";
    if (value >= 0.03) return "#3273fa";
    if (value >= 0.005) return "#7ea4f4";
    if (value > -0.005) return "#fafafa";
    if (value > -0.03) return "#fcb1b2";
    return "#ff4e50";
}

function entryMap(entries: LolmixRecommendationEntry[]) {
    return new Map(entries.map((entry) => [entry.id, entry]));
}

function orderedRunePaths(dataset: Dataset) {
    const paths = Object.values(dataset.runePathData);
    return [
        ...RUNE_PATH_ORDER.map((id) => paths.find((path) => path.id === id)),
        ...paths
            .filter(
                (path) => !RUNE_PATH_ORDER.some((pathId) => pathId === path.id),
            )
            .sort((left, right) => left.id - right.id),
    ].filter((path): path is RunePathRecord => !!path);
}

function runeSlotsForPath(
    pathId: number,
    dataset: Dataset,
    skipKeystones?: boolean,
) {
    return [0, 1, 2, 3]
        .filter((slot) => !(skipKeystones && slot === 0))
        .map((slot) =>
            Object.values(dataset.runeData)
                .filter((rune) => rune.pathId === pathId && rune.slot === slot)
                .sort((left, right) => left.index - right.index),
        )
        .filter((slot) => slot.length > 0);
}

function statShardOptions(dataset: Dataset, slot: number) {
    return Object.values(dataset.statShardData)
        .map((shard) => ({
            shard,
            position: shard.positions.find(
                (position) => position.slot === slot,
            ),
        }))
        .filter(
            (
                option,
            ): option is {
                shard: StatShardRecord;
                position: { slot: number; index: number };
            } => !!option.position,
        )
        .sort((left, right) => left.position.index - right.position.index)
        .map((option) => option.shard);
}

function statShardEntry(
    entries: LolmixRecommendationEntry[],
    slot: number,
    shardName: string,
) {
    const slotLabel = SHARD_SLOT_LABELS[slot].toLowerCase();
    const normalizedShardName = shardName.toLowerCase();
    return entries.find((entry) => {
        const name = entry.name.toLowerCase();
        return name.includes(slotLabel) && name.includes(normalizedShardName);
    });
}

function runePathIndex(pathId: number) {
    const index = RUNE_PATH_ORDER.findIndex(
        (candidate) => candidate === pathId,
    );
    return index >= 0 ? index : undefined;
}
