import {
    runeIconUrl,
    shardIconUrl,
    STAT_SHARD_VISUALS,
} from "../../utils/rune-icons";
import type { Dataset } from "@draftgap/core/src/models/dataset/Dataset";
import {
    parseLolmixDisplayRunePageKey,
    parseLolmixReadableRunePage,
} from "./lolmix-display";

const PATH_IDS = [8000, 8100, 8200, 8400, 8300];
const PATH_COLORS: Record<number, string> = {
    8000: "#d9bb6b",
    8100: "#e66c76",
    8200: "#a58be0",
    8400: "#88ba71",
    8300: "#70bbc7",
};

export type RuneVisual = {
    id: number | undefined;
    name: string;
    icon: string | undefined;
};

const normalize = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]/g, "");

export function lolmixRuneVisuals(raw: string, dataset: Dataset | undefined) {
    const encoded = parseLolmixDisplayRunePageKey(raw);
    const readable = parseLolmixReadableRunePage(raw);
    const runes = Object.values(dataset?.runeData ?? {});
    const paths = Object.values(dataset?.runePathData ?? {});

    const path = (index: number | undefined, name: string | undefined) => {
        const record =
            index !== undefined
                ? dataset?.runePathData[PATH_IDS[index] ?? index]
                : paths.find(
                      (path) => normalize(path.name) === normalize(name ?? ""),
                  );
        return {
            name: record?.name ?? name ?? "Unknown path",
            icon: runeIconUrl(record?.icon),
            color: PATH_COLORS[record?.id ?? 0] ?? "#a3a3a3",
        };
    };

    const rune = (value: number | string): RuneVisual => {
        const record =
            typeof value === "number"
                ? dataset?.runeData[value]
                : runes.find(
                      (rune) => normalize(rune.name) === normalize(value),
                  );
        return {
            id: record?.id ?? (typeof value === "number" ? value : undefined),
            name:
                record?.name ??
                (typeof value === "number" ? `Rune ${value}` : value),
            icon: runeIconUrl(record?.icon),
        };
    };

    const shard = (value: number | string): RuneVisual => {
        const id =
            typeof value === "number"
                ? value
                : Number(
                      Object.keys(STAT_SHARD_VISUALS).find((key) => {
                          const name = normalize(value)
                              .replace("movementspeed", "movespeed")
                              .replace("tenactiy", "tenacity");
                          return (
                              normalize(
                                  STAT_SHARD_VISUALS[Number(key)].name,
                              ) === name
                          );
                      }),
                  );
        return {
            id: Number.isFinite(id) ? id : undefined,
            name: STAT_SHARD_VISUALS[id]?.name ?? String(value),
            icon: shardIconUrl(id),
        };
    };

    return {
        primary: {
            ...path(encoded?.primaryPath, readable?.primaryPathName),
            runes: (encoded?.primary ?? readable?.primaryRunes ?? []).map(rune),
        },
        secondary: {
            ...path(encoded?.secondaryPath, readable?.secondaryPathName),
            runes: (encoded?.secondary ?? readable?.secondaryRunes ?? []).map(
                rune,
            ),
        },
        shards: (encoded?.shards ?? readable?.shards ?? []).map(shard),
    };
}
