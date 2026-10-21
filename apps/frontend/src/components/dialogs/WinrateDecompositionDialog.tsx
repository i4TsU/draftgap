import { Component, Show } from "solid-js";
import { SummaryCard } from "../views/analysis/SummaryCards";
import { hashtag, presentationChartLine } from "solid-heroicons/solid";
import { winrateToRating } from "@draftgap/core/src/rating/ratings";
import { DialogContent, DialogHeader, DialogTitle } from "../common/Dialog";

type Props = {
    data: {
        rating: number;
        games: number;
        wins: number;
        weightedRating?: number;
    };
};

export const WinrateDecompositionDialog: Component<Props> = (props) => {
    return (
        <DialogContent class="max-w-3xl">
            <DialogHeader>
                <DialogTitle>Winrate Decomposition</DialogTitle>
            </DialogHeader>
            <div
                class="grid overflow-hidden rounded-lg bg-primary"
                classList={{
                    "grid-cols-2": props.data.weightedRating === undefined,
                    "sm:grid-cols-3": props.data.weightedRating === undefined,
                    "grid-cols-1 sm:grid-cols-2":
                        props.data.weightedRating !== undefined,
                }}
            >
                <Show when={props.data.weightedRating !== undefined}>
                    <SummaryCard
                        class="py-2!"
                        icon={presentationChartLine}
                        title="Draft contribution"
                        rating={props.data.weightedRating}
                        tooltip={
                            <>
                                This matchup's contribution after lane
                                weighting. Direct opponents receive more weight
                                than cross-role opponents. Contributions add
                                together in rating space before conversion to a
                                percentage.
                            </>
                        }
                    />
                </Show>
                <SummaryCard
                    class="py-2!"
                    icon={presentationChartLine}
                    title={
                        props.data.weightedRating !== undefined
                            ? "Matchup winrate"
                            : "Draftgap winrate"
                    }
                    rating={props.data.rating}
                    tooltip={
                        <>
                            Winrate draftgap uses in the model, more
                            conservative than the real winrate. This winrate
                            will heavily change depending on the risk level.
                            {props.data.weightedRating !== undefined &&
                                " This is the matchup winrate before lane weighting."}
                        </>
                    }
                />
                <SummaryCard
                    class="py-2!"
                    icon={presentationChartLine}
                    title="Observed winrate"
                    rating={winrateToRating(props.data.wins / props.data.games)}
                    tooltip={
                        <>
                            Raw normalized winrate from the sample of games from
                            the dataset.
                        </>
                    }
                />
                <SummaryCard
                    class="py-2!"
                    icon={hashtag}
                    title="Observed games"
                    number={Math.ceil(props.data.games)}
                    tooltip={
                        <>Number of games in the sample from the dataset.</>
                    }
                />
            </div>
        </DialogContent>
    );
};
