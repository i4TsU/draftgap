import { Component, For, Show, createMemo } from "solid-js";
import { Panel, PanelHeader } from "../../common/Panel";
import {
    RuneData,
    StatShardData,
} from "@draftgap/core/src/models/dataset/RuneData";
import { formatPercentage, getRatingClass } from "../../../utils/rating";
import { ratingToWinrate } from "@draftgap/core/src/rating/ratings";
import { useBuild } from "../../../contexts/BuildContext";
import { useDataset } from "../../../contexts/DatasetContext";

export const RuneTable: Component = () => {
    const { dataset } = useDataset();

    const paths = () =>
        Object.keys(dataset()!.runePathData).map((str) => parseInt(str));

    return (
        <Panel>
            <PanelHeader>Runes</PanelHeader>
            <div class="flex gap-4 justify-between flex-wrap max-w-7xl">
                <For each={paths()}>
                    {(pathId) => (
                        <div class="flex flex-col gap-4">
                            <PathTable pathId={pathId} type="primary" />
                            <PathTable pathId={pathId} type="secondary" />
                        </div>
                    )}
                </For>
                <ShardTable />
            </div>
        </Panel>
    );
};

type PathTableProps = {
    pathId: number;
    type: "primary" | "secondary";
};

export const PathTable: Component<PathTableProps> = (props) => {
    const { dataset } = useDataset();

    const { buildAnalysisResult, partialBuildDataset } = useBuild();

    const runes = () =>
        Object.values(dataset()!.runeData).filter(
            (r) => r.pathId === props.pathId,
        );
    const runesBySlot = createMemo(() => {
        const result = new Map<number, RuneData[]>();

        for (const rune of runes()) {
            if (!result.has(rune.slot)) {
                result.set(rune.slot, []);
            }
            result.get(rune.slot)!.push(rune);
        }

        for (const slot of result.keys()) {
            result.set(
                slot,
                result.get(slot)!.sort((a, b) => a.index - b.index),
            );
        }

        return result;
    });

    const availableRunes = (slot: number) => {
        const analysis = buildAnalysisResult()?.runes[props.type];
        const buildData = partialBuildDataset();
        if (!analysis || !buildData) return [];

        return (runesBySlot().get(slot) ?? []).flatMap((rune) => {
            const result = analysis[rune.id];
            const stats = buildData.runes[props.type][rune.id];
            return result && stats
                ? [
                      {
                          id: rune.id,
                          rating: result.totalRating,
                          games: stats.games,
                          totalGames: buildData.games,
                      },
                  ]
                : [];
        });
    };

    return (
        <div>
            <Show when={props.type === "primary"}>
                <h3 class="uppercase mb-2 min-w-[184px] relative">
                    {dataset()!.runePathData[props.pathId].name}
                </h3>
            </Show>
            <div class="bg-[#141414] p-2 rounded-md flex flex-col gap-2 relative">
                <Show when={props.type === "primary"}>
                    <div class="flex gap-2 justify-between mb-2 min-w-[184px]">
                        <For each={availableRunes(0)}>
                            {(rune) => (
                                <Rune
                                    runeId={rune.id}
                                    rating={rune.rating}
                                    games={rune.games}
                                    totalGames={rune.totalGames}
                                    type={props.type}
                                />
                            )}
                        </For>
                    </div>
                </Show>
                <For
                    each={[...runesBySlot().keys()]
                        .filter((i) => i !== 0)
                        .sort()}
                >
                    {(slot) => (
                        <div class="flex gap-2 justify-between min-w-[184px]">
                            <For each={availableRunes(slot)}>
                                {(rune) => (
                                    <Rune
                                        runeId={rune.id}
                                        rating={rune.rating}
                                        games={rune.games}
                                        totalGames={rune.totalGames}
                                        type={props.type}
                                    />
                                )}
                            </For>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
};

export const ShardTable: Component = () => {
    const { dataset } = useDataset();
    const { buildAnalysisResult, partialBuildDataset } = useBuild();

    const shards = () => Object.values(dataset()!.statShardData);

    const shardsByPosition = createMemo(() => {
        const result = new Map<number, Map<number, StatShardData>>();

        for (const shard of shards()) {
            for (const position of shard.positions) {
                if (!result.has(position.slot)) {
                    result.set(position.slot, new Map());
                }

                result.get(position.slot)!.set(position.index, shard);
            }
        }

        return result;
    });

    const availableShards = (
        slot: number,
        shardType: "offense" | "flex" | "defense",
    ) => {
        const analysis = buildAnalysisResult()?.runes.shards[shardType];
        const buildData = partialBuildDataset();
        if (!analysis || !buildData) return [];

        return [...(shardsByPosition().get(slot)?.entries() ?? [])]
            .sort(([left], [right]) => left - right)
            .flatMap(([index, shard]) => {
                const result = analysis[shard.id];
                const stats = buildData.runes.shards[shardType][shard.id];
                return result && stats
                    ? [
                          {
                              index,
                              id: shard.id,
                              rating: result.totalRating,
                              games: stats.games,
                              totalGames: buildData.games,
                          },
                      ]
                    : [];
            });
    };

    return (
        <div>
            <h3 class="uppercase mb-2 min-w-[184px]">Shards</h3>
            <div class="bg-[#141414] p-2 rounded-md flex flex-col gap-2 relative">
                <For
                    each={
                        [
                            [0, "offense"],
                            [1, "flex"],
                            [2, "defense"],
                        ] as const
                    }
                >
                    {([slot, shardType]) => {
                        return (
                            <div class="grid grid-cols-3 gap-2 min-w-[184px] justify-items-center">
                                <For each={availableShards(slot, shardType)}>
                                    {(shard) => (
                                        <div
                                            style={{
                                                "grid-column": String(
                                                    shard.index + 1,
                                                ),
                                            }}
                                        >
                                            <Rune
                                                runeId={shard.id}
                                                rating={shard.rating}
                                                games={shard.games}
                                                totalGames={shard.totalGames}
                                                type={`shard-${shardType}`}
                                            />
                                        </div>
                                    )}
                                </For>
                            </div>
                        );
                    }}
                </For>
            </div>
        </div>
    );
};

type RuneProps = {
    runeId: number;
    type:
        | "primary"
        | "secondary"
        | "shard-offense"
        | "shard-flex"
        | "shard-defense";
    rating: number;
    games: number;
    totalGames: number;
};

export const Rune: Component<RuneProps> = (props) => {
    const { dataset } = useDataset();
    const { setSelectedEntity } = useBuild();

    const isRune = () => props.type.startsWith("shard-") === false;
    const rune = () => dataset()!.runeData[props.runeId];
    const shard = () => dataset()!.statShardData[props.runeId];
    const pickRate = () =>
        props.totalGames > 0 ? props.games / props.totalGames : 0;

    const imgUrl = () =>
        isRune()
            ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/${rune().icon.toLowerCase()}`
            : `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/statmods/statmods${shard().key.toLocaleLowerCase()}icon.png`;

    return (
        <button
            class="flex flex-col items-center justify-center gap-1 text-xs"
            classList={{
                "opacity-20": pickRate() < 0.01,
            }}
            onClick={() =>
                setSelectedEntity({
                    type: "rune",
                    runeType: props.type,
                    id: props.runeId,
                })
            }
        >
            <img
                src={imgUrl()}
                alt={isRune() ? rune().name : shard().name}
                classList={{
                    "w-7 h-7": !isRune() || rune().slot !== 0,
                    "w-10 h-10 -mb-1": isRune() && rune().slot === 0,
                }}
            />
            <span class={getRatingClass(props.rating)}>
                {formatPercentage(ratingToWinrate(props.rating))}
            </span>
            <span class="text-neutral-500">{formatPercentage(pickRate())}</span>
        </button>
    );
};
