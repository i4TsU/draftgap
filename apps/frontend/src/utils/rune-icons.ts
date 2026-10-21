// Riot's perk IDs are stable; shard names/keys in older datasets contain
// misspellings and do not always match the actual asset filenames.
export const STAT_SHARD_VISUALS: Record<
    number,
    { name: string; icon: string }
> = {
    5001: { name: "Health Scaling", icon: "HealthPlus" },
    5005: { name: "Attack Speed", icon: "AttackSpeed" },
    5007: { name: "Ability Haste", icon: "CDRScaling" },
    5008: { name: "Adaptive Force", icon: "AdaptiveForce" },
    5010: { name: "Move Speed", icon: "MovementSpeed" },
    5011: { name: "Health", icon: "HealthScaling" },
    5013: { name: "Tenacity and Slow Resist", icon: "Tenacity" },
};

export function runeIconUrl(icon: string | undefined) {
    if (!icon) return;
    return `https://ddragon.leagueoflegends.com/cdn/img/${icon}`;
}

export function shardIconUrl(id: number) {
    const shard = STAT_SHARD_VISUALS[id];
    if (!shard) return;
    return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/statmods/statmods${shard.icon.toLowerCase()}icon.png`;
}
