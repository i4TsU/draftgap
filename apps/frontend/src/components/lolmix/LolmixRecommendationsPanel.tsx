import {
    Component,
    For,
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
import { Panel, PanelHeader } from "../common/Panel";
import {
    LOLMIX_SKILL_EARLY_LEVELS,
    LOLMIX_SKILL_EARLY_SLOTS,
    formatLolmixCount,
    formatLolmixPercent,
    formatLolmixSignedPercent,
    lolmixScoreClass,
    lolmixSampleSize,
    lolmixSectionTitle,
    lolmixSkillEarlyKey,
    lolmixUnavailableSetupHint,
    lolmixWinrateTextClass,
    lolmixWarningLines,
    parseLolmixRunePageKey,
    visibleLolmixEntries,
    visibleLolmixSections,
    type LolmixRunePage,
} from "./lolmix-display";

type Props = {
    state: LolmixRecommendationsState;
    connectionStatus: LolmixConnectionState["status"];
    host: string;
    port: number;
    onRefresh?: () => void;
};

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
                <Match when={props.state.status === "not-configured"}>
                    <StatusMessage tone="muted">
                        Configure lolmix-server to request optional
                        recommendations.
                    </StatusMessage>
                </Match>
                <Match when={props.state.status === "idle"}>
                    <StatusMessage tone="muted">
                        <Switch>
                            <Match
                                when={props.connectionStatus === "connected"}
                            >
                                Lolmix recommendations are ready to request.
                            </Match>
                            <Match when={true}>
                                Connect lolmix-server to request optional
                                recommendations.
                            </Match>
                        </Switch>
                    </StatusMessage>
                </Match>
                <Match when={props.state.status === "loading"}>
                    <StatusMessage tone="muted">
                        Loading lolmix recommendations...
                    </StatusMessage>
                </Match>
                <Match when={props.state.status === "unavailable"}>
                    <StatusMessage tone="warning">
                        {lolmixUnavailableSetupHint(props.host, props.port)}
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
    const { dataset } = useDataset();
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
                        {(section) => (
                            <Section
                                data={props.data}
                                dataset={dataset()}
                                section={section}
                            />
                        )}
                    </For>
                </div>
            </Show>
        </div>
    );
};

const Section: Component<{
    data: LolmixAnalyzeResponse;
    dataset: Dataset | undefined;
    section: LolmixRecommendationSection;
}> = (props) => {
    const entries = () => visibleLolmixEntries(props.section);
    const sectionTotalNMax = () =>
        Math.max(...entries().map((entry) => entry.total_n_max), 0);

    return (
        <section
            class={cn("min-w-0", {
                "xl:col-span-2":
                    props.section.name === "skill_early" ||
                    props.section.name === "rune_page",
            })}
        >
            <h3 class="uppercase text-lg font-semibold mb-2">
                {lolmixSectionTitle(props.section.name)}
            </h3>
            <Switch>
                <Match when={props.section.name === "skill_early"}>
                    <SkillEarlyGrid entries={entries()} />
                </Match>
                <Match when={props.section.name === "rune_page"}>
                    <RunePagePanel data={props.data} dataset={props.dataset} />
                </Match>
                <Match when={true}>
                    <div class="border-y border-neutral-800 divide-y divide-neutral-800">
                        <For each={entries()}>
                            {(entry) => (
                                <EntryRow
                                    entry={entry}
                                    sectionName={props.section.name}
                                    sectionTotalNMax={sectionTotalNMax()}
                                />
                            )}
                        </For>
                    </div>
                </Match>
            </Switch>
        </section>
    );
};

const EntryRow: Component<{
    entry: LolmixRecommendationEntry;
    sectionName: string;
    sectionTotalNMax: number;
}> = (props) => {
    const isWinningItems = () => props.sectionName === "winning_items";
    const sampleLine = () => {
        const share =
            props.sectionTotalNMax > 0
                ? ` / ${formatLolmixPercent(
                      props.entry.total_n_max / props.sectionTotalNMax,
                  )}`
                : "";
        return `N ${formatLolmixCount(props.entry.total_n_max)}${share}`;
    };

    return (
        <div class="py-2 grid gap-2 lg:grid-cols-[minmax(12rem,1fr)_minmax(20rem,auto)] lg:items-center">
            <div class="min-w-0">
                <div class="text-neutral-100 leading-tight whitespace-normal break-words">
                    {props.entry.name}
                </div>
                <div class="text-xs text-neutral-500 uppercase">
                    {sampleLine()}
                </div>
            </div>
            <div class="flex flex-wrap md:justify-end gap-x-3 gap-y-1 text-sm uppercase text-neutral-400">
                <Show
                    when={isWinningItems()}
                    fallback={
                        <span class={lolmixScoreClass(props.entry.score)}>
                            Score {formatLolmixSignedPercent(props.entry.score)}
                        </span>
                    }
                >
                    <span class={lolmixWinrateTextClass(props.entry.combined_wr)}>
                        Combined WR {formatLolmixPercent(props.entry.combined_wr)}
                    </span>
                </Show>
                <Show
                    when={isWinningItems()}
                    fallback={
                        <>
                            <span>
                                Base {formatLolmixPercent(props.entry.overall_wr)}{" "}
                                / {formatLolmixPercent(props.entry.overall_pr)}
                            </span>
                            <span>
                                Combined{" "}
                                {formatLolmixPercent(props.entry.combined_wr)} /{" "}
                                {formatLolmixPercent(props.entry.combined_pr)}
                            </span>
                        </>
                    }
                >
                    <span>
                        Base WR {formatLolmixPercent(props.entry.overall_wr)}
                    </span>
                    <span>
                        Base PR {formatLolmixPercent(props.entry.overall_pr)}
                    </span>
                    <span>
                        Combined PR {formatLolmixPercent(props.entry.combined_pr)}
                    </span>
                </Show>
            </div>
        </div>
    );
};

const SkillEarlyGrid: Component<{ entries: LolmixRecommendationEntry[] }> = (
    props,
) => {
    const lookup = createMemo(() => {
        const byKey = new Map<string, LolmixRecommendationEntry>();
        for (const entry of props.entries) {
            const key = lolmixSkillEarlyKey(entry);
            if (key) byKey.set(`${key.level}:${key.slot}`, entry);
        }
        return byKey;
    });
    const entryFor = (level: number, slot: string) =>
        lookup().get(`${level}:${slot}`);

    return (
        <div class="overflow-x-auto border-y border-neutral-800">
            <div class="grid min-w-[44rem] grid-cols-[3rem_repeat(4,minmax(9rem,1fr))]">
                <div class="border-b border-neutral-800 p-2 text-sm uppercase text-neutral-500">
                    Lv
                </div>
                <For each={LOLMIX_SKILL_EARLY_SLOTS}>
                    {(slot) => (
                        <div class="border-b border-neutral-800 p-2 text-sm uppercase text-neutral-300">
                            {slot}
                        </div>
                    )}
                </For>
                <For each={LOLMIX_SKILL_EARLY_LEVELS}>
                    {(level) => (
                        <>
                            <div class="border-t border-neutral-800 p-2 text-neutral-300">
                                {level}
                            </div>
                            <For each={LOLMIX_SKILL_EARLY_SLOTS}>
                                {(slot) => (
                                    <SkillCell entry={entryFor(level, slot)} />
                                )}
                            </For>
                        </>
                    )}
                </For>
            </div>
        </div>
    );
};

const SkillCell: Component<{ entry: LolmixRecommendationEntry | undefined }> = (
    props,
) => (
    <div class="min-h-20 border-t border-neutral-800 p-2">
        <Show
            when={props.entry}
            fallback={<div class="text-neutral-600">-</div>}
        >
            {(entry) => (
                <>
                    <div class={cn("text-sm", lolmixScoreClass(entry().score))}>
                        {formatLolmixSignedPercent(entry().score)}
                    </div>
                    <div class="text-xs uppercase text-neutral-400">
                        WR {formatLolmixPercent(entry().overall_wr)}
                    </div>
                    <div class="text-xs uppercase text-neutral-500">
                        PR {formatLolmixPercent(entry().overall_pr)}
                    </div>
                    <div class="text-xs uppercase text-neutral-600">
                        N {formatLolmixCount(lolmixSampleSize(entry()))}
                    </div>
                </>
            )}
        </Show>
    </div>
);

type RunePageTab = "overview" | "highest-win" | "most-picked";
type ParsedRunePageEntry = {
    entry: LolmixRecommendationEntry;
    page: LolmixRunePage;
};

const RUNE_PATH_ORDER = [8000, 8100, 8200, 8400, 8300] as const;
const SHARD_SLOT_LABELS = ["Offense", "Flex", "Defense"] as const;

const RunePagePanel: Component<{
    data: LolmixAnalyzeResponse;
    dataset: Dataset | undefined;
}> = (props) => {
    const [selectedTab, setSelectedTab] = createSignal<RunePageTab>("overview");
    const sections = createMemo(
        () =>
            new Map(
                props.data.sections.map((section) => [section.name, section]),
            ),
    );
    const entriesFor = (name: string) => sections().get(name)?.entries ?? [];
    const parsedPages = createMemo(() =>
        entriesFor("rune_page")
            .map((entry) => {
                const page = parseLolmixRunePageKey(entry.name);
                return page ? { entry, page } : undefined;
            })
            .filter((page): page is ParsedRunePageEntry => !!page),
    );
    const highestWin = createMemo(() =>
        maxBy(parsedPages(), (page) => [
            page.entry.combined_wr,
            page.entry.score,
            page.entry.total_n_max,
            page.entry.combined_pr,
        ]),
    );
    const mostPicked = createMemo(() =>
        maxBy(parsedPages(), (page) => [
            page.entry.combined_pr,
            page.entry.overall_pr,
            page.entry.total_n_max,
            page.entry.combined_wr,
        ]),
    );
    const tabs = createMemo(() => [
        { value: "overview" as const, label: "Overview", page: undefined },
        ...(highestWin()
            ? [
                  {
                      value: "highest-win" as const,
                      label: "Highest WR",
                      page: highestWin(),
                  },
              ]
            : []),
        ...(mostPicked()
            ? [
                  {
                      value: "most-picked" as const,
                      label: "Most Picked",
                      page: mostPicked(),
                  },
              ]
            : []),
    ]);
    const activePage = () =>
        tabs().find((tab) => tab.value === selectedTab())?.page;

    return (
        <div class="border-y border-neutral-800 py-3">
            <Show when={tabs().length > 1}>
                <div class="mb-3 flex flex-wrap gap-2">
                    <For each={tabs()}>
                        {(tab) => (
                            <button
                                class={cn(
                                    "border border-neutral-800 px-3 py-1 text-sm uppercase text-neutral-400 hover:text-neutral-100",
                                    {
                                        "border-neutral-500 text-neutral-100":
                                            selectedTab() === tab.value,
                                    },
                                )}
                                onClick={() => setSelectedTab(tab.value)}
                            >
                                {tab.label}
                            </button>
                        )}
                    </For>
                </div>
            </Show>
            <Show when={activePage()}>
                {(page) => <RunePageSummary entry={page().entry} />}
            </Show>
            <Show
                when={props.dataset}
                fallback={
                    <div class="text-neutral-500 uppercase">
                        Rune data is loading.
                    </div>
                }
            >
                {(dataset) => (
                    <RuneMetricsBoard
                        dataset={dataset()}
                        entriesFor={entriesFor}
                        selectedPage={activePage()?.page}
                    />
                )}
            </Show>
        </div>
    );
};

const RunePageSummary: Component<{ entry: LolmixRecommendationEntry }> = (
    props,
) => (
    <div class="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm uppercase text-neutral-400">
        <span class={lolmixWinrateTextClass(props.entry.combined_wr)}>
            Combined WR {formatLolmixPercent(props.entry.combined_wr)}
        </span>
        <span>Combined PR {formatLolmixPercent(props.entry.combined_pr)}</span>
        <span>Score {formatLolmixSignedPercent(props.entry.score)}</span>
        <span>N {formatLolmixCount(props.entry.total_n_max)}</span>
    </div>
);

const RuneMetricsBoard: Component<{
    dataset: Dataset;
    entriesFor: (name: string) => LolmixRecommendationEntry[];
    selectedPage: LolmixRunePage | undefined;
}> = (props) => {
    const keystones = createMemo(() => entryMap(props.entriesFor("keystones")));
    const primary = createMemo(() => entryMap(props.entriesFor("runes_primary")));
    const secondary = createMemo(() =>
        entryMap(props.entriesFor("runes_secondary")),
    );
    const shards = () => props.entriesFor("stat_shards");
    const paths = createMemo(() => orderedRunePaths(props.dataset));

    return (
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
    );
};

type RuneRecord = Dataset["runeData"][number];
type RunePathRecord = Dataset["runePathData"][number];
type StatShardRecord = Dataset["statShardData"][number];

const RunePathGrid: Component<{
    dataset: Dataset;
    entriesForRune: (rune: RuneRecord) => LolmixRecommendationEntry | undefined;
    paths: RunePathRecord[];
    selected: (path: RunePathRecord, rune: RuneRecord) => boolean;
    skipKeystones?: boolean;
    title: string;
}> = (props) => (
    <div>
        <div class="mb-2 uppercase text-neutral-400">{props.title}</div>
        <div class="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            <For each={props.paths}>
                {(path) => (
                    <div class="border border-neutral-800 p-2">
                        <div class="mb-2 text-sm uppercase text-neutral-300">
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
        <div class="mb-2 uppercase text-neutral-400">Stat Shards</div>
        <div class="grid gap-3 md:grid-cols-3">
            <For each={[0, 1, 2] as const}>
                {(slot) => (
                    <div class="border border-neutral-800 p-2">
                        <div class="mb-2 text-sm uppercase text-neutral-300">
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
            "min-h-24 border border-neutral-800 p-2 overflow-hidden",
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
                        N {formatLolmixCount(entry().total_n_max)}
                    </div>
                </>
            )}
        </Show>
    </div>
);

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
            .sort((a, b) => a.id - b.id),
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
                .filter(
                    (rune) => rune.pathId === pathId && rune.slot === slot,
                )
                .sort((a, b) => a.index - b.index),
        )
        .filter((slot) => slot.length > 0);
}

function statShardOptions(dataset: Dataset, slot: number) {
    return Object.values(dataset.statShardData)
        .map((shard) => ({
            shard,
            position: shard.positions.find((position) => position.slot === slot),
        }))
        .filter(
            (
                option,
            ): option is {
                shard: StatShardRecord;
                position: { slot: number; index: number };
            } => !!option.position,
        )
        .sort((a, b) => a.position.index - b.position.index)
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
    const index = RUNE_PATH_ORDER.findIndex((candidate) => candidate === pathId);
    return index >= 0 ? index : undefined;
}

function maxBy<T>(items: T[], values: (item: T) => number[]) {
    let best: T | undefined;
    let bestValues: number[] | undefined;
    for (const item of items) {
        const current = values(item);
        if (!bestValues || compareNumberLists(current, bestValues) > 0) {
            best = item;
            bestValues = current;
        }
    }
    return best;
}

function compareNumberLists(left: number[], right: number[]) {
    const count = Math.max(left.length, right.length);
    for (let index = 0; index < count; index += 1) {
        const diff = (left[index] ?? 0) - (right[index] ?? 0);
        if (diff !== 0) return diff;
    }
    return 0;
}
