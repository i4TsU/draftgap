import { Component, Match, Switch } from "solid-js";
import { RuneTable } from "./RuneTable";
import { useBuild } from "../../../contexts/BuildContext";
import { BootsStats } from "./BootsStats";
import { ItemStats } from "./ItemStats";
import { StarterItemStats } from "./StarterItemStats";
import { SummonerSpellsStats } from "./SummonerSpellsStats";
import { SkillStats } from "./SkillStats";
import { LolmixRecommendationsPanel } from "../../lolmix/LolmixRecommendationsPanel";

export const BuildView: Component = () => {
    const { query, buildAnalysisResult } = useBuild();
    const buildErrorMessage = () => {
        if (!query.error) return "Unknown error";
        if (query.error instanceof Error) return query.error.message;
        return String(query.error);
    };

    return (
        <div class="flex flex-col gap-12">
            <LolmixRecommendationsPanel />
            <Switch>
                <Match when={query.isLoading}>
                    <div class="text-neutral-50 text-2xl text-center py-12">
                        Loading...
                    </div>
                </Match>
                <Match when={query.isError}>
                    <div class="mx-auto max-w-2xl rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-center">
                        <div class="text-xl text-red-300">
                            Error while fetching DraftGap build data
                        </div>
                        <div class="mt-2 break-words font-body text-xs text-red-100/80">
                            {buildErrorMessage()}
                        </div>
                    </div>
                </Match>
                <Match when={query.isSuccess && buildAnalysisResult()}>
                    <div class="flex flex-col gap-16">
                        <div class="flex flex-col gap-8">
                            <h2 class="uppercase text-2xl font-semibold leading-none text-center">
                                Pre-game
                            </h2>
                            {/* <RecommendedBuild /> */}
                            <RuneTable />
                            <SummonerSpellsStats />
                        </div>
                        <div class="flex flex-col gap-8">
                            <h2 class="uppercase text-2xl font-semibold leading-none text-center">
                                In-game
                            </h2>
                            <StarterItemStats />
                            <SkillStats />
                            {/* <ItemSetStats /> */}
                            <BootsStats />
                            <ItemStats />
                        </div>
                    </div>
                </Match>
                <Match when={query.isSuccess && !buildAnalysisResult()}>
                    <div class="text-neutral-500 text-2xl text-center py-12">
                        Build data is unavailable for this champion and role.
                    </div>
                </Match>
            </Switch>
        </div>
    );
};
