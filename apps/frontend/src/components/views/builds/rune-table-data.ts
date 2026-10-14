export function availableRuneEntries<T extends { id: number }>(
    runes: T[] | undefined,
    analysis: Record<number, { totalRating: number }> | undefined,
    stats: Record<number, { games: number }> | undefined,
    totalGames: number | undefined,
) {
    if (!analysis || !stats || totalGames === undefined) return [];
    return (runes ?? []).flatMap((rune) => {
        const result = analysis[rune.id];
        const data = stats[rune.id];
        return result && data
            ? [
                  {
                      ...rune,
                      rating: result.totalRating,
                      games: data.games,
                      totalGames,
                  },
              ]
            : [];
    });
}

export function runePickRate(games: number, totalGames: number) {
    return totalGames > 0 ? games / totalGames : 0;
}
