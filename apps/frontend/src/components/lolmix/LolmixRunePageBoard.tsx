import { Component, For, Show, createMemo, createSignal } from "solid-js";
import type { Dataset } from "@draftgap/core/src/models/dataset/Dataset";
import type {
    LolmixAnalyzeResponse,
    LolmixRecommendationEntry,
} from "../../api/lolmix-api";
import { cn } from "../../utils/style";
import {
    formatLolmixCompactCount,
    formatLolmixPercent,
} from "./lolmix-display";
import { lolmixRuneVisuals, type RuneVisual } from "./lolmix-runes";

export const RuneImage: Component<{
    src: string | undefined;
    name: string;
    class?: string;
}> = (props) => {
    const [failedSrc, setFailedSrc] = createSignal<string>();
    return (
        <span
            class={cn(
                "inline-flex shrink-0 items-center justify-center",
                props.class,
            )}
        >
            <Show
                when={props.src && failedSrc() !== props.src}
                fallback={<span class="text-sm text-neutral-500">?</span>}
            >
                <img
                    src={props.src}
                    alt={props.name}
                    class="h-full w-full object-contain"
                    loading="lazy"
                    onError={() => setFailedSrc(props.src)}
                />
            </Show>
        </span>
    );
};

export const LolmixRunePageBoard: Component<{
    name: string;
    dataset: Dataset | undefined;
    data: LolmixAnalyzeResponse;
}> = (props) => {
    const page = createMemo(() => lolmixRuneVisuals(props.name, props.dataset));
    const entries = createMemo(
        () =>
            new Map(
                props.data.sections.map((section) => [
                    section.name,
                    section.entries,
                ]),
            ),
    );
    const metric = (section: string, rune: RuneVisual) =>
        entries()
            .get(section)
            ?.find((entry) => entry.id === rune.id || entry.name === rune.name);
    const shardMetric = (shard: RuneVisual, slot: number) => {
        const key = ["offense", "flex", "defense"][slot];
        return entries()
            .get("stat_shards")
            ?.find(
                (entry) =>
                    entry.name === `shard:${key}:${shard.id}` ||
                    entry.name
                        .toLowerCase()
                        .replace("movement speed", "move speed") ===
                        `${key}: ${shard.name}`.toLowerCase(),
            );
    };

    return (
        <Show
            when={
                page().primary.runes.length > 0 ||
                page().secondary.runes.length > 0 ||
                page().shards.length > 0
            }
            fallback={
                <p class="py-4 text-center text-xs text-neutral-500">
                    Rune details are unavailable for this response.
                </p>
            }
        >
            <div
                class="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2"
                aria-label="Selected rune page"
            >
                <For each={["primary", "secondary"] as const}>
                    {(type) => {
                        const path = () => page()[type];
                        const primary = type === "primary";
                        return (
                            <div
                                class="min-w-0 rounded-lg border bg-neutral-900/50 p-3"
                                style={{ "border-color": `${path().color}35` }}
                            >
                                <div class="mb-3 flex items-center gap-2.5">
                                    <RuneImage
                                        src={path().icon}
                                        name={path().name}
                                        class="h-7 w-7"
                                    />
                                    <div>
                                        <div class="text-[9px] font-semibold uppercase tracking-widest text-neutral-500">
                                            {type}
                                        </div>
                                        <div
                                            class="text-sm font-semibold"
                                            style={{ color: path().color }}
                                        >
                                            {path().name}
                                        </div>
                                    </div>
                                </div>
                                <div class="flex flex-col gap-1.5">
                                    <For each={path().runes}>
                                        {(rune, index) => (
                                            <RuneRow
                                                rune={rune}
                                                keystone={
                                                    primary && index() === 0
                                                }
                                                color={path().color}
                                                entry={metric(
                                                    primary
                                                        ? index() === 0
                                                            ? "keystones"
                                                            : "runes_primary"
                                                        : "runes_secondary",
                                                    rune,
                                                )}
                                            />
                                        )}
                                    </For>
                                </div>
                            </div>
                        );
                    }}
                </For>
                <Show when={page().shards.length > 0}>
                    <div class="min-w-0 border-t border-neutral-800/70 pt-3 sm:col-span-2">
                        <div class="mb-2 text-[9px] font-semibold uppercase tracking-widest text-neutral-500">
                            Stat shards
                        </div>
                        <div class="grid grid-cols-3 gap-2">
                            <For each={page().shards}>
                                {(shard, index) => (
                                    <div
                                        class="flex min-w-0 flex-col items-center gap-1 rounded-lg bg-neutral-900/70 px-1.5 py-2.5 text-center"
                                        title={metricTitle(
                                            shardMetric(shard, index()),
                                        )}
                                    >
                                        <RuneImage
                                            src={shard.icon}
                                            name={shard.name}
                                            class="h-8 w-8"
                                        />
                                        <span class="text-[9px] uppercase tracking-wide text-neutral-500">
                                            {
                                                ["Offense", "Flex", "Defense"][
                                                    index()
                                                ]
                                            }
                                        </span>
                                        <span class="text-[11px] leading-tight text-neutral-200">
                                            {shard.name}
                                        </span>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                </Show>
            </div>
        </Show>
    );
};

const RuneRow: Component<{
    rune: RuneVisual;
    keystone: boolean;
    color: string;
    entry: LolmixRecommendationEntry | undefined;
}> = (props) => (
    <div
        class={cn(
            "flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1.5",
            props.keystone && "mb-1 bg-neutral-800/60",
        )}
        title={metricTitle(props.entry)}
    >
        <RuneImage
            src={props.rune.icon}
            name={props.rune.name}
            class={props.keystone ? "h-12 w-12" : "h-8 w-8"}
        />
        <div class="min-w-0 flex-1">
            <Show when={props.keystone}>
                <div
                    class="mb-0.5 text-[9px] uppercase tracking-wider"
                    style={{ color: props.color }}
                >
                    Keystone
                </div>
            </Show>
            <div
                class={cn(
                    "text-xs leading-snug text-neutral-200",
                    props.keystone && "font-semibold text-neutral-100",
                )}
            >
                {props.rune.name}
            </div>
            <Show when={props.entry}>
                {(entry) => (
                    <div class="mt-0.5 text-[10px] tabular-nums text-neutral-500">
                        {formatLolmixPercent(
                            entry().context_wr ?? entry().combined_wr,
                        )} WR{" "}
                        <span class="mx-0.5 text-neutral-700">·</span>{" "}
                        {formatLolmixPercent(
                            entry().context_pr ?? entry().combined_pr,
                        )} pick
                    </div>
                )}
            </Show>
        </div>
    </div>
);

function metricTitle(entry: LolmixRecommendationEntry | undefined) {
    return entry
        ? `${formatLolmixPercent(entry.context_wr ?? entry.combined_wr)} win rate · ${formatLolmixPercent(entry.context_pr ?? entry.combined_pr)} pick rate · ${formatLolmixCompactCount(entry.total_n_max)} games (individual rune)`
        : undefined;
}
